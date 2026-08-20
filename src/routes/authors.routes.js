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
 * @openapi
 * /authors:
 *   get:
 *     tags: [Authors]
 *     summary: List authors
 *     description: >
 *       Responses are cached for `AUTHORS_CACHE_TTL_SECONDS` (default 30s),
 *       keyed by the full query string, and invalidated on any
 *       create/update/delete.
 *     security: []
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *       - { name: search, in: query, schema: { type: string }, description: "Matches first_name, last_name, or email." }
 *       - { name: sort_by, in: query, schema: { type: string, default: created_at } }
 *       - { name: order, in: query, schema: { type: string, enum: [asc, desc], default: desc } }
 *     responses:
 *       200:
 *         description: Paginated author list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Author' } }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 */
authorRouter.get("/", optionalAuth, getAllAuthors);

/**
 * @openapi
 * /authors/{id}:
 *   get:
 *     tags: [Authors]
 *     summary: Get a single author
 *     security: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *       - { name: include_books, in: query, schema: { type: boolean, default: false }, description: Embed the author's books and a books_count. }
 *     responses:
 *       200:
 *         description: The author.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Author' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
authorRouter.get("/:id", optionalAuth, getAuthorById);

/**
 * @openapi
 * /authors:
 *   post:
 *     tags: [Authors]
 *     summary: Create an author
 *     description: Requires the Admin or Librarian role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, email]
 *             properties:
 *               first_name: { type: string, example: George }
 *               last_name: { type: string, example: Orwell }
 *               email: { type: string, format: email, example: orwell@example.com }
 *               date_of_birth: { type: string, format: date, nullable: true }
 *               biography: { type: string, nullable: true }
 *               phone: { type: string, nullable: true }
 *               image: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Author created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Author' }
 *       400: { $ref: '#/components/responses/ValidationFailed' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: An author with this email already exists.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
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
 * @openapi
 * /authors/{id}:
 *   put:
 *     tags: [Authors]
 *     summary: Update an author
 *     description: Requires the Admin or Librarian role. Partial update — every field is optional.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               email: { type: string, format: email }
 *               date_of_birth: { type: string, format: date, nullable: true }
 *               biography: { type: string, nullable: true }
 *               phone: { type: string, nullable: true }
 *               image: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Author updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/Author' }
 *       400: { $ref: '#/components/responses/ValidationFailed' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Another author already has this email.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
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
 * @openapi
 * /authors/{id}:
 *   delete:
 *     tags: [Authors]
 *     summary: Delete an author
 *     description: Requires the Admin or Librarian role. Fails if the author still has books attached.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Author deleted.
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Author has books attached — remove or reassign them first.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authorRouter.delete(
	"/:id",
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
	deleteAuthorByIdController
);

module.exports = authorRouter;
