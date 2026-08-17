module.exports = {
	testEnvironment: "node",
	coverageDirectory: "coverage",
	collectCoverageFrom: [
		"src/**/*.js",
		"!src/config/**",
		// Process bootstrapping/lifecycle code (signal handlers, the
		// NODE_ENV-gated start_server() call), not business logic — its actual
		// behavior (routes, middleware effects) is already exercised through
		// every test file via supertest against the exported app.
		"!src/server.js",
		"!**/node_modules/**",
	],
	testMatch: ["**/tests/**/*.test.js", "**/__tests__/**/*.js"],
	verbose: true,
	testTimeout: 30000,

	// Setup file runs before each test file
	setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

	// Global teardown runs once after all tests
	globalTeardown: "<rootDir>/tests/teardown.js",

	// Ignore patterns
	testPathIgnorePatterns: ["/node_modules/", "/dist/"],

	// Coverage thresholds
	coverageThreshold: {
		global: {
			branches: 70,
			functions: 70,
			lines: 70,
			statements: 70,
		},
	},

	// Force exit after tests complete
	forceExit: true,

	// Detect async operations that weren't properly handled
	detectOpenHandles: false,

	// Maximum workers (use 1 for sequential execution)
	maxWorkers: 1,
};
