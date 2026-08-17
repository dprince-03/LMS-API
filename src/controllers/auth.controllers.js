const {
	createUser,
	findUserByEmailOrUsername,
	findUserByEmail,
	verifyPassword,
	updateUserLastLogin,
	updateUserById,
	countUsers,
} = require("../models/users.model");
const { authUtils, rateLimitConfig } = require("../config/auth.config");
const { generateAccessToken, generateResetToken, verifyAppToken } = require("../utils/tokens");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { store } = require("../utils/store");
const logger = require("../utils/logger");

const LOGIN_ATTEMPTS_PREFIX = "login_attempts:";
const lockoutSeconds = Math.ceil(rateLimitConfig.loginAttempts.lockoutDuration / 1000);

// @desc    Register new user
// @access  Public
const register = async (req, res) => {
	try {
		const { first_name, last_name, user_name, phone, email, password, image_url } = req.body;

		const existingUser = await findUserByEmailOrUsername(email);
		if (existingUser) {
			return res.status(409).json({
				success: false,
				message: "User with this email or username already exists",
			});
		}

		const existingUsername = await findUserByEmailOrUsername(user_name);
		if (existingUsername) {
			return res.status(409).json({
				success: false,
				message: "Username is already taken",
			});
		}

		const newUser = await createUser({
			first_name,
			last_name,
			user_name,
			phone,
			email,
			password,
			image_url,
			role: "User",
			is_active: true,
			email_verified: false,
		});

		const token = generateAccessToken(newUser.id, newUser.email, newUser.role);

		res.status(201).json({
			success: true,
			message: "User registered successfully",
			data: {
				user: {
					id: newUser.id,
					first_name: newUser.first_name,
					last_name: newUser.last_name,
					full_name: newUser.full_name,
					user_name: newUser.user_name,
					email: newUser.email,
					role: newUser.role,
					is_active: newUser.is_active,
					email_verified: newUser.email_verified,
				},
				token,
				token_type: "Bearer",
				expires_in: process.env.JWT_EXPIRE || "7d",
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Error registering user");
		return res.status(400).json({
			success: false,
			message: "Unable to register user",
		});
	}
};

// @desc    Login user
// @access  Public
const login = async (req, res) => {
	try {
		const { emailOrUsername, password } = req.body;
		const lockoutKey = `${LOGIN_ATTEMPTS_PREFIX}${emailOrUsername.toLowerCase()}`;

		const attempts = parseInt((await store.get(lockoutKey)) || "0", 10);
		if (attempts >= rateLimitConfig.loginAttempts.maxAttempts) {
			return res.status(429).json({
				success: false,
				message: "Too many failed login attempts. Please try again later.",
			});
		}

		const user = await findUserByEmailOrUsername(emailOrUsername);
		if (!user || !user.is_active) {
			await store.incr(lockoutKey);
			await store.expire(lockoutKey, lockoutSeconds);
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		const isPasswordValid = await verifyPassword(password, user.password);
		if (!isPasswordValid) {
			await store.incr(lockoutKey);
			await store.expire(lockoutKey, lockoutSeconds);
			return res.status(401).json({
				success: false,
				message: "Invalid credentials",
			});
		}

		await store.del(lockoutKey);
		await updateUserLastLogin(user.id);

		const token = generateAccessToken(user.id, user.email, user.role);

		res.status(200).json({
			success: true,
			message: "Login successful",
			data: {
				user: {
					id: user.id,
					first_name: user.first_name,
					last_name: user.last_name,
					full_name: user.full_name,
					user_name: user.user_name,
					email: user.email,
					role: user.role,
					is_active: user.is_active,
					email_verified: user.email_verified,
					last_login: new Date().toISOString(),
				},
				token,
				token_type: "Bearer",
				expires_in: process.env.JWT_EXPIRE || "7d",
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Error logging in user");
		return res.status(500).json({
			success: false,
			message: "Internal Server Error",
		});
	}
};

// @desc    Logout user — blacklists the current token so it can't be reused.
// @access  Private
const logout = async (req, res) => {
	try {
		if (req.user && req.token) {
			const ttl = req.tokenExpiresAt
				? Math.max(1, req.tokenExpiresAt - Math.floor(Date.now() / 1000))
				: undefined;
			await authUtils.blacklistToken(req.token, ttl);
			logger.info({ user_id: req.user.id }, "User logged out");
		}

		res.status(200).json({
			success: true,
			message: "Logout successful",
			data: { logged_out_at: new Date().toISOString() },
		});
	} catch (error) {
		logger.error({ err: error }, "Error logging out user");
		return res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
};

const getMe = async (req, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ success: false, message: "Authentication failed" });
		}

		const { password: _password, ...userResponse } = req.user;

		res.status(200).json({
			success: true,
			message: "User profile retrieved successfully",
			data: userResponse,
		});
	} catch (error) {
		logger.error({ err: error }, "Error getting user profile");
		return res.status(500).json({
			success: false,
			message: "Internal Server Error",
		});
	}
};

const refreshToken = async (req, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ success: false, message: "Authentication required" });
		}

		const token = generateAccessToken(req.user.id, req.user.email, req.user.role);

		res.status(200).json({
			success: true,
			message: "Token refreshed successfully",
			data: {
				token,
				token_type: "Bearer",
				expires_in: process.env.JWT_EXPIRE || "7d",
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Error refreshing token");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

const changePassword = async (req, res) => {
	try {
		const { current_password, new_password } = req.body;

		if (!req.user) {
			return res.status(401).json({ success: false, message: "Authentication required" });
		}

		const isCurrentPasswordValid = await verifyPassword(current_password, req.user.password);
		if (!isCurrentPasswordValid) {
			return res
				.status(400)
				.json({ success: false, message: "Current password is incorrect" });
		}

		await updateUserById(req.user.id, { password: new_password }, ["password"]);

		res.status(200).json({ success: true, message: "Password changed successfully" });
	} catch (error) {
		logger.error({ err: error }, "Error changing password");
		return res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// @desc    Request a password reset email. Always responds the same way
//          regardless of whether the account exists, to avoid leaking which
//          emails are registered.
// @access  Public
const forgotPassword = async (req, res) => {
	try {
		const { email } = req.body;
		const genericResponse = {
			success: true,
			message: "If an account with that email exists, a password reset link has been sent.",
		};

		const user = await findUserByEmail(email);
		if (!user || !user.is_active) {
			return res.status(200).json(genericResponse);
		}

		const resetToken = generateResetToken(user.id, user.email);
		await sendPasswordResetEmail(user.email, resetToken);

		res.status(200).json(genericResponse);
	} catch (error) {
		logger.error({ err: error }, "Error handling forgot-password request");
		// Still return the generic response — don't leak internal failures.
		res.status(200).json({
			success: true,
			message: "If an account with that email exists, a password reset link has been sent.",
		});
	}
};

// @desc    Complete a password reset using a token issued by forgotPassword.
// @access  Public (requires a valid, unexpired, single-use reset token)
const resetPassword = async (req, res) => {
	try {
		const { token, new_password } = req.body;

		let decoded;
		try {
			decoded = verifyAppToken(token);
		} catch (_error) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid or expired reset token" });
		}

		if (decoded.purpose !== "password_reset") {
			return res
				.status(400)
				.json({ success: false, message: "Invalid or expired reset token" });
		}

		if (await authUtils.isTokenBlacklisted(token)) {
			return res
				.status(400)
				.json({ success: false, message: "This reset token has already been used" });
		}

		await updateUserById(decoded.id, { password: new_password }, ["password"]);

		// Single-use: blacklist immediately so the same link can't be replayed.
		const ttl = decoded.exp ? Math.max(1, decoded.exp - Math.floor(Date.now() / 1000)) : 3600;
		await authUtils.blacklistToken(token, ttl);

		res.status(200).json({ success: true, message: "Password reset successfully" });
	} catch (error) {
		logger.error({ err: error }, "Error resetting password");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// @desc    Initial admin setup (first-time only)
// @access  Public (protected by setup key)
const setup_admin = async (req, res) => {
	try {
		const {
			admin_email,
			admin_password,
			setup_key,
			first_name = "System",
			last_name = "Administrator",
		} = req.body;

		if (!admin_email || !admin_password || !setup_key) {
			return res.status(400).json({
				success: false,
				message: "Admin email, password, and setup key are required",
			});
		}

		if (!process.env.INITIAL_SETUP_KEY || setup_key !== process.env.INITIAL_SETUP_KEY) {
			return res.status(401).json({ success: false, message: "Invalid setup key" });
		}

		if (admin_password.length < 8) {
			return res.status(400).json({
				success: false,
				message: "Password must be at least 8 characters long",
			});
		}

		const hasUpperCase = /[A-Z]/.test(admin_password);
		const hasLowerCase = /[a-z]/.test(admin_password);
		const hasNumber = /\d/.test(admin_password);

		if (!hasUpperCase || !hasLowerCase || !hasNumber) {
			return res.status(400).json({
				success: false,
				message: "Password must contain uppercase, lowercase, and numbers",
			});
		}

		const existingAdmin = await findUserByEmail(admin_email);
		if (existingAdmin) {
			return res.status(409).json({ success: false, message: "Admin user already exists" });
		}

		const userCount = await countUsers();
		if (userCount > 0) {
			return res.status(403).json({
				success: false,
				message:
					"System already initialized. Use regular registration or contact existing admin.",
			});
		}

		const adminUser = await createUser({
			first_name,
			last_name,
			user_name: admin_email.split("@")[0],
			email: admin_email,
			password: admin_password,
			role: "Admin",
			is_active: true,
			email_verified: true,
		});

		logger.info({ email: admin_email }, "Admin setup completed");

		res.status(201).json({
			success: true,
			message: "System administrator created successfully",
			data: {
				user: {
					id: adminUser.id,
					first_name: adminUser.first_name,
					last_name: adminUser.last_name,
					email: adminUser.email,
					role: adminUser.role,
				},
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Admin setup error");
		res.status(500).json({
			success: false,
			message: "Failed to setup system administrator",
		});
	}
};

module.exports = {
	register,
	login,
	logout,
	getMe,
	refreshToken,
	changePassword,
	forgotPassword,
	resetPassword,
	setup_admin,
};
