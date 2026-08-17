// Minimal in-process TTL cache for read-heavy public endpoints
// (GET /books, GET /authors). Not shared across instances — fine for a
// single-process deployment; swap for a Redis-backed cache (src/utils/store.js
// already has a Redis connection when REDIS_URL is set) if this ever runs
// behind more than one instance.
class SimpleCache {
	constructor(ttlSeconds = 30) {
		this.ttlMs = ttlSeconds * 1000;
		this.entries = new Map();
	}

	get(key) {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			this.entries.delete(key);
			return undefined;
		}
		return entry.value;
	}

	set(key, value) {
		this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
	}

	// Clear everything, or everything whose key starts with `prefix`.
	clear(prefix) {
		if (!prefix) {
			this.entries.clear();
			return;
		}
		for (const key of this.entries.keys()) {
			if (key.startsWith(prefix)) this.entries.delete(key);
		}
	}
}

module.exports = SimpleCache;
