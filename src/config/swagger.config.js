// swagger-jsdoc definition shared by scripts/generate-docs.js (which builds
// src/openapi.json + docs/API.md) and any future runtime introspection.
// Route files carry the actual per-endpoint @openapi JSDoc blocks; this file
// only owns the document-wide shape: info, servers, security, and the
// reusable component schemas every endpoint's response is built from.
const swaggerDefinition = {
	openapi: "3.0.3",
	info: {
		title: "Library Management System API",
		version: "1.1.0",
		description:
			"REST API for a library management system — books, authors, users, and the borrow/return workflow, with role-based access control (Admin/Librarian/User).\n\nThis document is generated from JSDoc annotations on the route files (`npm run docs:generate`) — do not hand-edit `docs/API.md` or `src/openapi.json`.",
		license: { name: "ISC" },
	},
	servers: [
		{ url: "http://localhost:5080/api", description: "Local development" },
		{
			url: "{baseUrl}/api",
			description: "Custom",
			variables: { baseUrl: { default: "http://localhost:5080" } },
		},
	],
	tags: [
		{ name: "Health", description: "Liveness/readiness checks" },
		{ name: "Auth", description: "Registration, login, and session management" },
		{ name: "Authors", description: "Author records" },
		{ name: "Books", description: "Book catalog, borrowing, and returns" },
		{ name: "Users", description: "User accounts and profiles" },
		{
			name: "Borrow Records",
			description: "Borrow/return history, overdue tracking, statistics",
		},
	],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description:
					"Obtain a token from `POST /auth/register`, `POST /auth/login`, or `POST /auth/setup-admin`, then send it as `Authorization: Bearer <token>`.",
			},
		},
		schemas: {
			Error: {
				type: "object",
				properties: {
					success: { type: "boolean", example: false },
					message: { type: "string", example: "What went wrong" },
					error: {
						type: "string",
						description: "Detail, omitted in production for 500s.",
					},
				},
			},
			ValidationError: {
				type: "object",
				properties: {
					success: { type: "boolean", example: false },
					message: { type: "string", example: "Validation failed" },
					errors: {
						type: "array",
						items: {
							type: "object",
							properties: {
								field: { type: "string", example: "email" },
								message: { type: "string", example: "Invalid email format" },
							},
						},
					},
				},
			},
			Pagination: {
				type: "object",
				properties: {
					current_page: { type: "integer", example: 1 },
					total_pages: { type: "integer", example: 5 },
					total_items: { type: "integer", example: 47 },
					items_per_page: { type: "integer", example: 10 },
					has_next: { type: "boolean", example: true },
					has_prev: { type: "boolean", example: false },
				},
			},
			User: {
				type: "object",
				properties: {
					id: { type: "integer", example: 1 },
					first_name: { type: "string", example: "John" },
					last_name: { type: "string", example: "Doe" },
					full_name: { type: "string", example: "John Doe" },
					user_name: { type: "string", example: "johndoe" },
					email: { type: "string", format: "email", example: "john@example.com" },
					phone: { type: "string", nullable: true, example: "08012345678" },
					image_url: { type: "string", nullable: true },
					role: { type: "string", enum: ["Admin", "Librarian", "User"], example: "User" },
					is_active: { type: "boolean", example: true },
					email_verified: { type: "boolean", example: false },
					created_at: { type: "string", format: "date-time" },
					updated_at: { type: "string", format: "date-time" },
				},
			},
			UserPublic: {
				type: "object",
				description: "Limited fields exposed by GET /users/public.",
				properties: {
					id: { type: "integer", example: 1 },
					first_name: { type: "string", example: "John" },
					last_name: { type: "string", example: "Doe" },
					user_name: { type: "string", example: "johndoe" },
					role: { type: "string", enum: ["Admin", "Librarian", "User"] },
				},
			},
			AuthTokenResponse: {
				type: "object",
				properties: {
					success: { type: "boolean", example: true },
					message: { type: "string" },
					data: {
						type: "object",
						properties: {
							user: { $ref: "#/components/schemas/User" },
							token: { type: "string", description: "JWT access token" },
							token_type: { type: "string", example: "Bearer" },
							expires_in: { type: "string", example: "7d" },
						},
					},
				},
			},
			Author: {
				type: "object",
				properties: {
					id: { type: "integer", example: 1 },
					first_name: { type: "string", example: "George" },
					last_name: { type: "string", example: "Orwell" },
					email: { type: "string", format: "email", example: "orwell@example.com" },
					phone: { type: "string", nullable: true },
					image: { type: "string", nullable: true },
					date_of_birth: { type: "string", format: "date", nullable: true },
					biography: { type: "string", nullable: true },
					created_at: { type: "string", format: "date-time" },
					updated_at: { type: "string", format: "date-time" },
				},
			},
			Book: {
				type: "object",
				properties: {
					id: { type: "integer", example: 1 },
					isbn: { type: "string", example: "978-0451524935" },
					title: { type: "string", example: "1984" },
					author_id: { type: "integer", example: 1 },
					published_date: { type: "string", format: "date", nullable: true },
					description: { type: "string", nullable: true },
					cover_image: { type: "string", nullable: true },
					genre: { type: "string", nullable: true, example: "Dystopian Fiction" },
					language: { type: "string", nullable: true, example: "English" },
					pages: { type: "integer", nullable: true, example: 328 },
					publisher: { type: "string", nullable: true },
					available_copies: { type: "integer", example: 5 },
					total_copies: { type: "integer", example: 5 },
					status: {
						type: "string",
						enum: ["Available", "Borrowed", "Reserved", "Lost"],
						example: "Available",
					},
					created_at: { type: "string", format: "date-time" },
					updated_at: { type: "string", format: "date-time" },
				},
			},
			BorrowRecord: {
				type: "object",
				properties: {
					id: { type: "integer", example: 10 },
					user_id: { type: "integer", example: 1 },
					book_id: { type: "integer", example: 1 },
					borrow_date: { type: "string", format: "date-time" },
					due_date: { type: "string", format: "date-time" },
					return_date: { type: "string", format: "date-time", nullable: true },
					status: {
						type: "string",
						enum: ["Borrowed", "Returned", "Overdue"],
						example: "Borrowed",
					},
					is_active: { type: "boolean", example: true },
				},
			},
		},
		responses: {
			Unauthorized: {
				description: "Missing, invalid, or expired token",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/Error" },
						example: { success: false, message: "Access denied. No token provided" },
					},
				},
			},
			Forbidden: {
				description: "Authenticated, but wrong role or not the resource owner",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/Error" },
						example: {
							success: false,
							message: "Access denied. Required role(s): Admin. Your role: User",
						},
					},
				},
			},
			NotFound: {
				description: "Resource not found",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/Error" },
					},
				},
			},
			ValidationFailed: {
				description: "Request body failed schema validation",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/ValidationError" },
					},
				},
			},
			RateLimited: {
				description: "Too many requests",
				content: {
					"application/json": {
						schema: { $ref: "#/components/schemas/Error" },
						example: {
							success: false,
							message:
								"Too many requests from this IP, please try again after 15 minutes",
						},
					},
				},
			},
		},
	},
	security: [{ bearerAuth: [] }],
};

const swaggerJsdocOptions = {
	definition: swaggerDefinition,
	apis: [require("node:path").resolve(__dirname, "..", "routes", "*.routes.js")],
};

module.exports = { swaggerDefinition, swaggerJsdocOptions };
