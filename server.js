require('dotenv').config();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const ip = require('ip');
const morgan = require('morgan');
const rateLimit = require("express-rate-limit");

const authRouter = require('./src/routes/auth.routes');
const bookRouter = require('./src/routes/books.routes');
const userRouter = require('./src/routes/user.routes');
const authorRouter = require('./src/routes/authors.routes');

const app = express();

const PORT = process.env.PORT || 5080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5000', 
    credentials: true, // Allow cookies to be sent
}));

const limiter = rateLimit({
    windowMs: 15 + 60 * 1000, // 15 minutes
    max: 100,
    message: "Too many requests from this IP, please try again after 15 minutes",
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', limiter);
app.use('/api', authRouter);
app.use('/api', userRouter);
app.use('/api', authorRouter);
app.use('/api', bookRouter);

app.listen(PORT, () => {
    console.log(`\n## Server is starting... ##`);
    console.log(`Server is running on: http://localhost:${PORT} with IP: ${ip.address()}`);
    console.log(`- Authentication routes:
        url: http://localhost:${PORT}/api/auth/sign-up
        url: http://localhost:${PORT}/api/auth/sign-in
        url: http://localhost:${PORT}/api/auth/sign-out
        url: http://localhost:${PORT}/api/auth/sign-up/google
        url: http://localhost:${PORT}/api/auth/sign-in/google
    `);
    console.log(`- if you used nodemon (npm run watch), the server will restart automatically on code changes \n- you don't need to stop and start the server manually \n- just save the file and nodemon will restart the server for you \n- or you can type 'rs' and press enter to restart the server manually
    `);
    console.log(`## press Ctrl+C to stop the server ##`);
});