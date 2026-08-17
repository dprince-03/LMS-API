const { query } = require("../config/database.config");
const { passwordConfig } = require("../config/auth.config");
const { buildLikeParam } = require("../utils/sanitize");
const bcrypt = require("bcrypt");

// Fields a user may set on their own profile.
const SELF_EDITABLE_FIELDS = ["first_name", "last_name", "phone", "email", "image_url", "password"];
// Fields a Librarian may set on another user's profile — basic contact
// info only; email/password/role/status stay Admin-or-self.
const LIBRARIAN_EDITABLE_FIELDS = ["first_name", "last_name", "phone", "image_url"];
// Fields an Admin may set on any user's profile.
const ADMIN_EDITABLE_FIELDS = [...SELF_EDITABLE_FIELDS, "role", "is_active", "email_verified"];

// Hash password
const hashPassword = async (password) => {
	try {
		return await bcrypt.hash(password, passwordConfig.saltRounds);
	} catch (error) {
		throw new Error(`Error hashing password: ${error.message}`);
	}
};

// Verify password
const verifyPassword = async (plainPassword, hashedPassword) => {
	if (!plainPassword || !hashedPassword) {
		throw new Error("Both plainPassword and hashedPassword arguments are required");
	}

	try {
		return await bcrypt.compare(plainPassword, hashedPassword);
	} catch (error) {
		throw new Error(`Error verifying password: ${error.message}`);
	}
};

// Create a new user
const createUser = async (userData) => {
	try {
		// Hash password before storing
		const hashedPassword = await hashPassword(userData.password);

		const sql = `
            INSERT INTO users (first_name, last_name, user_name, phone, email, password,
                             image_url, role, is_active, email_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
		const params = [
			userData.first_name,
			userData.last_name || null,
			userData.user_name,
			userData.phone || null,
			userData.email,
			hashedPassword,
			userData.image_url || null,
			userData.role || "User",
			userData.is_active !== undefined ? userData.is_active : true,
			userData.email_verified || false,
		];

		const result = await query(sql, params);
		return await findUserById(result.insertId);
	} catch (error) {
		if (error.code === "ER_DUP_ENTRY") {
			throw new Error("User with this email or username already exists");
		}
		throw new Error(`Error creating user: ${error.message}`);
	}
};

// Find all users with pagination
const findAllUsers = async (options = {}) => {
	try {
		const { limit = 10, offset = 0, search = "", role = null, is_active = null } = options;

		let sql = "SELECT * FROM users WHERE deleted_at IS NULL";
		let params = [];

		// Search conditions
		if (search) {
			sql +=
				" AND (first_name LIKE ? OR last_name LIKE ? OR user_name LIKE ? OR email LIKE ?)";
			const like = buildLikeParam(search);
			params.push(like, like, like, like);
		}

		if (role) {
			sql += " AND role = ?";
			params.push(role);
		}

		if (is_active !== null) {
			sql += " AND is_active = ?";
			params.push(is_active);
		}

		sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
		params.push(limit, offset);

		const rows = await query(sql, params);
		return rows.map(formatUser);
	} catch (error) {
		throw new Error(`Error fetching users: ${error.message}`);
	}
};

// Find user by ID — returns the auth-shaped object (includes password hash).
// Only use this for internal auth flows (login, verifyToken). Anything that
// might end up in an API response must call findUserByIdSafe instead.
const findUserById = async (id) => {
	try {
		const sql = "SELECT * FROM users WHERE id = ? AND deleted_at IS NULL";
		const rows = await query(sql, [id]);

		if (rows.length === 0) {
			return null;
		}

		return formatUserForAuth(rows[0]);
	} catch (error) {
		throw new Error(`Error finding user: ${error.message}`);
	}
};

// Find user by ID — password-free, safe to return directly in an API response.
const findUserByIdSafe = async (id) => {
	const user = await findUserById(id);
	return formatUser(user);
};

// Find user by email
const findUserByEmail = async (email) => {
	try {
		const sql = "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL";
		const rows = await query(sql, [email]);

		return rows.length > 0 ? formatUserForAuth(rows[0]) : null; // for auth
	} catch (error) {
		throw new Error(`Error finding user by email: ${error.message}`);
	}
};

// Find user by username
const findUserByUsername = async (username) => {
	try {
		const sql = "SELECT * FROM users WHERE user_name = ? AND deleted_at IS NULL";
		const rows = await query(sql, [username]);

		return rows.length > 0 ? formatUserForAuth(rows[0]) : null; // For auth
	} catch (error) {
		throw new Error(`Error finding user by username: ${error.message}`);
	}
};

// Find user by email or username (for login)
const findUserByEmailOrUsername = async (emailOrUsername) => {
	try {
		const sql = "SELECT * FROM users WHERE (email = ? OR user_name = ?) AND deleted_at IS NULL";
		const rows = await query(sql, [emailOrUsername, emailOrUsername]);

		return rows.length > 0 ? formatUserForAuth(rows[0]) : null; // For auth
	} catch (error) {
		throw new Error(`Error finding user by email or username: ${error.message}`);
	}
};

// Update user. `allowedFields` must be one of SELF_EDITABLE_FIELDS /
// ADMIN_EDITABLE_FIELDS (or a subset) — the caller decides which, based on
// who's making the request. Only literal, allowlisted column names are ever
// interpolated into the SQL; unknown keys in `updateData` are silently
// dropped rather than trusted.
const updateUserById = async (id, updateData, allowedFields = SELF_EDITABLE_FIELDS) => {
	try {
		const fields = [];
		const params = [];

		for (const key of allowedFields) {
			if (key === "password") continue; // handled separately below
			if (
				Object.prototype.hasOwnProperty.call(updateData, key) &&
				updateData[key] !== undefined
			) {
				fields.push(`${key} = ?`);
				params.push(updateData[key]);
			}
		}

		// Handle password separately (hash it)
		if (allowedFields.includes("password") && updateData.password) {
			const hashedPassword = await hashPassword(updateData.password);
			fields.push("password = ?");
			params.push(hashedPassword);
		}

		if (fields.length === 0) {
			throw new Error("No fields to update");
		}

		params.push(id);
		const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ? AND deleted_at IS NULL`;

		const result = await query(sql, params);
		if (result.affectedRows === 0) {
			throw new Error("User not found or already deleted");
		}

		return await findUserById(id);
	} catch (error) {
		throw new Error(`Error updating user: ${error.message}`);
	}
};

// Soft delete user
const deleteUserById = async (id) => {
	try {
		const sql =
			"UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL";
		const result = await query(sql, [id]);

		return result.affectedRows > 0;
	} catch (error) {
		throw new Error(`Error deleting user: ${error.message}`);
	}
};

// Hard delete user (permanent)
const hardDeleteUserById = async (id) => {
	try {
		const sql = "DELETE FROM users WHERE id = ?";
		const result = await query(sql, [id]);

		return result.affectedRows > 0;
	} catch (error) {
		throw new Error(`Error permanently deleting user: ${error.message}`);
	}
};

// Update last login
const updateUserLastLogin = async (userId) => {
	try {
		const sql = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?";
		await query(sql, [userId]);
	} catch (error) {
		throw new Error(`Error updating last login: ${error.message}`);
	}
};

// Get user's borrow records
const getUserBorrowRecords = async (userId, options = {}) => {
	try {
		const { limit = 10, offset = 0, status = null } = options;

		let sql = `
            SELECT br.*, b.title as book_title, b.isbn as book_isbn,
                   CONCAT(a.first_name, ' ', a.last_name) as author_name
            FROM borrow_records br
            JOIN books b ON br.book_id = b.id
            LEFT JOIN authors a ON b.author_id = a.id
            WHERE br.user_id = ?
        `;
		let params = [userId];

		if (status) {
			sql += " AND br.status = ?";
			params.push(status);
		}

		sql += " ORDER BY br.borrow_date DESC LIMIT ? OFFSET ?";
		params.push(limit, offset);

		const rows = await query(sql, params);

		const { formatBorrowRecord } = require("./borrowedRecords.model");
		return rows.map((row) => {
			const record = formatBorrowRecord(row);
			record.book_title = row.book_title;
			record.book_isbn = row.book_isbn;
			record.author_name = row.author_name;
			return record;
		});
	} catch (error) {
		throw new Error(`Error fetching user's borrow records: ${error.message}`);
	}
};

// Get active borrowed books count
const getUserActiveBorrowedCount = async (userId) => {
	try {
		const sql =
			"SELECT COUNT(*) as count FROM borrow_records WHERE user_id = ? AND return_date IS NULL";
		const rows = await query(sql, [userId]);
		return rows[0].count;
	} catch (error) {
		throw new Error(`Error counting active borrows: ${error.message}`);
	}
};

// Check if user can borrow more books
const canUserBorrowMore = async (userId, maxBooks = 5) => {
	try {
		const activeCount = await getUserActiveBorrowedCount(userId);
		return activeCount < maxBooks;
	} catch (error) {
		throw new Error(`Error checking borrow limit: ${error.message}`);
	}
};

// Get overdue books for a user
const getUserOverdueBooks = async (userId) => {
	try {
		const sql = `
            SELECT br.*, b.title as book_title, b.isbn as book_isbn
            FROM borrow_records br
            JOIN books b ON br.book_id = b.id
            WHERE br.user_id = ? AND br.return_date IS NULL
            AND br.due_date < CURRENT_TIMESTAMP
            ORDER BY br.due_date ASC
        `;
		const rows = await query(sql, [userId]);

		const { formatBorrowRecord } = require("./borrowedRecords.model");
		return rows.map((row) => {
			const record = formatBorrowRecord(row);
			record.book_title = row.book_title;
			record.book_isbn = row.book_isbn;
			return record;
		});
	} catch (error) {
		throw new Error(`Error fetching overdue books: ${error.message}`);
	}
};

// Count total users
const countUsers = async (filters = {}) => {
	try {
		let sql = "SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL";
		let params = [];

		if (filters.search) {
			sql +=
				" AND (first_name LIKE ? OR last_name LIKE ? OR user_name LIKE ? OR email LIKE ?)";
			const like = buildLikeParam(filters.search);
			params.push(like, like, like, like);
		}

		if (filters.role) {
			sql += " AND role = ?";
			params.push(filters.role);
		}

		if (filters.is_active !== null && filters.is_active !== undefined) {
			sql += " AND is_active = ?";
			params.push(filters.is_active);
		}

		const rows = await query(sql, params);
		return rows[0].total;
	} catch (error) {
		throw new Error(`Error counting users: ${error.message}`);
	}
};

// Check user role functions
const isUserAdmin = (userData) => userData.role === "Admin";
const isUserLibrarian = (userData) => userData.role === "Librarian";
const isUserMember = (userData) => userData.role === "User";

// Get full name
const getUserFullName = (userData) => {
	if (!userData.first_name && !userData.last_name) return userData.user_name;
	return `${userData.first_name || ""} ${userData.last_name || ""}`.trim();
};

// Format user object and add computed properties (excludes password — safe
// to send in any API response)
const formatUser = (userData) => {
	if (!userData) return null;

	return {
		id: userData.id,
		first_name: userData.first_name,
		last_name: userData.last_name,
		full_name: getUserFullName(userData),
		user_name: userData.user_name,
		phone: userData.phone,
		email: userData.email,
		image_url: userData.image_url,
		role: userData.role,
		is_active: userData.is_active,
		email_verified: userData.email_verified,
		last_login: userData.last_login,
		created_at: userData.created_at,
		updated_at: userData.updated_at,
		// Role checks
		is_admin: isUserAdmin(userData),
		is_librarian: isUserLibrarian(userData),
		is_member: isUserMember(userData),
		// Note: password and deleted_at are excluded for security
	};
};

// Format user object including the password hash — for internal auth use
// ONLY (login, verifyToken). Never pass the result of this straight to
// res.json().
const formatUserForAuth = (userData) => {
	if (!userData) return null;

	return {
		id: userData.id,
		first_name: userData.first_name,
		last_name: userData.last_name,
		full_name: getUserFullName(userData),
		user_name: userData.user_name,
		phone: userData.phone,
		email: userData.email,
		password: userData.password,
		image_url: userData.image_url,
		role: userData.role,
		is_active: userData.is_active,
		email_verified: userData.email_verified,
		last_login: userData.last_login,
		created_at: userData.created_at,
		updated_at: userData.updated_at,
		// Role checks
		is_admin: isUserAdmin(userData),
		is_librarian: isUserLibrarian(userData),
		is_member: isUserMember(userData),
		// Note: password is included for authentication purposes only
	};
};

// Format user for public display (least sensitive data)
const formatUserPublic = (userData) => {
	if (!userData) return null;

	return {
		id: userData.id,
		full_name: getUserFullName(userData),
		user_name: userData.user_name,
		role: userData.role,
		is_active: userData.is_active,
	};
};

module.exports = {
	SELF_EDITABLE_FIELDS,
	LIBRARIAN_EDITABLE_FIELDS,
	ADMIN_EDITABLE_FIELDS,
	hashPassword,
	verifyPassword,
	createUser,
	findAllUsers,
	findUserById,
	findUserByIdSafe,
	findUserByEmail,
	findUserByUsername,
	findUserByEmailOrUsername,
	updateUserById,
	deleteUserById,
	hardDeleteUserById,
	updateUserLastLogin,
	getUserBorrowRecords,
	getUserActiveBorrowedCount,
	canUserBorrowMore,
	getUserOverdueBooks,
	countUsers,
	isUserAdmin,
	isUserLibrarian,
	isUserMember,
	getUserFullName,
	formatUser,
	formatUserForAuth,
	formatUserPublic,
};
