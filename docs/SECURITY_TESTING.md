# LMS-API — Security Test Plan

A checklist for a security review pass across the API. Status here reflects a
**static code review** (plus a couple of real tool runs — `npm audit`,
targeted `grep`s — done in this pass) — nothing has been exercised against a
running instance yet. Where an item is genuinely confirmed clean, it's marked
verified; everything else is marked open with the specific gap and a pointer
into [`TODO.md`](TODO.md) for the fix. The goal of a future pass is to convert
every "reviewed" below into "verified live" with real `curl` requests against
a running server — see the [live test procedures](#live-test-procedures) at
the bottom, kept from the previous version of this doc.

## 1. Authentication & authorization

- [ ] **Auth** — bcrypt cost factor is configurable via `BCRYPT_ROUNDS`
      (default 12, [`auth.config.js:14`](../src/config/auth.config.js#L14));
      `bcrypt.compare` is timing-safe. **Gap:** the not-found path in `login`
      ([`auth.controllers.js:160-166`](../src/controllers/auth.controllers.js#L160-L166))
      returns immediately without a compare, while the wrong-password path
      runs a full bcrypt compare — a measurable timing difference that lets an
      attacker enumerate valid emails/usernames. Fix: always run a dummy
      `bcrypt.compare` against a constant hash on the not-found path so both
      branches take the same time.
- [ ] **Auth bypass testing** — not live-tested this pass. Statically
      reviewed: the `verifyToken` → `requireAuth` → `requireRole`/
      `requireOwnershipOrAdmin` chain is sound in principle (see
      [`ARCHITECTURE.md`](ARCHITECTURE.md#auth--authorization-model)), but
      `GET /users/:id` is mis-wired — it chains `requireAdmin` before
      `requireAdminOrLibrarian`, so the second check is unreachable
      ([`users.routes.js:56`](../src/routes/users.routes.js#L56)). Needs a live
      pass with real tokens per role once the Phase 0 fixes land.
- [ ] **Privilege escalation** — **Critical, confirmed by code review, not yet
      fixed.** `updateUserController`
      ([`users.controllers.js:310-318`](../src/controllers/users.controllers.js#L310-L318))
      only blocks four field names (`id`, `created_at`, `updated_at`,
      `deleted_at`) — everything else in the request body, including `role`,
      `is_active`, and `email_verified`, passes straight through to the
      database. Combined with `requireOwnershipOrAdmin()` letting any user hit
      `PUT /users/:id` for their **own** id
      ([`users.routes.js:78`](../src/routes/users.routes.js#L78)), a plain
      `User` can send `PUT /users/:id { "role": "Admin" }` against their own
      account and become an Admin. `updateData.role` is only checked against
      the enum of valid role *names*
      ([`users.controllers.js:300-308`](../src/controllers/users.controllers.js#L300-L308))
      — never checked against *who's allowed to set it*. This is the single
      most severe issue found in this pass. Now tracked as a P0 item in
      [`TODO.md`](TODO.md).
- [ ] **JWT/token testing** — **Confirmed gap.** Both `jwt.verify` call sites
      ([`auth.middlewares.js:31`](../src/middlewares/auth.middlewares.js#L31)
      in `verifyToken`, and
      [`auth.middlewares.js:141`](../src/middlewares/auth.middlewares.js#L141)
      in `optionalAuth`) omit the `algorithms` option, so nothing pins the
      expected signing algorithm. `jsonwebtoken`'s transitive dependency `jws`
      also has an open advisory for HMAC signature verification (see §8) —
      worth fixing both together. Tokens are otherwise well-formed (`id`/
      `email`/`role` claims only), but `issuer`/`audience` are configured in
      `auth.config.js` and **never actually passed** to `jwt.sign`
      ([`auth.controllers.js:12-24`](../src/controllers/auth.controllers.js#L12-L24))
      or checked in `jwt.verify` — configured but inert.
- [ ] **Password policies** — inconsistent across the app: register/create-user
      require 8+ chars with upper/lower/number, `changePassword` only requires
      6 with no complexity check, and the register error message says "6
      characters" while the actual check is `< 8`
      ([`auth.controllers.js:56-59`](../src/controllers/auth.controllers.js#L56-L59)).
      No account lockout after repeated failed logins despite
      `rateLimitConfig.loginAttempts` already being defined and unused
      ([`auth.config.js:41-46`](../src/config/auth.config.js#L41-L46)).
- [ ] **Broken access control / IDOR** — resource ownership is checked
      correctly for borrow records (`getUserBorrowRecord`, `extendDueDate`
      both do an inline `req.user.id !== record.user_id` check) and for user
      profile updates (`requireOwnershipOrAdmin`). The one confirmed gap is the
      `GET /users/:id` routing bug noted above — Librarians and the resource
      owner currently can't reach it at all (too restrictive, not too
      permissive, but still wrong).
- [ ] **Mass assignment** — **Root cause of the privilege-escalation finding
      above.** `updateUserById`
      ([`users.model.js:169-207`](../src/models/users.model.js#L169-L207)),
      `updateBookById`
      ([`books.model.js:132-157`](../src/models/books.model.js#L132-L157)),
      and `updateAuthor`
      ([`authors.model.js:86-114`](../src/models/authors.model.js#L86-L114))
      all build their `UPDATE ... SET` clause by iterating
      `Object.keys(updateData)` with **no field allowlist** — the column name
      itself, not just the value, comes straight from client input. For
      books/authors this only enables setting fields the model didn't intend
      to expose (low impact — no privileged fields on those tables). For users
      it's the role-escalation vector above. **Related, more severe:** because
      the *column name* is interpolated directly
      (`` `${key} = ?` ``, [`users.model.js:177`](../src/models/users.model.js#L177) /
      [`books.model.js:140`](../src/models/books.model.js#L140) /
      [`authors.model.js:95`](../src/models/authors.model.js#L95)) rather than
      validated against a known column list, a crafted JSON key in the
      request body reaches the query as raw SQL, not just as an unexpected
      column — a real SQL injection vector distinct from the `LIMIT`/`OFFSET`
      one already tracked. Both are now P0 items in `TODO.md`, sharing one
      fix: replace the dynamic key iteration with an explicit per-model
      allowlist of updatable columns.

## 2. Session & token management

There's no server-side session store in the request path — auth is pure
bearer-JWT. (`express-session` and `cookie-parser` are both in
`package.json`, and `server.js` wires up `cookie-parser`, but grepping the
codebase turns up zero reads of `req.cookies` or writes of `res.cookie`
outside a commented-out block in `logout` — both are effectively dead weight
for auth; see §8.)

- [X] ~~**Cookie-based session risk**~~ — **N/A, verified by design.** The JWT
      is delivered via `Authorization: Bearer`, not a cookie, so there's
      nothing here for `httpOnly`/`sameSite`/`secure` to protect, and CSRF
      risk is correspondingly low — a malicious page can't make a browser
      auto-attach a bearer token the way it would a cookie.
- [X] ~~**Deactivation cuts off active tokens**~~ — **Verified clean.**
      `verifyToken` re-fetches the user from the DB on every request and
      rejects if `is_active` is false
      ([`auth.middlewares.js:33-47`](../src/middlewares/auth.middlewares.js#L33-L47)).
      Deactivating a user does immediately cut off their access — this part
      works correctly.
- [ ] **Instant session revocation / logout** — **Confirmed gap.**
      `authUtils.isTokenBlacklisted` exists
      ([`auth.config.js:110`](../src/config/auth.config.js#L109-L112)) but
      `verifyToken` never calls it. `logout` records the event and returns
      200, but the token it was handed is still valid for every subsequent
      request until it naturally expires (up to `JWT_EXPIRE`, default 7 days).
- [ ] **Concurrent session limits** — `sessionConfig.maxActiveSessions` is
      defined in `auth.config.js` but nothing in the login flow checks or
      enforces it — same "configured but inert" pattern as the JWT
      issuer/audience claims above.

## 3. Input validation & injection

- [ ] **Input validation on all endpoints** — validation today is ad-hoc
      `if (!field)` presence checks duplicated per controller (register,
      create-user, create-book, create-author each reimplement the same
      email-regex/required-field logic independently). No schema library in
      use. Not a vulnerability by itself, but it's exactly the kind of
      duplication that let the register endpoint's password-length message
      drift from its actual check (§1).
- [X] ~~**SQL injection (value position)**~~ — **Verified clean, with one
      documented exception.** Every query in the codebase goes through
      `mysql2`'s parameterized `query(sql, params)` helper
      ([`database.config.js:36-46`](../src/config/database.config.js#L36-L46))
      for values. The one exception is `LIMIT`/`OFFSET` string-interpolated in
      `findAllBooks`
      ([`books.model.js:82`](../src/models/books.model.js#L82)) — currently
      only reachable as sanitized integers from controllers, tracked in
      `TODO.md`. No `WHERE x = '${rawInput}'`-style value injection found
      anywhere.
- [ ] **SQL injection (identifier position)** — see the column-name injection
      in §1 — a separate, live, unmitigated issue from the value-position one
      above.
- [ ] **Stored payload handling** — `books.description`, `authors.biography`,
      and similar free-text fields are stored and returned as-is, with no
      sanitization on the way in or an escaping contract documented on the way
      out. This API has no server-rendered views itself, so there's no
      first-party stored-XSS surface in this repo — but nothing here protects
      a future frontend that renders these fields with `innerHTML`/
      `dangerouslySetInnerHTML`. Worth a one-line note in `API.md` stating
      these fields are unsanitized, HTML-unsafe strings.
- [X] ~~**Path traversal / file handling**~~ — **N/A, verified.** `multer` is a
      declared dependency but is never `require`d anywhere in `src/` or
      `server.js` — there is no file upload endpoint in this API at all
      despite the dependency existing (see §8).

## 4. API & application security

- [ ] **Rate limiting** — two independent limiters exist: a global
      `express-rate-limit` (100 req/15 min per IP,
      [`server.js:37-43`](../src/server.js#L37-L43)) applied to every `/api/*`
      route, and a fully-implemented, role-aware `roleBasedRateLimit`
      middleware
      ([`auth.middlewares.js:192-246`](../src/middlewares/auth.middlewares.js#L192-L246))
      that — checked against every route file — is **never actually mounted
      anywhere**. The role-tiered limits documented in `API.md`/the README
      aren't enforced by anything right now; only the flat global 100/15min
      applies. Also note: `express-rate-limit` itself has an open
      high-severity advisory via its `ip-address` dependency (IPv4-mapped
      IPv6 bypass — see §8), independent of this app's own config.
- [ ] **Security headers** — `server.js` sets four headers by hand
      ([`server.js:61-67`](../src/server.js#L61-L67)): `X-Content-Type-Options`,
      `X-Frame-Options`, `X-XSS-Protection` (deprecated, ignored by modern
      browsers), and `Strict-Transport-Security`. No CSP, no
      `Referrer-Policy`, no `Permissions-Policy`, and no `helmet` dependency
      at all. Already recommended in `TODO.md` — worth prioritizing since it's
      a small change for meaningfully broader coverage.
- [X] ~~**File upload security**~~ — **N/A**, no upload endpoint exists (§3).
- [X] ~~**API versioning / endpoint exposure**~~ — **Verified clean.** No
      `/api-docs` or OpenAPI surface exists yet (`docs/API.md` is handwritten,
      nothing generated/exposed). No dead/unmounted route files found — every
      `*.routes.js` file is `app.use()`'d in `server.js`.
- [X] ~~**Business logic — borrow/return integrity**~~ — **Verified clean.**
      `borrowBook` and `returnBook` both run inside a real DB transaction
      ([`books.model.js:227-267`](../src/models/books.model.js#L227-L267),
      [`270-309`](../src/models/books.model.js#L270-L309)), so a crash
      mid-operation can't leave `available_copies` and the borrow record out
      of sync. The max-5-books and no-double-borrow rules are enforced
      server-side, not just assumed on the client. `updateBooksById` does use
      the wrong lookup functions for its validation checks, but that's a
      functional bug, not an exploitable one — see `TODO.md` Phase 1.

## 5. Encryption & data protection

- [ ] **Encryption in transit** — this repo has no TLS termination of its
      own — Express listens on plain HTTP (`app.listen(PORT)`,
      [`server.js:146`](../src/server.js#L146)), and the Docker Compose stack in
      [`docker/`](../docker/) doesn't front it with a reverse proxy either.
      Reasonable for local/dev, but TLS is entirely the deploying
      environment's responsibility — worth stating explicitly in
      [`SETUP.md`](SETUP.md)'s guidance rather than leaving it implicit.
- [X] ~~**Secrets at rest**~~ — **Verified clean.** `.env` is gitignored, and
      `git ls-files | grep env` turns up nothing committed. `JWT_SECRET`'s
      strength is validated with a *warning* at startup
      ([`auth.config.js:127-146`](../src/config/auth.config.js#L127-L146)) but
      a weak/default secret doesn't stop the server from starting — already
      tracked in `TODO.md` Phase 2 as a should-refuse-to-boot fix.
- [ ] **Data at rest** — depends entirely on wherever MySQL's data directory
      ends up (host filesystem or Docker volume) — outside this repo's
      control either way.

## 6. Error handling & resilience

- [ ] **Error boundaries** — **Confirmed gap.** The global error handler in
      `server.js` returns `stack: err.stack` on every 500, unconditionally —
      no `NODE_ENV` gate at all
      ([`server.js:110-119`](../src/server.js#L110-L119)). Every controller also
      independently returns `error: error.message` from its own catch block —
      more contained (usually just a message, not a trace) but still not
      environment-gated. [`errorHandler.middlewares.js`](../src/middlewares/errorHandler.middlewares.js)
      exists as a dedicated place to centralize this and is completely empty
      and unused.
- [ ] **Consistent error shape** — three different response envelopes coexist
      (`{success}`, `{error: true}`, `{status: 'fail'|'success'}`) —
      cosmetic, but makes "did this request fail" harder to check generically
      from a client. Already in `TODO.md`.

## 7. Observability & incident response

- [ ] **Logging** — **Confirmed gap, more severe than a typical missing-log
      finding — this is the single highest-impact item in this whole pass.**
      `verifyPassword`
      ([`users.model.js:15-36`](../src/models/users.model.js#L15-L36)) logs
      the **plaintext password** and a hash prefix to stdout on every login
      attempt; `login`
      ([`auth.controllers.js:139-231`](../src/controllers/auth.controllers.js#L139-L231))
      logs the full request body and password-hash existence; `server.js`'s
      debug middleware
      ([`server.js:47-53`](../src/server.js#L47-L53)) logs every request body for
      every route. Wherever these logs are collected — a file, container
      logs, a log aggregator — credentials sit there in plaintext. This is
      `TODO.md` Phase 0's top item.
- [ ] **Audit trail** — no structured audit log exists for security-relevant
      events (role changes, admin creation, password resets, deactivation) —
      only ad-hoc `console.log`/`console.error` scattered through 6 files. No
      way to reconstruct "who changed what, when" after the fact.
- [ ] **Monitoring / alerting** — no error-tracking integration (Sentry or
      equivalent). Uncaught exceptions and unhandled rejections are logged to
      console and trigger a graceful shutdown
      ([`server.js:224-238`](../src/server.js#L224-L238)), but nothing pages
      anyone or persists the failure anywhere durable.
- [ ] **Backups** — no backup mechanism exists for the MySQL data — schema
      only (`library.database.sql`), no dump/restore script, no scheduled
      job. Given the DB is the only datastore in this project, worth a real
      `mysqldump` script before this runs anywhere that matters.

## 8. Infrastructure & dependency supply chain

- [ ] **`npm audit`** — **run in this pass**, real numbers:
      **9 vulnerabilities (3 moderate, 6 high)**, all in transitive
      dependencies.
  - `jws` (high, via `jsonwebtoken`) — "Improperly Verifies HMAC Signature,"
    directly related to the missing `algorithms:` pin in §1.
  - `express-rate-limit`/`ip-address` (high) — IPv4-mapped IPv6 rate-limit
    bypass, directly related to the rate-limiting gap in §4.
  - `multer` (high, 5 separate DoS advisories) and `nodemailer` (high, 7
    advisories including SMTP command injection) — both **fully unused** in
    this codebase (confirmed via `grep -rn "multer\|nodemailer" src/
    server.js` — zero hits for either). Removing them from `package.json`
    closes those advisories outright instead of patching unreachable code.
  - `body-parser`, `morgan`, `path-to-regexp`, `qs` (moderate/high) —
    transitive via `express` and its own deps; `npm audit fix`
    (non-breaking) should clear these.
  - Not yet run: `npm audit fix` itself, or a rebuild/retest afterward.
    Tracked in `TODO.md`.
- [ ] **Dead dependencies** — beyond `multer`/`nodemailer` above,
      `express-session` is declared and `cookie-parser` is wired up in
      `server.js`, but nothing in the auth flow uses sessions (pure JWT) —
      worth confirming intentional before removing, in case a session-based
      feature is planned.
- [X] ~~**CI / supply chain pinning**~~ — **N/A, nothing to pin yet.** No
      GitHub Actions workflows exist in this repo (`.github/workflows/` not
      present). Worth designing the CI pipeline (`TODO.md` Phase 6) with
      SHA-pinned third-party actions from the start rather than retrofitting
      later.
- [X] ~~**Container security**~~ — **Verified.** [`docker/Dockerfile`](../docker/Dockerfile)
      already runs as a non-root user on a minimal `node:20-alpine` base — no
      root-process gap to flag. Not yet scanned with a dedicated image
      scanner (Trivy/Grype) — worth adding once CI exists.

---

## Summary

Two findings from this pass are more severe than anything in the original
code review and are now the top priority in `TODO.md`, ahead of everything
else in Phase 0:

1. **Self-service privilege escalation** (§1) — any authenticated `User` can
   `PUT` their own profile with `{"role": "Admin"}` and it will be applied
   verbatim. No exploit chain, no injection — just a normal authenticated
   request.
2. **Column-name SQL injection** in `updateUserById`/`updateBookById`/
   `updateAuthor` (§1) — the object-key-as-column-name pattern used by all
   three `update*` functions passes attacker-controlled JSON keys straight
   into the SQL string.

Both share the same fix: replace `Object.keys(updateData).forEach(...)` with
an explicit per-model allowlist of updatable columns. One change closes both.

Everything in this document came from static code review and two real tool
runs (`npm audit`, targeted `grep`s) — none of it has been exercised against
a running instance yet. The next real step is standing up the Docker stack in
[`docker/`](../docker/), working through `TODO.md` Phase 0–1, then re-running
the procedures below against a live server to convert "reviewed" into
"verified."

---

## Live test procedures

Kept from the previous version of this document — copy-pasteable `curl`
procedures for once a server is actually running. See
[`docs/SETUP.md`](SETUP.md) to get one up.

### Password hash leak

```bash
TOKEN="<a valid user JWT>"
curl -s http://localhost:5080/api/auth/me -H "Authorization: Bearer $TOKEN" | grep -i password
```

Expected: no output. Repeat against `GET /users/:id`, `POST /users`,
`PUT /users/:id`, `GET /users/profile`.

### Self-privilege-escalation (new — §1)

```bash
USER_TOKEN="<a valid User-role JWT>"
USER_ID="<that same user's own id>"
curl -s -X PUT http://localhost:5080/api/users/$USER_ID \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d '{"role":"Admin"}'
```

Expected: `403`, role unchanged. Currently: `200`, role becomes `Admin`.

### Column-name SQL injection (new — §1)

```bash
USER_TOKEN="<a valid User-role JWT>"
USER_ID="<that same user's own id>"
curl -s -X PUT http://localhost:5080/api/users/$USER_ID \
  -H "Authorization: Bearer $USER_TOKEN" -H "Content-Type: application/json" \
  -d "{\"role='Admin' -- \":\"x\"}"
```

Expected: `400` (rejected as an invalid field). Test cautiously — depending on
exact MySQL parsing this may throw a syntax error (safe) or partially execute
(not safe) against a real column list; run only against a disposable test
database.

### Unauthenticated password reset

```bash
curl -s -X POST http://localhost:5080/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"victim@example.com","newPassword":"Hacked123!"}'
```

Expected: `404`/route removed. Currently: `200` — full account takeover with
nothing but a known email.

### Logout token invalidation

```bash
TOKEN="<a valid user JWT>"
curl -s -X POST http://localhost:5080/api/auth/logout -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5080/api/auth/me -H "Authorization: Bearer $TOKEN"
```

Expected: second call returns `401`. Currently: still returns the profile.

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

Expected (per role-tiered limits as documented): mostly `200` then `429`.
Currently: only the flat global 100/15min limiter is actually mounted (§4),
so this will look more permissive than the docs suggest until that's fixed.

### Timing-based user enumeration (new — §1)

```bash
time curl -s -o /dev/null -X POST http://localhost:5080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"definitely-not-a-real-user@example.com","password":"x"}'

time curl -s -o /dev/null -X POST http://localhost:5080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"emailOrUsername":"<a real registered email>","password":"wrong-password"}'
```

Expected: comparable timing. Currently: the second call should measurably
outlast the first (bcrypt compare only runs when the account exists).

## Automated checks worth adding

- `npm audit` (or `npm audit --production`) in CI on every PR.
- Dependency scanning (Dependabot/Snyk), particularly for `jsonwebtoken`,
  `bcrypt`, and `mysql2` given what they protect.
- A pre-commit or CI grep for `console.log` in `src/` that isn't behind a
  logger abstraction, to stop debug/credential logging from creeping back in.

## Reporting

This is a learning project without a formal disclosure process. If this ever
runs anywhere with real user data, add a `SECURITY.md` with a contact address
before that happens — don't wait for an incident to figure out where reports
should go.
