const request = require('supertest');
const app = require('../../server');
const { cleanupDatabase, createTestUser } = require('../helpers/test.helpers');

describe('Authentication API', () => {
    beforeEach(async () => {
        await cleanupDatabase();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                first_name: 'John',
                last_name: 'Doe',
                user_name: 'johndoe',
                email: 'john@example.com',
                password: 'Password123'
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('user');
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data.user.email).toBe(userData.email);
        });

        it('should fail with missing required fields', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@example.com' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('required');
        });

        it('should fail with invalid email format', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    first_name: 'Test',
                    user_name: 'testuser',
                    email: 'invalid-email',
                    password: 'Password123'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        it('should fail with duplicate email', async () => {
            const userData = {
                first_name: 'Test',
                user_name: 'testuser1',
                email: 'duplicate@example.com',
                password: 'Password123'
            };

            await request(app).post('/api/auth/register').send(userData);

            const response = await request(app)
                .post('/api/auth/register')
                .send({ ...userData, user_name: 'testuser2' })
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('already exists');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const userData = {
                first_name: 'Test',
                user_name: 'logintest',
                email: 'login@example.com',
                password: 'Password123'
            };

            await request(app).post('/api/auth/register').send(userData);

            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email_or_username: userData.email,
                    password: userData.password
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('token');
            expect(response.body.data).toHaveProperty('user');
        });

        it('should fail with invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    email_or_username: 'nonexistent@example.com',
                    password: 'WrongPassword'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should fail with missing password', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ email_or_username: 'test@example.com' })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return current user profile with valid token', async () => {
            const { user, token } = await createTestUser();

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(user.id);
            expect(response.body.data.email).toBe(user.email);
        });

        it('should fail without authorization token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .expect(401);

            expect(response.body.success).toBe(false);
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid_token')
                .expect(401);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/auth/change-password', () => {
        it('should change password successfully', async () => {
            const { user, token } = await createTestUser();

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    current_password: 'TestPassword123',
                    new_password: 'NewPassword123'
                })
                .expect(200);

            expect(response.body.success).toBe(true);

            // Verify can login with new password
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email_or_username: user.email,
                    password: 'NewPassword123'
                })
                .expect(200);

            expect(loginResponse.body.success).toBe(true);
        });

        it('should fail with incorrect current password', async () => {
            const { token } = await createTestUser();

            const response = await request(app)
                .post('/api/auth/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    current_password: 'WrongPassword',
                    new_password: 'NewPassword123'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });
});