# LMS-API — Security Test Plan

A checklist for a security review pass across the API. This is the second
pass — the first (kept in git history) found two critical issues
(self-service privilege escalation, column-name SQL injection) plus a long
tail of smaller gaps; all of those have since been fixed and are marked
closed below, with what changed. A handful of genuinely open items remain,
listed under their section with what's still missing. Status here is a
**static code review** (current file/line references, plus `npm audit` run
fresh for this pass) — the [live test procedures](#live-test-procedures) at
the bottom are copy-pasteable `curl` commands for verifying the closed items
stay closed and exercising the open ones against a running server.

## 1. Authentication & authorization

- [ ] **Timing-based user enumeration** — **Still open.** `login`
      ([`auth.controllers.js:87-138`](../src/controllers/auth.controllers.js#L87-L138))
      returns immediately on the not-found/inactive path without running a
      bcrypt compare, while the wrong-password path always runs one. That's a
      measurable timing difference an attacker can use to enumerate valid
      emails/usernames. Fix: run a dummy `bcrypt.compare` against a constant
      hash on the not-found path so both branches take comparable time.
- [x] ~~**Auth bypass — `GET /users/:id` mis-wired**~~ — **Fixed.** Now uses
      `requireOwnershipOrAdmin()`
      ([`users.routes.js:120`](../src/routes/users.routes.js#L120)), so the
      resource owner, Librarians, and Admins can all reach it — the previous
      `requireAdmin` chain that made the Librarian check unreachable is gone.
- [x] ~~**Privilege escalation via `PUT /users/:id`**~~ — **Fixed, was the
      top finding of the previous pass.** `updateUserController`
      ([`users.controllers.js:170-224`](../src/controllers/users.controllers.js#L170-L224))
      now computes an explicit `allowedFields` allowlist based on the
      caller's role and relationship to the target
      (`SELF_EDITABLE_FIELDS` / `LIBRARIAN_EDITABLE_FIELDS` /
      `ADMIN_EDITABLE_FIELDS`, defined in
      [`users.model.js`](../src/models/users.model.js)), rejects any attempt
      to set `role` with `403` unless the caller is Admin, and silently drops
      every other field not on the allowlist before it ever reaches the
      model layer. See the field-restriction table in
      [`API.md`](API.md#users).
- [x] ~~**JWT hardening**~~ — **Fixed.** `algorithms`/`issuer`/`audience` are
      now pinned on both signing and verification
      ([`tokens.js`](../src/utils/tokens.js)) via a shared `verifyAppToken`
      helper, closing the "configured but inert" gap from before. The
      `jsonwebtoken`/`jws` HMAC-verification advisory is also gone — see §8.
- [ ] **Password policy — `setup-admin` bypasses the shared schema** — Every
      other password-accepting endpoint validates through the shared Zod
      `password` schema
      ([`validation/schemas.js:4-18`](../src/validation/schemas.js#L4-L18)) —
      8+ chars, upper/lower/number. `POST /auth/setup-admin`
      ([`auth.routes.js:287`](../src/routes/auth.routes.js#L287)) is the one
      route with no `validateBody` at all; `setup_admin`
      ([`auth.controllers.js:323-409`](../src/controllers/auth.controllers.js#L323-L409))
      re-implements the same three regex checks by hand instead. Not a
      vulnerability — the checks are equivalent — but it's the one place a
      future change to password rules won't apply unless someone remembers
      to update it twice. Low priority; worth a `validateBody(setupAdminSchema)`
      pass for consistency.
- [x] ~~**No account lockout**~~ — **Fixed.** `login`
      ([`auth.controllers.js:87-138`](../src/controllers/auth.controllers.js#L87-L138))
      now tracks failed attempts per `emailOrUsername` in the shared store
      (Redis-backed when configured) and returns `429` past
      `LOGIN_MAX_ATTEMPTS` for `LOGIN_LOCKOUT_DURATION`.
- [x] ~~**Mass assignment / column-name SQL injection**~~ — **Fixed, was the
      second critical finding of the previous pass.** All three `update*`
      functions now build their `SET` clause from an explicit allowlist
      instead of `Object.keys(updateData)`: `UPDATABLE_FIELDS` in
      [`books.model.js`](../src/models/books.model.js#L4-L18) and
      [`authors.model.js`](../src/models/authors.model.js#L5-L12), and the
      role-scoped allowlists in
      [`users.model.js`](../src/models/users.model.js) described above. The
      column name in the generated SQL is now always one of a known-safe set
      — client input can only ever affect the parameterized _value_, never
      the column name itself.
- [x] ~~**Sort-column injection**~~ — **Verified clean.** `findAllAuthors`
      interpolates `sort_by`/`order` directly into the `ORDER BY` clause
      ([`authors.model.js:71`](../src/models/authors.model.js#L71)), but both
      are validated first — `sort_by` against a `SORTABLE_FIELDS` allowlist,
      `order` normalized to a strict `ASC`/`DESC` binary — before they ever
      reach the query string.

## 2. Session & token management

No server-side session store in the request path — auth is pure bearer-JWT.
No `express-session`/`cookie-parser` in `package.json` anymore (both were
declared-but-dead in the previous pass — now removed, see §8).

- [x] ~~**Cookie-based session risk**~~ — **N/A, verified by design.** JWT is
      delivered via `Authorization: Bearer`, not a cookie — nothing for
      `httpOnly`/`sameSite`/`secure` to protect, and CSRF risk is
      correspondingly low.
- [x] ~~**Deactivation cuts off active tokens**~~ — **Verified clean.**
      `verifyToken` re-fetches the user on every request and rejects if
      `is_active` is false
      ([`auth.middlewares.js:60-65`](../src/middlewares/auth.middlewares.js#L60-L65)).
- [x] ~~**Instant session revocation / logout**~~ — **Fixed.** `logout`
      blacklists the current token via the shared store
      ([`auth.controllers.js:157-179`](../src/controllers/auth.controllers.js#L157-L179)),
      and `verifyToken` now checks that blacklist on every request
      ([`auth.middlewares.js:33-38`](../src/middlewares/auth.middlewares.js#L33-L38))
      — a token used after logout is rejected immediately instead of
      remaining valid until its natural expiry.
- [x] ~~**Unauthenticated password reset**~~ — **Fixed.** The old
      `POST /auth/reset-password` (no auth, no token, just an email + new
      password) is gone. The flow is now
      `POST /auth/forgot-password` → single-use, 1-hour, `purpose`-scoped
      JWT (with a random `jti` so two tokens minted in the same second can't
      collide) emailed to the account →
      `POST /auth/reset-password` consumes it and blacklists it immediately
      after use (`auth.controllers.js` `forgotPassword`/`resetPassword`,
      [`tokens.js`](../src/utils/tokens.js)). Always responds with the same
      generic message regardless of whether the email exists.
- [ ] **Concurrent session limits** — still open. `sessionConfig.maxActiveSessions`
      ([`auth.config.js:26`](../src/config/auth.config.js#L26)) is defined
      and read nowhere else in the codebase — same "configured but inert"
      shape as the previous pass's JWT-claims finding, just not yet acted on
      for this one. Low priority for a JWT-based API (there's no session
      table to enforce a limit against without adding one) — worth either
      implementing or deleting the dead config, not leaving it looking
      load-bearing.

## 3. Input validation & injection

- [x] ~~**Input validation on all endpoints**~~ — **Fixed.** Every
      request-body-accepting route except `setup-admin` (see §1) now runs
      through `validateBody(schema)`
      ([`validate.middlewares.js`](../src/middlewares/validate.middlewares.js))
      backed by Zod schemas in
      [`validation/schemas.js`](../src/validation/schemas.js) — the ad-hoc
      duplicated `if (!field)` checks from the previous pass are gone.
- [x] ~~**SQL injection (value position)**~~ — **Verified clean.** Every
      query goes through `mysql2`'s parameterized `query(sql, params)`
      ([`database.config.js`](../src/config/database.config.js)).
- [x] ~~**SQL injection (identifier position)**~~ — **Fixed** — see the
      mass-assignment/column-allowlist fix in §1.
- [x] ~~**LIMIT/OFFSET injection**~~ — **Fixed.** Every list query now binds
      `LIMIT ? OFFSET ?` as real parameters (`books.model.js`,
      `authors.model.js`, `users.model.js`, `borrowedRecords.model.js`)
      instead of interpolating the values as a string.
- [x] ~~**LIKE-wildcard injection**~~ — **Fixed.** Every `search` filter now
      goes through `buildLikeParam`/`escapeLikeWildcards`
      ([`utils/sanitize.js`](../src/utils/sanitize.js)), which escapes `%`,
      `_`, and the backslash escape character itself before wrapping the
      term in wildcards — a search term containing `%` or `_` can no longer
      widen the match beyond what the user actually typed.
- [ ] **Stored payload handling** — still open, low severity. `books.description`,
      `authors.biography`, and similar free-text fields are stored and
      returned as-is, with no sanitization on the way in and no escaping
      contract documented on the way out. This API has no server-rendered
      views itself, so there's no first-party stored-XSS surface here — but
      nothing protects a future frontend that renders these fields with
      `innerHTML`/`dangerouslySetInnerHTML`. Worth a one-line note in
      `API.md` stating these fields are unsanitized, HTML-unsafe strings.
- [x] ~~**Path traversal / file handling**~~ — **N/A.** No file upload
      endpoint exists in this API (`multer` — previously an unused
      dependency — has been removed; see §8).

## 4. API & application security

- [x] ~~**Rate limiting not actually enforced**~~ — **Fixed.**
      `roleBasedRateLimit()`
      ([`auth.middlewares.js:219-262`](../src/middlewares/auth.middlewares.js#L219-L262))
      is now mounted globally on every `/api/*` request
      ([`server.js:101-103`](../src/server.js#L101-L103)), alongside the flat
      IP-based backstop. Both are backed by the shared store (Redis when
      `REDIS_URL` is set) and disabled under `NODE_ENV=test` so the
      automated suite isn't flaky — see the [live test
      procedures](#rate-limiting) to exercise this for real.
- [x] ~~**Missing security headers**~~ — **Fixed.** `helmet()` is now
      mounted first in the middleware chain
      ([`server.js:77`](../src/server.js#L77)), replacing the four
      hand-set headers from before (one of which, `X-XSS-Protection`, was
      already deprecated). Helmet's defaults add a baseline CSP,
      `Referrer-Policy`, `Permissions-Policy`, and the rest of its standard
      set — not custom-tuned for this app, but real coverage where there was
      none.
- [x] ~~**File upload security**~~ — **N/A**, no upload endpoint exists (§3).
- [x] ~~**API versioning / endpoint exposure**~~ — **Improved, and now
      documented rather than absent.** An OpenAPI 3.0 spec is generated from
      JSDoc annotations on every route
      (`npm run docs:generate` → [`swagger.config.js`](../src/config/swagger.config.js) →
      `src/openapi.json` + this repo's [`API.md`](API.md)) and served
      interactively at `/api/docs`. No dead/unmounted route files — every
      `*.routes.js` is `app.use()`'d in `server.js`.
- [x] ~~**Business logic — borrow/return integrity**~~ — **Verified clean.**
      `borrowBook`/`returnBook` both run inside a real DB transaction
      ([`books.model.js`](../src/models/books.model.js)), so a crash
      mid-operation can't leave `available_copies` and the borrow record out
      of sync. Max-5-books and no-double-borrow rules are enforced
      server-side.
- [ ] **Audit trail — partial coverage** — `auditLogger`
      ([`auth.middlewares.js:265-290`](../src/middlewares/auth.middlewares.js#L265-L290))
      exists and is wired to `POST /users`, `PUT /users/:id`, and
      `DELETE /users/:id`
      ([`users.routes.js`](../src/routes/users.routes.js)) — a real
      improvement over the previous pass's "only ad-hoc console.log"
      finding. It's not yet wired to book/author mutations, borrow/return,
      or login/logout — so "who changed what, when" is reconstructable for
      user-account changes but not for the rest of the API's writes. Worth
      extending the same middleware to the remaining write routes.

## 5. Encryption & data protection

- [ ] **Encryption in transit** — still open, and inherently so. This repo
      has no TLS termination of its own — Express listens on plain HTTP
      ([`server.js`](../src/server.js)), and the Docker Compose stack in
      [`docker/`](../docker/) doesn't front it with a reverse proxy. TLS is
      entirely the deploying environment's responsibility (a platform load
      balancer, an nginx/Caddy sidecar, etc.) — worth stating explicitly in
      [`SETUP.md`](SETUP.md) rather than leaving it implicit, since it's easy
      to deploy this as-is and not notice.
- [x] ~~**Secrets at rest**~~ — **Fixed — now enforced, not just warned
      about.** `.env` is gitignored and nothing is committed. A missing,
      default, or short `JWT_SECRET` now makes the process refuse to boot in
      production
      ([`auth.config.js:159-163`](../src/config/auth.config.js#L159-L163)) —
      previously this only logged a warning and continued.
- [ ] **Data at rest** — outside this repo's control either way; depends on
      wherever MySQL's data directory ends up (host filesystem or Docker
      volume). No change from the previous pass.

## 6. Error handling & resilience

- [x] ~~**Error boundaries leaking stack traces**~~ — **Fixed.**
      [`errorHandler.middlewares.js`](../src/middlewares/errorHandler.middlewares.js)
      — previously empty and unused — is now the single centralized error
      handler, and gates `stack`/`error` behind `NODE_ENV !== "production"`.
      Every controller's own catch block still returns a generic message on
      unhandled errors, not `error.message`.
- [x] ~~**Inconsistent error shape**~~ — **Fixed.** Every response now uses
      the single `{ success, message, data?, pagination?, errors? }`
      envelope — the three coexisting shapes from before (`{success}` /
      `{error: true}` / `{status: 'fail'|'success'}`) are gone.

## 7. Observability & incident response

- [x] ~~**Plaintext credential logging**~~ — **Fixed, was the highest-impact
      finding of the previous pass.** Structured `pino` logging
      ([`utils/logger.js`](../src/utils/logger.js)) now redacts
      `password`/`current_password`/`new_password` at every nesting level
      the redact config covers, and the per-request body-logging debug
      middleware that dumped every request body (credentials included) is
      gone.
- [ ] **Audit trail** — see §4; partial, not full, coverage.
- [x] ~~**Monitoring / alerting**~~ — **Fixed.** Sentry integration
      ([`utils/errorTracking.js`](../src/utils/errorTracking.js)) is wired
      into the global error handler and the uncaught-exception/unhandled-
      rejection handlers in `server.js` — a no-op when `SENTRY_DSN` isn't
      set (local dev, most test runs), active when it is. Errors are still
      logged locally either way.
- [ ] **Backups** — still open. No backup mechanism exists for the MySQL
      data — schema only (`migrations/`), no dump/restore script, no
      scheduled job. Worth a real `mysqldump` script before this runs
      anywhere the data matters.

## 8. Infrastructure & dependency supply chain

- [x] ~~**`npm audit` findings**~~ — **Fixed.** Previous pass: 9
      vulnerabilities (3 moderate, 6 high) — `jws` (HMAC verification,
      related to the unpinned JWT algorithm in §1), `express-rate-limit`/
      `ip-address` (rate-limit bypass), `multer` and `nodemailer` (unused at
      the time, pulling in advisories for code that was never reachable),
      plus transitive `body-parser`/`morgan`/`path-to-regexp`/`qs` issues.
      Re-run for this pass: **0 vulnerabilities.** `multer` and the unused
      `express-session`/`cookie-parser` have been removed entirely rather
      than patched around; `nodemailer` is now actually used (the
      forgot-password email flow, [`utils/mailer.js`](../src/utils/mailer.js))
      instead of being dead weight.
- [x] ~~**Dead dependencies**~~ — **Fixed** — see above.
- [x] ~~**CI / supply chain pinning**~~ — **Now exists.**
      [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs
      lint → test → Docker build on every push/PR, and publishes the image
      to GHCR on `main`/version tags.
      [`.github/dependabot.yml`](../.github/dependabot.yml) keeps npm,
      Docker base images, and Action versions from silently drifting. **Not
      yet done:** third-party Actions are pinned by version tag
      (`docker/build-push-action@v6`) rather than by commit SHA — tags are
      mutable, so this is a supply-chain hardening step worth doing before
      this pipeline handles anything more sensitive than a portfolio
      project's own image.
- [x] ~~**Container security**~~ — **Verified, still clean.**
      [`docker/Dockerfile`](../docker/Dockerfile) runs as a non-root user on
      a minimal `node:20-alpine` base, multi-stage so dev dependencies never
      reach the runtime image. Not yet scanned with a dedicated image
      scanner (Trivy/Grype) — worth adding as a CI step now that the
      pipeline actually exists to add it to.

---

## Summary

Both critical findings from the previous pass — self-service privilege
escalation and column-name SQL injection, sharing one root cause
(`Object.keys(updateData)`-driven `UPDATE` clauses with no allowlist) — are
fixed, along with the plaintext-credential-logging issue that was the
highest-impact finding after those two. `npm audit` went from 9
vulnerabilities to 0.

What's left, in priority order:

1. **Timing-based login enumeration** (§1) — still exploitable, low effort
   to fix (one dummy bcrypt compare on the not-found path).
2. **Encryption in transit** (§5) — inherent to how this is deployed, not a
   code fix; needs explicit documentation so it isn't deployed bare.
3. **Backups** (§7) and **audit trail coverage** (§4) — both partial/absent,
   both straightforward to extend from what already exists.
4. A handful of low-priority consistency items: `setup-admin`'s ad-hoc
   password check (§1), the dead `maxActiveSessions` config (§1), and
   SHA-pinning third-party Actions (§8).

None of the remaining items are the kind of "any authenticated user becomes
Admin with one request" severity the previous pass turned up — this is
cleanup, not triage.

---

## Live test procedures

Copy-pasteable `curl` procedures against a running server (see
[`SETUP.md`](SETUP.md) to get one up) — both to verify the closed items stay
closed, and to exercise the items still open above.

### Password hash leak (regression check)

```bash
TOKEN="<a valid user JWT>"
curl -s http://localhost:5080/api/auth/me -H "Authorization: Bearer $TOKEN" | grep -i password
```

Expected: no output. Repeat against `GET /users/:id`, `POST /users`,
`PUT /users/:id`, `GET /users/profile`.

### Self-privilege-escalation (regression check)

```bash
USER_TOKEN="<a valid User-role JWT>"
USER_ID="<that same user's own id>"
curl -s -X PUT http://localhost:5080/api/users/$USER_ID \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"Admin"}'
```

Expected (fixed): `403`, role unchanged.

### Column-name SQL injection (regression check)

```bash
USER_TOKEN="<a valid User-role JWT>"
USER_ID="<that same user's own id>"
curl -s -X PUT http://localhost:5080/api/users/$USER_ID \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"role='Admin' -- \":\"x\"}"
```

Expected (fixed): `400` — the field isn't on the allowlist, so it's dropped
before it ever reaches SQL, and validation rejects the empty resulting body.

### Logout token invalidation (regression check)

```bash
TOKEN="<a valid user JWT>"
curl -s -X POST http://localhost:5080/api/auth/logout -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5080/api/auth/me -H "Authorization: Bearer $TOKEN"
```

Expected (fixed): second call returns `401`.

### Unauthenticated password reset (regression check)

```bash
curl -s -X POST http://localhost:5080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"not-a-real-token","new_password":"Hacked123!"}'
```

Expected (fixed): `400` — a `token` is required and this one doesn't verify.
There is no way to reset a password with just an email anymore; get a real
token via `POST /auth/forgot-password` first to test the full flow.

### Vertical privilege escalation (role boundary)

```bash
USER_TOKEN="<a valid User-role JWT>"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5080/api/users \
  -H "Authorization: Bearer $USER_TOKEN"
```

Expected: `403`. Repeat for every Admin/Librarian-only route in
[`docs/API.md`](API.md) with a `User` token, and every Admin-only route with
a `Librarian` token.

### Horizontal privilege escalation (ownership boundary)

```bash
USER_A_TOKEN="<User A's JWT>"
USER_B_ID=2   # a different user's id
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5080/api/users/$USER_B_ID \
  -X PUT -H "Authorization: Bearer $USER_A_TOKEN" \
  -H "Content-Type: application/json" -d '{"first_name":"Hacked"}'
```

Expected: `403`. Repeat against `GET /users/:id/borrow-records` and
`POST /borrow-records/:id/extend` with a borrow record belonging to a
different user.

### Rate limiting

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code} " http://localhost:5080/api/authors
done; echo
```

Expected (Guest tier, 20 req/min): mostly `200` then `429` once the 21st
request lands within the same minute. Run against a server started without
`NODE_ENV=test` — both limiters are disabled in the test environment.

### Timing-based user enumeration (still open — §1)

```bash
time curl -s -o /dev/null -X POST http://localhost:5080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"definitely-not-a-real-user@example.com","password":"x"}'

time curl -s -o /dev/null -X POST http://localhost:5080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"<a real registered email>","password":"wrong-password"}'
```

Expected once fixed: comparable timing. Currently: the second call should
measurably outlast the first (bcrypt compare only runs when the account
exists).

## Automated checks worth adding

- `npm audit` (already in CI on every push — see
  [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)); consider
  failing the build on `moderate` instead of the current implicit default,
  now that the baseline is 0.
- A container image scanner (Trivy/Grype) as a CI step now that a
  `docker` job exists to add it to.
- Dependabot is live ([`.github/dependabot.yml`](../.github/dependabot.yml))
  — worth periodically checking its PRs aren't just accumulating unmerged.
- A pre-commit or CI grep for `console.log` in `src/` that isn't behind the
  `pino` logger, to stop debug/credential logging from creeping back in now
  that it's been removed once already.

## Reporting

This is a learning project without a formal disclosure process. If this ever
runs anywhere with real user data, add a `SECURITY.md` with a contact address
before that happens — don't wait for an incident to figure out where reports
should go.
