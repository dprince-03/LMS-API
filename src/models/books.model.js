const { query, queryWithTransaction } = require("../config/database.config");

// Function to create a new book
const createBook = async (bookData) => {};

// Function to find all books with optional pagination and filters
const findAllBooks = async (options = {}) => {};

// Function to get a book by ID
const findBookById = async (id) => {};

// Function to find books by ISBN
const findBooksByISBN = async (isbn) => {};

// Function to update a book by ID
const updateBookById = async (id, updateData) => {};

// Function to delete a book by ID
const deleteBookById = async (id) => {};

// Function to get author details for a book
const getBookAuthor = async (bookId) => {};

// Get borrow records for a book
const getBookBorrowRecords = async (bookId) => {};

// Check if a book is currently borrowed
const isBookCurrentlyBorrowed = async (bookId) => {};

// Borrow book ( decrease available copies by 1 )
const borrowBook = async (bookId, userId, dueDate) => {};

// Return book ( increase available copies by 1 )
const returnBook = async (bookId, userId) => {};

// Count total books
const countBooks = async (filters = {}) => {};

// Check if book is available for borrowing
const isBookAvailable = async (bookData) => {};

// Format book data and add computed properties
const formatBook = (bookData) => {};

module.exports ={};