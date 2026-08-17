# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/).

## [1.1.0] — 2026-08-17

A full audit-and-fix pass covering every item in [`TODO.md`](TODO.md) — the
API went from "several endpoints crash, several security holes" to a green
test suite with enforced coverage, a working Docker stack, and CI. See
[`TODO.md`](TODO.md) for the complete before/after list this summarizes.

### Fixed — crashes

- Missing model imports that broke `PUT /users/:id`, `DELETE /users/:id`,
  `GET /users/public`, `POST /books/:id/return`,
  `POST /borrow-records/:id/extend`, `GET /borrow-records/overdue`, and
  `GET /borrow-records/statistics`.
- `deleteBooksById` referencing an undefined variable (typo) — deleting a
  book always crashed.
- `getAuthorById` reassigning a `const` — crashed whenever `include_books=true`.
- A bodyless `POST` (no `Content-Type`) crashing any handler that
  destructured `req.body` directly, e.g. `POST /books/:id/borrow` with no body.

### Fixed — security

- **Critical:** a `User` could `PUT` their own profile with `{"role": "Admin"}`
  and it was applied verbatim (mass-assignment / privilege escalation).
- **Critical:** the three `update*` model functions built `UPDATE ... SET`
  clauses from client-supplied object keys with no allowlist — a SQL
  injection vector distinct from parameter binding. All three now use an
  explicit column allowlist.
- Password hashes no longer leak into API responses (`findUserByIdSafe` /
  `formatUser` vs. the auth-only `formatUserForAuth`).
- Removed the unauthenticated `POST /auth/reset-password` (anyone could
  reset any account's password by email alone). Replaced with a real
  token-based `forgot-password` / `reset-password` flow: single-use,
  1-hour-expiry, `purpose`-scoped tokens that can never be used as regular
  access tokens and vice versa.
- `verifyToken` now actually checks the token blacklist — logout revokes
  the token instead of being a no-op.
- Stripped plaintext-password and request-body debug logging from the login
  path and the global request logger.
- `GET /users/:id` RBAC fixed — was accidentally Admin-only regardless of
  the documented "Admin, Librarian, or own profile" policy.
- `JWT_SECRET` refuses to boot the server in production if missing/default/weak.
- `jwt.verify` now pins `algorithms`, `issuer`, and `audience` (previously
  configured but never enforced).
- Added a login-attempt lockout (5 attempts / 30 min, configurable).
- Added a `UNIQUE` constraint on `authors.email` at the schema level.
- LIMIT/OFFSET in `findAllBooks` now parameterized instead of interpolated.
- Search input is now escaped for SQL `LIKE` wildcards.

### Fixed — correctness

- `updateBooksById` was checking book/author existence via swapped lookup
  functions.
- `findAuthorByEmail`'s `rows.lemgth` typo meant duplicate-author-email
  checks never actually caught a duplicate.
- `createBooks` destructured `launguage` instead of `language` — the field
  silently never saved.
- `include_author`/`include_borrows` on `GET /books/:id` compared a query
  string against the boolean `true` — always false.
- Duplicate-ISBN now correctly returns `409` instead of `404`.
- Standardized the response envelope to `{success, message, data}` everywhere
  (previously mixed `{status: 'success'}` / `{error: true}` / `{success}`).

### Added

- `GET /api/health` — liveness/readiness check, wired into the Docker
  healthcheck, checks DB connectivity.
- Zod request validation (`src/validation/schemas.js`) for every write
  endpoint, replacing duplicated ad-hoc `if` checks.
- Structured logging via `pino`, replacing raw `console.log`/`console.error`
  (with credential redaction).
- Redis-backed rate limiting and token blacklist (`src/utils/store.js`),
  with an in-process fallback for local dev/tests.
- Response caching for `GET /books` and `GET /authors` (in-process TTL
  cache, invalidated on write).
- A scheduled job (`node-cron`) to mark overdue borrow records periodically,
  instead of only recalculating on-demand.
- Sentry error tracking, env-gated (no-op without `SENTRY_DSN`).
- A minimal forward-only SQL migration runner (`migrations/`, `scripts/migrate.js`).
- ESLint (flat config) + Prettier, enforced in CI.
- A GitHub Actions CI workflow: lint → test (against a real MySQL service
  container) → Docker build.
- A complete Docker Compose stack: API + MySQL + Redis, with a healthcheck
  and an idempotent schema-loading migration.
- 140 tests (up from a non-functional suite), including regression tests
  for every bug above and authorization-boundary tests, with an enforced
  70% coverage threshold.

### Removed

- `multer` and `nodemailer`(-the-unused-version) — `multer` had zero usage
  in the codebase and 5 open DoS advisories; `nodemailer` was later reintroduced
  at a patched version once the password-reset flow gave it a real purpose.
  `express-session` and `cookie-parser` removed as genuinely unused (auth is
  pure JWT).
- The empty, unused `errorHandler.middlewares.js` — replaced with a real
  centralized error handler wired into `server.js`.

## [1.0.0] — initial version

First backend project: Library Management System REST API with JWT auth,
role-based access control, and a book borrowing/returning workflow.
