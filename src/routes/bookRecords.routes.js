const express = require("express");
const brRouter = express.Router();

const {
	verifyToken,
	requireAuth,
	requireAdminOrLibrarian,
} = require("../middlewares/auth.middlewares");

const {
	getBorrowingStats,
	getOverdueRecords,
	getAllBorrowRecord,
	extendDueDate,
} = require("../controllers/bookRecords.controllers");

/**
 * @openapi
 * /borrow-records/statistics:
 *   get:
 *     tags: [Borrow Records]
 *     summary: Get borrowing statistics
 *     description: Requires the Admin or Librarian role.
 *     responses:
 *       200:
 *         description: Aggregate borrowing statistics.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Borrowing statistics retrieved successfully
 *               data:
 *                 total_borrows: 120
 *                 active_borrows: 34
 *                 returned_borrows: 80
 *                 overdue_borrows: 6
 *                 avg_borrow_days: 12.4
 *                 generated_at: "2026-08-19T12:00:00.000Z"
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
brRouter.get("/statistics", verifyToken, requireAuth, requireAdminOrLibrarian, getBorrowingStats);

/**
 * @openapi
 * /borrow-records/overdue:
 *   get:
 *     tags: [Borrow Records]
 *     summary: List overdue borrow records
 *     description: Requires the Admin or Librarian role.
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Paginated overdue borrow records.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/BorrowRecord' } }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
brRouter.get("/overdue", verifyToken, requireAuth, requireAdminOrLibrarian, getOverdueRecords);

/**
 * @openapi
 * /borrow-records:
 *   get:
 *     tags: [Borrow Records]
 *     summary: List all borrow records
 *     description: Requires the Admin or Librarian role.
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *       - { name: user_id, in: query, schema: { type: integer } }
 *       - { name: book_id, in: query, schema: { type: integer } }
 *       - { name: status, in: query, schema: { type: string, enum: [Borrowed, Returned, Overdue] } }
 *       - { name: overdue_only, in: query, schema: { type: boolean, default: false } }
 *     responses:
 *       200:
 *         description: Paginated borrow records.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/BorrowRecord' } }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
brRouter.get("/", verifyToken, requireAuth, requireAdminOrLibrarian, getAllBorrowRecord);

/**
 * @openapi
 * /borrow-records/{id}/extend:
 *   post:
 *     tags: [Borrow Records]
 *     summary: Extend a borrow record's due date
 *     description: Requires the record's owner, a Librarian, or an Admin.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               extension_days: { type: integer, default: 7 }
 *     responses:
 *       200:
 *         description: Due date extended.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/BorrowRecord' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Record is not currently active (already returned).
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
brRouter.post("/:id/extend", verifyToken, requireAuth, extendDueDate);

module.exports = brRouter;
