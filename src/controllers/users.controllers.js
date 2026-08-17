const {
	findUserByEmail,
	findUserByUsername,
	createUser,
	findAllUsers,
	countUsers,
	findUserById,
	findUserByIdSafe,
	updateUserById,
	deleteUserById,
	getUserBorrowRecords,
	getUserActiveBorrowedCount,
	getUserOverdueBooks,
	canUserBorrowMore,
	formatUser,
	formatUserPublic,
	SELF_EDITABLE_FIELDS,
	LIBRARIAN_EDITABLE_FIELDS,
	ADMIN_EDITABLE_FIELDS,
} = require("../models/users.model");
const logger = require("../utils/logger");

const createUserController = async (req, res) => {
	try {
		const {
			first_name,
			last_name,
			user_name,
			phone,
			email,
			password,
			image_url,
			role,
			is_active,
			email_verified,
		} = req.body;

		const existingEmail = await findUserByEmail(email);
		if (existingEmail) {
			return res.status(409).json({
				success: false,
				message: "User with this email already exists",
			});
		}

		const existingUsername = await findUserByUsername(user_name);
		if (existingUsername) {
			return res.status(409).json({
				success: false,
				message: "Username is already taken",
			});
		}

		const newUser = await createUser({
			first_name,
			last_name,
			user_name,
			phone,
			email,
			password,
			image_url,
			role: role || "User",
			is_active: is_active !== undefined ? is_active : true,
			email_verified: email_verified || false,
		});

		res.status(201).json({
			success: true,
			message: "User created successfully",
			data: formatUser(newUser),
		});
	} catch (error) {
		logger.error({ err: error }, "Error creating user");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

const getAllUsersController = async (req, res) => {
	try {
		const { page = 1, limit = 10, search = "", role, is_active } = req.query;

		const offset = (parseInt(page) - 1) * parseInt(limit);

		const options = { limit: parseInt(limit), offset, search };
		if (role) options.role = role;
		if (is_active !== undefined) options.is_active = is_active === "true";

		const filters = { search };
		if (role) filters.role = role;
		if (is_active !== undefined) filters.is_active = is_active === "true";

		const users = await findAllUsers(options);
		const totalUser = await countUsers(filters);
		const totalPages = Math.ceil(totalUser / parseInt(limit));

		res.status(200).json({
			success: true,
			message: "Users retrieved successfully",
			data: users,
			pagination: {
				current_page: parseInt(page),
				total_pages: totalPages,
				total_items: totalUser,
				items_per_page: parseInt(limit),
				has_next: parseInt(page) < totalPages,
				has_prev: parseInt(page) > 1,
			},
			filters: {
				search: search || null,
				role: role || null,
				is_active: is_active !== undefined ? is_active === "true" : null,
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Error fetching users");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

const getUserByIdController = async (req, res) => {
	try {
		const { id } = req.params;

		if (!id || isNaN(id)) {
			return res.status(400).json({ success: false, message: "Valid user ID is required" });
		}

		const user = await findUserByIdSafe(parseInt(id));
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const includeBorrows = req.query.include_borrows === "true";
		const includeStats = req.query.include_stats === "true";

		let userData = user;

		if (includeBorrows) {
			const borrowRecords = await getUserBorrowRecords(user.id, { limit: 10 });
			userData = { ...userData, recent_borrows: borrowRecords };
		}

		if (includeStats) {
			const activeBorrows = await getUserActiveBorrowedCount(user.id);
			const overdueBooks = await getUserOverdueBooks(user.id);
			const canBorrow = await canUserBorrowMore(user.id);

			userData = {
				...userData,
				statistics: {
					active_borrows: activeBorrows,
					overdue_books: overdueBooks.length,
					can_borrow_more: canBorrow,
					overdue_details: overdueBooks,
				},
			};
		}

		res.status(200).json({
			success: true,
			message: "User retrieved successfully",
			data: userData,
		});
	} catch (error) {
		logger.error({ err: error }, "Error fetching user");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

const updateUserController = async (req, res) => {
	try {
		const { id } = req.params;
		const updateData = req.body;
		const targetId = parseInt(id);

		if (!id || isNaN(id)) {
			return res.status(400).json({ success: false, message: "Valid user ID is required" });
		}

		const existingUser = await findUserById(targetId);
		if (!existingUser) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		if (updateData.email && updateData.email !== existingUser.email) {
			const emailExist = await findUserByEmail(updateData.email);
			if (emailExist) {
				return res
					.status(409)
					.json({ success: false, message: "Email is already taken by another user" });
			}
		}

		// Determine what this actor is allowed to change. This is the only
		// source of truth for updatable fields — it's also passed straight
		// through to the model as the SQL column allowlist, so an attacker
		// can't smuggle in `role`/`is_active` (or an arbitrary column name)
		// via the request body.
		let allowedFields;
		if (req.user.role === "Admin") {
			allowedFields = ADMIN_EDITABLE_FIELDS;
		} else if (req.user.role === "Librarian" && req.user.id !== targetId) {
			allowedFields = LIBRARIAN_EDITABLE_FIELDS;
		} else {
			allowedFields = SELF_EDITABLE_FIELDS;
		}

		if (updateData.role && !allowedFields.includes("role")) {
			return res
				.status(403)
				.json({ success: false, message: "You are not allowed to change the role field" });
		}

		const filteredData = {};
		for (const key of allowedFields) {
			if (
				Object.prototype.hasOwnProperty.call(updateData, key) &&
				updateData[key] !== undefined &&
				updateData[key] !== null
			) {
				filteredData[key] = updateData[key];
			}
		}

		if (Object.keys(filteredData).length === 0) {
			return res.status(400).json({ success: false, message: "No valid fields to update" });
		}

		const updatedUser = await updateUserById(targetId, filteredData, allowedFields);

		res.status(200).json({
			success: true,
			message: "User updated successfully",
			data: formatUser(updatedUser),
		});
	} catch (error) {
		logger.error({ err: error }, "Error updating user");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

const deleteUserController = async (req, res) => {
	try {
		const { id } = req.params;

		if (!id || isNaN(id)) {
			return res.status(400).json({ success: false, message: "Valid user ID is required" });
		}

		const existingUser = await findUserById(parseInt(id));
		if (!existingUser) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const activeBorrows = await getUserActiveBorrowedCount(parseInt(id));
		if (activeBorrows > 0) {
			return res.status(409).json({
				success: false,
				message: `Cannot delete user. User has ${activeBorrows} active borrow(s)`,
				active_borrows: activeBorrows,
			});
		}

		if (existingUser.role === "Admin") {
			const adminUsers = await findAllUsers({ role: "Admin", limit: 100 });
			const activeAdmins = adminUsers.filter(
				(user) => user.is_active && user.id !== parseInt(id)
			);

			if (activeAdmins.length === 0) {
				return res
					.status(409)
					.json({ success: false, message: "Cannot delete the last active admin user" });
			}
		}

		const deleted = await deleteUserById(parseInt(id));
		if (!deleted) {
			return res
				.status(404)
				.json({ success: false, message: "User not found or already deleted" });
		}

		res.status(200).json({ success: true, message: "User deleted successfully" });
	} catch (error) {
		logger.error({ err: error }, "Error deleting user");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// Get user profile (for current logged-in user) - GET /users/profile
const getUserProfileController = async (req, res) => {
	try {
		const userId = req.user?.id;

		if (!userId) {
			return res.status(401).json({ success: false, message: "Authentication required" });
		}

		const user = await findUserByIdSafe(userId);
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		const activeBorrows = await getUserActiveBorrowedCount(userId);
		const overdueBooks = await getUserOverdueBooks(userId);
		const recentBorrows = await getUserBorrowRecords(userId, { limit: 5 });

		const userProfile = {
			...user,
			statistics: {
				active_borrows: activeBorrows,
				overdue_books: overdueBooks.length,
				can_borrow_more: await canUserBorrowMore(userId),
			},
			recent_activity: recentBorrows,
		};

		res.status(200).json({
			success: true,
			message: "User profile retrieved successfully",
			data: userProfile,
		});
	} catch (error) {
		logger.error({ err: error }, "Error fetching user profile");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// Get users list for public view (limited data) - GET /users/public
const getPublicUsersController = async (req, res) => {
	try {
		const { page = 1, limit = 20, role, is_active = "true" } = req.query;

		const offset = (parseInt(page) - 1) * parseInt(limit);

		const options = { limit: parseInt(limit), offset, is_active: is_active === "true" };
		if (role) options.role = role;

		const users = await findAllUsers(options);
		const publicUsers = users.map(formatUserPublic);

		const filters = { is_active: is_active === "true" };
		if (role) filters.role = role;

		const totalUsers = await countUsers(filters);
		const totalPages = Math.ceil(totalUsers / parseInt(limit));

		res.status(200).json({
			success: true,
			message: "Public users list retrieved successfully",
			data: publicUsers,
			pagination: {
				current_page: parseInt(page),
				total_pages: totalPages,
				total_items: totalUsers,
				items_per_page: parseInt(limit),
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Error fetching public users");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

module.exports = {
	createUser: createUserController,
	getAllUsers: getAllUsersController,
	getUserById: getUserByIdController,
	updateUser: updateUserController,
	deleteUser: deleteUserController,
	getUserProfile: getUserProfileController,
	getPublicUsers: getPublicUsersController,
};
