#!/usr/bin/env node
/**
 * Minimal, dependency-free migration runner.
 *
 * Applies every *.sql file in migrations/, in filename order, that hasn't
 * already been recorded in the schema_migrations table. Each file runs in
 * its own transaction. Deliberately not a full framework (no down-migrations,
 * no branching) — the schema here is small enough that a straight-line list
 * of forward-only .sql files is easier to reason about than a heavier tool.
 *
 * Usage: node scripts/migrate.js
 */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

// This script lives in scripts/ — .env is a sibling directory's file, in src/.
require("dotenv").config({ path: path.join(__dirname, "..", "src", ".env") });

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function run() {
	const connection = await mysql.createConnection({
		host: process.env.DB_HOST || "localhost",
		user: process.env.DB_USER || "root",
		password: process.env.DB_PASSWORD || "",
		database: process.env.DB_NAME || "library_db",
		port: parseInt(process.env.DB_PORT) || 3306,
		multipleStatements: true,
	});

	try {
		await connection.query(`
			CREATE TABLE IF NOT EXISTS schema_migrations (
				id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
				filename VARCHAR(255) NOT NULL UNIQUE,
				applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		const [appliedRows] = await connection.query("SELECT filename FROM schema_migrations");
		const applied = new Set(appliedRows.map((row) => row.filename));

		const files = fs
			.readdirSync(MIGRATIONS_DIR)
			.filter((f) => f.endsWith(".sql"))
			.sort();

		let appliedCount = 0;

		for (const file of files) {
			if (applied.has(file)) {
				console.log(`skip  ${file} (already applied)`);
				continue;
			}

			const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");

			await connection.beginTransaction();
			try {
				await connection.query(sql);
				await connection.query("INSERT INTO schema_migrations (filename) VALUES (?)", [
					file,
				]);
				await connection.commit();
				console.log(`apply ${file}`);
				appliedCount++;
			} catch (error) {
				await connection.rollback();
				throw new Error(`Migration ${file} failed: ${error.message}`);
			}
		}

		console.log(
			`\nDone — ${appliedCount} migration(s) applied, ${files.length - appliedCount} already up to date.`
		);
	} finally {
		await connection.end();
	}
}

run().catch((error) => {
	console.error("Migration failed:", error.message);
	process.exit(1);
});
