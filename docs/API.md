# API Reference

Base URL: `http://localhost:5080/api` (configurable via `PORT`)

## Authentication

Protected endpoints require a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Obtain a token from `POST /auth/register`, `POST /auth/login`, or
`POST /auth/setup-admin` (first admin only).

## Response envelope

All endpoints respond with JSON in a consistent shape:

```json
{
  "success": true,
  "message": "Human-readable summary",
  "data": { },
  "pagination": { }
}
```

Errors:

```json
{
  "success": false,
  "message": "What went wrong",
  "error": "Detail (omitted in production for 500s)"
}
```

### Status codes

| Code | Meaning                                  |
| ---- | ----------------------------------------- |
| 200  | Success                                    |
| 201  | Created                                    |
| 400  | Bad request / validation error             |
| 401  | Unauthorized (missing/invalid/expired token) |
| 403  | Forbidden (authenticated, wrong role/owner) |
| 404  | Not found                                  |
| 409  | Conflict (duplicate, business rule violation) |
| 429  | Rate limited                               |
| 500  | Internal server error                      |

### Pagination

Applies to every list endpoint.

| Param   | Default | Notes                     |
| ------- | ------- | -------------------------- |
| `page`  | `1`     | 1-indexed                  |
| `limit` | `10`    | max enforced at the gateway rate limiter, not per-endpoint yet |

Response includes:

```json
"pagination": {
  "current_page": 1,
  "total_pages": 5,
  "total_items": 47,
  "items_per_page": 10,
  "has_next": true,
  "has_prev": false
}
```

### Rate limits

Two layers, both active on every `/api/*` request:

- A flat, IP-based backstop: 100 requests / 15 min (`express-rate-limit`).
- A role-aware limit, requests/minute, backed by Redis when `REDIS_URL` is
  set (falls back to in-process — see `docs/SETUP.md` — if not):

| Role      | Limit               |
| --------- | -------------------- |
| Guest     | 20 req / min          |
| User      | 60 req / min           |
| Librarian | 120 req / min          |
| Admin     | 300 req / min          |

Disabled entirely under `NODE_ENV=test` so the automated test suite isn't
flaky against shared per-minute buckets — see the manual `curl` procedures in
[`SECURITY_TESTING.md`](SECURITY_TESTING.md) to exercise this for real.

---

## Health — `/api/health`

### `GET /api/health`
Public. Liveness/readiness check — confirms the process is up and the
database is reachable. Used by the Docker healthcheck.

```json
// 200 — healthy
{ "status": "ok", "uptime_seconds": 42, "timestamp": "...", "database": "connected" }

// 503 — database unreachable
{ "status": "degraded", "uptime_seconds": 42, "timestamp": "...", "database": "disconnected" }
```

---

## Auth — `/api/auth`

### `POST /auth/register`
Public. Creates a `User`-role account.

```json
// request
{
  "first_name": "John",
  "last_name": "Doe",
  "user_name": "johndoe",
  "email": "john@example.com",
  "phone": "08012345678",
  "password": "Password123",
  "image_url": null
}
```
Password must be 8+ characters with at least one uppercase, one lowercase,
and one digit.

```json
// 201 response
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": { "id": 1, "first_name": "John", "...": "..." },
    "token": "<jwt>",
    "token_type": "Bearer",
    "expires_in": "7d"
  }
}
```

### `POST /auth/login`
Public.

```json
{ "emailOrUsername": "john@example.com", "password": "Password123" }
```

Returns the same `{ user, token, token_type, expires_in }` shape as register.

### `POST /auth/logout`
Protected. Blacklists the current token (Redis-backed, or in-process — see
`docs/SETUP.md`) so it's rejected on every subsequent request, even though it
hasn't naturally expired yet.

### `GET /auth/me`
Protected. Returns the current user's profile (no password field).

### `POST /auth/refresh`
Protected. Issues a new JWT for the current user.

### `POST /auth/change-password`
Protected.

```json
{ "current_password": "Password123", "new_password": "NewPassword456" }
```

### `POST /auth/setup-admin`
Public, but gated by a setup key and refuses if any user already exists —
intended for first-run bootstrapping only.

```json
{
  "admin_email": "admin@yourlibrary.com",
  "admin_password": "SecurePass123!",
  "setup_key": "value of INITIAL_SETUP_KEY"
}
```

### `POST /auth/forgot-password`
Public. Always responds with the same generic message regardless of whether
the email exists (no user enumeration). If the account exists, emails a
single-use, 1-hour-expiry reset token via SMTP — or logs it server-side as a
dev-mode fallback if `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` aren't configured.
The token is never returned in this response.

```json
{ "email": "john@example.com" }
```
```json
// 200 — always this shape, whether or not the email exists
{ "success": true, "message": "If an account with that email exists, a password reset link has been sent." }
```

### `POST /auth/reset-password`
Public — authorization comes from possessing a valid reset token, not from a
session. Consumes the token (single-use; a second attempt with the same
token returns 400) and updates the password.

```json
{ "token": "<reset token from the email>", "new_password": "NewSecurePass123" }
```

---

## Authors — `/api/authors`

`GET /` responses are cached in-process for 30s (`AUTHORS_CACHE_TTL_SECONDS`),
keyed by the full query string, and cleared on any create/update/delete.

| Method | Path            | Access          | Notes |
| ------ | --------------- | --------------- | ----- |
| GET    | `/`             | Public          | `page`, `limit`, `search`, `sort_by`, `order` |
| GET    | `/:id`          | Public          | `include_books=true` to embed the author's books |
| POST   | `/`             | Admin/Librarian | `first_name`, `last_name`, `email` required |
| PUT    | `/:id`          | Admin/Librarian | partial update |
| DELETE | `/:id`          | Admin/Librarian | 409 if the author has books attached |

```json
// POST /authors request
{
  "first_name": "George",
  "last_name": "Orwell",
  "email": "orwell@example.com",
  "date_of_birth": "1903-06-25",
  "biography": "English novelist...",
  "phone": null,
  "image": null
}
```

---

## Books — `/api/books`

`GET /` responses are cached in-process for 30s (`BOOKS_CACHE_TTL_SECONDS`),
keyed by the full query string, and cleared on any create/update/delete.

| Method | Path              | Access          | Notes |
| ------ | ----------------- | --------------- | ----- |
| GET    | `/`               | Public          | `page`, `limit`, `search`, `author_id`, `genre`, `status` |
| GET    | `/:id`            | Public          | `include_author=true`, `include_borrows=true` |
| POST   | `/`               | Admin/Librarian | see below |
| PUT    | `/:id`            | Admin/Librarian | partial update |
| DELETE | `/:id`            | Admin/Librarian | 409 if the book has active borrows |
| POST   | `/:id/borrow`     | Authenticated   | body: `{ "due_days": 14 }` (optional, default 14) |
| POST   | `/:id/return`     | Authenticated   | no body |

```json
// POST /books request
{
  "isbn": "978-0451524935",
  "title": "1984",
  "author_id": 1,
  "published_date": "1949-06-08",
  "description": "A dystopian social science fiction novel...",
  "genre": "Dystopian Fiction",
  "language": "English",
  "pages": 328,
  "publisher": "Secker & Warburg",
  "total_copies": 5,
  "available_copies": 5,
  "status": "Available"
}
```

```json
// POST /books/1/borrow response (201)
{
  "success": true,
  "message": "Book borrowed successfully",
  "data": {
    "borrow_record": { "id": 10, "due_date": "...", "status": "Borrowed", "...": "..." },
    "book": { "id": 1, "title": "1984", "available_copies": 4, "status": "Available" },
    "due_date": "2026-08-31T00:00:00.000Z",
    "days_allowed": 14
  }
}
```

```json
// POST /books/1/return response (200)
{
  "success": true,
  "message": "Book returned successfully",
  "data": {
    "borrow_record": { "...": "..." },
    "book": { "id": 1, "available_copies": 5, "status": "Available" },
    "return_details": {
      "borrowed_date": "...",
      "due_date": "...",
      "returned_date": "...",
      "is_overdue": false,
      "days_late": 0,
      "late_fee": 0
    }
  }
}
```

Business rules: max 5 concurrent borrows per user, can't double-borrow the
same book, book must have `available_copies > 0` and `status: "Available"`.

---

## Users — `/api/users`

| Method | Path                    | Access                          | Notes |
| ------ | ----------------------- | -------------------------------- | ----- |
| GET    | `/public`               | Public                           | limited fields only |
| GET    | `/profile`              | Authenticated                    | current user, with stats |
| GET    | `/`                     | Admin                            | `page`, `limit`, `search`, `role`, `is_active` |
| GET    | `/:id`                  | Admin, Librarian, or own profile | `include_borrows=true`, `include_stats=true` |
| GET    | `/:id/borrow-records`   | Owner, Admin, Librarian          | `page`, `limit`, `status` |
| POST   | `/`                     | Admin                            | create any role |
| PUT    | `/:id`                  | Owner, Librarian, or Admin       | partial update — see field restrictions below |
| DELETE | `/:id`                  | Admin                            | soft delete; 409 if active borrows or last admin |

```json
// POST /users request (Admin only)
{
  "first_name": "Jane",
  "last_name": "Smith",
  "user_name": "janesmith",
  "email": "jane@example.com",
  "password": "Password123",
  "role": "Librarian",
  "is_active": true
}
```

`PUT /:id` field restrictions — which fields a given caller may set are
enforced server-side (silently dropped if present but not permitted, except
`role`, which returns `403` if set by anyone other than an Admin):

| Caller                        | Settable fields |
| ------------------------------ | ---------------- |
| Admin                           | `first_name`, `last_name`, `phone`, `email`, `image_url`, `password`, `role`, `is_active`, `email_verified` |
| Librarian (editing another user) | `first_name`, `last_name`, `phone`, `image_url` |
| Self (own profile)              | `first_name`, `last_name`, `phone`, `email`, `image_url`, `password` |

---

## Borrow records — `/api/borrow-records`

| Method | Path             | Access                | Notes |
| ------ | ---------------- | ---------------------- | ----- |
| GET    | `/`              | Admin/Librarian         | `page`, `limit`, `user_id`, `book_id`, `status`, `overdue_only` |
| GET    | `/overdue`       | Admin/Librarian         | `page`, `limit` |
| GET    | `/statistics`    | Admin/Librarian         | totals, active/returned/overdue counts, avg borrow duration |
| POST   | `/:id/extend`    | Owner, Admin, Librarian | body: `{ "extension_days": 7 }` (optional, default 7) |

```json
// GET /borrow-records/statistics response
{
  "success": true,
  "message": "Borrowing statistics retrieved successfully",
  "data": {
    "total_borrows": 120,
    "active_borrows": 34,
    "returned_borrows": 80,
    "overdue_borrows": 6,
    "avg_borrow_days": 12.4,
    "generated_at": "2026-08-17T12:00:00.000Z"
  }
}
```

---

## Error response examples

```json
// 401 — no/invalid token
{ "success": false, "message": "Access denied. No token provided" }

// 403 — wrong role
{ "success": false, "message": "Access denied. Required role(s): Admin. Your role: User" }

// 409 — business rule
{ "success": false, "message": "Borrow limit exceeded", "active_borrows": 5, "max_allowed": 5 }

// 429 — rate limited
{ "success": false, "message": "Too many requests from this IP, please try again after 15 minutes" }
```
