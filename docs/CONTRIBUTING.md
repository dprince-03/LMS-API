# Contributing

Thanks for looking at this project. It's a learning project, so contributions
of any size — a typo fix, a bug report, a whole feature — are welcome.

## Getting set up

Follow [`SETUP.md`](SETUP.md) to get a working dev environment
(Docker or manual). Then:

```bash
npm run lint          # ESLint
npm run format:check  # Prettier
npm test              # Jest, against a real test database
npm run test:coverage # same, with a coverage report (70% threshold enforced)
```

All four should pass before you open a PR — the CI workflow
(`.github/workflows/ci.yml`) runs the same checks.

## Before you start

- Check [`TODO.md`](TODO.md) — it's the live list of known gaps,
  prioritized. If you're looking for something to work on, start there.
- For anything security-related, read [`SECURITY_TESTING.md`](SECURITY_TESTING.md)
  first — it documents the current security posture and known issues so you
  don't duplicate work or reintroduce something already fixed.
- For bugs, a failing test that reproduces the issue is the fastest way to
  get a fix merged.

## Code style

- Prettier + ESLint are both configured (`eslint.config.js`, `.prettierrc.json`)
  and enforced in CI — run `npm run format` / `npm run lint:fix` before
  committing rather than fighting the formatter by hand.
- Follow the existing layered structure: routes → controllers → models. Routes
  wire up middleware and call a controller; controllers handle
  request/response shape and validation; models are the only place that
  touches SQL. Don't put SQL in a controller or `res.json()` in a model.
- New endpoints that accept a body should get a Zod schema in
  `src/validation/schemas.js` and a `validateBody(...)` call in the route,
  rather than ad-hoc `if (!field)` checks in the controller.
- Any `UPDATE ... SET` built dynamically from request data must go through an
  explicit column allowlist (see `SELF_EDITABLE_FIELDS` /
  `ADMIN_EDITABLE_FIELDS` in `users.model.js`, or `UPDATABLE_FIELDS` in
  `books.model.js` / `authors.model.js`) — never interpolate a client-supplied
  key directly into SQL.
- New/changed routes need an `@openapi` JSDoc block (see any existing route
  for the pattern), then `npm run docs:generate` to rebuild
  `src/openapi.json` and `docs/API.md` from it. Don't hand-edit either file —
  CI regenerates and diffs both, so a route change without a regeneration
  fails the lint job.

## Tests

- New behavior needs a test. New bug fixes need a regression test (see
  `tests/api/security.test.js` for the pattern — each test names the bug it
  guards against).
- Tests run against a real MySQL database, not mocks — see
  [`SETUP.md`](SETUP.md#running-tests) for how to set one up
  locally.
- Rate limiting is disabled under `NODE_ENV=test` (see `server.js`) so
  functional tests aren't flaky against shared per-minute buckets — rate
  limit _behavior_ is tested manually via the `curl` procedures in
  [`SECURITY_TESTING.md`](SECURITY_TESTING.md), not the Jest suite.

## Commit / PR expectations

- Keep commits scoped — one logical change per commit is easier to review
  and revert than a mixed bag.
- Describe _why_ in the PR description, not just what changed — the diff
  already shows what changed.
- Don't skip CI. If a check is failing and you believe it's wrong, fix the
  check itself in the same PR rather than working around it.
