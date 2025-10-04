const { 
    findBookById, 
    updateBookById,
} = require("../models/books.model");

const { 
    findActiveBorrowRecord, 
    createBorrowRecord, 
    findAllBorrowRecords,
    updateOverdueBorrowRecords,
    countBorrowRecords,
} = require("../models/borrowedRecords.model");

const { 
    canUserBorrowMore, 
    getUserActiveBorrowedCount, 
    findUserById
} = require("../models/users.model");


const borrowBook = async (req, res) => {
    try {
        const { id: bookId } = req.params;
        const userId = req.user.id;
        const { due_days = 14 } = req.body;

        if ( !bookId || isNaN(bookId) ) {
            return res.status(400).json({
                success: false,
                message: 'Valid book ID is required'
            });
        }

        const book = await findBookById(parseInt(bookId));
        if (!book) {
            return res.status(404).json({
                success: false,
                message: 'Book not found'
            });
        }

        if (!book.is_available || book.available_copies <= 0) {
            return res.status(409).json({
                success: false,
                message: 'Book is not available for borrowing',
                available_copies: book.available_copies,
                status: book.status
            });
        }

        const canBorrow = await canUserBorrowMore(userId);
        if (!canBorrow) {
            const activeBorrows = await getUserActiveBorrowedCount(userId);
            return res.status(409).json({
                success: false,
                message: 'Borrow limit exceeded',
                active_borrows: activeBorrows,
                max_allowed: 5
            });
        }

        const existingBorrow = await findActiveBorrowRecord(userId, parseInt(bookId));
        if (existingBorrow) {
            return res.status(409).json({
                success: false,
                message: 'You have already borrowed this book',
                existing_borrow: {
                    id: existingBorrow.id,
                    borrowed_date: existingBorrow.borrow_date,
                    due_date: existingBorrow.due_date
                }
            });
        }

        const borrowDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + parseInt(due_days));

        try {
            const borrowData = {
                user_id: userId,
                book_id: parseInt(bookId),
                borrow_date: borrowDate,
                due_date: dueDate,
                status: 'Borrowed'
            };

            const borrowRecord = await createBorrowRecord(borrowData);

            await updateBookById(parseInt(bookId), {
                available_copies: book.available_copies - 1,
                status: book.available_copies - 1 <= 0 ? 'Borrowed' : 'Available'
            });

            const updatedBook = await findBookById(parseInt(bookId));

            res.status(201).json({
                success: true,
                message: 'Book borrowed successfully',
                data: {
                    borrow_record: borrowRecord,
                    book: {
                        id: updatedBook.id,
                        title: updatedBook.title,
                        isbn: updatedBook.isbn,
                        available_copies: updatedBook.available_copies,
                        status: updatedBook.status
                    },
                    due_date: dueDate.toISOString(),
                    days_allowed: parseInt(due_days)
                }
            });

        } catch (error) {
            console.error('Error during borrow operation:', error);
            throw error;
        }

    } catch (error) {
        console.error('Error borrowing book:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const returnBook = async (req, res) => {
    try {
        const { id: bookId } = req.params;
        const userId = req.user.id;

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid book ID is required'
            });
        }

        const book = await findBookById(parseInt(bookId));
        if (!book) {
            return res.status(404).json({
                success: false,
                message: 'Book not found'
            });
        }

        const activeBorrow = await findActiveBorrowRecord(userId, parseInt(bookId));
        if (!activeBorrow) {
            return res.status(404).json({
                success: false,
                message: 'No active borrow record found for this book',
                book_title: book.title
            });
        }

        const returnDate = new Date();
        const dueDate = new Date(activeBorrow.due_date);
        const isOverdue = returnDate > dueDate;
        const daysLate = isOverdue ? Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24)) : 0;
        const lateFee = daysLate * 1.0; // 1 currency per day late fee

        try {
             // Mark borrow record as returned
            const updatedBorrowRecord = await markBorrowRecordAsReturned(activeBorrow.id);

            // Update book available copies
            await updateBookById(parseInt(bookId), {
                available_copies: book.available_copies + 1,
                status: 'Available' // Book becomes available again
            });

            // Get updated book info
            const updatedBook = await findBookById(parseInt(bookId));

            const responseData = {
                borrow_record: updatedBorrowRecord,
                book: {
                    id: updatedBook.id,
                    title: updatedBook.title,
                    isbn: updatedBook.isbn,
                    available_copies: updatedBook.available_copies,
                    status: updatedBook.status
                },
                return_details: {
                    borrowed_date: activeBorrow.borrow_date,
                    due_date: activeBorrow.due_date,
                    returned_date: returnDate.toISOString(),
                    is_overdue: isOverdue,
                    days_late: daysLate,
                    late_fee: lateFee
                }
            };

            const statusCode = isOverdue ? 200 : 200; // You might want to use different codes
            const message = isOverdue 
                ? `Book returned successfully. Late fee: $${lateFee} (${daysLate}  // Mark borrow record as returned days late)`
                : 'Book returned successfully';

            res.status(statusCode).json({
                success: true,
                message,
                data: responseData
            });

        } catch (error) {
            console.error('Error during return operation:', error);
            throw error;
        }

    } catch (error) {
        console.error('Error returning book:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

const getAllBorrowRecord = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            user_id,
            book_id,
            status,
            overdue_only = 'false'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const options = {
            limit: parseInt(limit),
            offset,
            overdue_only: overdue_only === 'true'
        };

        if (user_id) options.user_id = parseInt(user_id);
        if (book_id) options.book_id = parseInt(book_id);
        if (status) options.status = status;

        const borrowRecords = await findAllBorrowRecords(options);

        const filters = { overdue_only: overdue_only === 'true' };
        if (user_id) filters.user_id = parseInt(user_id);
        if (book_id) filters.book_id = parseInt(book_id);
        if (status) filters.status = status;

        const totalRecords = await countBorrowRecords(filters);
        const totalPages = Math.ceil(totalRecords / parseInt(limit));

        await updateOverdueBorrowRecords();

        res.status(200).json({
            success: true,
            message: 'Borrow records retrieved successfully',
            data: borrowRecords,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalRecords,
                items_per_page: parseInt(limit),
                has_next: parseInt(page) < totalPages,
                has_prev: parseInt(page) > 1
            },
            filters: {
                user_id: user_id ? parseInt(user_id) : null,
                book_id: book_id ? parseInt(book_id) : null,
                status: status || null,
                overdue_only: overdue_only === 'true'
            }
        });
        
    } catch (error) {
        console.error('Error fetching borrow records:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

const getUserBorrowRecord = async (req, res) => {
    try {
        const { id: userId } = req.params;
        const {
            page = 1,
            limit = 10,
            status,
        } = req.query;

        if ( !userId || isNaN(userId) ) {
            return res.status(400).json({
                success: false,
                message: 'Valid user ID is required'
            });
        }

        const user = await findUserById(parseInt(userId));
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if ( req.user.role !== 'Admin' && req.user.role !== 'Librarian' && req.user.id !== parseInt(userId) ) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own borrow records'
            });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const options = {
            limit: parseInt(limit),
            offset,
            user_id: parseInt(userId)
        };

        if (status) {
            options.status = status;
        }

        const borrowRecords = await findAllBorrowRecords(options);

        // Get total count
        const totalRecords = await countBorrowRecords({ user_id: parseInt(userId), status });
        const totalPages = Math.ceil(totalRecords / parseInt(limit));

        // Get user statistics
        const activeBorrows = await getUserActiveBorrowedCount(parseInt(userId));

        res.status(200).json({
            success: true,
            message: 'User borrow records retrieved successfully',
            data: {
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    active_borrows: activeBorrows
                },
                records: borrowRecords,
                statistics: {
                    total_borrows: totalRecords,
                    active_borrows: activeBorrows,
                    can_borrow_more: await canUserBorrowMore(parseInt(userId))
                }
            },
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalRecords,
                items_per_page: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user borrow records:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

const getOverdueRecords = async (req, res) => {
	try {
		const { page = 1, limit = 20 } = req.query;

		// Calculate offset
		const offset = (parseInt(page) - 1) * parseInt(limit);

		// Update overdue status first
		const updatedCount = await updateOverdueBorrowRecords();
		console.log(`Updated ${updatedCount} records to overdue status`);

		// Get overdue records
		const overdueRecords = await getOverdueBorrowRecords({
			limit: parseInt(limit),
			offset,
		});

		// Get total count
		const totalOverdue = await countBorrowRecords({ overdue_only: true });
		const totalPages = Math.ceil(totalOverdue / parseInt(limit));

		res.status(200).json({
			success: true,
			message: "Overdue records retrieved successfully",
			data: overdueRecords,
			pagination: {
				current_page: parseInt(page),
				total_pages: totalPages,
				total_items: totalOverdue,
				items_per_page: parseInt(limit),
			},
			summary: {
				total_overdue_books: totalOverdue,
				updated_records: updatedCount,
			},
		});
	} catch (error) {
		console.error("Error fetching overdue records:", error.message);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error.message,
		});
	}
};

// Extend due date - POST /borrow-records/:id/extend
const extendDueDate = async (req, res) => {
	try {
		const { id: recordId } = req.params;
		const { extension_days = 7 } = req.body;

		// Validate record ID
		if (!recordId || isNaN(recordId)) {
			return res.status(400).json({
				success: false,
				message: "Valid borrow record ID is required",
			});
		}

		// Get borrow record
		const borrowRecord = await findBorrowRecordById(parseInt(recordId));
		if (!borrowRecord) {
			return res.status(404).json({
				success: false,
				message: "Borrow record not found",
			});
		}

		// Authorization: only allow user to extend their own records, or admin/librarian
		if (
			req.user.role !== "Admin" &&
			req.user.role !== "Librarian" &&
			req.user.id !== borrowRecord.user_id
		) {
			return res.status(403).json({
				success: false,
				message: "Access denied. You can only extend your own borrow records",
			});
		}

		// Check if book is already returned
		if (borrowRecord.return_date) {
			return res.status(400).json({
				success: false,
				message: "Cannot extend due date for returned book",
			});
		}

		// Calculate new due date
		const currentDueDate = new Date(borrowRecord.due_date);
		const newDueDate = new Date(currentDueDate);
		newDueDate.setDate(newDueDate.getDate() + parseInt(extension_days));

		// Extend due date
		const updatedRecord = await extendBorrowRecordDueDate(
			parseInt(recordId),
			newDueDate
		);

		res.status(200).json({
			success: true,
			message: "Due date extended successfully",
			data: {
				borrow_record: updatedRecord,
				extension: {
					previous_due_date: currentDueDate.toISOString(),
					new_due_date: newDueDate.toISOString(),
					extension_days: parseInt(extension_days),
				},
			},
		});
	} catch (error) {
		console.error("Error extending due date:", error.message);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error.message,
		});
	}
};

// Get borrowing statistics - GET /borrow-records/statistics
const getBorrowingStats = async (req, res) => {
	try {
		// Only admin and librarian can view statistics
		if (req.user.role !== "Admin" && req.user.role !== "Librarian") {
			return res.status(403).json({
				success: false,
				message: "Access denied. Admin or Librarian role required",
			});
		}

		const stats = await getBorrowingStatistics();

		res.status(200).json({
			success: true,
			message: "Borrowing statistics retrieved successfully",
			data: {
				...stats,
				generated_at: new Date().toISOString(),
			},
		});
	} catch (error) {
		console.error("Error fetching borrowing statistics:", error.message);
		res.status(500).json({
			success: false,
			message: "Internal server error",
			error: error.message,
		});
	}
};

module.exports = {
	borrowBook,
	returnBook,
	getAllBorrowRecord,
	getUserBorrowRecord,
	getOverdueRecords,
	extendDueDate,
	getBorrowingStats,
};