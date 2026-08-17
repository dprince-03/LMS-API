const { findUserById } = require("../models/users.model");
const { authUtils } = require("../config/auth.config");
const { verifyAppToken } = require("../utils/tokens");
const logger = require("../utils/logger");

const verifyToken = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader) {
			return res.status(401).json({
				success: false,
				message: "Access denied. No token provided",
			});
		}

		if (!authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				message: 'Access denied. Invalid token format. Use "Bearer <token>"',
			});
		}

		const token = authHeader.substring(7);

		if (!token) {
			return res.status(401).json({
				success: false,
				message: "Access denied. No token provided",
			});
		}

		if (await authUtils.isTokenBlacklisted(token)) {
			return res.status(401).json({
				success: false,
				message: "Access denied. Token has been revoked",
			});
		}

		const decoded = verifyAppToken(token);

		if (decoded.purpose) {
			// Single-purpose tokens (e.g. password reset) must never be
			// accepted as regular access tokens.
			return res.status(401).json({
				success: false,
				message: "Access denied. Invalid token",
			});
		}

		const user = await findUserById(decoded.id);

		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Access denied. User not found",
			});
		}

		if (!user.is_active) {
			return res.status(401).json({
				success: false,
				message: "Access denied. Account is deactivated",
			});
		}

		req.user = user;
		req.token = token;
		req.tokenExpiresAt = decoded.exp;

		next();
	} catch (error) {
		if (error.name === "JsonWebTokenError") {
			return res.status(401).json({
				success: false,
				message: "Access denied. Invalid token",
			});
		}

		if (error.name === "TokenExpiredError") {
			return res.status(401).json({
				success: false,
				message: "Access denied. Token has expired",
			});
		}

		logger.error({ err: error }, "Token verification error");
		return res.status(500).json({
			success: false,
			message: "Internal server error during authentication",
		});
	}
};

const requireAuth = (req, res, next) => {
	if (!req.user) {
		return res.status(401).json({
			success: false,
			message: "Authentication required. Please login first",
		});
	}

	next();
};

const requireRole = (allowedRoles = []) => {
	return (req, res, next) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					success: false,
					message: "Authentication required",
				});
			}

			if (!allowedRoles.includes(req.user.role)) {
				return res.status(403).json({
					success: false,
					message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${req.user.role}`,
				});
			}

			next();
		} catch (error) {
			logger.error({ err: error }, "Role verification error");
			return res.status(500).json({
				success: false,
				message: "Internal server error during authorization",
			});
		}
	};
};

// Admin only access middleware
const requireAdmin = requireRole(["Admin"]);

// Admin and Librarian access middleware
const requireAdminOrLibrarian = requireRole(["Admin", "Librarian"]);

// User/Member access middleware (all authenticated users)
const requireUser = requireRole(["Admin", "Librarian", "User"]);

const optionalAuth = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization;

		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return next();
		}

		const token = authHeader.substring(7);

		if (!token) {
			return next();
		}

		if (await authUtils.isTokenBlacklisted(token)) {
			return next();
		}

		const decoded = verifyAppToken(token);
		if (decoded.purpose) {
			return next();
		}

		const user = await findUserById(decoded.id);

		if (user && user.is_active) {
			req.user = user;
			req.token = token;
		}

		next();
	} catch (_error) {
		next();
	}
};

// Check if user owns the resource or has admin/librarian privileges
const requireOwnershipOrAdmin = (resourceUserIdParam = "id") => {
	return (req, res, next) => {
		try {
			if (!req.user) {
				return res.status(401).json({
					success: false,
					message: "Authentication required",
				});
			}

			const resourceUserId = parseInt(req.params[resourceUserIdParam]);
			const currentUserId = req.user.id;
			const userRole = req.user.role;

			// Allow access if user is admin, librarian, or owns the resource
			if (
				userRole === "Admin" ||
				userRole === "Librarian" ||
				currentUserId === resourceUserId
			) {
				return next();
			}

			return res.status(403).json({
				success: false,
				message: "Access denied. You can only access your own resources",
			});
		} catch (error) {
			logger.error({ err: error }, "Ownership verification error");
			return res.status(500).json({
				success: false,
				message: "Internal server error during ownership verification",
			});
		}
	};
};

// Rate limiting based on user role, backed by src/utils/store.js (Redis when
// REDIS_URL is set, in-process otherwise — see docs/TODO.md Phase 2).
const roleBasedRateLimit = () => {
	const { store } = require("../utils/store");
	const { rateLimitConfig } = require("../config/auth.config");

	return async (req, res, next) => {
		try {
			const identity = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
			const userRole = req.user ? req.user.role : "Guest";

			const rateLimits = {
				Guest: rateLimitConfig.maxAttempts.guest,
				User: rateLimitConfig.maxAttempts.user,
				Librarian: rateLimitConfig.maxAttempts.librarian,
				Admin: rateLimitConfig.maxAttempts.admin,
			};

			const limit = rateLimits[userRole] || rateLimits.Guest;
			const windowSeconds = 60;
			const key = `ratelimit:${identity}`;

			const count = await store.incr(key);
			if (count === 1) {
				await store.expire(key, windowSeconds);
			}

			if (count > limit) {
				return res.status(429).json({
					success: false,
					message: `Rate limit exceeded. Maximum ${limit} requests per minute for ${userRole} role`,
				});
			}

			res.set({
				"X-RateLimit-Limit": limit,
				"X-RateLimit-Remaining": Math.max(0, limit - count),
			});

			next();
		} catch (error) {
			logger.error({ err: error }, "Rate limiting error");
			next(); // Continue on error to not block legitimate requests
		}
	};
};

// Middleware to log user actions (audit trail)
const auditLogger = (action) => {
	return (req, res, next) => {
		try {
			const user = req.user;

			logger.info(
				{
					audit: true,
					action,
					user_id: user ? user.id : null,
					user_email: user ? user.email : null,
					user_role: user ? user.role : "Guest",
					ip: req.ip,
					endpoint: `${req.method} ${req.originalUrl}`,
					params: req.params,
				},
				"AUDIT"
			);

			next();
		} catch (error) {
			logger.error({ err: error }, "Audit logging error");
			next(); // Continue on error
		}
	};
};

module.exports = {
	verifyToken,
	requireAuth,
	requireRole,
	requireAdmin,
	requireAdminOrLibrarian,
	requireUser,
	optionalAuth,
	requireOwnershipOrAdmin,
	roleBasedRateLimit,
	auditLogger,
};
