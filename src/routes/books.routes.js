const express = require('express');

const bookRouter = express.Router();

bookRouter.get('/books'); // Retrieve all books.
bookRouter.get("/books/:id"); // Retrieve specific book by ID.
bookRouter.post("/books"); // Create a book (Admin/Librarian).
bookRouter.put("/books/:id"); // Update a book by ID (Admin/Librarian).
bookRouter.delete("/books/id"); // Delete a book by ID (Admin).
bookRouter.post("/books/:id/borrow"); // Borrow a book (Member, if available).
bookRouter.post("/books/:id/return");  // Return a borrowed book (Member).

module.exports = bookRouter;