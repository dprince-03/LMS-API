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
            launguage,
            pages,
            publisher,
            available_copies,
            total_copies,
            status,
        } = req.body;

        if (!isbn || !title || !author_id) {
            return res.status(400).json({
                success: false,
                message: 'ISBN, Title and Author ID is required',
            });
        }

        const existingBook = await findBookByISBN(isbn);
        if (existingBook) {
            return res.status(404).json({
                success: false,
                message: 'book with this ISBN lready exist'
            });
        }

        const author = await findAuthorById(author_id);
        if (!author) {
            return res.status(404).json({
                success: false,
                message: 'Author not found !!!',
            });
        }

        const totalCopies = parseInt(total_copies) || 0;
        const availableCopies = parseInt(available_copies) || totalCopies;

        if (availableCopies > totalCopies) {
            return res.status(400).json({
                success: false,
                message: 'Available copies cannot exceed total copies'
            });
        }

        const bookData = {
            isbn,
            title,
            author_id,
            published_date,
            description,
            cover_image,
            genre,
            launguage,
            pages: pages ? parseInt(pages) : null,
            publisher,
            available_copies: availableCopies,
            total_copies: totalCopies,
            status: status || 'Available'
        };

        const newBook = await createBook(bookData);

        res.status(200).json({
            success: true,
            message: 'Book created successfully',
            data: newBook
        });

    } catch (error) {
        console.error(`Error creating book: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            data: error.message,
        });
    }
};

const getAllBooks = async (req, res) => {
    try {
        const { 
            page = 1,
            limit = 10,
            search = '',
            author_id,
            genre,
            status
        } = req.query;

        const offset = ( parseInt(page) - 1 ) * parseInt(limit);

        const options = {
            limit: parseInt(limit),
            offset,
            search
        }

        if (author_id) {
            options.author_id = parseInt(author_id);
        }
        if (genre) {
            options.genre = genre;
        }
        if (status) {
            options.status = status;
        }

        const books = await findAllBooks(options);

        const filters = { search };
        if (author_id) {
            filters.author_id = parseInt(author_id);
        }
        if (genre) {
            filters.genre = genre;
        }
        if (status) {
            filters.status = status;
        }

        const totalBooks = await countBooks(filters);
        const totalPages = Math.ceil( totalBooks / parseInt(limit));

        res.status(200).json({
			success: true,
			message: "Books retrieved successfully",
            data: books,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalBooks,
                items_per_page: parseInt(limit),
                has_next: parseInt(page) < totalPages,
                has_prev: parseInt(page) > 1
            },
            filters: {
                search: search || null,
                author_id: author_id ? parseInt(author_id) : null,
                genre: genre || null,
                status: status || null
            },
        });


    } catch (error) {
        console.error(`Error fetching books: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

const getBooksById = async (req, res) => {
    try {
        const { id } = req.params;

        if ( !id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid book ID is required'
            });
        }

        const book = await findBookById(parseInt(id));

        if ( !book ) {
            return res.status(404).json({
                success: false,
                message: 'Book not found'
            });
        }

        const includeAuthor = req.query.include_author === true;
        const includeBorrows = req.query.include_borrows === true;

        let bookData = book;

        if ( includeAuthor ) {
            const author = await getBookAuthor(book.id);
            bookData = {
                ...bookData,
                author_details: author
            };
        }

        if ( includeBorrows ) {
            const borrowRecords = await getBookBorrowRecords(book.id);
            bookData = {
                ...bookData,
                borrow_records: borrowRecords,
                total_Borrows: borrowRecords.length,
            }
        }

        res.status(200).json({
            success: true,
            message: 'Book retrieved successfully',
            data: bookData,
        });


    } catch (error) {
        console.error(`Error fetching books: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

const updateBooksById = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if ( !id || isNaN(id) ) {
            return res.status(400).json({
                success: false,
                message: 'Valid book ID is required',
            });
        }

        const existingBook = await findAuthorById(parseInt(id));
        if ( !existingBook ) {
            return res.status(404).json({
                success: false,
                message: ' Book not found',
            });
        }

        if ( updateData.isbn && updateData.isbn !== existingBook.isbn ) {
            const isbnExist = await findBookByISBN(updateData.isbn);
            if ( isbnExist ) {
                return res.status(409).json({
                    success: false,
                    message: 'ISBN is already taken by another book'
                });
            }
        }

        if ( updateData.author_id ) {
            const author = await findBookById(updateData.author_id);
            if ( !author ) {
                return res.status(404).json({
                    success: false,
                    messeage: 'Author not found',
                });
            }
        }

        const totalCopies = updateData.total_copies ? parseInt(updateData.total_copies) : existingBook.total_copies;
        const availableCopies = updateData.available_copies !== undefined ? parseInt(updateData.available_copies) : existingBook.available_copies;

        if ( availableCopies > totalCopies ) {
            return res.status(400).json({
                success: false,
                message: 'Available copies cannot exceed total copies',
            });
        }

        const filteredData = {};
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && updateData[key] !== null) {
                // Convert numeric fields
                if (['pages', 'available_copies', 'total_copies', 'author_id'].includes(key)) {
                    filteredData[key] = parseInt(updateData[key]);
                } else {
                    filteredData[key] = updateData[key];
                }
            }
        });

        if (Object.keys(filteredData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        const updatedBook = await updateBookById(parseInt(id), filteredData);

        res.status(200).json({
            success: true,
            message: 'Book updated successfully',
            data: updatedBook
        });


    } catch (error) {
        console.error(`Error fetching books: ${error.message}`);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};

const deleteBooksById = async (req, res) => {
    try {
        const { id } = req.params;

        if ( !id || isNaN(id) ) {
            return res.status(400).json({
                success: false,
                message: 'Valid book ID is required'
            });
        }

        const existingBook = await findBookById(parseInt(id));
        if ( !existingBook ) {
            return res.status(404).json({
                success: false,
                message: 'Book not found'
            });
        }

        const borrowedRecords = await getBookBorrowRecords(parseInt(id));
        const activeBorrows = borrowRecords.filter(
            record => record.is_active
        );

        if (activeBorrows.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete book. Book has ${activeBorrows.length} active borrow(s)`,
                active_borrows: activeBorrows.length
            });
        }

        const deleted = await deleteBookById(parseInt(id));
        if ( !deleted ) {
            return res.status(404).json({
                success: false,
                message: 'Book not found or already deleted'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Book successfully deleted',
        });

        
    } catch (error) {
        console.error('Error deleting book:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
const borrowBooks = async (req, res) => {};
const returnBooks = async (req, res) => {};

module.exports = {
    createBooks,
    getAllBooks,
    getBooksById,
    updateBooksById,
    deleteBooksById,
    borrowBooks,
    returnBooks,
};