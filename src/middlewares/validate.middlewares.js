// Validates req.body against a Zod schema. On success, replaces req.body
// with the parsed (and coerced/defaulted) result so downstream code can
// trust its shape instead of re-checking presence/type itself.
const validateBody = (schema) => (req, res, next) => {
	const result = schema.safeParse(req.body);

	if (!result.success) {
		return res.status(400).json({
			success: false,
			message: "Validation failed",
			errors: result.error.issues.map((issue) => ({
				field: issue.path.join(".") || "(body)",
				message: issue.message,
			})),
		});
	}

	req.body = result.data;
	next();
};

module.exports = { validateBody };
