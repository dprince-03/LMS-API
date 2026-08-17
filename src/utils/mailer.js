const logger = require("./logger");

let transporter = null;
const smtpConfigured = Boolean(
	process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
);

if (smtpConfigured) {
	const nodemailer = require("nodemailer");
	transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST,
		port: parseInt(process.env.SMTP_PORT) || 587,
		secure: process.env.SMTP_SECURE === "true",
		auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
	});
}

// Sends an email if SMTP_* env vars are configured; otherwise logs the
// content at info level as a dev-mode fallback. Either way, the caller
// must never return this content in an HTTP response — it's only meant
// to reach the intended recipient out-of-band.
const sendMail = async ({ to, subject, text, html }) => {
	if (!smtpConfigured) {
		logger.info(
			{ to, subject, text },
			"SMTP not configured — logging email instead of sending (dev-mode fallback)"
		);
		return { delivered: false, reason: "smtp_not_configured" };
	}

	try {
		await transporter.sendMail({
			from: process.env.SMTP_FROM || process.env.SMTP_USER,
			to,
			subject,
			text,
			html,
		});
		return { delivered: true };
	} catch (error) {
		logger.error({ err: error, to, subject }, "Failed to send email");
		return { delivered: false, reason: "send_failed" };
	}
};

const sendPasswordResetEmail = async (to, resetToken) => {
	const resetUrl = `${process.env.APP_URL || "http://localhost:5080"}/reset-password?token=${resetToken}`;
	return sendMail({
		to,
		subject: "Reset your Library Management System password",
		text: `Use this link to reset your password (valid for 1 hour): ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
		html: `<p>Use this link to reset your password (valid for 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
	});
};

module.exports = { sendMail, sendPasswordResetEmail, smtpConfigured };
