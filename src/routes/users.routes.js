const express = require('express');
const userRouter = express.Router();

const { 
    getPublicUsers, 
    getUserProfile,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
} = require('../controllers/users.controllers');

const { 
    verifyToken, 
    requireAuth,
    requireAdmin,
    requireAdminOrLibrarian,
    requireOwnershipOrAdmin
} = require('../middlewares/auth.middlewares');

const { 
    getUserBorrowRecord 
} = require('../controllers/bookRecords.controllers');


/**
 * @route   GET /users/public
 * @desc    Get public users list (limited data)
 * @access  Public
 * @query   page, limit, role, is_active
*/
userRouter.get('/public', getPublicUsers);

/**
 * @route   GET /users/profile
 * @desc    Get current user's profile
 * @access  Private
*/
userRouter.get('/profile', verifyToken, requireAuth, getUserProfile);

/**
 * @route   GET /users
 * @desc    Get all users with filters and pagination
 * @access  Private (Admin only)
 * @query   page, limit, search, role, is_active
*/
userRouter.get('/', verifyToken, requireAuth, requireAdmin, getAllUsers);

/**
 * @route   GET /users/:id
 * @desc    Get single user by ID
 * @access  Private (Admin, Librarian, or own profile)
 * @query   include_borrows, include_stats
*/
userRouter.get('/:id', verifyToken, requireAdmin, requireAdminOrLibrarian, getUserById);

/**
 * @route   GET /users/:id/borrow-records
 * @desc    Get user's borrow records
 * @access  Private (Admin, Librarian, or own records)
 * @query   page, limit, status
*/
userRouter.get('/:id/borrow-records', verifyToken, requireAuth, getUserBorrowRecord);

/**
 * @route   POST /users
 * @desc    Create a new user
 * @access  Private (Admin only)
*/
userRouter.post('/', verifyToken, requireAuth, requireAdmin, createUser);

/**
 * @route   PUT /users/:id
 * @desc    Update user by ID
 * @access  Private (Admin, or own profile)
*/
userRouter.put('/:id', verifyToken, requireAuth, requireOwnershipOrAdmin(), updateUser);

/**
 * @route   DELETE /users/:id
 * @desc    Delete user by ID (soft delete)
 * @access  Private (Admin only)
*/
userRouter.delete('/:id', verifyToken, requireAuth, requireAdmin, deleteUser);

module.exports = userRouter;