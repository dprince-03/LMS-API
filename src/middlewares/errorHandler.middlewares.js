const logger = require("../utils/logger");
const { captureException } = require("../utils/errorTracking");

// Centralized error handler. Always logs the full error server-side;
// only exposes the stack trace to the client outside production.
const errorHandler = (err, req, res, _next) => {
	logger.error({ err, method: req.method, path: req.originalUrl }, "Unhandled request error");

	const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;

	if (statusCode >= 500) {
		captureException(err, { method: req.method, path: req.originalUrl });
	}
	const isProd = process.env.NODE_ENV === "production";

	const body = {
		success: false,
		message: statusCode < 500 ? err.message : "Internal Server Error",
	};

	if (!isProd) {
		body.error = `${err.name}: ${err.message}`;
		body.stack = err.stack;
	}

	res.status(statusCode).json(body);
};

// 404 handler for routes that don't match anything above it.
const notFoundHandler = (req, res) => {
	res.status(404).json({
		success: false,
		message: "Route not found",
		path: req.originalUrl,
		method: req.method,
	});
};

module.exports = { errorHandler, notFoundHandler };
