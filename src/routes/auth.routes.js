const express = require("express");
const authRouter = express.Router();

const {
	logout,
	register,
	login,
	getMe,
	refreshToken,
	changePassword,
	forgotPassword,
	resetPassword,
	setup_admin,
} = require("../controllers/auth.controllers");

const { verifyToken, requireAuth } = require("../middlewares/auth.middlewares");

const { validateBody } = require("../middlewares/validate.middlewares");
const {
	registerSchema,
	loginSchema,
	changePasswordSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
} = require("../validation/schemas");

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new User-role account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, user_name, email, password]
 *             properties:
 *               first_name: { type: string, example: John }
 *               last_name: { type: string, example: Doe }
 *               user_name: { type: string, minLength: 3, example: johndoe }
 *               email: { type: string, format: email }
 *               phone: { type: string, nullable: true }
 *               password:
 *                 type: string
 *                 description: 8+ characters, at least one uppercase, one lowercase, one number.
 *                 example: Password123
 *               image_url: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Account created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthTokenResponse' }
 *       400: { $ref: '#/components/responses/ValidationFailed' }
 *       409:
 *         description: Email or username already taken.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post("/register", validateBody(registerSchema), register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a JWT
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailOrUsername, password]
 *             properties:
 *               emailOrUsername: { type: string, example: john@example.com }
 *               password: { type: string, example: Password123 }
 *     responses:
 *       200:
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthTokenResponse' }
 *       401:
 *         description: Invalid credentials, or account deactivated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       429:
 *         description: Too many failed attempts — account temporarily locked out.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post("/login", validateBody(loginSchema), login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out (blacklists the current token)
 *     description: >
 *       Revokes the token used on this request — it's rejected on every
 *       subsequent request even though it hasn't naturally expired yet.
 *     responses:
 *       200:
 *         description: Logged out.
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.post("/logout", verifyToken, logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current user's profile
 *     responses:
 *       200:
 *         description: Current user (no password field).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.get("/me", verifyToken, requireAuth, getMe);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Issue a new JWT for the current user
 *     responses:
 *       200:
 *         description: New token issued.
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.post("/refresh", verifyToken, requireAuth, refreshToken);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change the current user's password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string }
 *               new_password:
 *                 type: string
 *                 description: 8+ characters, at least one uppercase, one lowercase, one number. Must differ from the current password.
 *     responses:
 *       200:
 *         description: Password changed.
 *       400: { $ref: '#/components/responses/ValidationFailed' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
authRouter.post(
	"/change-password",
	verifyToken,
	requireAuth,
	validateBody(changePasswordSchema),
	changePassword
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     description: >
 *       Always responds 200 with the same generic message, whether or not
 *       the email is registered, to avoid leaking which emails exist. If the
 *       account exists, emails a single-use, 1-hour reset token (or logs it
 *       server-side as a dev-mode fallback if SMTP isn't configured) — the
 *       token itself is never returned in this response.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Generic acknowledgement — see description.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "If an account with that email exists, a password reset link has been sent."
 */
authRouter.post("/forgot-password", validateBody(forgotPasswordSchema), forgotPassword);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Complete a password reset
 *     description: >
 *       Authorization comes from possessing a valid reset token, not from a
 *       session. Single-use — a second attempt with the same token returns
 *       400.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, new_password]
 *             properties:
 *               token: { type: string, description: Token from the forgot-password email. }
 *               new_password: { type: string }
 *     responses:
 *       200:
 *         description: Password reset.
 *       400:
 *         description: Invalid, expired, or already-used reset token; or validation failure.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post("/reset-password", validateBody(resetPasswordSchema), resetPassword);

/**
 * @openapi
 * /auth/setup-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Create the first Admin account (one-time bootstrap)
 *     description: >
 *       Public, but gated by `INITIAL_SETUP_KEY` and refuses if any user
 *       already exists in the system — intended for first-run
 *       initialization only, not general admin creation.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [admin_email, admin_password, setup_key]
 *             properties:
 *               admin_email: { type: string, format: email }
 *               admin_password: { type: string }
 *               setup_key: { type: string, description: Value of the INITIAL_SETUP_KEY env var. }
 *               first_name: { type: string, default: System }
 *               last_name: { type: string, default: Administrator }
 *     responses:
 *       201:
 *         description: Admin account created.
 *       401:
 *         description: Invalid setup key.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: System already initialized (a user already exists).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRouter.post("/setup-admin", setup_admin);

module.exports = authRouter;
