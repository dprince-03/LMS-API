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
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
authRouter.post("/register", validateBody(registerSchema), register);

/**
 * @route POST/auth/login
 * @desc Login user and got JWT token
 * @access Public
 */
authRouter.post("/login", validateBody(loginSchema), login);

/**
 * @route   POST /auth/logout
 * @desc    Logout user (blacklists the current token)
 * @access  Private
 */
authRouter.post("/logout", verifyToken, logout);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
authRouter.get("/me", verifyToken, requireAuth, getMe);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
authRouter.post("/refresh", verifyToken, requireAuth, refreshToken);

/**
 * @route   POST /auth/change-password
 * @desc    Change user password
 * @access  Private
 */
authRouter.post(
	"/change-password",
	verifyToken,
	requireAuth,
	validateBody(changePasswordSchema),
	changePassword
);

/**
 * @route   POST /auth/forgot-password
 * @desc    Request a password reset email
 * @access  Public
 */
authRouter.post("/forgot-password", validateBody(forgotPasswordSchema), forgotPassword);

/**
 * @route   POST /auth/reset-password
 * @desc    Complete a password reset using the token emailed by /forgot-password
 * @access  Public (requires a valid, unexpired, single-use reset token)
 */
authRouter.post("/reset-password", validateBody(resetPasswordSchema), resetPassword);

/**
 * @route   POST /auth/setup-admin
 * @desc    Initial admin setup (first-time only)
 * @access  Public (protected by setup key)
 */
authRouter.post("/setup-admin", setup_admin);

module.exports = authRouter;
