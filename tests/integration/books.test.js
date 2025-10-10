const request = require('supertest');
const app = require('../../server');
const {
    cleanupDatabase,
    createTestAdmin,
    createTestUser,
    createTestAuthor,
    createTestBook
} = require('../helpers/test.helpers');

describe('Books API', () => {
    let adminToken;
    let userToken;
    let author;

    beforeEach(async () => {
        await cleanupDatabase();
        
        const admin = await createTestAdmin();
        adminToken = admin.token;
        
        const user = await createTestUser();
        userToken = user.token;
        
        author = await createTestAuthor(adminToken);
    });

    describe('GET /api/books', () => {
        it('should return all books', async () => {
            await createTestBook(adminToken, author.id);

            const response = await request(app)
                .get('/api/books')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        it('should support filtering by author', async () => {
            await createTestBook(adminToken, author.id);

            const response = await request(app)
                .get(`/api/books?author_id=${author.id}`)
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
        });

        it('should support search', async () => {
            await createTestBook(adminToken, author.id, { title: 'Unique Title' });

            const response = await request(app)
                .get('/api/books?search=Unique')
                .expect(200);

            expect(response.body.data.length).toBeGreaterThan(0);
        });
    });

    describe('POST /api/books', () => {
        it('should create new book (admin/librarian only)', async () => {
            const bookData = {
                isbn: 'ISBN123456',
                title: 'New Book',
                author_id: author.id,
                total_copies: 10,
                available_copies: 10
            };

            const response = await request(app)
                .post('/api/books')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(bookData)
                .expect(201);

            expect(response.body.data.title).toBe(bookData.title);
        });

        it('should fail for regular users', async () => {
            const response = await request(app)
                .post('/api/books')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    isbn: 'ISBN123',
                    title: 'Test',
                    author_id: author.id
                })
                .expect(403);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/books/:id/borrow', () => {
        it('should borrow available book', async () => {
            const book = await createTestBook(adminToken, author.id);

            const response = await request(app)
                .post(`/api/books/${book.id}/borrow`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('borrow_record');
        });

        it('should fail when book not available', async () => {
            const book = await createTestBook(adminToken, author.id, {
                available_copies: 0
            });

            const response = await request(app)
                .post(`/api/books/${book.id}/borrow`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(409);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/books/:id/return', () => {
        it('should return borrowed book', async () => {
            const book = await createTestBook(adminToken, author.id);

            // Borrow first
            await request(app)
                .post(`/api/books/${book.id}/borrow`)
                .set('Authorization', `Bearer ${userToken}`);

            // Then return
            const response = await request(app)
                .post(`/api/books/${book.id}/return`)
                .set('Authorization', `Bearer ${userToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('return_details');
        });
    });
});