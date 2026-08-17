# Docker

Complete containerized stack: the API, a MySQL 8 instance, and a Redis
instance, wired together with Docker Compose. See
[`SETUP.md`](SETUP.md) for the full setup walkthrough — this
file covers just the Docker-specific details.

## Contents

- **`Dockerfile`** — multi-stage build (`deps` → `runtime`, plus a `test`
  stage). Runs as a non-root user, uses `dumb-init` as PID 1 for clean signal
  handling, and has a `GET /api/health` healthcheck built in. The built image
  is tagged `lms-api` (Docker requires lowercase repository names).
- **`docker-compose.yml`** — the `api` service, a `db` (MySQL 8) service, and
  a `redis` (Redis 7) service backing the token blacklist and role-based rate
  limiter. The database service loads `src/Database/library.database.sql`
  automatically on first startup via MySQL's `/docker-entrypoint-initdb.d/`
  convention — no manual schema step needed.
- **`.env.example`** — template for `src/.env`, the file the compose stack's
  `env_file` directive actually reads (see Notes below for why it's `src/`,
  not the repo root or `docker/`).
- **`.dockerignore`** — keeps `node_modules`, tests, docs, and secrets out of
  the build context/image.

## Quick start

```bash
cp docker/.env.example src/.env
# edit src/.env — at minimum set JWT_SECRET and DB_PASSWORD

docker compose -f docker/docker-compose.yml --env-file src/.env up --build
```

API: `http://localhost:5080` (or whatever `PORT` you set), image tagged `lms-api:latest`.
MySQL: `localhost:3306`, database `library_db` (or whatever `DB_NAME` you set).
Redis: internal to the Compose network only (not published to the host).

## Common commands

```bash
# Rebuild after a dependency change
docker compose -f docker/docker-compose.yml --env-file src/.env up --build

# Run in the background
docker compose -f docker/docker-compose.yml --env-file src/.env up -d

# Tail logs
docker compose -f docker/docker-compose.yml --env-file src/.env logs -f api

# Stop, keep data
docker compose -f docker/docker-compose.yml --env-file src/.env down

# Stop and wipe the MySQL volume (fresh schema load next time)
docker compose -f docker/docker-compose.yml --env-file src/.env down -v

# Shell into the running API container
docker compose -f docker/docker-compose.yml --env-file src/.env exec api sh

# Run the test suite inside a container (needs its own DB — see below)
docker build -f docker/Dockerfile --target test -t lms-api:test ..
docker run --rm --env-file src/.env -e NODE_ENV=test lms-api:test
```

## Notes

- **`.env` lives at `src/.env`, not the repo root or `docker/`.** `src/server.js`
  and `src/config/*.js` resolve it explicitly via `path.resolve(__dirname, ...)`
  rather than relying on `process.cwd()`, so it has to live alongside them
  regardless of where the process is launched from. The `env_file:` line
  inside the `api` service (`../src/.env`, relative to `docker-compose.yml`'s
  own location in `docker/`) points there for the same reason.
- **`--env-file src/.env` is required** on the `docker compose` command
  itself, not just inside the compose file. Compose resolves `${VAR}`
  substitution (used in `ports:`, `image:`, etc.) relative to the compose
  file's own directory by default — since `docker-compose.yml` lives in
  `docker/`, it would otherwise look for `docker/.env` and silently fall
  back to every default (`${DB_PORT:-3306}` etc.) instead of your real
  `src/.env`. This is a separate mechanism from the `env_file:` line inside
  the `api` service, which only injects vars into that one container's
  environment and doesn't affect `${VAR}` substitution in the YAML itself.
  Verified live: without the flag, `DB_PORT` overrides were silently
  ignored; with it, they applied correctly.
- The `api` service's `DB_HOST`/`DB_PORT` are overridden inside
  `docker-compose.yml` to point at the `db` service by its Compose network
  name — you don't need to change those in `src/.env` for the Docker path,
  only for running the app directly on your host.
- `depends_on: condition: service_healthy` means the API container won't
  start until MySQL's healthcheck (`mysqladmin ping`) passes — in practice
  MySQL 8's own internal restart during first-time initialization can still
  cause a couple of connection-refused restarts on the very first `up`
  (`restart: unless-stopped` recovers automatically within a few seconds;
  this is a known MySQL-in-Docker quirk, not a bug in this stack).
- The image has no build step (plain JS, no bundler), so the Dockerfile is
  intentionally simple: install prod deps, copy source, run.
- The container healthcheck hits `GET /api/health`, which also checks
  database connectivity (`src/routes/health.routes.js`) — a `503` there means
  the process is up but can't reach MySQL.
- Redis isn't strictly required — if `REDIS_URL` is unset the app falls back
  to an in-process store (see `src/utils/store.js`), which is fine for a
  single instance but won't share state across replicas or survive a
  restart. The Compose stack always provisions Redis so that fallback is
  never silently in play.
