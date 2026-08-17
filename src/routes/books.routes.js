const express = require('express');
const bookRouter = express.Router();

const { 
    getAllBooks, 
    getBooksById,
    createBooks,
    updateBooksById,
    deleteBooksById,
} = require('../controllers/books.controllers');

const { 
    optionalAuth, 
    verifyToken,
    requireAuth,
    requireAdminOrLibrarian,
    requireUser,
} = require('../middlewares/auth.middlewares');

const { 
    borrowBook, 
    returnBook, 
} = require('../controllers/bookRecords.controllers');


/**
 * @route   GET /books
 * @desc    Get all books with pagination, search, and filters
 * @access  Public
 * @query   page, limit, search, author_id, genre, status
*/
bookRouter.get('/', optionalAuth, getAllBooks);

/**
 * @route   GET /books/:id
 * @desc    Get single book by ID
 * @access  Public
 * @query   include_author (true/false), include_borrows (true/false)
*/
bookRouter.get('/:id', optionalAuth, getBooksById);

/**
 * @route   POST /books
 * @desc    Create a new book
 * @access  Private (Admin, Librarian)
*/
bookRouter.post('/', verifyToken, requireAuth, requireAdminOrLibrarian, createBooks);

/**
 * @route   PUT /books/:id
 * @desc    Update book by ID
 * @access  Private (Admin, Librarian)
*/
bookRouter.put('/:id', verifyToken, requireAuth, requireAdminOrLibrarian, updateBooksById);

/**
 * @route   DELETE /books/:id
 * @desc    Delete book by ID
 * @access  Private (Admin, Librarian)
*/
bookRouter.delete('/:id', verifyToken, requireAuth, requireAdminOrLibrarian, deleteBooksById);

/**
 * @route   POST /books/:id/borrow
 * @desc    Borrow a book
 * @access  Private (All authenticated users)
 * @body    due_days (optional, default: 14)
*/
bookRouter.post('/:id/borrow', verifyToken, requireAuth, requireUser, borrowBook);

/**
* @route   POST /books/:id/return
* @desc    Return a borrowed book
* @access  Private (All authenticated users)
*/
bookRouter.post('/:id/return', verifyToken, requireAuth, requireUser, returnBook);

module.exports = bookRouter;