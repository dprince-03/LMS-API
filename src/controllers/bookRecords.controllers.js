const { 
    findBookById, 
    updateBookById,
} = require("../models/books.model");

const { 
    findActiveBorrowRecord, 
    createBorrowRecord, 
    findAllBorrowRecords,
    updateOverdueBorrowRecords,
} = require("../models/borrowedRecords.model");

const { 
    canUserBorrowMore, 
    getUserActiveBorrowedCount 
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

const getAllBorrowRecords = async (req, res) => {
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