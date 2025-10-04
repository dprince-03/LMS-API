const express = require('express');
const authRouter = express.Router();

const { 
    logout, 
    register, 
    login, 
    getMe,
    refreshToken,
    changePassword
} = require('../controllers/auth.controllers');

const { 
    verifyToken, 
    requireAuth
} = require('../middlewares/auth.middlewares');


/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
authRouter.post('/register', register);

/**
 * @route POST/auth/login
 * @desc Login user and got JWT token
 * @access Public
 */
authRouter.post('/login', login);

/**
 * @route   POST /auth/logout
 * @desc    Logout user (invalidate token on client side)
 * @access  Private
 */
authRouter.post('/logout', verifyToken, logout);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
authRouter.get('/me', verifyToken, requireAuth, getMe);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh JWT token
 * @access  Private
 */
authRouter.post('/refresh', verifyToken, requireAuth, refreshToken);

/**
 * @route   POST /auth/change-password
 * @desc    Change user password
 * @access  Private
 */
authRouter.post('/change-password', verifyToken, requireAuth, changePassword);

module.exports = authRouter;