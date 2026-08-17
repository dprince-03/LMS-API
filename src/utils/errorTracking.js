const logger = require("./logger");

let Sentry = null;

if (process.env.SENTRY_DSN) {
	try {
		Sentry = require("@sentry/node");
		Sentry.init({
			dsn: process.env.SENTRY_DSN,
			environment: process.env.NODE_ENV || "development",
			tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
		});
		logger.info("Sentry error tracking initialized");
	} catch (error) {
		logger.warn(
			{ err: error },
			"SENTRY_DSN set but @sentry/node failed to initialize — continuing without it"
		);
		Sentry = null;
	}
} else if (process.env.NODE_ENV === "production") {
	logger.warn(
		"SENTRY_DSN not set — error tracking disabled in production (errors are still logged locally)"
	);
}

// Reports an error to Sentry if configured. Always safe to call — a no-op
// when SENTRY_DSN isn't set (e.g. local dev, most test runs).
const captureException = (error, extra) => {
	if (Sentry) {
		Sentry.captureException(error, extra ? { extra } : undefined);
	}
};

module.exports = { captureException, isEnabled: () => Boolean(Sentry) };
