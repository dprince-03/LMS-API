const { query } = require("../config/database.config");
const { formatBook } = require("./books.model");
const { buildLikeParam } = require("../utils/sanitize");

const UPDATABLE_FIELDS = [
	"first_name",
	"last_name",
	"image",
	"date_of_birth",
	"biography",
	"phone",
	"email",
];

// Allowlist for ORDER BY — column names can't be parameterized, so only a
// known-safe set of identifiers is ever interpolated into the SQL.
const SORTABLE_FIELDS = ["created_at", "first_name", "last_name", "date_of_birth"];

// Function to create a new author
const createAuthor = async (authorData) => {
	try {
		const sql = `
            INSERT INTO authors (first_name, last_name, image, date_of_birth, biography, phone, email)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

		const params = [
			authorData.first_name,
			authorData.last_name,
			authorData.image || null,
			authorData.date_of_birth || null,
			authorData.biography || null,
			authorData.phone || null,
			authorData.email || null,
		];

		const result = await query(sql, params);

		return await findAuthorById(result.insertId);
	} catch (error) {
		if (error.code === "ER_DUP_ENTRY") {
			throw new Error("An author with this email already exists");
		}
		throw new Error(`Error creating author: ${error.message}`);
	}
};

// find all authors
const findAllAuthors = async (options = {}) => {
	try {
		const {
			limit = 10,
			offset = 0,
			search = "",
			sort_by = "created_at",
			order = "desc",
		} = options;

		const sortColumn = SORTABLE_FIELDS.includes(sort_by) ? sort_by : "created_at";
		const sortOrder = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

		let sql = "SELECT * FROM authors";
		let params = [];

		if (search) {
			sql += " WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? ";
			const like = buildLikeParam(search);
			params = [like, like, like];
		}

		sql += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ? `;
		params.push(limit, offset);

		const rows = await query(sql, params);

		return rows.map(formatAuthor);
	} catch (error) {
		throw new Error(`Error fetching authors: ${error.message}`);
	}
};

// Function to get an author by ID
const findAuthorById = async (id) => {
	try {
		const sql = " SELECT * FROM authors WHERE id = ? ";

		const rows = await query(sql, [id]);

		if (rows.length === 0) {
			return null;
		}

		return formatAuthor(rows[0]);
	} catch (error) {
		throw new Error(`Error fetching author by ID: ${error.message}`);
	}
};

// Find author by email
const findAuthorByEmail = async (email) => {
	try {
		const sql = " SELECT * FROM authors WHERE email = ? ";

		const rows = await query(sql, [email]);

		return rows.length > 0 ? formatAuthor(rows[0]) : null;
	} catch (error) {
		throw new Error(`Error fetching author by email: ${error.message}`);
	}
};

// Function to update an author. Only literal, allowlisted column names are
// ever interpolated into the SQL — unknown keys in `updateData` are
// silently dropped.
const updateAuthor = async (id, updateData) => {
	try {
		const fields = [];
		const params = [];

		for (const key of UPDATABLE_FIELDS) {
			if (
				Object.prototype.hasOwnProperty.call(updateData, key) &&
				updateData[key] !== undefined
			) {
				fields.push(`${key} = ?`);
				params.push(updateData[key]);
			}
		}

		if (fields.length === 0) {
			throw new Error("No fields to update");
		}

		params.push(id);

		const sql = ` UPDATE authors SET ${fields.join(", ")} WHERE id = ? `;

		await query(sql, params);

		return await findAuthorById(id);
	} catch (error) {
		if (error.code === "ER_DUP_ENTRY") {
			throw new Error("An author with this email already exists");
		}
		throw new Error(`Error updating author: ${error.message}`);
	}
};

// delete an author
const deleteAuthorById = async (id) => {
	try {
		const sql = " DELETE FROM authors WHERE id = ? ";

		const result = await query(sql, [id]);

		return result.affectedRows > 0;
	} catch (error) {
		throw new Error(`Error deleting author: ${error.message}`);
	}
};

// Get books by author ID
const getBooksByAuthorId = async (authorId) => {
	try {
		const sql = " SELECT * FROM books WHERE author_id = ? ";

		const rows = await query(sql, [authorId]);

		return rows.map(formatBook);
	} catch (error) {
		throw new Error(`Error fetching books by author ID: ${error.message}`);
	}
};

// Count total authors
const countAuthors = async (search = "") => {
	try {
		let sql = " SELECT COUNT(*) AS total FROM authors ";
		let params = [];

		if (search) {
			sql += " WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? ";
			const like = buildLikeParam(search);
			params = [like, like, like];
		}

		const rows = await query(sql, params);
		return rows[0].total;
	} catch (error) {
		throw new Error(`Error counting authors: ${error.message}`);
	}
};

// Format author object and add computed properties
const formatAuthor = (authorData) => {
	if (!authorData) {
		return null;
	}

	return {
		id: authorData.id,
		first_name: authorData.first_name,
		last_name: authorData.last_name,
		full_name: `${authorData.first_name} ${authorData.last_name}`.trim(),
		image: authorData.image,
		date_of_birth: authorData.date_of_birth,
		biography: authorData.biography,
		phone: authorData.phone,
		email: authorData.email,
		created_at: authorData.created_at,
		updated_at: authorData.updated_at,
	};
};

module.exports = {
	UPDATABLE_FIELDS,
	SORTABLE_FIELDS,
	createAuthor,
	findAllAuthors,
	findAuthorById,
	findAuthorByEmail,
	updateAuthor,
	deleteAuthorById,
	getBooksByAuthorId,
	countAuthors,
	formatAuthor,
};
