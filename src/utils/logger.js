const pino = require("pino");

const isTest = process.env.NODE_ENV === "test";
const isProd = process.env.NODE_ENV === "production";

// pino-pretty is a devDependency — it's stripped from production images
// (`npm ci --omit=dev`). Don't just infer its presence from NODE_ENV: a
// container can end up with NODE_ENV=development (e.g. a shared .env file
// also used for local runs) while still having no pino-pretty installed,
// which crashes pino outright at startup. Check for real instead.
const pinoPrettyAvailable = (() => {
	try {
		require.resolve("pino-pretty");
		return true;
	} catch {
		return false;
	}
})();

const logger = pino({
	level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
	enabled: !isTest || process.env.DEBUG_TESTS === "true",
	redact: {
		paths: [
			"password",
			"*.password",
			"req.headers.authorization",
			"req.body.password",
			"req.body.current_password",
			"req.body.new_password",
			"body.password",
			"body.current_password",
			"body.new_password",
		],
		censor: "[REDACTED]",
	},
	transport:
		!isProd && !isTest && pinoPrettyAvailable
			? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
			: undefined,
});

module.exports = logger;
