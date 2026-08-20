const express = require("express");
const userRouter = express.Router();

const {
	getPublicUsers,
	getUserProfile,
	getAllUsers,
	getUserById,
	createUser,
	updateUser,
	deleteUser,
} = require("../controllers/users.controllers");

const {
	verifyToken,
	requireAuth,
	requireAdmin,
	requireOwnershipOrAdmin,
	auditLogger,
} = require("../middlewares/auth.middlewares");

const { validateBody } = require("../middlewares/validate.middlewares");
const { createUserSchema, updateUserSchema } = require("../validation/schemas");

const { getUserBorrowRecord } = require("../controllers/bookRecords.controllers");

/**
 * @openapi
 * /users/public:
 *   get:
 *     tags: [Users]
 *     summary: List users (public, limited fields)
 *     security: []
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 20 } }
 *       - { name: role, in: query, schema: { type: string, enum: [Admin, Librarian, User] } }
 *       - { name: is_active, in: query, schema: { type: boolean, default: true } }
 *     responses:
 *       200:
 *         description: Paginated public user list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/UserPublic' } }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 */
userRouter.get("/public", getPublicUsers);

/**
 * @openapi
 * /users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get the current user's full profile, with borrowing statistics
 *     responses:
 *       200:
 *         description: Current user's profile.
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
userRouter.get("/profile", verifyToken, requireAuth, getUserProfile);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     description: Requires the Admin role.
 *     parameters:
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *       - { name: search, in: query, schema: { type: string } }
 *       - { name: role, in: query, schema: { type: string, enum: [Admin, Librarian, User] } }
 *       - { name: is_active, in: query, schema: { type: boolean } }
 *     responses:
 *       200:
 *         description: Paginated user list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/User' } }
 *                 pagination: { $ref: '#/components/schemas/Pagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
userRouter.get("/", verifyToken, requireAuth, requireAdmin, getAllUsers);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a single user
 *     description: Requires the Admin/Librarian role, or that the caller is requesting their own profile.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *       - { name: include_borrows, in: query, schema: { type: boolean, default: false } }
 *       - { name: include_stats, in: query, schema: { type: boolean, default: false } }
 *     responses:
 *       200:
 *         description: The user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
userRouter.get("/:id", verifyToken, requireAuth, requireOwnershipOrAdmin(), getUserById);

/**
 * @openapi
 * /users/{id}/borrow-records:
 *   get:
 *     tags: [Users]
 *     summary: Get a user's borrow records
 *     description: Requires the Admin/Librarian role, or that the caller owns the records.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 10 } }
 *       - { name: status, in: query, schema: { type: string, enum: [Borrowed, Returned, Overdue] } }
 *     responses:
 *       200:
 *         description: Paginated borrow records for this user.
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
 *       404: { $ref: '#/components/responses/NotFound' }
 */
userRouter.get("/:id/borrow-records", verifyToken, requireAuth, getUserBorrowRecord);

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create a user
 *     description: Requires the Admin role. Can create any role, unlike self-registration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, user_name, email, password]
 *             properties:
 *               first_name: { type: string, example: Jane }
 *               last_name: { type: string, example: Smith }
 *               user_name: { type: string, minLength: 3, example: janesmith }
 *               email: { type: string, format: email }
 *               phone: { type: string, nullable: true }
 *               password: { type: string, example: Password123 }
 *               image_url: { type: string, nullable: true }
 *               role: { type: string, enum: [Admin, Librarian, User], default: User }
 *               is_active: { type: boolean, default: true }
 *               email_verified: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: User created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationFailed' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: Email or username already taken.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
userRouter.post(
	"/",
	verifyToken,
	requireAuth,
	requireAdmin,
	validateBody(createUserSchema),
	auditLogger("user.create"),
	createUser
);

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user
 *     description: >
 *       Requires the resource owner, a Librarian, or an Admin. Which fields
 *       a given caller may actually set is enforced server-side and depends
 *       on who's calling — see the field-restriction table in
 *       `docs/API.md`. Attempting to set `role` without the Admin role
 *       returns 403; every other disallowed field is silently dropped
 *       rather than rejected.
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
 *               phone: { type: string, nullable: true }
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               image_url: { type: string, nullable: true }
 *               role: { type: string, enum: [Admin, Librarian, User], description: Admin-only. }
 *               is_active: { type: boolean, description: Admin-only. }
 *               email_verified: { type: boolean, description: Admin-only. }
 *     responses:
 *       200:
 *         description: User updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400: { $ref: '#/components/responses/ValidationFailed' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not the resource owner/Librarian/Admin, or attempted to set `role` without Admin.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Email already taken by another user.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
userRouter.put(
	"/:id",
	verifyToken,
	requireAuth,
	requireOwnershipOrAdmin(),
	validateBody(updateUserSchema),
	auditLogger("user.update"),
	updateUser
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user (soft delete)
 *     description: >
 *       Requires the Admin role. Fails if the user has active borrows, or is
 *       the last active Admin.
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: User deleted.
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: User has active borrows, or is the last active Admin.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
userRouter.delete(
	"/:id",
	verifyToken,
	requireAuth,
	requireAdmin,
	auditLogger("user.delete"),
	deleteUser
);

module.exports = userRouter;
