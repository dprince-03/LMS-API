const express = require('express');
const authorRouter = express.Router();

const { 
    getAllAuthors, 
    getAuthorById,
    updateAuthorById,
    deleteAuthorByIdController,
    createAuthorController
} = require('../controllers/authors.controllers');

const { 
    optionalAuth, 
    verifyToken,
    requireAuth,
    requireAdminOrLibrarian
} = require('../middlewares/auth.middlewares');


/**
 * @route   GET /authors
 * @desc    Get all authors with pagination and search
 * @access  Public (with optional auth for enhanced features)
 * @query   page, limit, search
*/
authorRouter.get('/', optionalAuth, getAllAuthors);

/**
 * @route   GET /authors/:id
 * @desc    Get single author by ID
 * @access  Public
 * @query   include_books (true/false)
*/
authorRouter.get('/:id', optionalAuth, getAuthorById);

/**
 * @route   POST /authors
 * @desc    Create a new author
 * @access  Private (Admin, Librarian)
*/
authorRouter.post('/', verifyToken, requireAuth, requireAdminOrLibrarian, createAuthorController);

/**
 * @route   PUT /authors/:id
 * @desc    Update author by ID
 * @access  Private (Admin, Librarian)
*/
authorRouter.put('/:id', verifyToken, requireAuth, requireAdminOrLibrarian, updateAuthorById);

/**
 * @route   DELETE /authors/:id
 * @desc    Delete author by ID
 * @access  Private (Admin, Librarian)
*/
authorRouter.delete('/:id', verifyToken, requireAuth, requireAdminOrLibrarian, deleteAuthorByIdController);

module.exports = authorRouter;