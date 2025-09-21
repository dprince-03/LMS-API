const bcrypt = require('bcrypt');
const { query, queryWithTransaction } = require("../config/database.config");

// Function to create a new user
const createUser = async (userData) => {};

// Function to find all users with optional pagination and filters
const findAllUsers = async (options = {}) => {};

// Function to get a user by ID
const findUserById = async (id) => {};

// Function to find users by username
const findUsersByUsername = async (username) => {};

// Function to find a user by email
const findUserByEmail = async (email) => {};

// Function to find a user by Email or Username (for login)
const findUserByEmailOrUsername = async (identifier) => {};

// Function to update a user by ID
const updateUserById = async (id, updateData) => {};

// Function to delete a user by ID
const deleteUserById = async (id) => {};

// Function to hard delete a user by ID (permanent deletion)
const hardDeleteUserById = async (id) => {};

// Function to update last login
const updateLastLogin = async (id) => {};

// Funtion to get borrowed records for a user
const getUserBorrowedRecords = async (userId) => {};

// Get active borrowed books count
const getActiveBorrowedBooksCount = async (userId) => {};

// Check if user can borrow more books
const canUserBorrowMoreBooks = async (userId, maxBooks = 5) => {};

// Get overdue borrowed books
const getOverdueBorrowedBooks = async (userId) => {};

// Count total users
const countUsers = async (filters = {}) => {};

// Check user role functions
const isUserAdmin = (userData) => {};
const isUserLibrarian = (userData) => {};
const isUserMember = (userData) => {};

// Get user full name
const getUserFullName = (userData) => {};

// Format user data and add computed properties
const formatUser = (userData) => {};

// Format user for public display (less sensitive data)
const formatUserPublic = (userData) => {};

module.exports ={};