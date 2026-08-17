# TODO — Path to 10/10

Status: **all phases complete.** Every item below was fixed, verified against
a real MySQL database (Docker or local), and covered by the test suite where
applicable — this file is now the completion record, not a punch list.
140 tests pass (`npm test`), coverage thresholds are enforced and met
(`npm run test:coverage`), `npm audit` reports 0 vulnerabilities, ESLint and
Prettier are both clean, the Docker Compose stack (API + MySQL + Redis)
builds and runs end-to-end, and CI (`.github/workflows/ci.yml`) runs all of
the above on every push/PR.

See [`CHANGELOG.md`](CHANGELOG.md) for the summarized release notes.

Legend: `P0` blocking/critical · `P1` high · `P2` medium · `P3` low/polish

---

## Phase 0 — Stop the bleeding (P0)

- [x] Missing imports in `users.controllers.js` (`updateUserById`,
      `deleteUserById`, `formatUserPublic`) — fixed; regression-tested in
      `tests/api/users.test.js`.
- [x] Missing imports in `bookRecords.controllers.js` (`markBorrowRecordAsReturned`,
      `findBorrowRecordById`, `extendBorrowRecordDueDate`,
      `getOverdueBorrowRecords`, `getBorrowingStatistics`) — fixed;
      regression-tested in `tests/api/borrowRecords.test.js` and
      `tests/api/integration.test.js`.
- [x] `deleteBooksById` variable typo — fixed; regression-tested in
      `tests/api/books.test.js`.
- [x] `getAuthorById` `const` reassignment crash — fixed (`let`);
      regression-tested in `tests/api/authors.test.js`.
- [x] Password hashes leaking into API responses — fixed. `findUserById`
      (auth-only) and `findUserByIdSafe`/`formatUser` (safe to return) are
      now separate functions; every controller-facing lookup uses the safe
      one. Regression-tested in `tests/api/security.test.js`.
- [x] Unauthenticated `POST /auth/reset-password` — removed entirely.
      Replaced with a real `forgot-password`/`reset-password` flow: single-use,
      1-hour, `purpose`-scoped JWTs that can't be used as access tokens or
      vice versa. Tested end-to-end in `tests/api/security.test.js`.
- [x] Debug logging of credentials — removed. Replaced with `pino`
      structured logging (`src/utils/logger.js`) with field-level redaction
      for `password`/`current_password`/`new_password`/`authorization`.
- [x] `verifyToken` now checks the token blacklist — logout actually revokes
      the token. Regression-tested.
- [x] Stack traces gated to non-production — centralized in
      `src/middlewares/errorHandler.middlewares.js`, unit-tested.
- [x] Self-service privilege escalation — fixed via an explicit column
      allowlist (`SELF_EDITABLE_FIELDS`/`LIBRARIAN_EDITABLE_FIELDS`/
      `ADMIN_EDITABLE_FIELDS` in `users.model.js`); `role` in the body from a
      non-Admin now returns `403` outright rather than being silently
      dropped. Regression-tested in `tests/api/security.test.js`.
- [x] Column-name SQL injection in `updateUserById`/`updateBookById`/
      `updateAuthor` — fixed; all three now use an explicit, hardcoded column
      allowlist instead of iterating client-supplied object keys.

---

## Phase 1 — Correctness bugs (P1)

- [x] `updateBooksById` swapped book/author lookups — fixed.
- [x] `findAuthorByEmail`'s `rows.lemgth` typo — fixed; regression-tested
      (`tests/api/authors.test.js` — duplicate-email rejection).
- [x] `launguage` → `language` typo in `createBooks` — fixed;
      regression-tested (`tests/api/books.test.js`).
- [x] `include_author`/`include_borrows` `=== true` bug — fixed (compares
      against the string `'true'`); regression-tested.
- [x] `GET /users/:id` access control — fixed (`requireOwnershipOrAdmin()`
      instead of the `requireAdmin` + `requireAdminOrLibrarian` chain);
      regression-tested.
- [x] `LIMIT`/`OFFSET` parameterized in `findAllBooks` instead of
      interpolated.
- [x] Duplicate-ISBN now returns `409`, not `404`.
- [x] Error-handler `&&` bug — fixed in the rewritten
      `errorHandler.middlewares.js` (`` `${err.name}: ${err.message}` ``
      outside production).
- [x] `sort_by`/`order` on `GET /authors` — implemented in
      `findAllAuthors` with a column allowlist (`SORTABLE_FIELDS`), not
      removed.
- [x] `GET /api/health` implemented — checks DB connectivity, wired into the
      Docker healthcheck.

---

## Phase 2 — Security hardening (P1/P2)

- [x] Password policy standardized — 8+ chars, upper/lower/number,
      enforced via `passwordConfig` + a shared Zod schema everywhere
      (register, create-user, change-password, reset-password).
- [x] Rate limiting and the token blacklist moved to Redis
      (`src/utils/store.js`), with an in-process fallback when `REDIS_URL`
      is unset. Verified live: `X-RateLimit-*` headers correct, Redis
      confirmed as the backing store via the Compose stack.
- [x] `JWT_SECRET` — server now refuses to start (`process.exit(1)`) with a
      missing/default/weak secret when `NODE_ENV=production`.
- [x] `UNIQUE` constraint added on `authors.email` in the schema (and the
      migration).
- [x] `helmet` added, replacing the hand-rolled header middleware.
- [x] Zod validation (`src/validation/schemas.js` + `validateBody`
      middleware) wired into every write endpoint.
- [x] Login-attempt lockout implemented (5 attempts / 30 min, configurable
      via `LOGIN_MAX_ATTEMPTS`/`LOGIN_LOCKOUT_DURATION`).
- [x] Search input escaped for SQL `LIKE` wildcards (`src/utils/sanitize.js`),
      unit-tested.

---

## Phase 3 — Consistency & code quality (P2)

- [x] Response envelope standardized to `{success, message, data}`
      everywhere.
- [x] `errorHandler.middlewares.js` implemented and wired into `server.js`
      (was empty/unused).
- [x] Catch-all 404 handler re-enabled.
- [x] Self-shadowing variable in `updateAuthorById` renamed.
- [x] Dead commented-out code removed from `jest.config.js`,
      `tests/setup.js`, `tests/helpers/test.helpers.js`, and `server.js`.
- [x] Prettier applied across the codebase (tabs, consistent style);
      `npm run format:check` clean.
- [x] `acquireTimeout` → `connectTimeout` (the correct `mysql2` option).
- [x] `BCRYPT_ROUNDS` duplicate read removed — `users.model.js` now imports
      `passwordConfig.saltRounds` instead of reading `process.env` directly.
- [x] `multer` and `express-session`/`cookie-parser` removed as genuinely
      unused. `nodemailer` kept — the password-reset flow gave it a real
      purpose — and bumped to the patched major version.
- [x] `npm audit` — 0 vulnerabilities (production and dev dependencies).

---

## Phase 4 — Testing

- [x] Test suite runs green: 140/140 (`npm test`) against a real MySQL
      database, all `tests/api/*.test.js` files verified against the fixed
      controllers. (Along the way, fixed several pre-existing test-fixture
      bugs unrelated to the Phase 0/1 code fixes: a `beforeAll`-creates-once
      + `afterEach`-wipes-everything pattern across four test files that
      invalidated tokens mid-suite, a hardcoded wrong password in one admin
      login, and a UNIQUE-constraint collision from a static default
      `user_name` reused across two users in the same test.)
- [x] Regression tests added for every Phase 0/1 bug
      (`tests/api/security.test.js` + targeted additions to the per-resource
      test files), each naming the bug it guards against.
- [x] Authorization boundary tests added: unauthenticated → protected,
      User → Admin-only, User → another user's records, Librarian's field
      restrictions on `PUT /users/:id`.
- [x] Real password-reset flow implemented and tested (request, consume,
      single-use enforcement, cross-token-type rejection).
- [x] `npm run test:coverage` wired into CI; `coverageThreshold` (70% across
      statements/branches/functions/lines) enforced and met.

---

## Phase 5 — Documentation

- [x] Architecture overview — [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)
      (updated: Redis-backed store, migrations, corrected role matrix).
- [x] Setup/dev guide — [`docs/SETUP.md`](SETUP.md) (updated: migrations,
      lint/format commands, `--env-file` for Docker, corrected
      boot-refusal behavior).
- [x] API reference — [`docs/API.md`](API.md) (updated: health check,
      forgot/reset-password, caching notes, corrected rate-limit and
      `PUT /users/:id` field-restriction docs).
- [x] Security posture & test procedures — [`docs/SECURITY_TESTING.md`](SECURITY_TESTING.md).
- [x] Stale `docs/testing_setup_guide.md` removed (described a directory
      layout that never matched the real one).
- [x] `CONTRIBUTING.md` and `CHANGELOG.md` added.
- [ ] **P3 (deferred)** Generate `docs/API.md` from an OpenAPI/Swagger spec
      instead of hand-maintaining it. Not done — the API surface only just
      stabilized in this pass; revisit once it's been stable for a while
      and drift becomes a real (not hypothetical) problem.

---

## Phase 6 — DevOps / Docker / CI

- [x] Dockerfile + docker-compose — [`docker/`](../docker/). Image builds
      clean, tagged `lms-api` (Docker requires lowercase repository names).
      Full stack (API + MySQL + Redis) verified live: health check,
      admin setup, login, Redis-backed rate-limit headers, author creation —
      all exercised end-to-end against the real running containers.
- [x] GitHub Actions CI (`.github/workflows/ci.yml`): lint → test (against a
      real MySQL service container) → Docker build, on every push/PR.
- [x] ESLint (flat config) + Prettier, both enforced in CI.
- [x] Structured logging via `pino`, replacing raw `console.log`/`console.error`.
- [x] `/api/health` wired into the Docker `HEALTHCHECK`.
- [x] Database migrations — a minimal forward-only `.sql` runner
      (`migrations/`, `scripts/migrate.js`, tracked in a `schema_migrations`
      table), deliberately not a heavyweight framework given the schema's size.
- [x] Sentry error tracking added, env-gated (no-op without `SENTRY_DSN`),
      wired into the error handler and the uncaught-exception/rejection
      handlers.

---

## Phase 7 — Performance & scale

- [x] Response caching added for `GET /books` and `GET /authors`
      (in-process TTL cache, invalidated on write).
- [x] DB connection pool made configurable (`DB_CONNECTION_LIMIT`,
      `DB_CONNECT_TIMEOUT`) and slow-query logging added
      (`SLOW_QUERY_THRESHOLD_MS`). Further *tuning* of these values needs
      real observed production traffic, which doesn't exist yet — the
      infrastructure to observe and adjust is in place.
- [x] Scheduled job (`node-cron`) added to mark overdue borrow records
      periodically instead of only recalculating on-demand
      (`src/jobs/overdue.job.js`, configurable via `OVERDUE_JOB_CRON`,
      disabled in tests via `DISABLE_OVERDUE_JOB`).

---

## Definition of "10/10" — status

- [x] Every endpoint in [`docs/API.md`](API.md) works as documented, with a
      test covering it.
- [x] No credential appears in a log or an API response (verified:
      password-hash regression tests, redacted logger, live Docker smoke test).
- [x] `npm audit` and CI lint/test both pass clean.
- [x] `docker compose -f docker/docker-compose.yml --env-file .env up` gives
      a working stack with zero manual steps beyond copying `.env` —
      verified live.
- [x] A new contributor can go from `git clone` to a passing test suite
      using only [`docs/SETUP.md`](SETUP.md).
