// const request = require('supertest');
// const app = require('../../server');
// const { query } = require('../../src/config/database.config');

// // Clean up test database
// const cleanupDatabase = async () => {
//     await query('SET FOREIGN_KEY_CHECKS = 0');
//     await query('TRUNCATE TABLE borrow_records');
//     await query('TRUNCATE TABLE books');
//     await query('TRUNCATE TABLE authors');
//     await query('TRUNCATE TABLE users');
//     await query('SET FOREIGN_KEY_CHECKS = 1');
// };

// // Create test user
// const createTestUser = async (userData = {}) => {
//     const defaultUser = {
//         first_name: 'Test',
//         last_name: 'User',
//         user_name: `testuser_${Date.now()}`,
//         email: `test${Date.now()}@example.com`,
//         password: 'TestPassword123',
//         role: 'User'
//     };

//     const response = await request(app)
//         .post('/api/auth/register')
//         .send({ ...defaultUser, ...userData });

//     return response.body.data;
// };

// // Create test admin
// const createTestAdmin = async () => {
//     return createTestUser({
//         user_name: `admin_${Date.now()}`,
//         email: `admin${Date.now()}@example.com`,
//         role: 'Admin'
//     });
// };

// // Login helper
// const loginUser = async (email, password) => {
//     const response = await request(app)
//         .post('/api/auth/login')
//         .send({ email_or_username: email, password });

//     return response.body.data.token;
// };

// // Create test author
// const createTestAuthor = async (token, authorData = {}) => {
//     const defaultAuthor = {
//         first_name: 'Test',
//         last_name: 'Author',
//         email: `author${Date.now()}@example.com`
//     };

//     const response = await request(app)
//         .post('/api/authors')
//         .set('Authorization', `Bearer ${token}`)
//         .send({ ...defaultAuthor, ...authorData });

//     return response.body.data;
// };

// // Create test book
// const createTestBook = async (token, authorId, bookData = {}) => {
//     const defaultBook = {
//         isbn: `ISBN${Date.now()}`,
//         title: 'Test Book',
//         author_id: authorId,
//         total_copies: 5,
//         available_copies: 5
//     };

//     const response = await request(app)
//         .post('/api/books')
//         .set('Authorization', `Bearer ${token}`)
//         .send({ ...defaultBook, ...bookData });

//     return response.body.data;
// };

// module.exports = {
//     cleanupDatabase,
//     createTestUser,
//     createTestAdmin,
//     loginUser,
//     createTestAuthor,
//     createTestBook
// };

const { query } = require("../../src/config/database.config");
const {
	createUser,
	findUserByEmailOrUsername,
} = require("../../src/models/users.model");
const { createAuthor } = require("../../src/models/authors.model");
const { createBook } = require("../../src/models/books.model");
const { createBorrowRecord } = require("../../src/models/borrowedRecords.model");

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
		return await createAuthor({
			first_name: "Test",
			last_name: "Author",
			email: "author@example.com",
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

		return await createBook({
			isbn: "978-1234567890",
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