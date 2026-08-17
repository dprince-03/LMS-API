// .env.test lives alongside this file, in tests/.
require("dotenv").config({ path: require("node:path").resolve(__dirname, ".env.test") });

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests (pino itself is already silenced under
// NODE_ENV=test — see src/utils/logger.js — this covers anything still using
// raw console.* directly).
global.console = {
	...console,
	log: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	info: jest.fn(),
};

// Global test fixtures — the canonical "default" user/admin identity most
// tests log in as. Deliberately static (not randomized) so call sites that
// create one of these without overriding fields can reliably log back in
// with well-known credentials afterward.
global.testUser = {
	email: "test@example.com",
	password: "TestPass123!",
	first_name: "Test",
	last_name: "User",
	user_name: "testuser",
};

global.adminUser = {
	email: "admin@example.com",
	password: "AdminPass123!",
	first_name: "Admin",
	last_name: "User",
	user_name: "adminuser",
	role: "Admin",
};
