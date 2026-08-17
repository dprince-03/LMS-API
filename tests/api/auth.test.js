// const request = require('supertest');
// const app = require('../../server');
// const { cleanupDatabase, createTestUser } = require('../helpers/test.helpers');

// describe('Authentication API', () => {
//     beforeEach(async () => {
//         await cleanupDatabase();
//     });

//     describe('POST /api/auth/register', () => {
//         it('should register a new user successfully', async () => {
//             const userData = {
//                 first_name: 'John',
//                 last_name: 'Doe',
//                 user_name: 'johndoe',
//                 email: 'john@example.com',
//                 password: 'Password123'
//             };

//             const response = await request(app)
//                 .post('/api/auth/register')
//                 .send(userData)
//                 .expect(201);

//             expect(response.body.success).toBe(true);
//             expect(response.body.data).toHaveProperty('user');
//             expect(response.body.data).toHaveProperty('token');
//             expect(response.body.data.user.email).toBe(userData.email);
//         });

//         it('should fail with missing required fields', async () => {
//             const response = await request(app)
//                 .post('/api/auth/register')
//                 .send({ email: 'test@example.com' })
//                 .expect(400);

//             expect(response.body.success).toBe(false);
//             expect(response.body.message).toContain('required');
//         });

//         it('should fail with invalid email format', async () => {
//             const response = await request(app)
//                 .post('/api/auth/register')
//                 .send({
//                     first_name: 'Test',
//                     user_name: 'testuser',
//                     email: 'invalid-email',
//                     password: 'Password123'
//                 })
//                 .expect(400);

//             expect(response.body.success).toBe(false);
//         });

//         it('should fail with duplicate email', async () => {
//             const userData = {
//                 first_name: 'Test',
//                 user_name: 'testuser1',
//                 email: 'duplicate@example.com',
//                 password: 'Password123'
//             };

//             await request(app).post('/api/auth/register').send(userData);

//             const response = await request(app)
//                 .post('/api/auth/register')
//                 .send({ ...userData, user_name: 'testuser2' })
//                 .expect(409);

//             expect(response.body.success).toBe(false);
//             expect(response.body.message).toContain('already exists');
//         });
//     });

//     describe('POST /api/auth/login', () => {
//         it('should login with valid credentials', async () => {
//             const userData = {
//                 first_name: 'Test',
//                 user_name: 'logintest',
//                 email: 'login@example.com',
//                 password: 'Password123'
//             };

//             await request(app).post('/api/auth/register').send(userData);

//             const response = await request(app)
//                 .post('/api/auth/login')
//                 .send({
//                     email_or_username: userData.email,
//                     password: userData.password
//                 })
//                 .expect(200);

//             expect(response.body.success).toBe(true);
//             expect(response.body.data).toHaveProperty('token');
//             expect(response.body.data).toHaveProperty('user');
//         });

//         it('should fail with invalid credentials', async () => {
//             const response = await request(app)
//                 .post('/api/auth/login')
//                 .send({
//                     email_or_username: 'nonexistent@example.com',
//                     password: 'WrongPassword'
//                 })
//                 .expect(401);

//             expect(response.body.success).toBe(false);
//         });

//         it('should fail with missing password', async () => {
//             const response = await request(app)
//                 .post('/api/auth/login')
//                 .send({ email_or_username: 'test@example.com' })
//                 .expect(400);

//             expect(response.body.success).toBe(false);
//         });
//     });

//     describe('GET /api/auth/me', () => {
//         it('should return current user profile with valid token', async () => {
//             const { user, token } = await createTestUser();

//             const response = await request(app)
//                 .get('/api/auth/me')
//                 .set('Authorization', `Bearer ${token}`)
//                 .expect(200);

//             expect(response.body.success).toBe(true);
//             expect(response.body.data.id).toBe(user.id);
//             expect(response.body.data.email).toBe(user.email);
//         });

//         it('should fail without authorization token', async () => {
//             const response = await request(app)
//                 .get('/api/auth/me')
//                 .expect(401);

//             expect(response.body.success).toBe(false);
//         });

//         it('should fail with invalid token', async () => {
//             const response = await request(app)
//                 .get('/api/auth/me')
//                 .set('Authorization', 'Bearer invalid_token')
//                 .expect(401);

//             expect(response.body.success).toBe(false);
//         });
//     });

//     describe('POST /api/auth/change-password', () => {
//         it('should change password successfully', async () => {
//             const { user, token } = await createTestUser();

//             const response = await request(app)
//                 .post('/api/auth/change-password')
//                 .set('Authorization', `Bearer ${token}`)
//                 .send({
//                     current_password: 'TestPassword123',
//                     new_password: 'NewPassword123'
//                 })
//                 .expect(200);

//             expect(response.body.success).toBe(true);

//             // Verify can login with new password
//             const loginResponse = await request(app)
//                 .post('/api/auth/login')
//                 .send({
//                     email_or_username: user.email,
//                     password: 'NewPassword123'
//                 })
//                 .expect(200);

//             expect(loginResponse.body.success).toBe(true);
//         });

//         it('should fail with incorrect current password', async () => {
//             const { token } = await createTestUser();

//             const response = await request(app)
//                 .post('/api/auth/change-password')
//                 .set('Authorization', `Bearer ${token}`)
//                 .send({
//                     current_password: 'WrongPassword',
//                     new_password: 'NewPassword123'
//                 })
//                 .expect(400);

//             expect(response.body.success).toBe(false);
//         });
//     });
// });


const request = require("supertest");
const app = require("../../server");
const DBHelper = require("../helpers/test.helpers");

describe("Authentication API", () => {
	beforeAll(async () => {
		await DBHelper.clearDatabase();
	});

	afterEach(async () => {
		await DBHelper.clearDatabase();
	});

	afterAll(async () => {
		// Close database pool for this test suite
		const { pool } = require("../../src/config/database.config");
		await pool.end();
	});

	describe("POST /api/auth/register", () => {
		it("should register a new user successfully", async () => {
			const response = await request(app)
				.post("/api/auth/register")
				.send({
					first_name: "John",
					last_name: "Doe",
					user_name: "johndoe",
					email: "john@example.com",
					password: "SecurePass123!",
				})
				.expect(201);

			expect(response.body.success).toBe(true);
			expect(response.body.data.user).toHaveProperty("id");
			expect(response.body.data.user.email).toBe("john@example.com");
			expect(response.body.data.user.role).toBe("User");
			expect(response.body.data).toHaveProperty("token");
		});

		it("should reject duplicate email registration", async () => {
			// First registration
			await request(app).post("/api/auth/register").send({
				first_name: "Test",
				last_name: "User",
				user_name: "testuser",
				email: "test@example.com",
				password: "TestPass123!",
			});

			// Second registration with same email
			const response = await request(app)
				.post("/api/auth/register")
				.send({
					first_name: "Test",
					last_name: "User",
					user_name: "testuser2",
					email: "test@example.com",
					password: "TestPass123!",
				})
				.expect(409);

			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("already exists");
		});

		it("should validate password strength", async () => {
			const response = await request(app)
				.post("/api/auth/register")
				.send({
					first_name: "Test",
					last_name: "User",
					user_name: "testuser",
					email: "test@example.com",
					password: "weak",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should reject missing required fields", async () => {
			const response = await request(app)
				.post("/api/auth/register")
				.send({
					email: "test@example.com",
					password: "TestPass123!",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /api/auth/login", () => {
		beforeEach(async () => {
			await DBHelper.createTestUser();
		});

		it("should login user with valid email credentials", async () => {
			const response = await request(app)
				.post("/api/auth/login")
				.send({
					emailOrUsername: "test@example.com",
					password: "TestPass123!",
				})
				.expect(200);

			expect(response.body.status).toBe("success");
			expect(response.body.data).toHaveProperty("token");
			expect(response.body.data.user.email).toBe("test@example.com");
		});

		it("should login user with valid username credentials", async () => {
			const response = await request(app)
				.post("/api/auth/login")
				.send({
					emailOrUsername: "testuser",
					password: "TestPass123!",
				})
				.expect(200);

			expect(response.body.status).toBe("success");
			expect(response.body.data).toHaveProperty("token");
		});

		it("should reject invalid credentials", async () => {
			const response = await request(app)
				.post("/api/auth/login")
				.send({
					emailOrUsername: "test@example.com",
					password: "WrongPassword",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});

		it("should reject non-existent user", async () => {
			const response = await request(app)
				.post("/api/auth/login")
				.send({
					emailOrUsername: "nonexistent@example.com",
					password: "TestPass123!",
				})
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe("GET /api/auth/me", () => {
		let authToken;

		beforeEach(async () => {
			await DBHelper.createTestUser();

			// Login to get token
			const loginResponse = await request(app).post("/api/auth/login").send({
				emailOrUsername: "test@example.com",
				password: "TestPass123!",
			});

			authToken = loginResponse.body.data.token;
		});

		it("should return user profile with valid token", async () => {
			const response = await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.success).toBe(true);
			expect(response.body.data.email).toBe("test@example.com");
			expect(response.body.data).not.toHaveProperty("password");
		});

		it("should reject request without token", async () => {
			const response = await request(app).get("/api/auth/me").expect(401);

			expect(response.body.success).toBe(false);
		});

		it("should reject request with invalid token", async () => {
			const response = await request(app)
				.get("/api/auth/me")
				.set("Authorization", "Bearer invalid_token_here")
				.expect(401);

			expect(response.body.success).toBe(false);
		});
	});

	describe("POST /api/auth/change-password", () => {
		let authToken;

		beforeEach(async () => {
			await DBHelper.createTestUser();

			const loginResponse = await request(app).post("/api/auth/login").send({
				emailOrUsername: "test@example.com",
				password: "TestPass123!",
			});

			authToken = loginResponse.body.data.token;
		});

		it("should change password successfully", async () => {
			const response = await request(app)
				.post("/api/auth/change-password")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					current_password: "TestPass123!",
					new_password: "NewSecurePass123!",
				})
				.expect(200);

			expect(response.body.success).toBe(true);

			// Verify can login with new password
			const loginResponse = await request(app)
				.post("/api/auth/login")
				.send({
					emailOrUsername: "test@example.com",
					password: "NewSecurePass123!",
				})
				.expect(200);

			expect(loginResponse.body.status).toBe("success");
		});

		it("should reject incorrect current password", async () => {
			const response = await request(app)
				.post("/api/auth/change-password")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					current_password: "WrongPassword",
					new_password: "NewSecurePass123!",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});

		it("should reject weak new password", async () => {
			const response = await request(app)
				.post("/api/auth/change-password")
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					current_password: "TestPass123!",
					new_password: "weak",
				})
				.expect(400);

			expect(response.body.success).toBe(false);
		});
	});
});