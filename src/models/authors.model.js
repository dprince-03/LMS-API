const { query, queryWithTransaction } = require('../config/database.config');

// Function to create a new author
const createAuthor = async (authorData) => {
    try {
        const sql = ``;

        const params = [];

        const result = await query(sql, params);

        return await getAuthorById(result.insertId);
    } catch (error) {
        throw new Error(`Error creating author: ${error.message}`);
    }
};

// find all authors
const findAllAuthors = async (options = {}) => {
    try {
        const { limit = 10, offset = 0, search = '' } = options;

        let sql = '';

        let params = [];

        if ( search ) {
            sql += ``;
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        sql += ``;
        params.push(limit, offset);

        const rows = await query(sql, params);
        
        return rows.map(formatAuthor);
    } catch (error) {
        throw new Error(`Error fetching authors: ${error.message}`);
    }
};

// Function to get an author by ID
const findAuthorById = async (id) => {
    try {
        const sql = ``;

        const rows = await query(sql, [id]);

        if ( rows.length === 0 ) {
            return null;
        }

        return formatAuthor(rows[0]);
    } catch (error) {
        throw new Error(`Error fetching author by ID: ${error.message}`);
    }
};

// Find author by email
const findAuthorByEmail = async (email) => {
    try {
        const sql = ``;

        const rows = await query(sql, [email]);

        return rows.lemgth > 0 ? formatAuthor( rows[0] ) : null;
    } catch (error) {
        throw new Error(`Error fetching author by email: ${error.message}`);
    }
}

// Function to update an author
const updateAuthor = async (id, updateData) => {
    try {
        const fields = [];

        const params = [];

        // Dynamically build the SQL query based on provided fields
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined && key !== 'id') {
                fields.push( ` ${key} = ? ` );
                params.push( updateData[key] );
            }
        });

        if (fields.length === 0) {
            throw new Error("No fields to update");            
        }

        params.push(id);

        const sql = ``;

        await query(sql, params);

        return await findAuthorById(id);
    } catch (error) {
        throw new Error(`Error updating author: ${error.message}`);
    }
};

// delete an author
const deleteAuthorById = async (id) => {
    try {
        const sql = ``;

        const result = await query(sql, [id]);

        return result.affectedRows > 0;
    } catch (error) {
        throw new Error(`Error deleting author: ${error.message}`);
    }
};

// Get books by author ID
const getBooksByAuthorId = async (authorId) => {try {
    const sql = ``;

    const rows = await query(sql, [authorId]);

    const { formatBook } = require('./books.model');
    return rows.map(formatBook);
} catch (error) {
    
}};

// Count total authors
const countAuthors = async (search = '') => {
    try {
        let sql = ``;
        let params = [];

        if( search ) {
            sql += ``;
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        const rows = await query(sql, params);
        return rows[0].total;
    } catch (error) {
        throw new Error(`Error counting authors: ${error.message}`);
    }
};

// Format author object and add computed properties
const formatAuthor = (authorData) => {
    if (!authorData) {
        return null;
    }

    return {};
};

module.exports ={
    createAuthor,
    findAllAuthors,
    findAuthorById,
    findAuthorByEmail,
    updateAuthor,
    deleteAuthorById,
    getBooksByAuthorId,
    countAuthors,
    formatAuthor,
};