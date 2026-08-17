const request = require("supertest");
const app = require("../../src/server");
const DBHelper = require("../helpers/test.helpers");

describe("Authors API", () => {
	let adminToken;
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
	});

	afterEach(async () => {
		await DBHelper.clearDatabase();
	});

	describe("GET /api/authors", () => {
		beforeEach(async () => {
			await DBHelper.createTestAuthor();
		});

		it("should return paginated authors list", async () => {
			const response = await request(app).get("/api/authors?page=1&limit=5").expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toBeInstanceOf(Array);
			expect(response.body.pagination).toHaveProperty("current_page", 1);
		});

		it("should search authors by name", async () => {
			const response = await request(app).get("/api/authors?search=Test").expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("GET /api/authors/:id", () => {
		it("should return a single author", async () => {
			const author = await DBHelper.createTestAuthor();

			const response = await request(app).get(`/api/authors/${author.id}`).expect(200);

			expect(response.body.data.id).toBe(author.id);
		});

		it("should include books when include_books=true", async () => {
			const author = await DBHelper.createTestAuthor();
			await DBHelper.createTestBook({ author_id: author.id });

			const response = await request(app)
				.get(`/api/authors/${author.id}?include_books=true`)
				.expect(200);

			expect(response.body.data).toHaveProperty("books");
			expect(response.body.data.books_count).toBe(1);
		});

		it("should return 404 for a non-existent author", async () => {
			await request(app).get("/api/authors/999999").expect(404);
		});
	});

	describe("POST /api/authors", () => {
		it("should create author with admin access", async () => {
			const newAuthor = {
				first_name: "Jane",
				last_name: "Austen",
				email: "jane@example.com",
				biography: "Famous English novelist",
			};

			const response = await request(app)
				.post("/api/authors")
				.set("Authorization", `Bearer ${adminToken}`)
				.send(newAuthor)
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.first_name).toBe("Jane");
			expect(response.body.data.last_name).toBe("Austen");
		});

		it("should reject a duplicate author email (regression: findAuthorByEmail had a rows.lemgth typo)", async () => {
			await DBHelper.createTestAuthor({ email: "duplicate-author@example.com" });

			await request(app)
				.post("/api/authors")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({
					first_name: "Someone",
					last_name: "Else",
					email: "duplicate-author@example.com",
				})
				.expect(409);
		});

		it("should reject author creation without admin role", async () => {
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
				.post("/api/authors")
				.set("Authorization", `Bearer ${userToken}`)
				.send({
					first_name: "Unauthorized",
					last_name: "Author",
					email: "unauthorized@example.com",
				})
				.expect(403);
		});
	});

	describe("PUT /api/authors/:id", () => {
		let author;

		beforeEach(async () => {
			author = await DBHelper.createTestAuthor();
		});

		it("should update author with admin access", async () => {
			const response = await request(app)
				.put(`/api/authors/${author.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.send({
					biography: "Updated biography",
				})
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.biography).toBe("Updated biography");
		});
	});

	describe("DELETE /api/authors/:id", () => {
		let author;

		beforeEach(async () => {
			author = await DBHelper.createTestAuthor();
		});

		it("should delete author with admin access", async () => {
			const response = await request(app)
				.delete(`/api/authors/${author.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
		});

		it("should prevent deleting author with associated books", async () => {
			// Create a book associated with the author
			await DBHelper.createTestBook({ author_id: author.id });

			const response = await request(app)
				.delete(`/api/authors/${author.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(409);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("associated books");
		});
	});
});
