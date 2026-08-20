#!/usr/bin/env node
/**
 * Builds the OpenAPI spec from the @openapi JSDoc blocks in src/routes/*.js
 * and writes it to two places:
 *
 *   - src/openapi.json — the machine-readable spec, served at runtime by
 *     swagger-ui-express (see src/server.js). Lives inside src/ so it ships
 *     in the Docker image without a separate COPY line.
 *   - docs/API.md — a human-readable Markdown reference rendered from the
 *     same spec, for anyone browsing the repo instead of hitting /api/docs.
 *
 * Both files are generated, not hand-maintained — edit the JSDoc blocks on
 * the routes themselves, then run `npm run docs:generate`. CI (see
 * .github/workflows/ci.yml) regenerates and diffs both files on every push,
 * so a route change without a regeneration fails the lint job instead of
 * silently drifting.
 *
 * Usage: node scripts/generate-docs.js
 */
const fs = require("node:fs");
const path = require("node:path");
const swaggerJsdoc = require("swagger-jsdoc");
const prettier = require("prettier");
const { swaggerJsdocOptions } = require("../src/config/swagger.config");

const REPO_ROOT = path.join(__dirname, "..");
const OPENAPI_JSON_PATH = path.join(REPO_ROOT, "src", "openapi.json");
const API_MD_PATH = path.join(REPO_ROOT, "docs", "API.md");

const METHOD_ORDER = ["get", "post", "put", "patch", "delete"];

// Response entries commonly reference a shared definition (e.g.
// `{ $ref: '#/components/responses/Unauthorized' }`) rather than inlining
// one — that $ref is deliberately left unresolved in the spec itself (the
// whole point of a $ref), but the Markdown renderer needs the real object
// to pull a description/example out of.
const resolveRef = (spec, refOrObject) => {
	if (!refOrObject?.$ref) return refOrObject;
	const segments = refOrObject.$ref.replace(/^#\//, "").split("/");
	return segments.reduce((node, segment) => node[segment], spec);
};

const typeLabel = (schema) => {
	if (!schema) return "";
	if (schema.$ref) return schema.$ref.split("/").pop();
	if (schema.type === "array") return `${typeLabel(schema.items)}[]`;
	if (schema.enum) return schema.enum.map((v) => `"${v}"`).join(" \\| ");
	return schema.type || "";
};

const renderParamsTable = (parameters = []) => {
	if (!parameters.length) return "";
	const rows = parameters.map((p) => {
		const schema = p.schema || {};
		const defaultValue = schema.default !== undefined ? `\`${schema.default}\`` : "";
		return `| \`${p.name}\` | ${p.in} | ${typeLabel(schema)} | ${p.required ? "yes" : "no"} | ${defaultValue} | ${p.description || ""} |`;
	});
	return [
		"| Param | In | Type | Required | Default | Description |",
		"| --- | --- | --- | --- | --- | --- |",
		...rows,
	].join("\n");
};

const renderRequestBody = (requestBody) => {
	if (!requestBody) return "";
	const content = requestBody.content?.["application/json"];
	if (!content?.schema) return "";
	const schema = content.schema;
	const properties = schema.properties || {};
	const required = new Set(schema.required || []);
	const rows = Object.entries(properties).map(([name, propSchema]) => {
		return `| \`${name}\` | ${typeLabel(propSchema)} | ${required.has(name) ? "yes" : "no"} | ${propSchema.description || ""} |`;
	});
	if (!rows.length) return "";
	return [
		"**Request body:**",
		"",
		"| Field | Type | Required | Description |",
		"| --- | --- | --- | --- |",
		...rows,
	].join("\n");
};

const renderResponses = (spec, responses = {}) => {
	const rows = Object.entries(responses).map(([code, rawDef]) => {
		const def = resolveRef(spec, rawDef);
		return `| ${code} | ${def.description || ""} |`;
	});
	if (!rows.length) return "";
	return ["**Responses:**", "", "| Status | Description |", "| --- | --- |", ...rows].join("\n");
};

const renderExamples = (spec, responses = {}) => {
	const blocks = [];
	for (const [code, rawDef] of Object.entries(responses)) {
		const def = resolveRef(spec, rawDef);
		const example = def.content?.["application/json"]?.example;
		if (example) {
			blocks.push(
				`\`\`\`json\n// ${code} — ${def.description || ""}\n${JSON.stringify(example, null, 2)}\n\`\`\``
			);
		}
	}
	return blocks.join("\n\n");
};

const renderOperation = (spec, opPath, method, operation) => {
	const parts = [`### ${method.toUpperCase()} ${opPath}`, ""];

	const isPublic = Array.isArray(operation.security) && operation.security.length === 0;
	parts.push(`**Access:** ${isPublic ? "Public" : "Authenticated (Bearer JWT)"}`);
	parts.push("");

	if (operation.description) {
		parts.push(operation.description.trim());
		parts.push("");
	}

	const paramsTable = renderParamsTable(operation.parameters);
	if (paramsTable) {
		parts.push(paramsTable, "");
	}

	const requestBodyTable = renderRequestBody(operation.requestBody);
	if (requestBodyTable) {
		parts.push(requestBodyTable, "");
	}

	const responsesTable = renderResponses(spec, operation.responses);
	if (responsesTable) {
		parts.push(responsesTable, "");
	}

	const examples = renderExamples(spec, operation.responses);
	if (examples) {
		parts.push(examples, "");
	}

	return parts.join("\n");
};

const renderMarkdown = (spec) => {
	const preamble = `# API Reference

> Generated by \`npm run docs:generate\` from the \`@openapi\` JSDoc blocks in
> \`src/routes/*.routes.js\` — do not hand-edit this file. Change the route
> annotations and regenerate instead. An interactive version of this same
> spec is served at \`/api/docs\` whenever the server is running.

Base URL: \`${spec.servers[0].url}\` (configurable via \`PORT\`)

## Authentication

Protected endpoints require a JWT in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

${spec.components.securitySchemes.bearerAuth.description}

## Response envelope

All endpoints respond with JSON in a consistent shape:

\`\`\`json
{
  "success": true,
  "message": "Human-readable summary",
  "data": {},
  "pagination": {}
}
\`\`\`

Errors:

\`\`\`json
{
  "success": false,
  "message": "What went wrong",
  "error": "Detail (omitted in production for 500s)"
}
\`\`\`

### Status codes

| Code | Meaning |
| --- | --- |
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized (missing/invalid/expired/revoked token) |
| 403 | Forbidden (authenticated, wrong role/owner) |
| 404 | Not found |
| 409 | Conflict (duplicate, business rule violation) |
| 429 | Rate limited |
| 500 | Internal server error |

### Pagination

Applies to every list endpoint. Response includes:

\`\`\`json
"pagination": {
  "current_page": 1,
  "total_pages": 5,
  "total_items": 47,
  "items_per_page": 10,
  "has_next": true,
  "has_prev": false
}
\`\`\`

### Rate limits

Two layers, both active on every \`/api/*\` request:

- A flat, IP-based backstop: 100 requests / 15 min (\`express-rate-limit\`).
- A role-aware limit, requests/minute, backed by Redis when \`REDIS_URL\` is
  set (falls back to in-process otherwise — see \`docs/SETUP.md\`):

| Role | Limit |
| --- | --- |
| Guest | 20 req / min |
| User | 60 req / min |
| Librarian | 120 req / min |
| Admin | 300 req / min |

Disabled entirely under \`NODE_ENV=test\` so the automated test suite isn't
flaky against shared per-minute buckets — see the manual \`curl\` procedures in
[\`SECURITY_TESTING.md\`](SECURITY_TESTING.md) to exercise this for real.

---
`;

	const sections = spec.tags.map((tag) => {
		const operations = [];
		for (const [opPath, methods] of Object.entries(spec.paths)) {
			for (const method of METHOD_ORDER) {
				const operation = methods[method];
				if (operation && operation.tags?.includes(tag.name)) {
					operations.push({ opPath, method, operation });
				}
			}
		}
		operations.sort(
			(a, b) => a.opPath.localeCompare(b.opPath) || a.method.localeCompare(b.method)
		);

		const body = operations
			.map(({ opPath, method, operation }) =>
				renderOperation(spec, opPath, method, operation)
			)
			.join("\n---\n\n");

		return `## ${tag.name}\n\n${tag.description}\n\n${body}`;
	});

	return `${preamble}\n${sections.join("\n\n---\n\n")}\n`;
};

async function run() {
	const spec = swaggerJsdoc(swaggerJsdocOptions);
	// resolveConfig is required — prettier.format() doesn't read .prettierrc
	// on its own just because a `filepath` was given, so without this the
	// generated files would come out in Prettier's own defaults (2-space,
	// no tabs) instead of this repo's config, and immediately fail
	// `npm run format:check`.
	const projectConfig = (await prettier.resolveConfig(OPENAPI_JSON_PATH)) || {};

	const specJson = `${JSON.stringify(spec, null, "\t")}\n`;
	const formattedJson = await prettier.format(specJson, {
		...projectConfig,
		filepath: OPENAPI_JSON_PATH,
	});
	fs.writeFileSync(OPENAPI_JSON_PATH, formattedJson);
	console.log(`Wrote ${path.relative(REPO_ROOT, OPENAPI_JSON_PATH)}`);

	const markdown = renderMarkdown(spec);
	const formattedMarkdown = await prettier.format(markdown, {
		...projectConfig,
		filepath: API_MD_PATH,
	});
	fs.writeFileSync(API_MD_PATH, formattedMarkdown);
	console.log(`Wrote ${path.relative(REPO_ROOT, API_MD_PATH)}`);
}

run().catch((error) => {
	console.error("Failed to generate API docs:", error);
	process.exit(1);
});
