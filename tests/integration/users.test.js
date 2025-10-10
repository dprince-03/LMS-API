const request = require('supertest');
const app = require('../../server');
const {
    cleanupDatabase,
    createTestUser,
    createTestAdmin,
    loginUser
} = require('../helpers/test.helpers');

describe('Users API', () => {
    let adminToken;
    let userToken;

    beforeEach(async () => {
        await cleanupDatabase();
        
        // Create admin and user
        const admin = await createTestAdmin();
        adminToken = admin.token;
        
        const user = await createTestUser();
        userToken = user.token;
    });

    describe('GET /api/users', () => {
        it('should return all users for admin', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body).toHaveProperty('pagination');
        });

        it('should fail for non-admin users', async () => {
            const response = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/users?page=1&limit=5')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.pagination.items_per_page).toBe(5);
        });

        it('should support search', async () => {
            const response = await request(app)
                .get('/api/users?search=admin')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /api/users/:id', () => {
        it('should return user by ID', async () => {
            const user = await createTestUser();

            const response = await request(app)
                .get(`/api/users/${user.user.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.data.id).toBe(user.user.id);
        });

        it('should return 404 for non-existent user', async () => {
            const response = await request(app)
                .get('/api/users/99999')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/users', () => {
        it('should create new user (admin only)', async () => {
            const newUser = {
                first_name: 'New',
                last_name: 'User',
                user_name: 'newuser123',
                email: 'newuser@example.com',
                password: 'Password123',
                role: 'Librarian'
            };

            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(newUser)
                .expect(201);

            expect(response.body.data.email).toBe(newUser.email);
            expect(response.body.data.role).toBe('Librarian');
        });

        it('should fail for non-admin', async () => {
            const response = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    first_name: 'Test',
                    user_name: 'test',
                    email: 'test@example.com',
                    password: 'Password123'
                })
                .expect(403);

            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should update user profile', async () => {
            const user = await createTestUser();

            const response = await request(app)
                .put(`/api/users/${user.user.id}`)
                .set('Authorization', `Bearer ${user.token}`)
                .send({ first_name: 'Updated' })
                .expect(200);

            expect(response.body.data.first_name).toBe('Updated');
        });

        it('should fail to update other user profile', async () => {
            const user1 = await createTestUser();
            const user2 = await createTestUser();

            const response = await request(app)
                .put(`/api/users/${user2.user.id}`)
                .set('Authorization', `Bearer ${user1.token}`)
                .send({ first_name: 'Hacked' })
                .expect(403);

            expect(response.body.success).toBe(false);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('should delete user (admin only)', async () => {
            const user = await createTestUser();

            const response = await request(app)
                .delete(`/api/users/${user.user.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        it('should fail for non-admin', async () => {
            const user = await createTestUser();

            const response = await request(app)
                .delete(`/api/users/${user.user.id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
        });
    });
});