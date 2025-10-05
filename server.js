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
const { testConnection, closeConnection } = require('./src/config/database.config');
const { initializeAuth } = require('./src/config/auth.config');


const app = express();
const PORT = process.env.PORT || 5080;

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

// ========================
//      MIDDLEWARES
// ========================

app.use(cors(corsOption));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// ========================
//      ROUTES
// ========================
app.use('/api', limiter,);
app.use('/api/auth', limiter, authRouter);
app.use('/api/authors', limiter, authorRouter);
app.use('/api/books', limiter, bookRouter);
app.use('/api/users', limiter, userRouter);
app.use('/api/borrow-records', limiter, brRouter);

// ==========================
//      SERVER SETUP
// ==========================

const start_server = async () => {
    try {
        console.log("🚀 Starting Library Management System API...");
    
        const dbConnect = await testConnection();
        if (!dbConnect) {
            console.error("❌ Failed to connect to database");
            console.error("Please check your database configuration in .env file");
            process.exit(1);
        }
    
        initializeAuth();
    
        const server = app.listen(PORT, () => {
            console.log("");
            console.log("=".repeat(50));
            console.log(`✅ Server is running on port ${PORT}`);
            console.log(`✅ API URL: http://localhost:${PORT}/api`);
            // console.log(`✅ Health Check: http://localhost:${PORT}/api/health`);
            console.log("=".repeat(50));
            console.log("");
            console.log("Available Routes:");
            console.log(`  - POST   /api/auth/register`);
            console.log(`  - POST   /api/auth/login`);
            console.log(`  - GET    /api/auth/me`);
            console.log(`  - GET    /api/authors`);
            console.log(`  - GET    /api/books`);
            console.log(`  - POST   /api/books/:id/borrow`);
            console.log(`  - POST   /api/books/:id/return`);
            console.log(`  - GET    /api/users`);
            console.log(`  - GET    /api/borrow-records`);
            console.log("");
            console.log("Press CTRL+C to stop the server");
            console.log("");
        });
    
        const shutdown = async (signal) => {
            console.log(`\n${signal} received. Closing server gracefully...`);
    
            server.close(async () => {
                console.log("Server closed");
    
                // Close database connections
                await closeConnection();
    
                console.log("Goodbye! 👋");
                process.exit(0);
            });
            // Force close after 10 seconds
            setTimeout(() => {
                console.error("Forcing server shutdown...");
                process.exit(1);
            }, 10000);
        };
    
        // Handle shutdown signals
        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));
    
        // Handle uncaught exceptions
        process.on("uncaughtException", (err) => {
            console.error("Uncaught Exception:", err);
            shutdown("UNCAUGHT_EXCEPTION");
        });
    
        // Handle unhandled promise rejections
        process.on("unhandledRejection", (reason, promise) => {
            console.error("Unhandled Rejection at:", promise, "reason:", reason);
            shutdown("UNHANDLED_REJECTION");
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

start_server();