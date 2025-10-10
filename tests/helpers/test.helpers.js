const request = require('supertest');
const app = require('../../server');
const { query } = require('../../src/config/database.config');

// Clean up test database
const cleanupDatabase = async () => {
    await query('SET FOREIGN_KEY_CHECKS = 0');
    await query('TRUNCATE TABLE borrow_records');
    await query('TRUNCATE TABLE books');
    await query('TRUNCATE TABLE authors');
    await query('TRUNCATE TABLE users');
    await query('SET FOREIGN_KEY_CHECKS = 1');
};

// Create test user
const createTestUser = async (userData = {}) => {
    const defaultUser = {
        first_name: 'Test',
        last_name: 'User',
        user_name: `testuser_${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        password: 'TestPassword123',
        role: 'User'
    };

    const response = await request(app)
        .post('/api/auth/register')
        .send({ ...defaultUser, ...userData });

    return response.body.data;
};

// Create test admin
const createTestAdmin = async () => {
    return createTestUser({
        user_name: `admin_${Date.now()}`,
        email: `admin${Date.now()}@example.com`,
        role: 'Admin'
    });
};

// Login helper
const loginUser = async (email, password) => {
    const response = await request(app)
        .post('/api/auth/login')
        .send({ email_or_username: email, password });

    return response.body.data.token;
};

// Create test author
const createTestAuthor = async (token, authorData = {}) => {
    const defaultAuthor = {
        first_name: 'Test',
        last_name: 'Author',
        email: `author${Date.now()}@example.com`
    };

    const response = await request(app)
        .post('/api/authors')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...defaultAuthor, ...authorData });

    return response.body.data;
};

// Create test book
const createTestBook = async (token, authorId, bookData = {}) => {
    const defaultBook = {
        isbn: `ISBN${Date.now()}`,
        title: 'Test Book',
        author_id: authorId,
        total_copies: 5,
        available_copies: 5
    };

    const response = await request(app)
        .post('/api/books')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...defaultBook, ...bookData });

    return response.body.data;
};

module.exports = {
    cleanupDatabase,
    createTestUser,
    createTestAdmin,
    loginUser,
    createTestAuthor,
    createTestBook
};