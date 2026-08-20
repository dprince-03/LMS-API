const express = require("express");
const bookRouter = express.Router();

const {
	getAllBooks,
	getBooksById,
	createBooks,
	updateBooksById,
	deleteBooksById,
} = require("../controllers/books.controllers");

const {
	optionalAuth,
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
	requireUser,
} = require("../middlewares/auth.middlewares");

const { validateBody } = require("../middlewares/validate.middlewares");
const { createBookSchema, updateBookSchema } = require("../validation/schemas");

const { borrowBook, returnBook } = require("../controllers/bookRecords.controllers");

/**
 * @openapi
 * /books:
 *   get:
 *     tags: [Books]
 *     summary: List books
 *     description: >
 *       Responses are cached for `BOOKS_CACHE_TTL_SECONDS` (default 30s),
 *       keyed by the full query string, and invalidated on any
 *       create/update/delete.
 *     security: []
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: author_id, in: query, schema: { type: integer } }
 *       - { name: genre, in: query, schema: { type: string } }
 *       - { name: status, in: query, schema: { type: string, enum: [Available, Borrowed, Reserved, Lost] } }
 *     responses:
 *       200:
 *         description: Paginated book list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Book' } }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 */
bookRouter.get("/", optionalAuth, getAllBooks);

/**
 * @openapi
 * /books/{id}:
 *   get:
 *     tags: [Books]
 *     summary: Get a single book
 *     security: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *       - { name: include_author, in: query, schema: { type: boolean, default: false } }
 *       - { name: include_borrows, in: query, schema: { type: boolean, default: false } }
 *     responses:
 *       200:
 *         description: The book.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Book' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
bookRouter.get("/:id", optionalAuth, getBooksById);

/**
 * @openapi
 * /books:
 *   post:
 *     tags: [Books]
 *     summary: Create a book
 *     description: Requires the Admin or Librarian role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isbn, title, author_id]
 *             properties:
 *               isbn: { type: string, example: "978-0451524935" }
 *               title: { type: string, example: "1984" }
 *               author_id: { type: integer, example: 1 }
 *               published_date: { type: string, format: date, nullable: true }
 *               description: { type: string, nullable: true }
 *               cover_image: { type: string, nullable: true }
 *               genre: { type: string, nullable: true, example: Dystopian Fiction }
 *               language: { type: string, nullable: true, example: English }
 *               pages: { type: integer, nullable: true, example: 328 }
 *               publisher: { type: string, nullable: true }
 *               available_copies: { type: integer, default: 0 }
 *               total_copies: { type: integer, default: 0 }
 *               status: { type: string, enum: [Available, Borrowed, Reserved, Lost], default: Available }
 *     responses:
 *       201:
 *         description: Book created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Book' }
 *       400:
 *         description: Validation failure, or available_copies exceeds total_copies.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404:
 *         description: author_id does not exist.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: A book with this ISBN already exists.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
bookRouter.post(
	"/",
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
	validateBody(createBookSchema),
	createBooks
);

/**
 * @openapi
 * /books/{id}:
 *   put:
 *     tags: [Books]
 *     summary: Update a book
 *     description: Requires the Admin or Librarian role. Partial update — every field is optional.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isbn: { type: string }
 *               title: { type: string }
 *               author_id: { type: integer }
 *               published_date: { type: string, format: date, nullable: true }
 *               description: { type: string, nullable: true }
 *               cover_image: { type: string, nullable: true }
 *               genre: { type: string, nullable: true }
 *               language: { type: string, nullable: true }
 *               pages: { type: integer, nullable: true }
 *               publisher: { type: string, nullable: true }
 *               available_copies: { type: integer }
 *               total_copies: { type: integer }
 *               status: { type: string, enum: [Available, Borrowed, Reserved, Lost] }
 *     responses:
 *       200:
 *         description: Book updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Book' }
 *       400: { $ref: '#/components/responses/ValidationFailed' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: ISBN already taken by another book.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
bookRouter.put(
	"/:id",
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
	validateBody(updateBookSchema),
	updateBooksById
);

/**
 * @openapi
 * /books/{id}:
 *   delete:
 *     tags: [Books]
 *     summary: Delete a book
 *     description: Requires the Admin or Librarian role. Fails if the book has active borrows.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Book deleted.
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Book has active borrows.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
bookRouter.delete("/:id", verifyToken, requireAuth, requireAdminOrLibrarian, deleteBooksById);

/**
 * @openapi
 * /books/{id}/borrow:
 *   post:
 *     tags: [Books]
 *     summary: Borrow a book
 *     description: >
 *       Requires the book to have available_copies > 0 and status
 *       "Available", the caller to have fewer than 5 active borrows, and no
 *       existing active borrow of the same book by the same caller.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               due_days: { type: integer, default: 14 }
 *     responses:
 *       201:
 *         description: Book borrowed.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Book borrowed successfully
 *               data:
 *                 borrow_record: { id: 10, due_date: "2026-08-31T00:00:00.000Z", status: Borrowed }
 *                 book: { id: 1, title: "1984", available_copies: 4, status: Available }
 *                 due_date: "2026-08-31T00:00:00.000Z"
 *                 days_allowed: 14
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Book unavailable, borrow limit exceeded, or already borrowed by this user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
bookRouter.post("/:id/borrow", verifyToken, requireAuth, requireUser, borrowBook);

/**
 * @openapi
 * /books/{id}/return:
 *   post:
 *     tags: [Books]
 *     summary: Return a borrowed book
 *     description: Applies a $1/day late fee if returned past the due date.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Book returned.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Book returned successfully
 *               data:
 *                 borrow_record: { id: 10, status: Returned }
 *                 book: { id: 1, available_copies: 5, status: Available }
 *                 return_details:
 *                   is_overdue: false
 *                   days_late: 0
 *                   late_fee: 0
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404:
 *         description: Book not found, or no active borrow record for this book/user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
bookRouter.post("/:id/return", verifyToken, requireAuth, requireUser, returnBook);

module.exports = bookRouter;
