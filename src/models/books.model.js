const { query, queryWithTransaction } = require("../config/database.config");

// Create a new book
const createBook = async (bookData) => {
	try {
		const sql = `
            INSERT INTO books (isbn, published_date, author_id, title, description, cover_image, 
                             genre, language, pages, publisher, available_copies, total_copies, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
		const params = [
			bookData.isbn,
			bookData.published_date || null,
			bookData.author_id,
			bookData.title,
			bookData.description || null,
			bookData.cover_image || null,
			bookData.genre || null,
			bookData.language || null,
			bookData.pages || null,
			bookData.publisher || null,
			bookData.available_copies || 0,
			bookData.total_copies || 0,
			bookData.status || "Available",
		];

		const result = await query(sql, params);
		return await findBookById(result.insertId);
	} catch (error) {
		throw new Error(`Error creating book: ${error.message}`);
	}
};

// Find all books with pagination and filters
const findAllBooks = async (options = {}) => {
	try {
		const {
			limit = 10,
			offset = 0,
			search = "",
			author_id = null,
			genre = null,
			status = null,
		} = options;

		let sql = `
            SELECT b.*, 
                   CONCAT(a.first_name, ' ', a.last_name) as author_name
            FROM books b
            LEFT JOIN authors a ON b.author_id = a.id
        `;
		let params = [];
		let whereConditions = [];

		// Search conditions
		if (search) {
			whereConditions.push(
				"(b.title LIKE ? OR b.isbn LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ?)"
			);
			params.push(`%${search}%`, `%${search}%`, `%${search}%`);
		}

		if (author_id) {
			whereConditions.push("b.author_id = ?");
			params.push(author_id);
		}

		if (genre) {
			whereConditions.push("b.genre = ?");
			params.push(genre);
		}

		if (status) {
			whereConditions.push("b.status = ?");
			params.push(status);
		}

		if (whereConditions.length > 0) {
			sql += " WHERE " + whereConditions.join(" AND ");
		}

		sql += ` ORDER BY b.created_at DESC LIMIT ${offset}, ${limit}`;

		const rows = await query(sql, params);
		return rows.map((row) => {
			const book = formatBook(row);
			book.author_name = row.author_name;
			return book;
		});
	} catch (error) {
		throw new Error(`Error fetching books: ${error.message}`);
	}
};

// Find book by ID
const findBookById = async (id) => {
	try {
		const sql = `
            SELECT b.*, 
                   CONCAT(a.first_name, ' ', a.last_name) as author_name
            FROM books b
            LEFT JOIN authors a ON b.author_id = a.id
            WHERE b.id = ?
        `;
		const rows = await query(sql, [id]);

		if (rows.length === 0) {
			return null;
		}

		const book = formatBook(rows[0]);
		book.author_name = rows[0].author_name;
		return book;
	} catch (error) {
		throw new Error(`Error finding book: ${error.message}`);
	}
};

// Find book by ISBN
const findBookByISBN = async (isbn) => {
	try {
		const sql = "SELECT * FROM books WHERE isbn = ?";
		const rows = await query(sql, [isbn]);

		return rows.length > 0 ? formatBook(rows[0]) : null;
	} catch (error) {
		throw new Error(`Error finding book by ISBN: ${error.message}`);
	}
};

// Update book
const updateBookById = async (id, updateData) => {
	try {
		const fields = [];
		const params = [];

		// Build dynamic update query
		Object.keys(updateData).forEach((key) => {
			if (updateData[key] !== undefined && key !== "id") {
				fields.push(`${key} = ?`);
				params.push(updateData[key]);
			}
		});

		if (fields.length === 0) {
			throw new Error("No fields to update");
		}

		params.push(id);
		const sql = `UPDATE books SET ${fields.join(", ")} WHERE id = ?`;

		await query(sql, params);
		return await findBookById(id);
	} catch (error) {
		throw new Error(`Error updating book: ${error.message}`);
	}
};

// Delete book
const deleteBookById = async (id) => {
	try {
		const sql = "DELETE FROM books WHERE id = ?";
		const result = await query(sql, [id]);

		return result.affectedRows > 0;
	} catch (error) {
		throw new Error(`Error deleting book: ${error.message}`);
	}
};

// Get author details for a book
const getBookAuthor = async (bookId) => {
	try {
		const book = await findBookById(bookId);
		if (!book || !book.author_id) return null;

		const { findAuthorById } = require("./authors.model");
		return await findAuthorById(book.author_id);
	} catch (error) {
		throw new Error(`Error fetching book's author: ${error.message}`);
	}
};

// Get borrow records for a book
const getBookBorrowRecords = async (bookId) => {
	try {
		const sql = `
            SELECT br.*, u.first_name as user_first_name, u.last_name as user_last_name, 
                   u.user_name, u.email as user_email
            FROM borrow_records br
            JOIN users u ON br.user_id = u.id
            WHERE br.book_id = ?
            ORDER BY br.borrow_date DESC
        `;
		const rows = await query(sql, [bookId]);

		const { formatBorrowRecord } = require("./borrowRecords.model");
		return rows.map((row) => {
			const record = formatBorrowRecord(row);
			record.user_first_name = row.user_first_name;
			record.user_last_name = row.user_last_name;
			record.user_name = row.user_name;
			record.user_email = row.user_email;
			return record;
		});
	} catch (error) {
		throw new Error(`Error fetching book's borrow records: ${error.message}`);
	}
};

// Check if book is currently borrowed
const isBookCurrentlyBorrowed = async (bookId) => {
	try {
		const sql = `
            SELECT COUNT(*) as count 
            FROM borrow_records 
            WHERE book_id = ? AND return_date IS NULL AND status = 'Borrowed'
        `;
		const rows = await query(sql, [bookId]);
		return rows[0].count > 0;
	} catch (error) {
		throw new Error(`Error checking if book is borrowed: ${error.message}`);
	}
};

// Borrow book (decrease available copies)
const borrowBook = async (bookId, userId, dueDate) => {
	try {
		const book = await findBookById(bookId);
		if (!book || !isBookAvailable(book)) {
			throw new Error("Book is not available for borrowing");
		}

		const connection =
			await require("../config/database.config").pool.getConnection();

		try {
			await connection.beginTransaction();

			// Update available copies
			await queryWithTransaction(
				connection,
				"UPDATE books SET available_copies = available_copies - 1 WHERE id = ? AND available_copies > 0",
				[bookId]
			);

			// Create borrow record
			await queryWithTransaction(
				connection,
				"INSERT INTO borrow_records (user_id, book_id, due_date) VALUES (?, ?, ?)",
				[userId, bookId, dueDate]
			);

			await connection.commit();

			// Return updated book data
			return await findBookById(bookId);
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	} catch (error) {
		throw new Error(`Error borrowing book: ${error.message}`);
	}
};

// Return book (increase available copies)
const returnBook = async (bookId, userId) => {
	try {
		const connection =
			await require("../config/database.config").pool.getConnection();

		try {
			await connection.beginTransaction();

			// Update borrow record
			const result = await queryWithTransaction(
				connection,
				'UPDATE borrow_records SET return_date = NOW(), status = "Returned" WHERE user_id = ? AND book_id = ? AND return_date IS NULL',
				[userId, bookId]
			);

			if (result.affectedRows === 0) {
				throw new Error("No active borrow record found");
			}

			// Update available copies
			await queryWithTransaction(
				connection,
				"UPDATE books SET available_copies = available_copies + 1 WHERE id = ?",
				[bookId]
			);

			await connection.commit();

			// Return updated book data
			return await findBookById(bookId);
		} catch (error) {
			await connection.rollback();
			throw error;
		} finally {
			connection.release();
		}
	} catch (error) {
		throw new Error(`Error returning book: ${error.message}`);
	}
};

// Count total books
const countBooks = async (filters = {}) => {
	try {
		let sql = "SELECT COUNT(*) as total FROM books b";
		let params = [];
		let whereConditions = [];

		if (filters.search) {
			sql += " LEFT JOIN authors a ON b.author_id = a.id";
			whereConditions.push(
				"(b.title LIKE ? OR b.isbn LIKE ? OR CONCAT(a.first_name, ' ', a.last_name) LIKE ?)"
			);
			params.push(
				`%${filters.search}%`,
				`%${filters.search}%`,
				`%${filters.search}%`
			);
		}

		if (filters.author_id) {
			whereConditions.push("b.author_id = ?");
			params.push(filters.author_id);
		}

		if (filters.genre) {
			whereConditions.push("b.genre = ?");
			params.push(filters.genre);
		}

		if (filters.status) {
			whereConditions.push("b.status = ?");
			params.push(filters.status);
		}

		if (whereConditions.length > 0) {
			sql += " WHERE " + whereConditions.join(" AND ");
		}

		const rows = await query(sql, params);
		return rows[0].total;
	} catch (error) {
		throw new Error(`Error counting books: ${error.message}`);
	}
};

// Check if book is available for borrowing
const isBookAvailable = (bookData) => {
	return bookData.available_copies > 0 && bookData.status === "Available";
};

// Format book object and add computed properties
const formatBook = (bookData) => {
	if (!bookData) return null;

	return {
		id: bookData.id,
		isbn: bookData.isbn,
		published_date: bookData.published_date,
		author_id: bookData.author_id,
		author_name: bookData.author_name || null,
		title: bookData.title,
		description: bookData.description,
		cover_image: bookData.cover_image,
		genre: bookData.genre,
		language: bookData.language,
		pages: bookData.pages,
		publisher: bookData.publisher,
		available_copies: bookData.available_copies,
		total_copies: bookData.total_copies,
		status: bookData.status,
		is_available: isBookAvailable(bookData),
		created_at: bookData.created_at,
		updated_at: bookData.updated_at,
	};
};

module.exports = {
	createBook,
	findAllBooks,
	findBookById,
	findBookByISBN,
	updateBookById,
	deleteBookById,
	getBookAuthor,
	getBookBorrowRecords,
	isBookCurrentlyBorrowed,
	borrowBook,
	returnBook,
	countBooks,
	isBookAvailable,
	formatBook,
};
