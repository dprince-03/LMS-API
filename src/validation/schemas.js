const { z } = require("zod");
const { passwordConfig } = require("../config/auth.config");

const password = z
	.string()
	.min(
		passwordConfig.minLength,
		`Password must be at least ${passwordConfig.minLength} characters long`
	)
	.refine((pw) => !passwordConfig.requireUppercase || /[A-Z]/.test(pw), {
		message: "Password must contain at least one uppercase letter",
	})
	.refine((pw) => !passwordConfig.requireLowercase || /[a-z]/.test(pw), {
		message: "Password must contain at least one lowercase letter",
	})
	.refine((pw) => !passwordConfig.requireNumbers || /\d/.test(pw), {
		message: "Password must contain at least one number",
	});

const email = z.string().trim().email("Invalid email format");
const optionalString = z.string().trim().min(1).optional().nullable();
const role = z.enum(["Admin", "Librarian", "User"]);

// ---- Auth ----

const registerSchema = z.object({
	first_name: z.string().trim().min(1, "First name is required"),
	last_name: z.string().trim().min(1, "Last name is required"),
	user_name: z.string().trim().min(3, "Username must be at least 3 characters"),
	phone: optionalString,
	email,
	password,
	image_url: optionalString,
});

const loginSchema = z.object({
	emailOrUsername: z.string().trim().min(1, "Email or username is required"),
	password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z
	.object({
		current_password: z.string().min(1, "Current password is required"),
		new_password: password,
	})
	.refine((data) => data.current_password !== data.new_password, {
		message: "New password must be different from current password",
		path: ["new_password"],
	});

const forgotPasswordSchema = z.object({
	email,
});

const resetPasswordSchema = z.object({
	token: z.string().min(1, "Reset token is required"),
	new_password: password,
});

// ---- Users ----

const createUserSchema = z.object({
	first_name: z.string().trim().min(1, "First name is required"),
	last_name: z.string().trim().min(1, "Last name is required"),
	user_name: z.string().trim().min(3, "Username must be at least 3 characters"),
	phone: optionalString,
	email,
	password,
	image_url: optionalString,
	role: role.optional(),
	is_active: z.boolean().optional(),
	email_verified: z.boolean().optional(),
});

const updateUserSchema = z
	.object({
		first_name: z.string().trim().min(1).optional(),
		last_name: z.string().trim().min(1).optional(),
		phone: optionalString,
		email: email.optional(),
		password: password.optional(),
		image_url: optionalString,
		role: role.optional(),
		is_active: z.boolean().optional(),
		email_verified: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, { message: "No valid fields to update" });

// ---- Authors ----

const createAuthorSchema = z.object({
	first_name: z.string().trim().min(1, "First name is required"),
	last_name: z.string().trim().min(1, "Last name is required"),
	image: optionalString,
	date_of_birth: optionalString,
	biography: optionalString,
	phone: optionalString,
	email,
});

const updateAuthorSchema = z
	.object({
		first_name: z.string().trim().min(1).optional(),
		last_name: z.string().trim().min(1).optional(),
		image: optionalString,
		date_of_birth: optionalString,
		biography: optionalString,
		phone: optionalString,
		email: email.optional(),
	})
	.refine((data) => Object.keys(data).length > 0, { message: "No valid fields to update" });

// ---- Books ----

const createBookSchema = z.object({
	isbn: z.string().trim().min(1, "ISBN is required"),
	title: z.string().trim().min(1, "Title is required"),
	author_id: z.coerce.number().int().positive("A valid author_id is required"),
	published_date: optionalString,
	description: optionalString,
	cover_image: optionalString,
	genre: optionalString,
	language: optionalString,
	pages: z.coerce.number().int().positive().optional().nullable(),
	publisher: optionalString,
	available_copies: z.coerce.number().int().min(0).optional(),
	total_copies: z.coerce.number().int().min(0).optional(),
	status: z.enum(["Available", "Borrowed", "Reserved", "Lost"]).optional(),
});

const updateBookSchema = z
	.object({
		isbn: z.string().trim().min(1).optional(),
		title: z.string().trim().min(1).optional(),
		author_id: z.coerce.number().int().positive().optional(),
		published_date: optionalString,
		description: optionalString,
		cover_image: optionalString,
		genre: optionalString,
		language: optionalString,
		pages: z.coerce.number().int().positive().optional().nullable(),
		publisher: optionalString,
		available_copies: z.coerce.number().int().min(0).optional(),
		total_copies: z.coerce.number().int().min(0).optional(),
		status: z.enum(["Available", "Borrowed", "Reserved", "Lost"]).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, { message: "No valid fields to update" });

module.exports = {
	registerSchema,
	loginSchema,
	changePasswordSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	createUserSchema,
	updateUserSchema,
	createAuthorSchema,
	updateAuthorSchema,
	createBookSchema,
	updateBookSchema,
};
