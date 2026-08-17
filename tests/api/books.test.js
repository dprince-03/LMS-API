// const request = require('supertest');
// const app = require('../../server');
// const {
//     cleanupDatabase,
//     createTestAdmin,
//     createTestUser,
//     createTestAuthor,
//     createTestBook
// } = require('../helpers/test.helpers');

// describe('Books API', () => {
//     let adminToken;
//     let userToken;
//     let author;

//     beforeEach(async () => {
//         await cleanupDatabase();

//         const admin = await createTestAdmin();
//         adminToken = admin.token;

//         const user = await createTestUser();
//         userToken = user.token;

//         author = await createTestAuthor(adminToken);
//     });

//     describe('GET /api/books', () => {
//         it('should return all books', async () => {
//             await createTestBook(adminToken, author.id);

//             const response = await request(app)
//                 .get('/api/books')
//                 .expect(200);

//             expect(response.body.success).toBe(true);
//             expect(Array.isArray(response.body.data)).toBe(true);
//         });

//         it('should support filtering by author', async () => {
//             await createTestBook(adminToken, author.id);

//             const response = await request(app)
//                 .get(`/api/books?author_id=${author.id}`)
//                 .expect(200);

//             expect(response.body.data.length).toBeGreaterThan(0);
//         });

//         it('should support search', async () => {
//             await createTestBook(adminToken, author.id, { title: 'Unique Title' });

//             const response = await request(app)
//                 .get('/api/books?search=Unique')
//                 .expect(200);

//             expect(response.body.data.length).toBeGreaterThan(0);
//         });
//     });

//     describe('POST /api/books', () => {
//         it('should create new book (admin/librarian only)', async () => {
//             const bookData = {
//                 isbn: 'ISBN123456',
//                 title: 'New Book',
//                 author_id: author.id,
//                 total_copies: 10,
//                 available_copies: 10
//             };

//             const response = await request(app)
//                 .post('/api/books')
//                 .set('Authorization', `Bearer ${adminToken}`)
//                 .send(bookData)
//                 .expect(201);

//             expect(response.body.data.title).toBe(bookData.title);
//         });

//         it('should fail for regular users', async () => {
//             const response = await request(app)
//                 .post('/api/books')
//                 .set('Authorization', `Bearer ${userToken}`)
//                 .send({
//                     isbn: 'ISBN123',
//                     title: 'Test',
//                     author_id: author.id
//                 })
//                 .expect(403);

//             expect(response.body.success).toBe(false);
//         });
//     });

//     describe('POST /api/books/:id/borrow', () => {
//         it('should borrow available book', async () => {
//             const book = await createTestBook(adminToken, author.id);

//             const response = await request(app)
//                 .post(`/api/books/${book.id}/borrow`)
//                 .set('Authorization', `Bearer ${userToken}`)
//                 .expect(201);

//             expect(response.body.success).toBe(true);
//             expect(response.body.data).toHaveProperty('borrow_record');
//         });

//         it('should fail when book not available', async () => {
//             const book = await createTestBook(adminToken, author.id, {
//                 available_copies: 0
//             });

//             const response = await request(app)
//                 .post(`/api/books/${book.id}/borrow`)
//                 .set('Authorization', `Bearer ${userToken}`)
//                 .expect(409);

//             expect(response.body.success).toBe(false);
//         });
//     });

//     describe('POST /api/books/:id/return', () => {
//         it('should return borrowed book', async () => {
//             const book = await createTestBook(adminToken, author.id);

//             // Borrow first
//             await request(app)
//                 .post(`/api/books/${book.id}/borrow`)
//                 .set('Authorization', `Bearer ${userToken}`);

//             // Then return
//             const response = await request(app)
//                 .post(`/api/books/${book.id}/return`)
//                 .set('Authorization', `Bearer ${userToken}`)
//                 .expect(200);

//             expect(response.body.success).toBe(true);
//             expect(response.body.data).toHaveProperty('return_details');
//         });
//     });
// });

const request = require("supertest");
const app = require("../../src/server");
const DBHelper = require("../helpers/test.helpers");

describe("Books API", () => {
	let adminToken;
	let testBook;

	beforeEach(async () => {
		await DBHelper.clearDatabase();

		// Create admin user and get token
		await DBHelper.createTestUser({
			email: "admin@example.com",
			user_name: "adminuser",
			role: "Admin",
		});

		const loginResponse = await request(app).post("/api/auth/login").send({
			emailOrUsername: "admin@example.com",
			password: "TestPass123!",
		});

		adminToken = loginResponse.body.data.token;

		// Create test book
		testBook = await DBHelper.createTestBook();
	});

	afterEach(async () => {
		await DBHelper.clearDatabase();
	});

	describe("GET /api/books/:id", () => {
		it("should include author details when include_author=true (regression: compared query string with === true)", async () => {
			const response = await request(app)
				.get(`/api/books/${testBook.id}?include_author=true`)
				.expect(200);

			expect(response.body.data).toHaveProperty("author_details");
			expect(response.body.data.author_details).not.toBeNull();
		});

		it("should include borrow records when include_borrows=true", async () => {
			const response = await request(app)
				.get(`/api/books/${testBook.id}?include_borrows=true`)
				.expect(200);

			expect(response.body.data).toHaveProperty("borrow_records");
			expect(response.body.data).toHaveProperty("total_borrows");
		});

		it("should return 404 for a non-existent book", async () => {
			await request(app).get("/api/books/999999").expect(404);
		});

		it("should return 400 for a non-numeric book id", async () => {
			await request(app).get("/api/books/not-a-number").expect(400);
		});
	});

	describe("PUT /api/books/:id", () => {
		it("should update a book with admin access", async () => {
			const response = await request(app)
				.put(`/api/books/${testBook.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ title: "Updated Title", genre: "Updated Genre" })
				.expect(200);

			expect(response.body.data.title).toBe("Updated Title");
			expect(response.body.data.genre).toBe("Updated Genre");
		});

		it("should reject available_copies greater than total_copies", async () => {
			await request(app)
				.put(`/api/books/${testBook.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ available_copies: 999 })
				.expect(400);
		});

		it("should reject update from a non-admin user", async () => {
			const user = await DBHelper.createTestUser({
				email: "updater@example.com",
				user_name: "updateruser",
			});
			const login = await request(app)
				.post("/api/auth/login")
				.send({ emailOrUsername: "updater@example.com", password: "TestPass123!" });

			await request(app)
				.put(`/api/books/${testBook.id}`)
				.set("Authorization", `Bearer ${login.body.data.token}`)
				.send({ title: "Should Not Apply" })
				.expect(403);
			void user;
		});

		it("should return 404 when updating a non-existent book", async () => {
			await request(app)
				.put("/api/books/999999")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ title: "Nope" })
				.expect(404);
		});
	});

	describe("DELETE /api/books/:id", () => {
		it("should delete a book with admin access (regression: typo referenced an undefined variable)", async () => {
			const book = await DBHelper.createTestBook();

			const response = await request(app)
				.delete(`/api/books/${book.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should reject deleting a book with an active borrow", async () => {
			const book = await DBHelper.createTestBook();
			await request(app)
				.post(`/api/books/${book.id}/borrow`)
				.set("Authorization", `Bearer ${adminToken}`)
				.send({});

			const response = await request(app)
				.delete(`/api/books/${book.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(409);

			expect(response.body.success).toBe(false);
		});

		it("should reject deletion from a non-admin user", async () => {
			const book = await DBHelper.createTestBook();
			await DBHelper.createTestUser({
				email: "deleter@example.com",
				user_name: "deleteruser",
			});
			const login = await request(app)
				.post("/api/auth/login")
				.send({ emailOrUsername: "deleter@example.com", password: "TestPass123!" });

			await request(app)
				.delete(`/api/books/${book.id}`)
				.set("Authorization", `Bearer ${login.body.data.token}`)
				.expect(403);
		});
	});

	describe("POST /api/books/:id/return", () => {
		it("should return a borrowed book", async () => {
			const book = await DBHelper.createTestBook();
			const user = await DBHelper.createTestUser({
				email: "returner@example.com",
				user_name: "returneruser",
			});
			const login = await request(app)
				.post("/api/auth/login")
				.send({ emailOrUsername: "returner@example.com", password: "TestPass123!" });
			const token = login.body.data.token;

			await request(app)
				.post(`/api/books/${book.id}/borrow`)
				.set("Authorization", `Bearer ${token}`)
				.send({});

			const response = await request(app)
				.post(`/api/books/${book.id}/return`)
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(response.body.data).toHaveProperty("return_details");
			void user;
		});

		it("should 404 when there is no active borrow to return", async () => {
			const book = await DBHelper.createTestBook();
			await request(app)
				.post(`/api/books/${book.id}/return`)
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(404);
		});
	});

	describe("GET /api/books", () => {
		it("should return paginated books list", async () => {
			const response = await request(app).get("/api/books?page=1&limit=5").expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toBeInstanceOf(Array);
			expect(response.body.pagination).toHaveProperty("current_page", 1);
		});

		it("should filter books by genre", async () => {
			const response = await request(app).get("/api/books?genre=Fiction").expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("POST /api/books", () => {
		it("should create book with admin access", async () => {
			const newBook = {
				isbn: "978-0987654321",
				title: "New Test Book",
				author_id: testBook.author_id,
				genre: "Science Fiction",
				total_copies: 10,
				available_copies: 10,
			};

			const response = await request(app)
				.post("/api/books")
				.set("Authorization", `Bearer ${adminToken}`)
				.send(newBook)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.title).toBe(newBook.title);
		});

		it('should save the language field (regression: controller destructured "launguage")', async () => {
			const response = await request(app)
				.post("/api/books")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({
					isbn: "978-1122334455",
					title: "Language Regression Book",
					author_id: testBook.author_id,
					language: "French",
					total_copies: 1,
					available_copies: 1,
				})
				.expect(201);

			expect(response.body.data.language).toBe("French");
		});

		it("should reject book creation without admin role", async () => {
			// Create regular user
			await DBHelper.createTestUser({
				email: "user@example.com",
				role: "User",
			});

			const loginResponse = await request(app).post("/api/auth/login").send({
				emailOrUsername: "user@example.com",
				password: "TestPass123!",
			});

			const userToken = loginResponse.body.data.token;

			await request(app)
				.post("/api/books")
				.set("Authorization", `Bearer ${userToken}`)
				.send({
					isbn: "978-1111111111",
					title: "Unauthorized Book",
					author_id: testBook.author_id,
				})
				.expect(403);
		});
	});

	describe("POST /api/books/:id/borrow", () => {
		let userToken;

		beforeEach(async () => {
			await DBHelper.createTestUser({
				email: "borrower@example.com",
			});

			const loginResponse = await request(app).post("/api/auth/login").send({
				emailOrUsername: "borrower@example.com",
				password: "TestPass123!",
			});

			userToken = loginResponse.body.data.token;
		});

		it("should allow user to borrow available book", async () => {
			const response = await request(app)
				.post(`/api/books/${testBook.id}/borrow`)
				.set("Authorization", `Bearer ${userToken}`)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.borrow_record).toHaveProperty("id");
		});

		it("should prevent borrowing unavailable book", async () => {
			// Make book unavailable
			await DBHelper.createTestBook({ available_copies: 0 });

			const unavailableBook = await DBHelper.createTestBook({
				title: "Unavailable Book",
				available_copies: 0,
			});

			await request(app)
				.post(`/api/books/${unavailableBook.id}/borrow`)
				.set("Authorization", `Bearer ${userToken}`)
				.expect(409);
		});
	});
});
