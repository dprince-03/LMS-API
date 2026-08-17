const { query } = require("../../src/config/database.config");
const { createUser } = require("../../src/models/users.model");
const { createAuthor } = require("../../src/models/authors.model");
const { createBook } = require("../../src/models/books.model");
const { createBorrowRecord } = require("../../src/models/borrowedRecords.model");

// Monotonic counter (not just Date.now()) so fixtures created synchronously
// within the same millisecond still get distinct default values — avoids
// UNIQUE constraint collisions (users.email/user_name, authors.email,
// books.isbn) when a test doesn't explicitly override them.
let counter = 0;
const unique = () => `${Date.now()}${++counter}`;

class DBHelper {
	static async clearDatabase() {
		try {
			await query("SET FOREIGN_KEY_CHECKS = 0");

			const tables = ["borrow_records", "books", "authors", "users"];

			for (const table of tables) {
				await query(`DELETE FROM ${table}`);
				await query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
			}

			await query("SET FOREIGN_KEY_CHECKS = 1");
		} catch (error) {
			console.error("Error clearing database:", error);
			throw error;
		}
	}

	// Static default identity, deliberately NOT unique — most call sites rely
	// on being able to log in afterward with the well-known
	// test@example.com/testuser credentials (matching global.testUser in
	// tests/setup.js) without threading a generated value back out. Pass an
	// explicit override when a test needs more than one distinct user.
	static async createTestUser(userData = {}) {
		return await createUser({
			first_name: "Test",
			last_name: "User",
			user_name: "testuser",
			email: "test@example.com",
			password: "TestPass123!",
			role: "User",
			...userData,
		});
	}

	static async createTestAuthor(authorData = {}) {
		const id = unique();
		return await createAuthor({
			first_name: "Test",
			last_name: "Author",
			email: `author${id}@example.com`,
			...authorData,
		});
	}

	static async createTestBook(bookData = {}) {
		// Create author if not provided
		let authorId = bookData.author_id;
		if (!authorId) {
			const author = await this.createTestAuthor();
			authorId = author.id;
		}

		const id = unique();
		return await createBook({
			isbn: `978-${id}`,
			title: "Test Book",
			author_id: authorId,
			genre: "Fiction",
			total_copies: 5,
			available_copies: 5,
			...bookData,
		});
	}

	static async createBorrowRecord(recordData = {}) {
		// Create user if not provided
		let userId = recordData.user_id;
		if (!userId) {
			const user = await this.createTestUser();
			userId = user.id;
		}

		// Create book if not provided
		let bookId = recordData.book_id;
		if (!bookId) {
			const book = await this.createTestBook();
			bookId = book.id;
		}

		const dueDate = new Date();
		dueDate.setDate(dueDate.getDate() + 14);

		return await createBorrowRecord({
			user_id: userId,
			book_id: bookId,
			borrow_date: new Date(),
			due_date: dueDate,
			status: "Borrowed",
			...recordData,
		});
	}
}

module.exports = DBHelper;
