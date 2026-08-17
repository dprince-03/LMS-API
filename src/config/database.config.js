// This file lives in src/config/ — .env is one level up, in src/.
require("dotenv").config({ path: require("node:path").resolve(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");
const logger = require("../utils/logger");

// Create a MySQL connection pool
const pool = mysql.createPool({
	host: process.env.DB_HOST || "localhost",
	user: process.env.DB_USER || "root",
	password: process.env.DB_PASSWORD || "",
	database: process.env.DB_NAME || "library_db",
	port: parseInt(process.env.DB_PORT) || 3306,
	waitForConnections: true,
	connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
	queueLimit: 0,
	connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
});

const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS) || 200;

// Test database connection
const testConnection = async () => {
	try {
		const connection = await pool.getConnection();
		logger.info("Database connected successfully");

		const [rows] = await connection.execute("SELECT 1 as test");
		logger.debug({ rows }, "Database query test successful");

		connection.release();
		return true;
	} catch (error) {
		logger.error({ err: error }, "Database connection failed");
		return false;
	}
};

// Query helper function
const query = async (sql, params = []) => {
	const start = process.env.NODE_ENV === "test" ? null : Date.now();
	try {
		const [rows] = await pool.query(sql, params);

		if (start !== null) {
			const duration = Date.now() - start;
			if (duration > SLOW_QUERY_THRESHOLD_MS) {
				logger.warn({ sql, duration }, "Slow query detected");
			}
		}

		return rows;
	} catch (error) {
		logger.error({ err: error, sql }, "Database query error");
		throw error;
	}
};

// Query with transaction helper function
const queryWithTransaction = async (connection, sql, params = []) => {
	try {
		const [rows] = await connection.query(sql, params);
		return rows;
	} catch (error) {
		logger.error({ err: error, sql }, "Transaction query error");
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
		logger.info("Database connections closed successfully");
	} catch (error) {
		logger.error({ err: error }, "Error closing database connections");
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
