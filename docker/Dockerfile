# syntax=docker/dockerfile:1

# ---- Base ----
# Build context is expected to be the repo root (see docker-compose.yml's
# `build.context: ..`), so all COPY paths below are relative to the repo root.
FROM node:26-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

# ---- Dependencies (cached separately from source for faster rebuilds) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Dev dependencies (used only for the `test` stage) ----
FROM base AS deps-dev
COPY package.json package-lock.json ./
RUN npm ci

# ---- Test ----
# `docker build --target test -t lms-api:test .` then run with a test DB.
FROM deps-dev AS test
COPY . .
ENV NODE_ENV=test
CMD ["npm", "test"]

# ---- Runtime ----
FROM base AS runtime
ENV NODE_ENV=production

# Run as a non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY migrations ./migrations

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 5080) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
