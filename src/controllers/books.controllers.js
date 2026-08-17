const { findAuthorById } = require("../models/authors.model");
const {
	findBookByISBN,
	createBook,
	findAllBooks,
	countBooks,
	findBookById,
	getBookAuthor,
	getBookBorrowRecords,
	updateBookById,
	deleteBookById,
} = require("../models/books.model");
const logger = require("../utils/logger");
const SimpleCache = require("../utils/cache");

// Short TTL cache for the public, read-heavy book endpoints. Cleared on
// any write (create/update/delete) so stale data can't linger past a write.
const booksCache = new SimpleCache(parseInt(process.env.BOOKS_CACHE_TTL_SECONDS) || 30);

const createBooks = async (req, res) => {
	try {
		const {
			isbn,
			title,
			author_id,
			published_date,
			description,
			cover_image,
			genre,
			language,
			pages,
			publisher,
			available_copies,
			total_copies,
			status,
		} = req.body;

		const existingBook = await findBookByISBN(isbn);
		if (existingBook) {
			return res.status(409).json({
				success: false,
				message: "A book with this ISBN already exists",
			});
		}

		const author = await findAuthorById(author_id);
		if (!author) {
			return res.status(404).json({ success: false, message: "Author not found" });
		}

		const totalCopies = parseInt(total_copies) || 0;
		const availableCopies =
			available_copies !== undefined ? parseInt(available_copies) : totalCopies;

		if (availableCopies > totalCopies) {
			return res.status(400).json({
				success: false,
				message: "Available copies cannot exceed total copies",
			});
		}

		const newBook = await createBook({
			isbn,
			title,
			author_id,
			published_date,
			description,
			cover_image,
			genre,
			language,
			pages: pages ? parseInt(pages) : null,
			publisher,
			available_copies: availableCopies,
			total_copies: totalCopies,
			status: status || "Available",
		});

		booksCache.clear();

		res.status(201).json({
			success: true,
			message: "Book created successfully",
			data: newBook,
		});
	} catch (error) {
		logger.error({ err: error }, "Error creating book");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

const getAllBooks = async (req, res) => {
	try {
		const { page = 1, limit = 10, search = "", author_id, genre, status } = req.query;

		const cacheKey = req.originalUrl;
		const cached = booksCache.get(cacheKey);
		if (cached) {
			return res.status(200).json(cached);
		}

		const offset = (parseInt(page) - 1) * parseInt(limit);

		const options = { limit: parseInt(limit), offset, search };
		if (author_id) options.author_id = parseInt(author_id);
		if (genre) options.genre = genre;
		if (status) options.status = status;

		const books = await findAllBooks(options);

		const filters = { search };
		if (author_id) filters.author_id = parseInt(author_id);
		if (genre) filters.genre = genre;
		if (status) filters.status = status;

		const totalBooks = await countBooks(filters);
		const totalPages = Math.ceil(totalBooks / parseInt(limit));

		const responseBody = {
			success: true,
			message: "Books retrieved successfully",
			data: books,
			pagination: {
				current_page: parseInt(page),
				total_pages: totalPages,
				total_items: totalBooks,
				items_per_page: parseInt(limit),
				has_next: parseInt(page) < totalPages,
				has_prev: parseInt(page) > 1,
			},
			filters: {
				search: search || null,
				author_id: author_id ? parseInt(author_id) : null,
				genre: genre || null,
				status: status || null,
			},
		};

		booksCache.set(cacheKey, responseBody);
		res.status(200).json(responseBody);
	} catch (error) {
		logger.error({ err: error }, "Error fetching books");
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
};

const getBooksById = async (req, res) => {
	try {
		const { id } = req.params;

		if (!id || isNaN(id)) {
			return res.status(400).json({ success: false, message: "Valid book ID is required" });
		}

		const book = await findBookById(parseInt(id));
		if (!book) {
			return res.status(404).json({ success: false, message: "Book not found" });
		}

		const includeAuthor = req.query.include_author === "true";
		const includeBorrows = req.query.include_borrows === "true";

		let bookData = book;

		if (includeAuthor) {
			const author = await getBookAuthor(book.id);
			bookData = { ...bookData, author_details: author };
		}

		if (includeBorrows) {
			const borrowRecords = await getBookBorrowRecords(book.id);
			bookData = {
				...bookData,
				borrow_records: borrowRecords,
				total_borrows: borrowRecords.length,
			};
		}

		res.status(200).json({
			success: true,
			message: "Book retrieved successfully",
			data: bookData,
		});
	} catch (error) {
		logger.error({ err: error }, "Error fetching book");
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
};

const updateBooksById = async (req, res) => {
	try {
		const { id } = req.params;
		const updateData = req.body;

		if (!id || isNaN(id)) {
			return res.status(400).json({ success: false, message: "Valid book ID is required" });
		}

		const existingBook = await findBookById(parseInt(id));
		if (!existingBook) {
			return res.status(404).json({ success: false, message: "Book not found" });
		}

		if (updateData.isbn && updateData.isbn !== existingBook.isbn) {
			const isbnExist = await findBookByISBN(updateData.isbn);
			if (isbnExist) {
				return res
					.status(409)
					.json({ success: false, message: "ISBN is already taken by another book" });
			}
		}

		if (updateData.author_id) {
			const author = await findAuthorById(updateData.author_id);
			if (!author) {
				return res.status(404).json({ success: false, message: "Author not found" });
			}
		}

		const totalCopies =
			updateData.total_copies !== undefined
				? parseInt(updateData.total_copies)
				: existingBook.total_copies;
		const availableCopies =
			updateData.available_copies !== undefined
				? parseInt(updateData.available_copies)
				: existingBook.available_copies;

		if (availableCopies > totalCopies) {
			return res.status(400).json({
				success: false,
				message: "Available copies cannot exceed total copies",
			});
		}

		const updatedBook = await updateBookById(parseInt(id), updateData);
		booksCache.clear();

		res.status(200).json({
			success: true,
			message: "Book updated successfully",
			data: updatedBook,
		});
	} catch (error) {
		logger.error({ err: error }, "Error updating book");
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
};

const deleteBooksById = async (req, res) => {
	try {
		const { id } = req.params;

		if (!id || isNaN(id)) {
			return res.status(400).json({ success: false, message: "Valid book ID is required" });
		}

		const existingBook = await findBookById(parseInt(id));
		if (!existingBook) {
			return res.status(404).json({ success: false, message: "Book not found" });
		}

		const borrowRecords = await getBookBorrowRecords(parseInt(id));
		const activeBorrows = borrowRecords.filter((record) => record.is_active);

		if (activeBorrows.length > 0) {
			return res.status(409).json({
				success: false,
				message: `Cannot delete book. Book has ${activeBorrows.length} active borrow(s)`,
				active_borrows: activeBorrows.length,
			});
		}

		const deleted = await deleteBookById(parseInt(id));
		if (!deleted) {
			return res
				.status(404)
				.json({ success: false, message: "Book not found or already deleted" });
		}

		booksCache.clear();

		res.status(200).json({ success: true, message: "Book successfully deleted" });
	} catch (error) {
		logger.error({ err: error }, "Error deleting book");
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

module.exports = {
	createBooks,
	getAllBooks,
	getBooksById,
	updateBooksById,
	deleteBooksById,
};
