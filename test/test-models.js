
const { testConnection } = require('./src/config/database.config');
// const { authors, books, users } = require('./src/models');
const authors = require('./src/models/authors.model');
const users = require('./src/models/users.model');
const books = require('./src/models/books.model');

const testModels = async () => {
    await testConnection();
    
    // Test creating an author
    try {
        const author = await authors.createAuthor({
            first_name: 'Test',
            last_name: 'Author',
            email: 'test@author.com'
        });
        console.log('✅ Created author:', author);
        
        // Test creating a user
        const user = await users.createUser({
            first_name: 'Test',
            last_name: 'User',
            user_name: 'testuser',
            email: 'test@user.com',
            password: 'password123',
            role: 'User'
        });
        console.log('✅ Created user:', user.user_name);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

testModels();

