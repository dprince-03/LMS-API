const express = require("express");
const healthRouter = express.Router();
const { pool } = require("../config/database.config");
const { hasRedis, redisClient } = require("../utils/store");
const logger = require("../utils/logger");

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness/readiness check
 *     description: >
 *       Verifies the process is up and its dependencies (database, and Redis
 *       when configured) are reachable. Used by the Docker healthcheck and
 *       any future load balancer/uptime monitor.
 *     security: []
 *     responses:
 *       200:
 *         description: Healthy — database (and Redis, if configured) reachable.
 *         content:
 *           application/json:
 *             example:
 *               status: ok
 *               uptime_seconds: 42
 *               timestamp: "2026-08-19T12:00:00.000Z"
 *               database: connected
 *               redis: connected
 *       503:
 *         description: Degraded — database or Redis unreachable.
 *         content:
 *           application/json:
 *             example:
 *               status: degraded
 *               uptime_seconds: 42
 *               timestamp: "2026-08-19T12:00:00.000Z"
 *               database: disconnected
 *               redis: connected
 */
healthRouter.get("/", async (req, res) => {
	const health = {
		status: "ok",
		uptime_seconds: Math.floor(process.uptime()),
		timestamp: new Date().toISOString(),
		database: "unknown",
		redis: hasRedis ? "unknown" : "not_configured",
	};

	let degraded = false;

	try {
		const connection = await pool.getConnection();
		await connection.query("SELECT 1");
		connection.release();
		health.database = "connected";
	} catch (error) {
		logger.warn({ err: error }, "Health check: database unreachable");
		health.database = "disconnected";
		degraded = true;
	}

	// Only counts against overall health when Redis is actually configured —
	// its absence is an expected, already-logged fallback to the in-process
	// store (see src/utils/store.js), not a failure.
	if (hasRedis) {
		try {
			await redisClient.ping();
			health.redis = "connected";
		} catch (error) {
			logger.warn({ err: error }, "Health check: Redis unreachable");
			health.redis = "disconnected";
			degraded = true;
		}
	}

	if (degraded) {
		health.status = "degraded";
		return res.status(503).json(health);
	}

	return res.status(200).json(health);
});

module.exports = healthRouter;
