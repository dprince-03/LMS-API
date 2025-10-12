// Global teardown - runs once after all test suites
module.exports = async () => {
	console.log("\n🧹 Running global teardown...");

	try {
		// Small delay to ensure all connections are ready to close
		await new Promise((resolve) => setTimeout(resolve, 1000));

		console.log("✅ Global teardown completed\n");
	} catch (error) {
		console.error("❌ Error during global teardown:", error);
	}
};
