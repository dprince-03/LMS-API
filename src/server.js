// server.js and .env are siblings in src/ — resolve explicitly by __dirname
// rather than relying on process.cwd(), since that depends on where the
// process was launched from (e.g. `npm start` from the repo root vs.
// `node server.js` from inside src/).
require("dotenv").config({ path: require("node:path").resolve(__dirname, ".env") });
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRouter = require("./routes/auth.routes");
const authorRouter = require("./routes/authors.routes");
const bookRouter = require("./routes/books.routes");
const userRouter = require("./routes/users.routes");
const brRouter = require("./routes/bookRecords.routes");
const healthRouter = require("./routes/health.routes");

const { testConnection, closeConnection } = require("./config/database.config");
const { initializeAuth } = require("./config/auth.config");
const { optionalAuth, roleBasedRateLimit } = require("./middlewares/auth.middlewares");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler.middlewares");
const { startOverdueJob, stopOverdueJob } = require("./jobs/overdue.job");
const { captureException } = require("./utils/errorTracking");
const logger = require("./utils/logger");

const app = express();
const PORT = process.env.PORT || 5080;

// ========================
//      MIDDLEWARES
// ========================

const corsOption = {
	origin: process.env.CORS_ORIGINS
		? process.env.CORS_ORIGINS.split(",")
		: ["http://localhost:5000", "http://localhost:5080"],
	methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	credentials: true,
	optionsSuccessStatus: 200,
};

// Coarse, IP-based backstop shared by every route (100 requests / 15 min).
// Finer, role-aware limits are applied per-request below via
// roleBasedRateLimit, once we know whether the caller is a Guest/User/
// Librarian/Admin. Both are disabled under NODE_ENV=test — a functional
// test suite runs far more requests per minute against one shared IP/store
// than any real client would, and rate-limit *behavior* itself is exercised
// separately via the manual curl procedures in docs/SECURITY_TESTING.md.
const isTestEnv = process.env.NODE_ENV === "test";
const limiter = isTestEnv
	? (req, res, next) => next()
	: rateLimit({
			windowMs: 15 * 60 * 1000, // 15 minutes
			max: 100,
			message: "Too many requests from this IP, please try again after 15 minutes",
			standardHeaders: true,
			legacyHeaders: false,
		});

app.use(helmet());
app.use(cors(corsOption));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// express.json()/urlencoded() only populate req.body when the request
// actually carries a matching Content-Type — a bodyless POST (or one sent
// without a Content-Type header) leaves req.body as undefined, which
// crashes any handler that destructures it directly (e.g. `const { due_days
// = 14 } = req.body`). Normalize once, globally, instead of guarding every
// call site.
app.use((req, res, next) => {
	if (req.body === undefined) req.body = {};
	next();
});

if (process.env.NODE_ENV !== "test") {
	app.use(morgan("dev"));
}

// Best-effort auth (never blocks) so role-tiered rate limiting can tell
// Guest/User/Librarian/Admin apart before each route's own verifyToken/
// requireAuth enforces whatever that specific route actually requires.
app.use("/api", optionalAuth);
if (!isTestEnv) {
	app.use("/api", roleBasedRateLimit());
}

// ========================
//      ROUTES
// ========================

app.get("/api", limiter, (req, res) => {
	res.status(200).json({
		success: true,
		message: "Welcome to Library Management System API",
		version: "1.0.0",
		documentation: "/docs/API.md",
		health: "/api/health",
	});
});

app.use("/api/health", healthRouter);
app.use("/api/auth", limiter, authRouter);
app.use("/api/authors", limiter, authorRouter);
app.use("/api/books", limiter, bookRouter);
app.use("/api/users", limiter, userRouter);
app.use("/api/borrow-records", limiter, brRouter);

// ==========================
//      ERROR HANDLING
// ==========================

app.use(notFoundHandler);
app.use(errorHandler);

// ==========================
//      SERVER SETUP
// ==========================

const start_server = async () => {
	try {
		logger.info("Starting Library Management System API...");

		const dbConnect = await testConnection();
		if (!dbConnect) {
			logger.error(
				"Failed to connect to database. Check your database configuration in .env"
			);
			process.exit(1);
		}

		initializeAuth();
		startOverdueJob();

		const server = app.listen(PORT, () => {
			logger.info(
				{
					port: PORT,
					baseUrl: `http://localhost:${PORT}`,
					apiUrl: `http://localhost:${PORT}/api`,
					healthCheck: `http://localhost:${PORT}/api/health`,
				},
				"Server is running"
			);
		});

		const shutdown = async (signal) => {
			logger.info({ signal }, "Shutting down gracefully...");

			stopOverdueJob();

			server.close(async () => {
				logger.info("HTTP server closed");
				await closeConnection();
				logger.info("All connections closed. Goodbye!");
				process.exit(0);
			});

			// Force close after 10 seconds
			setTimeout(() => {
				logger.error("Forcing server shutdown after timeout...");
				process.exit(1);
			}, 10000);
		};

		// Handle shutdown signals
		process.on("SIGTERM", () => shutdown("SIGTERM"));
		process.on("SIGINT", () => shutdown("SIGINT"));

		// Handle uncaught exceptions
		process.on("uncaughtException", (err) => {
			logger.error({ err }, "Uncaught Exception");
			captureException(err);
			shutdown("UNCAUGHT_EXCEPTION");
		});

		// Handle unhandled promise rejections
		process.on("unhandledRejection", (reason) => {
			logger.error({ reason }, "Unhandled Rejection");
			captureException(reason instanceof Error ? reason : new Error(String(reason)));
			shutdown("UNHANDLED_REJECTION");
		});

		return server;
	} catch (error) {
		logger.error({ err: error }, "Failed to start server");
		process.exit(1);
	}
};

if (process.env.NODE_ENV !== "test") {
	start_server();
}

// Export app for testing
module.exports = app;
