require("dotenv").config();
const mysql = require("mysql2/promise");

// Create a MySQL connection pool
const pool = mysql.createPool({
	host: process.env.DB_HOST || "localhost",
	user: process.env.DB_USER || "root",
	password: process.env.DB_PASSWORD || "",
	database: process.env.DB_NAME || "library_db",
	port: process.env.DB_PORT || 3306,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
	acquireTimeout: 60000,
	timeout: 60000,
	reconnect: true,
});

// Test database connection
const testConnection = async () => {
	try {
		const connection = await pool.getConnection();
		console.log("✅ Database connected successfully!");

		// Test a simple query
		const [rows] = await connection.execute("SELECT 1 as test");
		console.log("✅ Database query test successful:", rows[0]);

		connection.release();
		return true;
	} catch (error) {
		console.error("❌ Database connection failed:", error.message);
		return false;
	}
};

// Query helper function
const query = async (sql, params = []) => {
	try {
		const [rows] = await pool.execute(sql, params);
		return rows;
	} catch (error) {
		console.error("Database query error:", error.message);
		console.error("SQL:", sql);
		console.error("Params:", params);
		throw error;
	}
};

// Query with transaction helper function
const queryWithTransaction = async (connection, sql, params = []) => {
	try {
		const [rows] = await connection.execute(sql, params);
		return rows;
	} catch (error) {
		console.error("Transaction query error:", error.message);
		console.error("SQL:", sql);
		console.error("Params:", params);
		throw error;
	}
};

// Transaction wrapper function
const executeTransaction = async (callback) => {
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();

		const result = await callback(connection);

		await connection.commit();
		return result;
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
};

// Gracefully close database connections
const closeConnection = async () => {
	try {
		await pool.end();
		console.log("✅ Database connections closed successfully");
	} catch (error) {
		console.error("❌ Error closing database connections:", error.message);
	}
};

module.exports = {
	pool,
	testConnection,
	query,
	queryWithTransaction,
	executeTransaction,
	closeConnection,
};