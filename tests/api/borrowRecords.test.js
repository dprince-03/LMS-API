const request = require("supertest");
const app = require("../../server");
const DBHelper = require("../helpers/test.helpers");

describe("Borrow Records API", () => {
	let adminToken;
	let userToken;
	let book;
	let borrowRecord;

	beforeAll(async () => {
		await DBHelper.clearDatabase();

		// Create admin user
		await DBHelper.createTestUser({
			email: "admin@example.com",
			user_name: "adminuser",
			role: "Admin",
		});

		const adminLogin = await request(app).post("/api/auth/login").send({
			emailOrUsername: "admin@example.com",
			password: "TestPass123!",
		});

		adminToken = adminLogin.body.data.token;

		// Create regular user
		await DBHelper.createTestUser(global.testUser);

		const userLogin = await request(app).post("/api/auth/login").send({
			emailOrUsername: "test@example.com",
			password: "TestPass123!",
		});

		userToken = userLogin.body.data.token;

		// Create book
		book = await DBHelper.createTestBook();
	});

	afterEach(async () => {
		await DBHelper.clearDatabase();
	});

	describe("GET /api/borrow-records", () => {
		it("should return borrow records for admin", async () => {
			const response = await request(app)
				.get("/api/borrow-records")
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toBeInstanceOf(Array);
		});

		it("should reject access for regular users", async () => {
			await request(app)
				.get("/api/borrow-records")
				.set("Authorization", `Bearer ${userToken}`)
				.expect(403);
		});
	});

	describe("GET /api/borrow-records/overdue", () => {
		it("should return overdue records for admin", async () => {
			const response = await request(app)
				.get("/api/borrow-records/overdue")
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});

	describe("GET /api/borrow-records/statistics", () => {
		it("should return borrowing statistics for admin", async () => {
			const response = await request(app)
				.get("/api/borrow-records/statistics")
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data).toHaveProperty("total_borrows");
		});
	});

	describe("POST /api/borrow-records/:id/extend", () => {
		beforeEach(async () => {
			// Create a borrow record first
			const user = await DBHelper.createTestUser({
				email: "borrower@example.com",
			});

			const borrowResponse = await request(app)
				.post(`/api/books/${book.id}/borrow`)
				.set("Authorization", `Bearer ${userToken}`);

			borrowRecord = borrowResponse.body.data.borrow_record;
		});

		it("should extend due date for user's own record", async () => {
			const response = await request(app)
				.post(`/api/borrow-records/${borrowRecord.id}/extend`)
				.set("Authorization", `Bearer ${userToken}`)
				.send({ extension_days: 7 })
				.expect(200);

			expect(response.body.success).toBe(true);
		});
	});
});
