require("dotenv").config();

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
	minLength: 6,
	requireUppercase: true,
	requireLowercase: true,
	requireNumbers: true,
	requireSpecialChars: false, // Set to true for stricter password requirements
};

// Session Configuration
const sessionConfig = {
	maxActiveSessions: parseInt(process.env.MAX_ACTIVE_SESSIONS) || 5, // Max concurrent sessions per user
	sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours in milliseconds
	refreshTokenExpiry:
		parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Rate Limiting Configuration
const rateLimitConfig = {
	windowMs:
		parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15 minutes default
	maxAttempts: {
		guest: parseInt(process.env.RATE_LIMIT_GUEST) || 20,
		user: parseInt(process.env.RATE_LIMIT_USER) || 60,
		librarian: parseInt(process.env.RATE_LIMIT_LIBRARIAN) || 120,
		admin: parseInt(process.env.RATE_LIMIT_ADMIN) || 300,
	},
	// Login attempt limits
	loginAttempts: {
		maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS) || 5,
		lockoutDuration:
			parseInt(process.env.LOGIN_LOCKOUT_DURATION) || 30 * 60 * 1000, // 30 minutes
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

// Token blacklist (for logout functionality)
// In production, use Redis or another cache system
const tokenBlacklist = new Set();

// Utility functions
const authUtils = {
	// Add token to blacklist
	blacklistToken: (token) => {
		tokenBlacklist.add(token);

		// Clean up expired tokens periodically
		setTimeout(
			() => {
				tokenBlacklist.delete(token);
			},
			jwtConfig.expiresIn === "7d"
				? 7 * 24 * 60 * 60 * 1000
				: 24 * 60 * 60 * 1000
		);
	},

	// Check if token is blacklisted
	isTokenBlacklisted: (token) => {
		return tokenBlacklist.has(token);
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
		if (
			!jwtConfig.secret ||
			jwtConfig.secret === "your_super_secret_jwt_key_here"
		) {
			console.warn(
				"⚠️  WARNING: Using default JWT secret. Please set a strong JWT_SECRET in your environment variables!"
			);
			return false;
		}

		if (jwtConfig.secret.length < 32) {
			console.warn(
				"⚠️  WARNING: JWT secret is too short. Use at least 32 characters for better security!"
			);
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
	console.log("🔐 Initializing authentication system...");

	// Validate JWT secret
	const isSecretValid = authUtils.validateJwtSecret();
	if (!isSecretValid) {
		console.log("❌ JWT secret validation failed");
	} else {
		console.log("✅ JWT secret validation passed");
	}

	// Log configuration
	console.log(`✅ JWT expires in: ${jwtConfig.expiresIn}`);
	console.log(`✅ Password min length: ${passwordConfig.minLength}`);
	console.log(`✅ BCrypt rounds: ${passwordConfig.saltRounds}`);
	console.log(
		`✅ Rate limit window: ${rateLimitConfig.windowMs / 1000 / 60} minutes`
	);
	console.log(`✅ CORS origins: ${securityConfig.corsOrigins.join(", ")}`);

	console.log("🔐 Authentication system initialized");
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
