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



const request = require('supertest');
const app = require('../../server');
const DBHelper = require('../helpers/test.helpers');

describe('Books API', () => {
    let authToken;
    let adminToken;
    let testBook;

    beforeAll(async () => {
        await DBHelper.clearDatabase();
    
        // Create admin user and get token
        const admin = await DBHelper.createTestUser({
            email: 'admin@example.com',
            user_name: 'adminuser',
            role: 'Admin'
        });

        const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
            emailOrUsername: 'admin@example.com',
            password: 'TestPass123!'
        });

        adminToken = loginResponse.body.data.token;

        // Create test book
        testBook = await DBHelper.createTestBook();
    });

    afterEach(async () => {
        await DBHelper.clearDatabase();
    });

    describe('GET /api/books', () => {
        it('should return paginated books list', async () => {
            const response = await request(app)
            .get('/api/books?page=1&limit=5')
            .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
            expect(response.body.pagination).toHaveProperty('current_page', 1);
        });

        it('should filter books by genre', async () => {
            const response = await request(app)
            .get('/api/books?genre=Fiction')
            .expect(200);

            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/books', () => {
        it('should create book with admin access', async () => {
            const newBook = {
                isbn: '978-0987654321',
                title: 'New Test Book',
                author_id: testBook.author_id,
                genre: 'Science Fiction',
                total_copies: 10,
                available_copies: 10
            };

            const response = await request(app)
            .post('/api/books')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(newBook)
            .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe(newBook.title);
        });

        it('should reject book creation without admin role', async () => {
            // Create regular user
            const user = await DBHelper.createTestUser({
                email: 'user@example.com',
                role: 'User'
            });

            const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                emailOrUsername: 'user@example.com',
                password: 'TestPass123!'
            });

            const userToken = loginResponse.body.data.token;

            await request(app)
            .post('/api/books')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
                isbn: '978-1111111111',
                title: 'Unauthorized Book',
                author_id: testBook.author_id
            })
            .expect(403);
        });
    });

    describe('POST /api/books/:id/borrow', () => {
        let userToken;

        beforeEach(async () => {
            const user = await DBHelper.createTestUser({
                email: 'borrower@example.com'
            });

            const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                emailOrUsername: 'borrower@example.com',
                password: 'TestPass123!'
            });

            userToken = loginResponse.body.data.token;
        });

        it('should allow user to borrow available book', async () => {
            const response = await request(app)
            .post(`/api/books/${testBook.id}/borrow`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.borrow_record).toHaveProperty('id');
        });

        it('should prevent borrowing unavailable book', async () => {
            // Make book unavailable
            await DBHelper.createTestBook({ available_copies: 0 });

            const unavailableBook = await DBHelper.createTestBook({
                title: 'Unavailable Book',
                available_copies: 0
            });

            await request(app)
            .post(`/api/books/${unavailableBook.id}/borrow`)
            .set('Authorization', `Bearer ${userToken}`)
            .expect(409);
        });
    });
});