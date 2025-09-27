const express = require('express');

const { 
    createBooks,
    getAllBooks,
    getBooksById,
    updateBooksById,
    deleteBooksById,
    borrowBooks,
    returnBooks,
} = require('../controllers/books.controllers');

const bookRouter = express.Router();

bookRouter.post("/books/profile", createBooks); // Create a book (Admin/Librarian).
bookRouter.get('/books', getAllBooks); // Retrieve all books.
bookRouter.get("/books/:id", getBooksById); // Retrieve specific book by ID.
bookRouter.put("/books/:id", updateBooksById); // Update a book by ID (Admin/Librarian).
bookRouter.delete("/books/:id", deleteBooksById); // Delete a book by ID (Admin).
bookRouter.post("/books/:id/borrow", borrowBooks); // Borrow a book (Member, if available).
bookRouter.post("/books/:id/return", returnBooks);  // Return a borrowed book (Member).

module.exports = bookRouter;