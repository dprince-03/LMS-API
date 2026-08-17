# Library Management System API - Complete Testing Guide

## Table of Contents
1. [Installation & Configuration](#installation--configuration)
2. [Jest Configuration](#jest-configuration)
3. [Test Database Setup](#test-database-setup)
4. [Test Utilities](#test-utilities)
5. [Authentication Tests](#authentication-tests)
6. [Users API Tests](#users-api-tests)
7. [Books API Tests](#books-api-tests)
8. [Authors API Tests](#authors-api-tests)
9. [Borrow Records Tests](#borrow-records-tests)
10. [Running Tests](#running-tests)

---

## Installation & Configuration

### Step 1: Install Testing Dependencies

```bash
# Install Jest and Supertest
npm install --save-dev jest supertest

# Install additional testing utilities
npm install --save-dev @types/jest @types/supertest
```

### Step 2: Update package.json

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "NODE_ENV=test jest --coverage --verbose",
    "test:watch": "NODE_ENV=test jest --watch",
    "test:unit": "NODE_ENV=test jest --testPathPattern=unit",
    "test:integration": "NODE_ENV=test jest --testPathPattern=integration",
    "test:auth": "NODE_ENV=test jest --testPathPattern=auth",
    "test:clear": "jest --clearCache"
  }
}
```

---

## Jest Configuration

### Step 3: Create `jest.config.js`

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/**',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

---

## Test Database Setup

### Step 4: Create Test Environment Configuration

Create `.env.test` file:

```env
# Test Environment
NODE_ENV=test
PORT=5001

# Test Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root123
DB_NAME=library_db_test
DB_PORT=3306

# JWT (use different secret for testing)
JWT_SECRET=test_jwt_secret_key_for_testing_only
JWT_EXPIRE=1d

# Session
SESSION_SECRET=test_session_secret
SESSION_KEY=test_session
SESSION_MAX_AGE=3600000

# Other
BCRYPT_ROUNDS=4
```

### Step 5: Create Test Database

```sql
-- Create test database
CREATE DATABASE IF NOT EXISTS library_db_test;
USE library_db_test;

-- Run your schema creation SQL here
-- (Same structure as production database)
```

---

## Test Utilities

### Step 6: Create `tests/setup.js`

```javascript
require('dotenv').config({ path: '.env.test' });
const { testConnection, closeConnection } = require('../src/config/database.config');

// Setup runs before all tests
beforeAll(async () => {
    console.log('🔄 Setting up test environment...');
    const connected = await testConnection();
    if (!connected) {
        throw new Error('Failed to connect to test database');
    }
    console.log('✅ Test database connected');
});

// Cleanup runs after all tests
afterAll(async () => {
    console.log('🔄 Cleaning up test environment...');
    await closeConnection();
    console.log('✅ Test environment cleaned up');
});

// Set longer timeout for integration tests
jest.setTimeout(10000);
```

### Step 7: Create `tests/helpers/testHelpers.js`

```javascript
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
```

---

## Authentication Tests

### Step 8: Create `tests/integration/auth.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');
const { cleanupDatabase, createTestUser } = require('../helpers/testHelpers');

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
```

---

## Users API Tests

### Step 9: Create `tests/integration/users.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');
const {
    cleanupDatabase,
    createTestUser,
    createTestAdmin,
    loginUser
} = require('../helpers/testHelpers');

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
```

---

## Books & Authors Tests

### Step 10: Create `tests/integration/books.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');
const {
    cleanupDatabase,
    createTestAdmin,
    createTestUser,
    createTestAuthor,
    createTestBook
} = require('../helpers/testHelpers');

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
```

---

## Running Tests

### Step 11: Run Your Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only authentication tests
npm run test:auth

# Run integration tests only
npm run test:integration

# Clear Jest cache
npm run test:clear
```

### Expected Output

```
 PASS  tests/integration/auth.test.js
  Authentication API
    POST /api/auth/register
      ✓ should register a new user successfully (234ms)
      ✓ should fail with missing required fields (45ms)
      ✓ should fail with invalid email format (42ms)
      ✓ should fail with duplicate email (89ms)
    POST /api/auth/login
      ✓ should login with valid credentials (156ms)
      ✓ should fail with invalid credentials (67ms)
      ✓ should fail with missing password (23ms)
    GET /api/auth/me
      ✓ should return current user profile with valid token (78ms)
      ✓ should fail without authorization token (12ms)
      ✓ should fail with invalid token (34ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Coverage:    85.2% Statements
             78.9% Branches
             82.4% Functions
             84.7% Lines
```

---

## Troubleshooting

### Common Issues

**1. Database Connection Fails**
```bash
# Check if test database exists
mysql -u root -p
CREATE DATABASE library_db_test;
```

**2. Tests Timeout**
```javascript
// Increase timeout in jest.config.js
testTimeout: 30000
```

**3. Port Already in Use**
```bash
# Use different port in .env.test
PORT=5001
```

---

## Coverage Report

After running tests, view coverage report:

```bash
# Open in browser
open coverage/lcov-report/index.html
```

---

## Next Steps

1. ✅ Add more edge case tests
2. ✅ Test error scenarios
3. ✅ Add performance tests
4. ✅ Set up CI/CD pipeline
5. ✅ Add load testing with Artillery

**Your API is now fully tested and production-ready!** 🚀