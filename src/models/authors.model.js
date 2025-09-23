const { query, queryWithTransaction } = require('../config/database.config');
const { formatBook } = require("./books.model");

// Function to create a new author
const createAuthor = async (authorData) => {
    try {
        const sql = `
            INSERT INTO authorS (first_name, last_name, image, date_of_birth, biography, phone, email)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            authorData.first_name,
            authorData.last_name,
            authorData.image || null,
            authorData.date_of_birth || null,
            authorData.biography || null,
            authorData.phone || null,
            authorData.email || null,
        ];

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

        let sql = 'SELECT * FROM  authors';

        let params = [];

        if ( search ) {
            sql += ` WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? `;
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ? `;
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
        const sql = ` SELECT * FROM authors WHERE id = ? `;

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
        const sql = ` SELECT * FROM authors WHERE email = ? `;

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

        const sql = ` UPDATE authors SET ${fields.join(', ')} WHERE id = ? `;

        await query(sql, params);

        return await findAuthorById(id);
    } catch (error) {
        throw new Error(`Error updating author: ${error.message}`);
    }
};

// delete an author
const deleteAuthorById = async (id) => {
    try {
        const sql = ` DELETE FROM authors WHERE id = ? `;

        const result = await query(sql, [id]);

        return result.affectedRows > 0;
    } catch (error) {
        throw new Error(`Error deleting author: ${error.message}`);
    }
};

// Get books by author ID
const getBooksByAuthorId = async (authorId) => {try {
    const sql = ` SELECT * FROM books WHERE author_id = ? `;

    const rows = await query(sql, [authorId]);

    return rows.map(formatBook);
} catch (error) {
    throw new Error("Error fetching books by author ID: ${error.message}");    
}};

// Count total authors
const countAuthors = async (search = '') => {
    try {
        let sql = ` SELECT COUNT(*) AS total FROM authors `;
        let params = [];

        if( search ) {
            sql += ` WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? `;
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

    return {
        id: authorData.id,
        first_name: authorData.first_name,
        last_name: authorData.last_name,
        full_name: `${authorData.first_name} ${authorData.last_name}`.trim(),
        image: authorData.image,
        date_of_birth: authorData.date_of_birth,
        biography: authorData.biography,
        phone: authorData.phone,
        email: authorData.email,
        created_at: authorData.created_at,
        updated_at: authorData.updated_at,
    };
};

module.exports = {
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