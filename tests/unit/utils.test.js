const SimpleCache = require("../../src/utils/cache");
const { escapeLikeWildcards, buildLikeParam } = require("../../src/utils/sanitize");
const { store, RedisStore } = require("../../src/utils/store");
const {
	verifyToken,
	requireOwnershipOrAdmin,
	auditLogger,
} = require("../../src/middlewares/auth.middlewares");
const { captureException, isEnabled } = require("../../src/utils/errorTracking");
const { errorHandler, notFoundHandler } = require("../../src/middlewares/errorHandler.middlewares");
const {
	isBorrowRecordOverdue,
	getBorrowRecordDaysOverdue,
	isBorrowRecordActive,
	calculateBorrowRecordLateFee,
	formatBorrowRecord,
} = require("../../src/models/borrowedRecords.model");
const { isBookAvailable, formatBook } = require("../../src/models/books.model");

describe("mailer", () => {
	it("logs instead of sending when SMTP is not configured (dev fallback)", async () => {
		const { sendMail, smtpConfigured } = require("../../src/utils/mailer");
		expect(smtpConfigured).toBe(false);
		const result = await sendMail({ to: "a@example.com", subject: "Hi", text: "body" });
		expect(result.delivered).toBe(false);
		expect(result.reason).toBe("smtp_not_configured");
	});

	it("sends via nodemailer when SMTP_* env vars are configured", async () => {
		jest.isolateModules(() => {
			const sendMailMock = jest.fn().mockResolvedValue({ messageId: "1" });
			jest.doMock("nodemailer", () => ({
				createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
			}));
			const originalEnv = { ...process.env };
			process.env.SMTP_HOST = "smtp.example.com";
			process.env.SMTP_USER = "user";
			process.env.SMTP_PASS = "pass";
			try {
				const isolated = require("../../src/utils/mailer");
				expect(isolated.smtpConfigured).toBe(true);
				return isolated
					.sendMail({ to: "a@example.com", subject: "Hi", text: "body" })
					.then((result) => {
						expect(result.delivered).toBe(true);
						expect(sendMailMock).toHaveBeenCalled();
					});
			} finally {
				process.env = originalEnv;
				jest.dontMock("nodemailer");
			}
		});
	});

	it("reports delivered:false when the SMTP send itself fails", async () => {
		jest.isolateModules(() => {
			jest.doMock("nodemailer", () => ({
				createTransport: jest.fn(() => ({
					sendMail: jest.fn().mockRejectedValue(new Error("SMTP down")),
				})),
			}));
			const originalEnv = { ...process.env };
			process.env.SMTP_HOST = "smtp.example.com";
			process.env.SMTP_USER = "user";
			process.env.SMTP_PASS = "pass";
			try {
				const isolated = require("../../src/utils/mailer");
				return isolated
					.sendMail({ to: "a@example.com", subject: "Hi", text: "body" })
					.then((result) => {
						expect(result.delivered).toBe(false);
						expect(result.reason).toBe("send_failed");
					});
			} finally {
				process.env = originalEnv;
				jest.dontMock("nodemailer");
			}
		});
	});
});

// No REDIS_URL in the test env (see tests/.env.test), so SimpleCache falls
// back to its in-process Map implementation here — the Redis-backed path is
// covered separately below via a mocked ioredis client.
describe("SimpleCache (in-memory fallback, no REDIS_URL in test env)", () => {
	it("returns undefined for a missing key", async () => {
		const cache = new SimpleCache("test", 30);
		expect(await cache.get("missing")).toBeUndefined();
	});

	it("stores and retrieves a value", async () => {
		const cache = new SimpleCache("test", 30);
		await cache.set("a", { foo: "bar" });
		expect(await cache.get("a")).toEqual({ foo: "bar" });
	});

	it("expires a value after its TTL", async () => {
		const cache = new SimpleCache("test", 0.01); // 10ms
		await cache.set("a", "value");
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(await cache.get("a")).toBeUndefined();
	});

	it("clears everything", async () => {
		const cache = new SimpleCache("test", 30);
		await cache.set("a", 1);
		await cache.set("b", 2);
		await cache.clear();
		expect(await cache.get("a")).toBeUndefined();
		expect(await cache.get("b")).toBeUndefined();
	});

	it("keeps separate namespaces from colliding on the same key", async () => {
		const booksCache = new SimpleCache("books", 30);
		const authorsCache = new SimpleCache("authors", 30);
		await booksCache.set("/list", "books-response");
		await authorsCache.set("/list", "authors-response");
		expect(await booksCache.get("/list")).toBe("books-response");
		expect(await authorsCache.get("/list")).toBe("authors-response");
	});
});

// Exercises the Redis-backed path by mocking src/utils/store's exports
// directly (rather than standing up a real Redis instance) — mirrors the
// pattern used for the errorTracking Sentry tests above.
describe("SimpleCache (Redis-backed, mocked store module)", () => {
	const makeMockRedisClient = () => {
		const data = new Map();
		const sets = new Map();
		return {
			async get(key) {
				return data.has(key) ? data.get(key) : null;
			},
			async set(key, value) {
				data.set(key, value);
				return "OK";
			},
			async sadd(key, member) {
				if (!sets.has(key)) sets.set(key, new Set());
				sets.get(key).add(member);
				return 1;
			},
			async smembers(key) {
				return Array.from(sets.get(key) || []);
			},
			async expire() {
				return 1;
			},
			async del(...keys) {
				let removed = 0;
				for (const key of keys) {
					if (data.delete(key)) removed++;
					if (sets.delete(key)) removed++;
				}
				return removed;
			},
		};
	};

	it("stores and retrieves a value via the mocked client", async () => {
		await jest.isolateModulesAsync(async () => {
			const mockClient = makeMockRedisClient();
			jest.doMock("../../src/utils/store", () => ({
				hasRedis: true,
				redisClient: mockClient,
			}));

			const IsolatedCache = require("../../src/utils/cache");
			const cache = new IsolatedCache("books", 30);

			await cache.set("/books?page=1", { data: [1, 2, 3] });
			expect(await cache.get("/books?page=1")).toEqual({ data: [1, 2, 3] });
		});
	});

	it("clear() removes every key it previously set", async () => {
		await jest.isolateModulesAsync(async () => {
			const mockClient = makeMockRedisClient();
			jest.doMock("../../src/utils/store", () => ({
				hasRedis: true,
				redisClient: mockClient,
			}));

			const IsolatedCache = require("../../src/utils/cache");
			const cache = new IsolatedCache("authors", 30);

			await cache.set("/authors?page=1", "one");
			await cache.set("/authors?page=2", "two");
			await cache.clear();

			expect(await cache.get("/authors?page=1")).toBeUndefined();
			expect(await cache.get("/authors?page=2")).toBeUndefined();
		});
	});

	it("get() treats a client error as a cache miss instead of throwing", async () => {
		await jest.isolateModulesAsync(async () => {
			const failingClient = {
				async get() {
					throw new Error("connection lost");
				},
			};
			jest.doMock("../../src/utils/store", () => ({
				hasRedis: true,
				redisClient: failingClient,
			}));

			const IsolatedCache = require("../../src/utils/cache");
			const cache = new IsolatedCache("books", 30);

			await expect(cache.get("/books")).resolves.toBeUndefined();
		});
	});
});

describe("sanitize (LIKE wildcard escaping)", () => {
	it("escapes %, _, and backslash", () => {
		expect(escapeLikeWildcards("50%_off\\deal")).toBe("50\\%\\_off\\\\deal");
	});

	it("leaves plain strings untouched", () => {
		expect(escapeLikeWildcards("hello world")).toBe("hello world");
	});

	it("passes through non-string input unchanged", () => {
		expect(escapeLikeWildcards(null)).toBeNull();
	});

	it("wraps the escaped value in wildcard percent signs", () => {
		expect(buildLikeParam("abc")).toBe("%abc%");
	});
});

describe("store (in-memory fallback, no REDIS_URL in test env)", () => {
	it("returns null for a missing key", async () => {
		expect(await store.get("nope:unit-test")).toBeNull();
	});

	it("sets and gets a value", async () => {
		await store.set("unit:key1", "value1");
		expect(await store.get("unit:key1")).toBe("value1");
	});

	it("deletes a value", async () => {
		await store.set("unit:key2", "value2");
		await store.del("unit:key2");
		expect(await store.get("unit:key2")).toBeNull();
	});

	it("increments a counter from zero", async () => {
		const key = "unit:counter1";
		expect(await store.incr(key)).toBe(1);
		expect(await store.incr(key)).toBe(2);
		await store.del(key);
	});

	it("expires a value after the given TTL", async () => {
		await store.set("unit:key3", "value3", 0.01);
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(await store.get("unit:key3")).toBeNull();
	});
});

describe("RedisStore (unit, mocked ioredis client — no real Redis needed)", () => {
	const makeMockRedis = () => {
		const data = new Map();
		return {
			async get(key) {
				return data.has(key) ? data.get(key) : null;
			},
			async set(key, value, mode, ttl) {
				data.set(key, value);
				void mode;
				void ttl;
				return "OK";
			},
			async del(key) {
				data.delete(key);
				return 1;
			},
			async incr(key) {
				const next = (parseInt(data.get(key) || "0", 10) + 1).toString();
				data.set(key, next);
				return parseInt(next, 10);
			},
			async expire() {
				return 1;
			},
			async quit() {
				return "OK";
			},
		};
	};

	it("sets and gets a value with a TTL", async () => {
		const redisStore = new RedisStore(makeMockRedis());
		await redisStore.set("key1", "value1", 60);
		expect(await redisStore.get("key1")).toBe("value1");
	});

	it("sets a value without a TTL", async () => {
		const redisStore = new RedisStore(makeMockRedis());
		await redisStore.set("key2", "value2");
		expect(await redisStore.get("key2")).toBe("value2");
	});

	it("deletes a value", async () => {
		const redisStore = new RedisStore(makeMockRedis());
		await redisStore.set("key3", "value3");
		await redisStore.del("key3");
		expect(await redisStore.get("key3")).toBeNull();
	});

	it("increments a counter", async () => {
		const redisStore = new RedisStore(makeMockRedis());
		expect(await redisStore.incr("counter")).toBe(1);
		expect(await redisStore.incr("counter")).toBe(2);
	});

	it("expire and close delegate to the underlying client without throwing", async () => {
		const redisStore = new RedisStore(makeMockRedis());
		await expect(redisStore.expire("key4", 30)).resolves.toBeUndefined();
		await expect(redisStore.close()).resolves.toBeUndefined();
	});
});

describe("auth.middlewares units not exercised via the API surface", () => {
	const mockRes = () => {
		const res = { statusCode: null, body: null };
		res.status = (code) => {
			res.statusCode = code;
			return res;
		};
		res.json = (body) => {
			res.body = body;
			return res;
		};
		return res;
	};

	it("verifyToken rejects a header missing the Bearer prefix", async () => {
		const req = { headers: { authorization: "NotBearer abc" } };
		const res = mockRes();
		await verifyToken(req, res, () => {
			throw new Error("next() should not be called");
		});
		expect(res.statusCode).toBe(401);
	});

	it("verifyToken rejects when no Authorization header is present", async () => {
		const req = { headers: {} };
		const res = mockRes();
		await verifyToken(req, res, () => {
			throw new Error("next() should not be called");
		});
		expect(res.statusCode).toBe(401);
	});

	it("requireOwnershipOrAdmin requires authentication", () => {
		const req = { params: { id: "1" } };
		const res = mockRes();
		requireOwnershipOrAdmin()(req, res, () => {
			throw new Error("next() should not be called");
		});
		expect(res.statusCode).toBe(401);
	});

	it("requireOwnershipOrAdmin allows a Librarian regardless of ownership", () => {
		const req = { params: { id: "999" }, user: { id: 1, role: "Librarian" } };
		const res = mockRes();
		let called = false;
		requireOwnershipOrAdmin()(req, res, () => {
			called = true;
		});
		expect(called).toBe(true);
	});

	it("auditLogger logs and always calls next, even for an anonymous request", () => {
		const req = { method: "GET", originalUrl: "/api/test", params: {}, ip: "127.0.0.1" };
		const res = mockRes();
		let called = false;
		auditLogger("test.action")(req, res, () => {
			called = true;
		});
		expect(called).toBe(true);
	});
});

describe("errorTracking (no SENTRY_DSN in test env)", () => {
	it("reports disabled", () => {
		expect(isEnabled()).toBe(false);
	});

	it("captureException is a safe no-op", () => {
		expect(() => captureException(new Error("test"), { foo: "bar" })).not.toThrow();
	});

	it("initializes Sentry and reports enabled when SENTRY_DSN is set", () => {
		jest.isolateModules(() => {
			jest.doMock("@sentry/node", () => ({
				init: jest.fn(),
				captureException: jest.fn(),
			}));
			const originalDsn = process.env.SENTRY_DSN;
			process.env.SENTRY_DSN = "https://fake@example.com/1";
			try {
				const isolated = require("../../src/utils/errorTracking");
				expect(isolated.isEnabled()).toBe(true);
				expect(() => isolated.captureException(new Error("boom"), { a: 1 })).not.toThrow();
			} finally {
				process.env.SENTRY_DSN = originalDsn;
				jest.dontMock("@sentry/node");
			}
		});
	});

	it("falls back to disabled if @sentry/node fails to initialize", () => {
		jest.isolateModules(() => {
			jest.doMock("@sentry/node", () => ({
				init: () => {
					throw new Error("bad DSN");
				},
			}));
			const originalDsn = process.env.SENTRY_DSN;
			process.env.SENTRY_DSN = "https://fake@example.com/1";
			try {
				const isolated = require("../../src/utils/errorTracking");
				expect(isolated.isEnabled()).toBe(false);
			} finally {
				process.env.SENTRY_DSN = originalDsn;
				jest.dontMock("@sentry/node");
			}
		});
	});
});

describe("errorHandler middleware", () => {
	const mockReqRes = () => {
		const req = { method: "GET", originalUrl: "/api/test" };
		const res = {
			statusCode: null,
			body: null,
			status(code) {
				this.statusCode = code;
				return this;
			},
			json(body) {
				this.body = body;
				return this;
			},
		};
		return { req, res };
	};

	it("defaults to 500 and a generic message for an unmarked error", () => {
		const { req, res } = mockReqRes();
		errorHandler(new Error("boom"), req, res, () => {});
		expect(res.statusCode).toBe(500);
		expect(res.body.message).toBe("Internal Server Error");
	});

	it("uses the error's own message for a marked 4xx error", () => {
		const { req, res } = mockReqRes();
		const err = new Error("Not allowed");
		err.statusCode = 403;
		errorHandler(err, req, res, () => {});
		expect(res.statusCode).toBe(403);
		expect(res.body.message).toBe("Not allowed");
	});

	it("hides the message and stack for a 500 in production", () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";
		try {
			const { req, res } = mockReqRes();
			errorHandler(new Error("leaky internal detail"), req, res, () => {});
			expect(res.body.message).toBe("Internal Server Error");
			expect(res.body).not.toHaveProperty("stack");
		} finally {
			process.env.NODE_ENV = originalEnv;
		}
	});

	it("notFoundHandler returns a 404 JSON body", () => {
		const req = { method: "GET", originalUrl: "/api/does-not-exist" };
		let statusCode;
		let body;
		const res = {
			status(code) {
				statusCode = code;
				return this;
			},
			json(b) {
				body = b;
				return this;
			},
		};
		notFoundHandler(req, res);
		expect(statusCode).toBe(404);
		expect(body.success).toBe(false);
	});
});

describe("borrowedRecords.model pure helpers", () => {
	const overdueRecord = {
		due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
		return_date: null,
		status: "Borrowed",
	};
	const futureRecord = {
		due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
		return_date: null,
		status: "Borrowed",
	};
	const returnedRecord = {
		due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
		return_date: new Date(),
		status: "Returned",
	};

	it("isBorrowRecordOverdue is true past the due date with no return", () => {
		expect(isBorrowRecordOverdue(overdueRecord)).toBe(true);
	});

	it("isBorrowRecordOverdue is false before the due date", () => {
		expect(isBorrowRecordOverdue(futureRecord)).toBe(false);
	});

	it("isBorrowRecordOverdue is false once returned, even past the due date", () => {
		expect(isBorrowRecordOverdue(returnedRecord)).toBe(false);
	});

	it("getBorrowRecordDaysOverdue is 0 when not overdue", () => {
		expect(getBorrowRecordDaysOverdue(futureRecord)).toBe(0);
	});

	it("getBorrowRecordDaysOverdue is positive when overdue", () => {
		expect(getBorrowRecordDaysOverdue(overdueRecord)).toBeGreaterThan(0);
	});

	it("isBorrowRecordActive is true only while Borrowed and unreturned", () => {
		expect(isBorrowRecordActive(overdueRecord)).toBe(true);
		expect(isBorrowRecordActive(returnedRecord)).toBe(false);
	});

	it("calculateBorrowRecordLateFee is 0 when not overdue", () => {
		expect(calculateBorrowRecordLateFee(futureRecord)).toBe(0);
	});

	it("calculateBorrowRecordLateFee scales with days overdue and the daily rate", () => {
		const days = getBorrowRecordDaysOverdue(overdueRecord);
		expect(calculateBorrowRecordLateFee(overdueRecord, 2)).toBe(days * 2);
	});

	it("formatBorrowRecord returns null for null input", () => {
		expect(formatBorrowRecord(null)).toBeNull();
	});

	it("formatBorrowRecord computes is_overdue/is_active on the formatted object", () => {
		const formatted = formatBorrowRecord(overdueRecord);
		expect(formatted.is_overdue).toBe(true);
		expect(formatted.is_active).toBe(true);
	});
});

describe("books.model pure helpers", () => {
	it("isBookAvailable requires both copies and status", () => {
		expect(isBookAvailable({ available_copies: 1, status: "Available" })).toBe(true);
		expect(isBookAvailable({ available_copies: 0, status: "Available" })).toBe(false);
		expect(isBookAvailable({ available_copies: 1, status: "Borrowed" })).toBe(false);
	});

	it("formatBook returns null for null input", () => {
		expect(formatBook(null)).toBeNull();
	});
});
