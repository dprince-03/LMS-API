const {
    createAuthor,
    findAllAuthors,
    findAuthorById,
    findAuthorByEmail,
    updateAuthor,
    deleteAuthorById,
    getBooksByAuthorId,
    countAuthors,

} = require('../models/authors.model');

const createAuthorController = async (req, res) => {
    try {
        const {first_name, last_name, image, date_of_birth, biography, phone, email} = req.body;

        if (!first_name || !last_name || !email) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, and email are required.',
            });
        }

        if (email) {
            const existingAuthor = await findAuthorByEmail(email);
            if (existingAuthor) {
                return res.status(409).json({
                    success: false,
                    message: 'An author with this email already exists.',
                });
            }
        }

        const authorData = {
            first_name,
            last_name,
            image: image || null,
            date_of_birth: date_of_birth || null,
            biography: biography || null,
            phone: phone || null,
            email,
        };

        const newauthor = await createAuthor(authorData);

        return res.status(201).json({
            success: true,
            message: 'Author profile created successfully.',
            data: newauthor,
        });

    } catch (error) {
        console.error(` Error in createAuthor controller: ${error.message} `);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while creating the author profile.',
            error: error.message,
        });
    }
};

const getAllAuthors = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            sort_by = 'created_at',
            order = 'desc',
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const authors = await findAllAuthors({
            limit: parseInt(limit),
            offset,
            search,
            sort_by,
            order,
        });

        const totalAuthors = await countAuthors(search);
        const totalPages = Math.ceil(totalAuthors / parseInt(limit));

        return res.status(200).json({
            success: true,
            message: 'Authors fetched successfully.',
            data: authors,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalAuthors,
                items_per_page: parseInt(limit),
                has_next: parseInt(page) < totalPages,
                has_previous: parseInt(page) > 1,
            },
        });

    } catch (error) {
        console.error(` Error fetching authors: ${error.message} `);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.',
            error: error.message,
        });
    }
};

const getAuthorById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid author ID. \nValid author ID is requried',
            });
        }

        const author = await findAuthorById(id);

        if (!author) {
            return res.status(404).json({
                success: false,
                message: 'Author not found.',
            });
        }

        const includeBooks = req.query.include_books === 'true';
        const authorData = author;

        if (includeBooks) {
            const books = await getBooksByAuthorId(id);
            authorData = {
                ...author,
                books,
                books_count: books.length,
            }
        }

        res.status(200).json({
            success: true,
            message: 'Author fetched successfully.',
            data: authorData,
        });

    } catch (error) {
        console.error(` Error fetching author: ${error.message} `);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.',
            error: error.message,
        });
    }
};

const updateAuthorById = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid author ID. \nValid author ID is requried',
            });
        }

        const existingAuthor = await findAuthorById(parseInt(id));
        if (!existingAuthor) {
            return res.status(404).json({
                success: false,
                message: 'Author not found.',
            });
        }

        if (updateData.email && updateData.email !== existingAuthor.email) {
            const emailExists = await findAuthorByEmail(updateData.email);
            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Another author with this email already exists.',
                });
            }
        }

        const filteredData = {};
        Object.keys(updateData).forEach(key => {
            if ( updateData[key] !== undefined && updateData[key] !== null ) {
                filteredData[key] = updateData[key];
            }
        });

        if (Object.keys(filteredData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided for update.',
            });
        }

        const updateAuthorById = await updateAuthor(parseInt(id), filteredData);

        res.status(200).json({
            success: true,
            message: 'Author updated successfully.',
            data: updateAuthorById,
        });

    } catch (error) {
        console.error(` Error updating author: ${error.message} `);
        return res.status(500).json({
            success: false,
            message: 'Internal server error.',
            error: error.message,
        });
    }
};

const deleteAuthorByIdController = async (req, res) => {
    try {
        const { id } = req.params;

        if ( !id || isNaN(id) ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid author ID. \nValid author ID is requried',
            });
        }

        const existingAuthor = await findAuthorById(parseInt(id));
        if ( !existingAuthor ) {
            return res.status(404).json({
                success: false,
                message: 'Author not found.',
            });
        }

        const authorBooks = await getBooksByAuthorId(parseInt(id));
        if ( authorBooks.length > 0 ) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete author with associated books. \nPlease remove or reassign the books first.',
            });
        }

        
        // Delete author
        const deleted = await deleteAuthorById(parseInt(id));

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Author not found or already deleted'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Author deleted successfully.',
        });
    } catch (error) {
        console.error(` Error deleting author: ${error.message} `);
        res.status(500).json({
            success: false,
            message: 'Internal server error.',
            error: error.message,
        });
    }
};

module.exports = {
    createAuthorController,
    getAllAuthors,
    getAuthorById,
    updateAuthorById,
    deleteAuthorByIdController,
};