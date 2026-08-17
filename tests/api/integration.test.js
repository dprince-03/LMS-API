const request = require('supertest');
const app = require('../../server');
const DBHelper = require('../helpers/test.helpers');

describe('Full Library Workflow', () => {
  let userToken;
  let book;
  let borrowRecord;

  beforeAll(async () => {
    await DBHelper.clearDatabase();

    // Setup user and book
    await DBHelper.createTestUser();
    book = await DBHelper.createTestBook({ available_copies: 3 });

    // Login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        emailOrUsername: 'test@example.com',
        password: 'TestPass123!'
      });

    userToken = loginResponse.body.data.token;
  });

  it('should complete full borrow-return cycle', async () => {
    // 1. Borrow book
    const borrowResponse = await request(app)
      .post(`/api/books/${book.id}/borrow`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201);

    expect(borrowResponse.body.success).toBe(true);
    borrowRecord = borrowResponse.body.data.borrow_record;

    // 2. Check book availability decreased
    const bookResponse = await request(app)
      .get(`/api/books/${book.id}`)
      .expect(200);

    expect(bookResponse.body.data.available_copies).toBe(2);

    // 3. Return book
    const returnResponse = await request(app)
      .post(`/api/books/${book.id}/return`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(returnResponse.body.success).toBe(true);

    // 4. Verify book availability restored
    const finalBookResponse = await request(app)
      .get(`/api/books/${book.id}`)
      .expect(200);

    expect(finalBookResponse.body.data.available_copies).toBe(3);
  });
});