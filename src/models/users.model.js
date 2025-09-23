// const bcrypt = require('bcrypt');
const { SearchSource } = require("jest");
const { query, queryWithTransaction } = require("../config/database.config");

// Function to create a new user
const createUser = async (userData) => {
    try {
        const sql = ``;

        const params = [];

        const result = await query(sql, params);

        return await findUserById(result.insertId);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error("User with this email or username already exists.");
        }
        throw new Error("Error creating user: ${error.message}");
    }
};

// Function to find all users with optional pagination and filters
const findAllUsers = async (options = {}) => {
    try {
        const {} = options;

        let sql = ``;

        let params = [];

        if (Search) {
            sql += ``;
            params.push(); // add role here later 
        }

        sql = ``;
        params.push(); // add limit and offset here later

        const rows = await query(sql, params);

        return rows.map(); // add formatUser here later
    } catch (error) {
        throw new Error("Error fetching users: ${error.message}");
    }
};

// Function to get a user by ID
const findUserById = async (id) => {
    try {
        const sql = ``;

        const rows = await query(sql, [id]);

        if (rows.length === 0) {
            return null;
        }

        return ; // add formatUser here later
    } catch (error) {
        throw new Error("Error fetching user by ID: ${error.message}");
    }
};

// Function to find users by username
const findUsersByUsername = async (username) => {
    try {
        const sql = ``;

        const rows = await query(sql, [username]);

        return rows.length > 0 ? formatUser() : null; // add formatUser parameter here later
    } catch (error) {
        throw new Error("Error fetching user by username: ${error.message}");
    }
};

// Function to find a user by email
const findUserByEmail = async (email) => {
    try {
        const sql = ``;

        const rows = await query(sql, [email]);

        return rows.length > 0 ? formatUser() : null; // add formatUser parameter here later
    } catch (error) {
        throw new Error("Error fetching user by email: ${error.message}");
    }
};

// Function to find a user by Email or Username (for login)
const findUserByEmailOrUsername = async (identifier) => {
    try {
        const sql = ``;

        const rows = await query(sql, [identifier, identifier]);

        return rows.length > 0 ? formatUser() : null; // add formatUser parameter here later
    } catch (error) {
        throw new Error("Error fetching user by email or username: ${error.message}");
    }
};

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