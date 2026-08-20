# Setup Guide

Two paths: [Docker](#docker-setup-recommended) (fastest, no local MySQL
needed) or [manual/local](#manual-local-setup).

## Prerequisites

- Node.js 18+ and npm
- MySQL 8+ (skip if using Docker)
- Docker + Docker Compose (only for the Docker path)

## Docker setup (recommended)

This spins up the API and a MySQL instance together, with the schema loaded
automatically on first boot.

```bash
# from the repo root
cp docker/.env.example src/.env   # then edit src/.env — at minimum set JWT_SECRET

docker compose -f docker/docker-compose.yml --env-file src/.env up --build
```

The API will be reachable at `http://localhost:5080` and MySQL at
`localhost:3306` (credentials from `src/.env`). See [`DOCKER.md`](DOCKER.md)
for details on the compose stack, healthchecks, and rebuilding.

To stop:

```bash
docker compose -f docker/docker-compose.yml --env-file src/.env down          # keep data
docker compose -f docker/docker-compose.yml --env-file src/.env down -v       # wipe DB volume too
```

## Manual / local setup

### 1. Clone and install

```bash
git clone https://github.com/dprince-03/LMS-API.git
cd LMS-API
npm install
```

### 2. Configure environment variables

Create a `.env` file in `src/` (alongside `server.js` — `dotenv` is loaded
relative to that file's location, not the current working directory, so it
must live there regardless of where you run `npm start`/`npm run dev` from):

```env
# Server
PORT=5080
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=library_db
DB_PORT=3306

# JWT
JWT_SECRET=replace_with_a_random_32+_character_string
JWT_EXPIRE=7d
JWT_ISSUER=library-management-system
JWT_AUDIENCE=library-users

# Security
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
BCRYPT_ROUNDS=12
INITIAL_SETUP_KEY=choose_a_secure_one_time_setup_key

# Rate limiting (optional — sane defaults exist if omitted)
RATE_LIMIT_WINDOW=15
RATE_LIMIT_GUEST=20
RATE_LIMIT_USER=60
RATE_LIMIT_LIBRARIAN=120
RATE_LIMIT_ADMIN=300
```

Generate a strong `JWT_SECRET` quickly:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> The README mentions a `generate-secrets.js` helper script — it isn't
> currently checked into the repo (it's git-ignored as a "secrets" file
> pattern). Use the one-liner above, or add the script back and keep it local.

### 3. Set up the database

```bash
mysql -u root -p < src/Database/library.database.sql
```

This creates the `library_db` database and all four tables
(`users`, `authors`, `books`, `borrow_records`).

For any schema change after this point, add a new file under `migrations/`
(forward-only `.sql`, numbered) and apply it with:

```bash
npm run migrate
```

This tracks applied migrations in a `schema_migrations` table, so it's safe
to run repeatedly — already-applied files are skipped.

### 4. Start the server

```bash
npm run dev     # nodemon, auto-reload
# or
npm start       # plain node, for production-like runs
```

You should see a startup banner confirming the DB connection, JWT secret
validation, and the port the server is listening on. Once it's up, browse
`http://localhost:5080/api/docs` for interactive, always-current API
documentation (generated from the route annotations — see
[`CONTRIBUTING.md`](CONTRIBUTING.md) if you're adding or changing a route).

### 5. Create the first admin user

```bash
curl -X POST http://localhost:5080/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "admin_email": "admin@yourlibrary.com",
    "admin_password": "SecurePass123!",
    "setup_key": "YOUR_INITIAL_SETUP_KEY_FROM_ENV"
  }'
```

This only works once — it refuses if any user already exists in the database.

## Running tests

Tests need their own database (don't point them at your dev DB — the test
suite truncates tables between runs).

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS library_db_test;"
mysql -u root -p library_db_test < src/Database/library.database.sql
```

Add a `tests/.env.test` (or export equivalent env vars) pointing `DB_NAME` at
`library_db_test` — `tests/setup.js` loads it from that path specifically.
`BCRYPT_ROUNDS=4` and `DISABLE_OVERDUE_JOB=true` are worth setting there too
— they make the suite noticeably faster and quieter (real bcrypt cost
factors and a live cron job are pointless overhead in tests). Rate limiting
is disabled automatically under `NODE_ENV=test` (see `src/server.js`) so the
suite isn't flaky against shared per-minute buckets.

```bash
npm test                  # full suite, sequential (--runInBand)
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report → coverage/lcov-report/index.html; 70% threshold enforced
npm run test:auth         # single suite, e.g. auth only
npm run test:integration  # integration.test.js only
```

## Linting & formatting

```bash
npm run lint          # ESLint
npm run lint:fix       # ESLint, auto-fixing what it can
npm run format         # Prettier, writes changes
npm run format:check   # Prettier, check only (what CI runs)
```

## Troubleshooting

**"Failed to connect to database" on startup**
Check `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`/`DB_PORT` in `.env` match a
running MySQL instance, and that the database from step 3 exists.

**Port already in use**
Change `PORT` in `.env`, or stop whatever else is bound to 5080
(`lsof -i :5080` on macOS/Linux).

**Server won't start / "Refusing to start in production"**
`initializeAuth()` refuses to boot when `NODE_ENV=production` and
`JWT_SECRET` is missing, the default placeholder, or under 32 characters
(warns but still starts outside production). Set a real one — see step 2.

**Tests hang or leave the process open**
`jest.config.js` sets `forceExit: true` specifically because DB pool
connections can otherwise keep Jest alive; if you see this anyway, check for a
missing `await closeConnection()` in a test teardown.
