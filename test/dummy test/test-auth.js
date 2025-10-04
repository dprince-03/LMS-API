
const { testConnection } = require('../../src/config/database.config');
const { register, login } = require('../../src/controllers/auth.controllers');

// Mock request/response objects for testing
const mockRegister = async () => {
    const req = {
        body: {
            first_name: 'Test',
            last_name: 'User',
            user_name: 'testuser',
            email: 'test@example.com',
            password: 'Password123'
        }
    };
    
    const res = {
        status: (code) => ({ json: (data) => console.log('Status:', code, 'Data:', data) })
    };
    
    await register(req, res);
};

const testAuth = async () => {
    await testConnection();
    await mockRegister();
};

testAuth();

