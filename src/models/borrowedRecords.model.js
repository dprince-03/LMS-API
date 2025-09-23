const { query, queryWithTransaction } = require("../config/database.config");

// Create a new borrow record
const createBorrowRecord = async (borrowData) => {
	try {
		const sql = `
            INSERT INTO borrow_records (user_id, book_id, borrow_date, due_date, status)
            VALUES (?, ?, ?, ?, ?)
        `;
		const params = [
			borrowData.user_id,
			borrowData.book_id,
			borrowData.borrow_date || new Date(),
			borrowData.due_date,
			borrowData.status || "Borrowed",
		];

		const result = await query(sql, params);
		return await findBorrowRecordById(result.insertId);
	} catch (error) {
		throw new Error(`Error creating borrow record: ${error.message}`);
	}
};

// Find all borrow records with pagination
const findAllBorrowRecords = async (options = {}) => {
	try {
		const {
			limit = 10,
			offset = 0,
			user_id = null,
			book_id = null,
			status = null,
			overdue_only = false,
		} = options;

		let sql = `
            SELECT br.*, 
                   u.first_name as user_first_name, u.last_name as user_last_name, 
                   u.user_name, u.email as user_email,
                   b.title as book_title, b.isbn as book_isbn,
                   CONCAT(a.first_name, ' ', a.last_name) as author_name
            FROM borrow_records br
            JOIN users u ON br.user_id = u.id
            JOIN books b ON br.book_id = b.id
            LEFT JOIN authors a ON b.author_id = a.id
            WHERE 1=1
        `;
		let params = [];

		if (user_id) {
			sql += " AND br.user_id = ?";
			params.push(user_id);
		}

		if (book_id) {
			sql += " AND br.book_id = ?";
			params.push(book_id);
		}

		if (status) {
			sql += " AND br.status = ?";
			params.push(status);
		}

		if (overdue_only) {
			sql += " AND br.return_date IS NULL AND br.due_date < CURRENT_TIMESTAMP";
		}

		sql += " ORDER BY br.borrow_date DESC LIMIT ? OFFSET ?";
		params.push(limit, offset);

		const rows = await query(sql, params);
		return rows.map((row) => {
			const record = formatBorrowRecord(row);
			record.user_first_name = row.user_first_name;
			record.user_last_name = row.user_last_name;
			record.user_name = row.user_name;
			record.user_email = row.user_email;
			record.book_title = row.book_title;
			record.book_isbn = row.book_isbn;
			record.author_name = row.author_name;
			return record;
		});
	} catch (error) {
		throw new Error(`Error fetching borrow records: ${error.message}`);
	}
};

// Find borrow record by ID
const findBorrowRecordById = async (id) => {
	try {
		const sql = `
            SELECT br.*, 
                   u.first_name as user_first_name, u.last_name as user_last_name, 
                   u.user_name, u.email as user_email,
                   b.title as book_title, b.isbn as book_isbn,
                   CONCAT(a.first_name, ' ', a.last_name) as author_name
            FROM borrow_records br
            JOIN users u ON br.user_id = u.id
            JOIN books b ON br.book_id = b.id
            LEFT JOIN authors a ON b.author_id = a.id
            WHERE br.id = ?
        `;
		const rows = await query(sql, [id]);

		if (rows.length === 0) {
			return null;
		}

		const record = formatBorrowRecord(rows[0]);
		record.user_first_name = rows[0].user_first_name;
		record.user_last_name = rows[0].user_last_name;
		record.user_name = rows[0].user_name;
		record.user_email = rows[0].user_email;
		record.book_title = rows[0].book_title;
		record.book_isbn = rows[0].book_isbn;
		record.author_name = rows[0].author_name;
		return record;
	} catch (error) {
		throw new Error(`Error finding borrow record: ${error.message}`);
	}
};

// Find active borrow record for user and book
const findActiveBorrowRecord = async (userId, bookId) => {
	try {
		const sql = `
            SELECT * FROM borrow_records 
            WHERE user_id = ? AND book_id = ? AND return_date IS NULL AND status = 'Borrowed'
        `;
		const rows = await query(sql, [userId, bookId]);

		return rows.length > 0 ? formatBorrowRecord(rows[0]) : null;
	} catch (error) {
		throw new Error(`Error finding active borrow record: ${error.message}`);
	}
};

// Get all overdue records
const getOverdueBorrowRecords = async (options = {}) => {
	try {
		const { limit = 50, offset = 0 } = options;

		const sql = `
            SELECT br.*, 
                   u.first_name as user_first_name, u.last_name as user_last_name, 
                   u.user_name, u.email as user_email,
                   b.title as book_title, b.isbn as book_isbn,
                   CONCAT(a.first_name, ' ', a.last_name) as author_name,
                   DATEDIFF(CURRENT_DATE, br.due_date) as days_overdue
            FROM borrow_records br
            JOIN users u ON br.user_id = u.id
            JOIN books b ON br.book_id = b.id
            LEFT JOIN authors a ON b.author_id = a.id
            WHERE br.return_date IS NULL 
            AND br.due_date < CURRENT_TIMESTAMP
            AND br.status = 'Borrowed'
            ORDER BY br.due_date ASC
            LIMIT ? OFFSET ?
        `;

		const rows = await query(sql, [limit, offset]);
		return rows.map((row) => {
			const record = formatBorrowRecord(row);
			record.user_first_name = row.user_first_name;
			record.user_last_name = row.user_last_name;
			record.user_name = row.user_name;
			record.user_email = row.user_email;
			record.book_title = row.book_title;
			record.book_isbn = row.book_isbn;
			record.author_name = row.author_name;
			record.days_overdue = row.days_overdue;
			return record;
		});
	} catch (error) {
		throw new Error(`Error fetching overdue records: ${error.message}`);
	}
};

// Update borrow record status
const updateBorrowRecordStatus = async (id, status) => {
	try {
		const sql = "UPDATE borrow_records SET status = ? WHERE id = ?";
		const result = await query(sql, [status, id]);

		if (result.affectedRows === 0) {
			throw new Error("Borrow record not found");
		}

		return await findBorrowRecordById(id);
	} catch (error) {
		throw new Error(`Error updating borrow record status: ${error.message}`);
	}
};

// Mark borrow record as returned
const markBorrowRecordAsReturned = async (id) => {
	try {
		const sql = `
            UPDATE borrow_records 
            SET return_date = CURRENT_TIMESTAMP, status = 'Returned' 
            WHERE id = ?
        `;
		const result = await query(sql, [id]);

		if (result.affectedRows === 0) {
			throw new Error("Borrow record not found");
		}

		return await findBorrowRecordById(id);
	} catch (error) {
		throw new Error(`Error marking as returned: ${error.message}`);
	}
};

// Update overdue status for all records
const updateOverdueBorrowRecords = async () => {
	try {
		const sql = `
            UPDATE borrow_records 
            SET status = 'Overdue' 
            WHERE return_date IS NULL 
            AND due_date < CURRENT_TIMESTAMP 
            AND status = 'Borrowed'
        `;
		const result = await query(sql);
		return result.affectedRows;
	} catch (error) {
		throw new Error(`Error updating overdue records: ${error.message}`);
	}
};

// Get user details for a borrow record
const getBorrowRecordUser = async (recordId) => {
	try {
		const record = await findBorrowRecordById(recordId);
		if (!record) return null;

		const { findUserById } = require("./users.model");
		return await findUserById(record.user_id);
	} catch (error) {
		throw new Error(`Error fetching user: ${error.message}`);
	}
};

// Get book details for a borrow record
const getBorrowRecordBook = async (recordId) => {
	try {
		const record = await findBorrowRecordById(recordId);
		if (!record) return null;

		const { findBookById } = require("./books.model");
		return await findBookById(record.book_id);
	} catch (error) {
		throw new Error(`Error fetching book: ${error.message}`);
	}
};

// Extend due date for a borrow record
const extendBorrowRecordDueDate = async (id, newDueDate) => {
	try {
		const record = await findBorrowRecordById(id);
		if (!record) {
			throw new Error("Borrow record not found");
		}

		if (record.return_date) {
			throw new Error("Cannot extend due date for returned book");
		}

		const sql = "UPDATE borrow_records SET due_date = ? WHERE id = ?";
		const result = await query(sql, [newDueDate, id]);

		if (result.affectedRows === 0) {
			throw new Error("Borrow record not found");
		}

		return await findBorrowRecordById(id);
	} catch (error) {
		throw new Error(`Error extending due date: ${error.message}`);
	}
};

// Count total borrow records
const countBorrowRecords = async (filters = {}) => {
	try {
		let sql = "SELECT COUNT(*) as total FROM borrow_records br";
		let params = [];
		let whereConditions = ["1=1"];

		if (filters.user_id) {
			whereConditions.push("br.user_id = ?");
			params.push(filters.user_id);
		}

		if (filters.book_id) {
			whereConditions.push("br.book_id = ?");
			params.push(filters.book_id);
		}

		if (filters.status) {
			whereConditions.push("br.status = ?");
			params.push(filters.status);
		}

		if (filters.overdue_only) {
			whereConditions.push(
				"br.return_date IS NULL AND br.due_date < CURRENT_TIMESTAMP"
			);
		}

		sql += " WHERE " + whereConditions.join(" AND ");
		const rows = await query(sql, params);
		return rows[0].total;
	} catch (error) {
		throw new Error(`Error counting borrow records: ${error.message}`);
	}
};

// Get borrowing statistics
const getBorrowingStatistics = async () => {
	try {
		const sql = `
            SELECT 
                COUNT(*) as total_borrows,
                COUNT(CASE WHEN return_date IS NULL THEN 1 END) as active_borrows,
                COUNT(CASE WHEN return_date IS NOT NULL THEN 1 END) as returned_borrows,
                COUNT(CASE WHEN return_date IS NULL AND due_date < CURRENT_TIMESTAMP THEN 1 END) as overdue_borrows,
                AVG(DATEDIFF(IFNULL(return_date, CURRENT_DATE), borrow_date)) as avg_borrow_days
            FROM borrow_records
        `;
		const rows = await query(sql);
		return rows[0];
	} catch (error) {
		throw new Error(`Error getting borrowing stats: ${error.message}`);
	}
};

// Delete borrow record
const deleteBorrowRecordById = async (id) => {
	try {
		const sql = "DELETE FROM borrow_records WHERE id = ?";
		const result = await query(sql, [id]);

		return result.affectedRows > 0;
	} catch (error) {
		throw new Error(`Error deleting borrow record: ${error.message}`);
	}
};

// Check if record is overdue
const isBorrowRecordOverdue = (recordData) => {
	if (recordData.return_date) return false; // Already returned
	return new Date() > new Date(recordData.due_date);
};

// Calculate days overdue
const getBorrowRecordDaysOverdue = (recordData) => {
	if (!isBorrowRecordOverdue(recordData)) return 0;
	const today = new Date();
	const dueDate = new Date(recordData.due_date);
	const diffTime = today - dueDate;
	return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Check if currently active (not returned)
const isBorrowRecordActive = (recordData) => {
	return !recordData.return_date && recordData.status === "Borrowed";
};

// Calculate late fee (if any)
const calculateBorrowRecordLateFee = (recordData, dailyFee = 1.0) => {
	if (!isBorrowRecordOverdue(recordData)) return 0;
	return getBorrowRecordDaysOverdue(recordData) * dailyFee;
};

// Format borrow record object and add computed properties
const formatBorrowRecord = (recordData) => {
	if (!recordData) return null;

	return {
		id: recordData.id,
		user_id: recordData.user_id,
		book_id: recordData.book_id,
		borrow_date: recordData.borrow_date,
		return_date: recordData.return_date,
		due_date: recordData.due_date,
		status: recordData.status,
		is_overdue: isBorrowRecordOverdue(recordData),
		days_overdue: getBorrowRecordDaysOverdue(recordData),
		is_active: isBorrowRecordActive(recordData),
		created_at: recordData.created_at,
		updated_at: recordData.updated_at,
		// Additional fields if loaded with joins
		user_first_name: recordData.user_first_name,
		user_last_name: recordData.user_last_name,
		user_name: recordData.user_name,
		user_email: recordData.user_email,
		book_title: recordData.book_title,
		book_isbn: recordData.book_isbn,
		author_name: recordData.author_name,
	};
};

module.exports = {
	createBorrowRecord,
	findAllBorrowRecords,
	findBorrowRecordById,
	findActiveBorrowRecord,
	getOverdueBorrowRecords,
	updateBorrowRecordStatus,
	markBorrowRecordAsReturned,
	updateOverdueBorrowRecords,
	getBorrowRecordUser,
	getBorrowRecordBook,
	extendBorrowRecordDueDate,
	countBorrowRecords,
	getBorrowingStatistics,
	deleteBorrowRecordById,
	isBorrowRecordOverdue,
	getBorrowRecordDaysOverdue,
	isBorrowRecordActive,
	calculateBorrowRecordLateFee,
	formatBorrowRecord,
};
