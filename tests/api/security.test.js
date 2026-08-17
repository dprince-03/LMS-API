const request = require("supertest");
const app = require("../../src/server");
const DBHelper = require("../helpers/test.helpers");
const { verifyAppToken } = require("../../src/utils/tokens");

// Regression coverage for the bugs found in the docs/TODO.md / SECURITY_TESTING.md
// review pass, plus the authorization-boundary and password-reset coverage
// called for in Phase 4. Each test names the specific bug it guards against.
describe("Security & regression coverage", () => {
	let adminToken;
	let userToken;
	let user;

	beforeEach(async () => {
		await DBHelper.clearDatabase();

		await DBHelper.createTestUser(global.adminUser);
		const adminLogin = await request(app)
			.post("/api/auth/login")
			.send({ emailOrUsername: global.adminUser.email, password: global.adminUser.password });
		adminToken = adminLogin.body.data.token;

		user = await DBHelper.createTestUser(global.testUser);
		const userLogin = await request(app)
			.post("/api/auth/login")
			.send({ emailOrUsername: global.testUser.email, password: global.testUser.password });
		userToken = userLogin.body.data.token;
	});

	describe("Self-service privilege escalation (formerly: PUT /users/:id let a User set role)", () => {
		it("silently drops is_active/email_verified when a User edits their own profile", async () => {
			const response = await request(app)
				.put(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${userToken}`)
				.send({ first_name: "Updated", is_active: false, email_verified: true })
				.expect(200);

			expect(response.body.data.first_name).toBe("Updated");
			expect(response.body.data.is_active).toBe(1);

			const check = await request(app)
				.get(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${userToken}`)
				.expect(200);
			expect(check.body.data.is_active).toBe(1);
		});

		it("rejects the request outright with a 403 when role is explicitly present in a User's own update", async () => {
			await request(app)
				.put(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${userToken}`)
				.send({ role: "Admin" })
				.expect(403);
		});

		it("still allows an Admin to change another user's role", async () => {
			const response = await request(app)
				.put(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ role: "Librarian" })
				.expect(200);

			expect(response.body.data.role).toBe("Librarian");
		});
	});

	describe("Password hash exposure (formerly: findUserById leaked bcrypt hash into responses)", () => {
		it("never includes a password field in GET /users/:id", async () => {
			const response = await request(app)
				.get(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.expect(200);
			expect(response.body.data).not.toHaveProperty("password");
		});

		it("never includes a password field in the PUT /users/:id response", async () => {
			const response = await request(app)
				.put(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${userToken}`)
				.send({ first_name: "NoLeak" })
				.expect(200);
			expect(response.body.data).not.toHaveProperty("password");
		});

		it("never includes a password field when an Admin creates a user", async () => {
			const response = await request(app)
				.post("/api/users")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({
					first_name: "New",
					last_name: "Person",
					user_name: "newperson",
					email: "newperson@example.com",
					password: "SecurePass123",
				})
				.expect(201);
			expect(response.body.data).not.toHaveProperty("password");
		});

		it("never includes a password field in GET /users/profile", async () => {
			const response = await request(app)
				.get("/api/users/profile")
				.set("Authorization", `Bearer ${userToken}`)
				.expect(200);
			expect(response.body.data).not.toHaveProperty("password");
		});
	});

	describe("GET /users/:id access control (formerly: requireAdmin blocked Librarian/self entirely)", () => {
		it("allows a User to view their own profile", async () => {
			await request(app)
				.get(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${userToken}`)
				.expect(200);
		});

		it("allows a Librarian to view another user's profile", async () => {
			const librarian = await DBHelper.createTestUser({
				email: "librarian@example.com",
				user_name: "librarianuser",
				role: "Librarian",
			});
			const login = await request(app)
				.post("/api/auth/login")
				.send({ emailOrUsername: "librarian@example.com", password: "TestPass123!" });

			await request(app)
				.get(`/api/users/${user.id}`)
				.set("Authorization", `Bearer ${login.body.data.token}`)
				.expect(200);
			void librarian;
		});

		it("rejects a User viewing a different user's profile", async () => {
			const other = await DBHelper.createTestUser({
				email: "other@example.com",
				user_name: "otheruser",
			});
			await request(app)
				.get(`/api/users/${other.id}`)
				.set("Authorization", `Bearer ${userToken}`)
				.expect(403);
		});
	});

	describe("Vertical/horizontal authorization boundaries", () => {
		it("rejects an unauthenticated request to a protected route", async () => {
			await request(app).get("/api/users").expect(401);
		});

		it("rejects a User hitting an Admin-only route", async () => {
			await request(app)
				.get("/api/users")
				.set("Authorization", `Bearer ${userToken}`)
				.expect(403);
		});

		it("rejects a User hitting another user's borrow records", async () => {
			const other = await DBHelper.createTestUser({
				email: "other2@example.com",
				user_name: "otheruser2",
			});
			await request(app)
				.get(`/api/users/${other.id}/borrow-records`)
				.set("Authorization", `Bearer ${userToken}`)
				.expect(403);
		});

		it("rejects a stale/tampered JWT", async () => {
			await request(app)
				.get("/api/auth/me")
				.set("Authorization", "Bearer not.a.valid.jwt")
				.expect(401);
		});
	});

	describe("Logout token revocation (formerly: blacklist was never checked)", () => {
		it("rejects a token after logout", async () => {
			await request(app)
				.post("/api/auth/logout")
				.set("Authorization", `Bearer ${userToken}`)
				.expect(200);
			await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${userToken}`)
				.expect(401);
		});
	});

	describe("Password reset flow (formerly: unauthenticated reset-password by email alone)", () => {
		it("responds identically whether or not the email exists (no user enumeration)", async () => {
			const known = await request(app)
				.post("/api/auth/forgot-password")
				.send({ email: global.testUser.email })
				.expect(200);
			const unknown = await request(app)
				.post("/api/auth/forgot-password")
				.send({ email: "nobody@example.com" })
				.expect(200);
			expect(known.body.message).toBe(unknown.body.message);
		});

		it("resets the password with a validly-signed reset token and the new password works", async () => {
			// SMTP isn't configured in tests, so forgotPassword logs instead of
			// emailing — mint the same shape of token directly to exercise the
			// verification/consumption path without needing a real mailbox.
			const { generateResetToken } = require("../../src/utils/tokens");
			const resetToken = generateResetToken(user.id, user.email);

			await request(app)
				.post("/api/auth/reset-password")
				.send({ token: resetToken, new_password: "BrandNewPass123" })
				.expect(200);

			const login = await request(app)
				.post("/api/auth/login")
				.send({ emailOrUsername: user.email, password: "BrandNewPass123" })
				.expect(200);
			expect(login.body.success).toBe(true);
		});

		it("rejects reusing the same reset token twice", async () => {
			const { generateResetToken } = require("../../src/utils/tokens");
			const resetToken = generateResetToken(user.id, user.email);

			await request(app)
				.post("/api/auth/reset-password")
				.send({ token: resetToken, new_password: "FirstReset123" })
				.expect(200);

			await request(app)
				.post("/api/auth/reset-password")
				.send({ token: resetToken, new_password: "SecondReset123" })
				.expect(400);
		});

		it("rejects a regular access token used as a reset token", async () => {
			await request(app)
				.post("/api/auth/reset-password")
				.send({ token: userToken, new_password: "ShouldNotWork123" })
				.expect(400);
		});

		it("rejects a reset token used as a regular access token", async () => {
			const { generateResetToken } = require("../../src/utils/tokens");
			const resetToken = generateResetToken(user.id, user.email);

			await request(app)
				.get("/api/auth/me")
				.set("Authorization", `Bearer ${resetToken}`)
				.expect(401);
		});
	});

	describe("Health check", () => {
		it("reports ok with a connected database", async () => {
			const response = await request(app).get("/api/health").expect(200);
			expect(response.body.status).toBe("ok");
			expect(response.body.database).toBe("connected");
		});
	});

	describe("JWT algorithm/issuer/audience are enforced (formerly: unpinned algorithms)", () => {
		it("issues tokens verifiable by verifyAppToken with the expected claims", async () => {
			const decoded = verifyAppToken(userToken);
			expect(decoded.id).toBe(user.id);
			expect(decoded.role).toBe("User");
		});
	});
});
