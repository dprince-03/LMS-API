const cron = require("node-cron");
const { updateOverdueBorrowRecords } = require("../models/borrowedRecords.model");
const logger = require("../utils/logger");

let task = null;

// Runs updateOverdueBorrowRecords() on a schedule instead of only lazily
// on-demand when someone happens to hit GET /borrow-records or
// GET /borrow-records/overdue. Schedule is configurable via
// OVERDUE_JOB_CRON (standard 5-field cron syntax); disabled entirely if
// DISABLE_OVERDUE_JOB=true (useful in tests).
const startOverdueJob = () => {
	if (process.env.DISABLE_OVERDUE_JOB === "true") {
		logger.info("Overdue records job disabled via DISABLE_OVERDUE_JOB");
		return null;
	}

	const schedule = process.env.OVERDUE_JOB_CRON || "*/15 * * * *"; // every 15 minutes by default

	task = cron.schedule(schedule, async () => {
		try {
			const updated = await updateOverdueBorrowRecords();
			if (updated > 0) {
				logger.info({ updated }, "Scheduled job marked borrow records overdue");
			}
		} catch (error) {
			logger.error({ err: error }, "Overdue records job failed");
		}
	});

	logger.info({ schedule }, "Overdue records job scheduled");
	return task;
};

const stopOverdueJob = () => {
	if (task) {
		task.stop();
		task = null;
	}
};

module.exports = { startOverdueJob, stopOverdueJob };
