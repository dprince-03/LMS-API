const express = require("express");
const healthRouter = express.Router();
const { pool } = require("../config/database.config");
const logger = require("../utils/logger");

/**
 * @route   GET /api/health
 * @desc    Liveness/readiness check — verifies the process is up and the
 *          database is reachable. Used by the Docker healthcheck and any
 *          future load balancer/uptime monitor.
 * @access  Public
 */
healthRouter.get("/", async (req, res) => {
	const health = {
		status: "ok",
		uptime_seconds: Math.floor(process.uptime()),
		timestamp: new Date().toISOString(),
		database: "unknown",
	};

	try {
		const connection = await pool.getConnection();
		await connection.query("SELECT 1");
		connection.release();
		health.database = "connected";
		return res.status(200).json(health);
	} catch (error) {
		logger.warn({ err: error }, "Health check: database unreachable");
		health.status = "degraded";
		health.database = "disconnected";
		return res.status(503).json(health);
	}
});

module.exports = healthRouter;
