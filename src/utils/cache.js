const { hasRedis, redisClient } = require("./store");
const logger = require("./logger");

// TTL response cache for read-heavy public endpoints (GET /books,
// GET /authors). Backed by Redis when REDIS_URL is set — so cached
// responses and invalidation are shared across every instance behind a load
// balancer — falling back to an in-process Map otherwise (fine for a single
// instance, e.g. local dev). A namespace is required so each cache's keys
// (and its "clear everything in this cache" index) stay isolated from every
// other cache sharing the same Redis instance.
class SimpleCache {
	constructor(namespace, ttlSeconds = 30) {
		this.namespace = namespace;
		this.ttlSeconds = ttlSeconds;
		this.ttlMs = ttlSeconds * 1000;
		this.entries = new Map();
		this.useRedis = hasRedis && !!redisClient;
	}

	_key(key) {
		return `cache:${this.namespace}:${key}`;
	}

	// Redis has no cheap "delete every key under this prefix" primitive
	// (KEYS/SCAN are O(n) and not something a response cache should lean
	// on) — so writes also record their key in this set, and clear() just
	// deletes everything the set names.
	_indexKey() {
		return `cache:${this.namespace}:__index__`;
	}

	async get(key) {
		if (this.useRedis) {
			try {
				const raw = await redisClient.get(this._key(key));
				return raw === null ? undefined : JSON.parse(raw);
			} catch (error) {
				logger.warn(
					{ err: error, namespace: this.namespace },
					"Cache read failed, treating as a miss"
				);
				return undefined;
			}
		}

		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			this.entries.delete(key);
			return undefined;
		}
		return entry.value;
	}

	async set(key, value) {
		if (this.useRedis) {
			try {
				const fullKey = this._key(key);
				await redisClient.set(fullKey, JSON.stringify(value), "EX", this.ttlSeconds);
				await redisClient.sadd(this._indexKey(), fullKey);
				// The index only needs to outlive its longest-lived member by a
				// little; re-stamping its TTL on every write keeps it from
				// outliving actual usage of this cache by much.
				await redisClient.expire(this._indexKey(), this.ttlSeconds + 60);
			} catch (error) {
				logger.warn(
					{ err: error, namespace: this.namespace },
					"Cache write failed, skipping"
				);
			}
			return;
		}

		this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
	}

	async clear() {
		if (this.useRedis) {
			try {
				const indexKey = this._indexKey();
				const keys = await redisClient.smembers(indexKey);
				if (keys.length) await redisClient.del(...keys, indexKey);
				else await redisClient.del(indexKey);
			} catch (error) {
				logger.warn({ err: error, namespace: this.namespace }, "Cache clear failed");
			}
			return;
		}

		this.entries.clear();
	}
}

module.exports = SimpleCache;
