const logger = require("./logger");

/**
 * A tiny key-value store abstraction used for the token blacklist and
 * rate-limit counters. Backed by Redis when REDIS_URL is set (works across
 * multiple instances and survives restarts); falls back to an in-process
 * Map otherwise (fine for local dev/tests, but scoped to one process and
 * lost on restart — see docs/TODO.md Phase 2).
 */
class MemoryStore {
	constructor() {
		this.entries = new Map();
		// Sweep expired keys periodically so the map can't grow unbounded.
		this.sweepInterval = setInterval(() => this._sweep(), 60 * 1000);
		this.sweepInterval.unref?.();
	}

	_sweep() {
		const now = Date.now();
		for (const [key, entry] of this.entries) {
			if (entry.expiresAt && entry.expiresAt <= now) {
				this.entries.delete(key);
			}
		}
	}

	async get(key) {
		const entry = this.entries.get(key);
		if (!entry) return null;
		if (entry.expiresAt && entry.expiresAt <= Date.now()) {
			this.entries.delete(key);
			return null;
		}
		return entry.value;
	}

	async set(key, value, ttlSeconds = null) {
		this.entries.set(key, {
			value,
			expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
		});
	}

	async del(key) {
		this.entries.delete(key);
	}

	async incr(key) {
		const current = parseInt((await this.get(key)) || "0", 10);
		const next = current + 1;
		const entry = this.entries.get(key);
		this.entries.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
		return next;
	}

	async expire(key, ttlSeconds) {
		const entry = this.entries.get(key);
		if (entry) entry.expiresAt = Date.now() + ttlSeconds * 1000;
	}

	async close() {
		clearInterval(this.sweepInterval);
	}
}

class RedisStore {
	constructor(redis) {
		this.redis = redis;
	}

	async get(key) {
		return this.redis.get(key);
	}

	async set(key, value, ttlSeconds = null) {
		if (ttlSeconds) {
			await this.redis.set(key, value, "EX", ttlSeconds);
		} else {
			await this.redis.set(key, value);
		}
	}

	async del(key) {
		await this.redis.del(key);
	}

	async incr(key) {
		return this.redis.incr(key);
	}

	async expire(key, ttlSeconds) {
		await this.redis.expire(key, ttlSeconds);
	}

	async close() {
		await this.redis.quit();
	}
}

let store;
let hasRedis = false;
// The raw ioredis client, exposed alongside `store` so callers that need
// Redis-specific behavior the MemoryStore/RedisStore abstraction doesn't
// cover (health-check pings, the response cache's pattern-based clear) can
// reuse this one connection instead of opening another.
let redisClient = null;

if (process.env.REDIS_URL) {
	try {
		const Redis = require("ioredis");
		const redis = new Redis(process.env.REDIS_URL, {
			maxRetriesPerRequest: 2,
			retryStrategy: (times) => Math.min(times * 200, 2000),
			lazyConnect: false,
		});
		redis.on("error", (err) => {
			logger.error(
				{ err },
				"Redis connection error — falling back to in-memory store behavior for this event"
			);
		});
		store = new RedisStore(redis);
		hasRedis = true;
		redisClient = redis;
		logger.info("Rate limiting and token blacklist backed by Redis");
	} catch (error) {
		logger.warn(
			{ err: error },
			"REDIS_URL set but ioredis unavailable/failed to init — falling back to in-memory store"
		);
		store = new MemoryStore();
	}
} else {
	store = new MemoryStore();
	logger.warn(
		"REDIS_URL not set — rate limiting and token blacklist are in-process only (fine for local dev, not for multi-instance production)"
	);
}

module.exports = { store, hasRedis, redisClient, MemoryStore, RedisStore };
