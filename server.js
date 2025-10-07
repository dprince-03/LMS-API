require('dotenv').config();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require("express-rate-limit");

const authRouter = require('./src/routes/auth.routes');
const authorRouter = require('./src/routes/authors.routes');
const bookRouter = require('./src/routes/books.routes');
const userRouter = require('./src/routes/users.routes');
const brRouter = require('./src/routes/bookRecords.routes');

const { 
    testConnection, 
    closeConnection 
} = require('./src/config/database.config');
const { initializeAuth } = require('./src/config/auth.config');


const app = express();
const PORT = process.env.PORT || 5080;

// ========================
//      MIDDLEWARES
// ========================

const corsOption = {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5000', 'http://localhost:5080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

const limiter = rateLimit({
    windowMs: 15 + 60 * 1000, // 15 minutes
    max: 100,
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(cors(corsOption));

// ✅ Temporary debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    console.log('Body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);
    next();
}); // remove later

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// ========================
//      ROUTES
// ========================
// app.use('/api', limiter, (req, res) => {
//     res.status(200).json({
//         success: true,
//         message: 'Welcome to Library Management System API',
//         version: '1.0.0',
//         documentation: '/api',
//         features: [
//             'JWT Authentication',
//             'Role-based Access Control',
//             'Book Borrowing System',
//             'Rate Limiting',
//             'Input Validation',
//             'Security Headers',
//             'Request Logging'
//         ],
//     });
// });
app.use('/api/auth', limiter, authRouter);
app.use('/api/authors', limiter, authorRouter);
app.use('/api/books', limiter, bookRouter);
app.use('/api/users', limiter, userRouter);
app.use('/api/borrow-records', limiter, brRouter);

// ==========================
//      ERROR HANDLING
// ==========================

// 404 Error Handler
// app.use('*', (req, res) => {
//     res.status(404).json({
//         success: false,
//         message: 'Route not found',
//         path: req.originalUrl,
//         method: req.method,
//         suggestion: 'Check /api for available endpoints'
//     });
// });
        
app.use((err, req, res, next) => {
    console.error(`Error: ${err}`);
        
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: err.message && err.name,
        stack: err.stack,
    });
});

// ==========================
//      SERVER SETUP
// ==========================

const start_server = async () => {
    try {
        console.log('');
        console.log('='.repeat(60));
        console.log("🚀 Starting Library Management System API...");
        console.log('='.repeat(60));
        console.log('');
    
        const dbConnect = await testConnection();
        if (!dbConnect) {
            console.error("❌ Failed to connect to database");
            console.error("Please check your database configuration in .env file");
            process.exit(1);
        }
    
        console.log('');
        console.log('='.repeat(60));
        initializeAuth();
        console.log('='.repeat(60));
        console.log('');
    
        const server = app.listen(PORT, () => {
            console.log('');
            console.log('='.repeat(50));
            console.log(`✅ Server is running on port ${PORT}`);
            console.log(`✅ API URL: http://localhost:${PORT}/api`);
            console.log('='.repeat(50));
            console.log('');
            console.log('📡 Server Information:');
            console.log(`   Base URL:        http://localhost:${PORT}`);
            console.log(`   API URL:         http://localhost:${PORT}/api`);
            console.log(`   Health Check:    http://localhost:${PORT}/api/health`);
            console.log('');
            console.log('🔐 Authentication Endpoints:');
            console.log(`   POST   /api/auth/register      - Register new user`);
            console.log(`   POST   /api/auth/login         - Login user`);
            console.log(`   GET    /api/auth/me            - Get current user`);
            console.log(`   POST   /api/auth/logout        - Logout user`);
            console.log('');
            console.log('📚 Main Endpoints:');
            console.log(`   GET    /api/authors            - Get all authors`);
            console.log(`   GET    /api/books              - Get all books`);
            console.log(`   POST   /api/books/:id/borrow   - Borrow a book`);
            console.log(`   POST   /api/books/:id/return   - Return a book`);
            console.log(`   GET    /api/users              - Get all users (Admin)`);
            console.log(`   GET    /api/borrow-records     - Get borrow records`);
            console.log('');
            console.log('🛡️  Security Features:');
            console.log('   ✓ Rate Limiting Enabled');
            console.log('   ✓ Input Sanitization Active');
            console.log('   ✓ Security Headers Set');
            console.log('   ✓ CORS Configured');
            console.log('   ✓ Request Logging Active');
            console.log('');
            console.log('💡 Tips:');
            console.log('   - Use Postman or curl to test the API');
            console.log('   - Check /api for complete endpoint list');
            console.log('');
            console.log('='.repeat(50));
            console.log('       Press CTRL+C to stop the server         ');
            console.log('='.repeat(50));
            console.log('');
        });
    
        const shutdown = async (signal) => {
            console.log('');
            console.log('='.repeat(60));
            console.log(`⚠️  ${signal} received. Shutting down gracefully...`);
            console.log('='.repeat(60));
            
            server.close(async () => {
                console.log('');
                console.log('✅ HTTP server closed');
                
                // Close database connections
                console.log('🔄 Closing database connections...');
                await closeConnection();
                
                console.log('✅ All connections closed');
                console.log('');
                console.log('👋 Goodbye!');
                console.log('');
                process.exit(0);
            });

            // Force close after 10 seconds
            setTimeout(() => {
                console.error('');
                console.error('⚠️  Forcing server shutdown after timeout...');
                console.error('');
                process.exit(1);
            }, 10000);
        };
    
         // Handle shutdown signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            console.error('');
            console.error('❌ Uncaught Exception:', err);
            console.error('');
            shutdown('UNCAUGHT_EXCEPTION');
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('');
            console.error('❌ Unhandled Rejection at:', promise);
            console.error('❌ Reason:', reason);
            console.error('');
            shutdown('UNHANDLED_REJECTION');
        });
        
    } catch (error) {
        console.error('');
        console.error('='.repeat(60));
        console.error('❌ Failed to start server');
        console.error('='.repeat(60));
        console.error('');
        console.error('Error:', error.message);
        console.error('');
        process.exit(1);
    }
};

start_server();