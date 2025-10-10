// const { testConnection, setupTestDatabase, cleanTestDatabase, closeTestConnection } = require('./test-db.config');

// // Global test setup
// beforeAll(async () => {
//   // Setup test database
//   try {
//     await testConnection();
//     await setupTestDatabase();
//     console.log('✅ Test database setup completed');
//   } catch (error) {
//     console.error('❌ Test database setup failed:', error.message);
//     throw error;
//   }
// });

// // Clean up after each test
// afterEach(async () => {
//   // Clean test data
//   try {
//     await cleanTestDatabase();
//   } catch (error) {
//     console.warn('Warning: Test cleanup failed:', error.message);
//   }
// });

// // Global teardown
// afterAll(async () => {
//   // Close test database connections
//   try {
//     await closeTestConnection();
//     console.log('✅ Test cleanup completed');
//   } catch (error) {
//     console.warn('Warning: Test teardown failed:', error.message);
//   }
// });

require("dotenv").config({ path: ".env.test" });
const {
	testConnection,
	closeConnection,
} = require("../src/config/database.config");

// Setup runs before all tests
beforeAll(async () => {
	console.log("🔄 Setting up test environment...");
	const connected = await testConnection();
	if (!connected) {
		throw new Error("Failed to connect to test database");
	}
	console.log("✅ Test database connected");
});

// Cleanup runs after all tests
afterAll(async () => {
	console.log("🔄 Cleaning up test environment...");
	await closeConnection();
	console.log("✅ Test environment cleaned up");
});

// Set longer timeout for integration tests
jest.setTimeout(10000);