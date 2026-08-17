// This file lives in src/config/ — .env is one level up, in src/.
require("dotenv").config({ path: require("node:path").resolve(__dirname, "..", ".env") });
const logger = require("../utils/logger");

// JWT Configuration
const jwtConfig = {
	secret: process.env.JWT_SECRET || "your_super_secret_jwt_key_here",
	expiresIn: process.env.JWT_EXPIRE || "7d",
	algorithm: "HS256",
	issuer: process.env.JWT_ISSUER || "library-management-system",
	audience: process.env.JWT_AUDIENCE || "library-users",
};

// Password Configuration
const passwordConfig = {
	saltRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
	minLength: 8,
	requireUppercase: true,
	requireLowercase: true,
	requireNumbers: true,
	requireSpecialChars: false, // Set to true for stricter password requirements
};

// Session Configuration
const sessionConfig = {
	maxActiveSessions: parseInt(process.env.MAX_ACTIVE_SESSIONS) || 5, // Max concurrent sessions per user
	sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours in milliseconds
	refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Rate Limiting Configuration
const rateLimitConfig = {
	windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes default
	maxAttempts: {
		guest: parseInt(process.env.RATE_LIMIT_GUEST) || 20,
		user: parseInt(process.env.RATE_LIMIT_USER) || 60,
		librarian: parseInt(process.env.RATE_LIMIT_LIBRARIAN) || 120,
		admin: parseInt(process.env.RATE_LIMIT_ADMIN) || 300,
	},
	// Login attempt limits
	loginAttempts: {
		maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 5,
		lockoutDuration: parseInt(process.env.LOGIN_LOCKOUT_DURATION) || 30 * 60 * 1000, // 30 minutes
		progressiveDelay: true, // Increase delay with each failed attempt
	},
};

// Security Headers Configuration
const securityConfig = {
	corsOrigins: process.env.CORS_ORIGINS
		? process.env.CORS_ORIGINS.split(",")
		: ["http://localhost:3000", "http://localhost:3001"],
	allowedMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	maxAge: 86400, // 24 hours for preflight cache
	credentials: true,
};

// Role-based permissions
const rolePermissions = {
	Admin: {
		users: ["create", "read", "update", "delete"],
		books: ["create", "read", "update", "delete"],
		authors: ["create", "read", "update", "delete"],
		borrows: ["create", "read", "update", "delete", "extend", "override"],
		reports: ["read", "generate", "export"],
		system: ["configure", "backup", "restore"],
	},
	Librarian: {
		users: ["read", "update"], // Can view and update user profiles but not create/delete
		books: ["create", "read", "update", "delete"],
		authors: ["create", "read", "update", "delete"],
		borrows: ["create", "read", "update", "extend"],
		reports: ["read", "generate"],
		system: [],
	},
	User: {
		users: ["read"], // Can only view their own profile
		books: ["read"],
		authors: ["read"],
		borrows: ["create", "read"], // Can borrow books and view their borrow history
		reports: [],
		system: [],
	},
};

// Utility functions
const authUtils = {
	// Blacklist a token until it would have naturally expired. Backed by
	// src/utils/store.js — Redis when REDIS_URL is set, in-process otherwise.
	blacklistToken: async (token, expiresInSeconds) => {
		const { store } = require("../utils/store");
		const ttl = expiresInSeconds || 7 * 24 * 60 * 60; // fall back to 7 days
		await store.set(`blacklist:${token}`, "1", ttl);
	},

	// Check if token is blacklisted
	isTokenBlacklisted: async (token) => {
		const { store } = require("../utils/store");
		const value = await store.get(`blacklist:${token}`);
		return value !== null && value !== undefined;
	},

	// Generate secure random string
	generateSecureRandom: (length = 32) => {
		const crypto = require("crypto");
		return crypto.randomBytes(length).toString("hex");
	},

	// Hash sensitive data
	hashSensitiveData: (data) => {
		const crypto = require("crypto");
		return crypto.createHash("sha256").update(data).digest("hex");
	},

	// Validate JWT secret strength
	validateJwtSecret: () => {
		if (!jwtConfig.secret || jwtConfig.secret === "your_super_secret_jwt_key_here") {
			logger.warn(
				"Using default JWT secret. Set a strong JWT_SECRET in your environment variables!"
			);
			return false;
		}

		if (jwtConfig.secret.length < 32) {
			logger.warn("JWT secret is too short. Use at least 32 characters for better security!");
			return false;
		}

		return true;
	},

	// Check user permissions
	hasPermission: (userRole, resource, action) => {
		const permissions = rolePermissions[userRole];
		if (!permissions || !permissions[resource]) {
			return false;
		}
		return permissions[resource].includes(action);
	},

	// Get allowed roles for a specific permission
	getRolesWithPermission: (resource, action) => {
		const allowedRoles = [];
		for (const [role, permissions] of Object.entries(rolePermissions)) {
			if (permissions[resource] && permissions[resource].includes(action)) {
				allowedRoles.push(role);
			}
		}
		return allowedRoles;
	},
};

// Initialize security checks
const initializeAuth = () => {
	logger.info("Initializing authentication system...");

	const isSecretValid = authUtils.validateJwtSecret();
	if (!isSecretValid) {
		if (process.env.NODE_ENV === "production") {
			logger.error("Refusing to start in production with a missing/default/weak JWT_SECRET.");
			process.exit(1);
		}
		logger.warn("JWT secret validation failed (non-production — continuing)");
	} else {
		logger.info("JWT secret validation passed");
	}

	logger.info(
		{
			jwtExpiresIn: jwtConfig.expiresIn,
			passwordMinLength: passwordConfig.minLength,
			bcryptRounds: passwordConfig.saltRounds,
			rateLimitWindowMinutes: rateLimitConfig.windowMs / 1000 / 60,
			corsOrigins: securityConfig.corsOrigins,
		},
		"Auth configuration loaded"
	);

	logger.info("Authentication system initialized");
};

module.exports = {
	jwtConfig,
	passwordConfig,
	sessionConfig,
	rateLimitConfig,
	securityConfig,
	rolePermissions,
	authUtils,
	initializeAuth,
};
