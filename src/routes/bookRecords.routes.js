const express = require('express');
const brRouter = express.Router();

const { 
    verifyToken, 
    requireAuth, 
    requireAdminOrLibrarian 
} = require('../middlewares/auth.middlewares');

const { 
    getBorrowingStats, 
    getOverdueRecords,
    getAllBorrowRecord,
    extendDueDate
} = require('../controllers/bookRecords.controllers');


/**
 * @route   GET /borrow-records/statistics
 * @desc    Get borrowing statistics
 * @access  Private (Admin, Librarian)
*/
brRouter.get('/statistics', verifyToken, requireAuth, requireAdminOrLibrarian, getBorrowingStats);

/**
 * @route   GET /borrow-records/overdue
 * @desc    Get all overdue borrow records
 * @access  Private (Admin, Librarian)
 * @query   page, limit
*/
brRouter.get('/overdue', verifyToken, requireAuth, requireAdminOrLibrarian, getOverdueRecords);

/**
 * @route   GET /borrow-records
 * @desc    Get all borrow records with filters
 * @access  Private (Admin, Librarian)
 * @query   page, limit, user_id, book_id, status, overdue_only
*/
brRouter.get('/', verifyToken, requireAuth, requireAdminOrLibrarian, getAllBorrowRecord);

/**
 * @route   POST /borrow-records/:id/extend
 * @desc    Extend due date for a borrow record
 * @access  Private (User for own records, Admin/Librarian for all)
 * @body    extension_days (optional, default: 7)
*/
brRouter.post('/:id/extend', verifyToken, requireAuth, extendDueDate);

module.exports = brRouter;