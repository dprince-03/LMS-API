const express = require("express");
const authorRouter = express.Router();

const {
	getAllAuthors,
	getAuthorById,
	updateAuthorById,
	deleteAuthorByIdController,
	createAuthorController,
} = require("../controllers/authors.controllers");

const {
	optionalAuth,
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
} = require("../middlewares/auth.middlewares");

const { validateBody } = require("../middlewares/validate.middlewares");
const { createAuthorSchema, updateAuthorSchema } = require("../validation/schemas");

/**
 * @route   GET /authors
 * @desc    Get all authors with pagination and search
 * @access  Public (with optional auth for enhanced features)
 * @query   page, limit, search, sort_by, order
 */
authorRouter.get("/", optionalAuth, getAllAuthors);

/**
 * @route   GET /authors/:id
 * @desc    Get single author by ID
 * @access  Public
 * @query   include_books (true/false)
 */
authorRouter.get("/:id", optionalAuth, getAuthorById);

/**
 * @route   POST /authors
 * @desc    Create a new author
 * @access  Private (Admin, Librarian)
 */
authorRouter.post(
	"/",
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
	validateBody(createAuthorSchema),
	createAuthorController
);

/**
 * @route   PUT /authors/:id
 * @desc    Update author by ID
 * @access  Private (Admin, Librarian)
 */
authorRouter.put(
	"/:id",
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
	validateBody(updateAuthorSchema),
	updateAuthorById
);

/**
 * @route   DELETE /authors/:id
 * @desc    Delete author by ID
 * @access  Private (Admin, Librarian)
 */
authorRouter.delete(
	"/:id",
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
	deleteAuthorByIdController
);

module.exports = authorRouter;
