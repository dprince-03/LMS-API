const {
	createAuthor,
	findAllAuthors,
	findAuthorById,
	findAuthorByEmail,
	updateAuthor,
	deleteAuthorById,
	getBooksByAuthorId,
	countAuthors,
} = require("../models/authors.model");
const logger = require("../utils/logger");
const SimpleCache = require("../utils/cache");

const authorsCache = new SimpleCache(parseInt(process.env.AUTHORS_CACHE_TTL_SECONDS) || 30);

const createAuthorController = async (req, res) => {
	try {
		const { first_name, last_name, image, date_of_birth, biography, phone, email } = req.body;

		const existingAuthor = await findAuthorByEmail(email);
		if (existingAuthor) {
			return res.status(409).json({
				success: false,
				message: "An author with this email already exists.",
			});
		}

		const newAuthor = await createAuthor({
			first_name,
			last_name,
			image: image || null,
			date_of_birth: date_of_birth || null,
			biography: biography || null,
			phone: phone || null,
			email,
		});

		authorsCache.clear();

		return res.status(201).json({
			success: true,
			message: "Author profile created successfully.",
			data: newAuthor,
		});
	} catch (error) {
		logger.error({ err: error }, "Error creating author");
		return res.status(500).json({
			success: false,
			message: "An error occurred while creating the author profile.",
		});
	}
};

const getAllAuthors = async (req, res) => {
	try {
		const {
			page = 1,
			limit = 10,
			search = "",
			sort_by = "created_at",
			order = "desc",
		} = req.query;

		const cacheKey = req.originalUrl;
		const cached = authorsCache.get(cacheKey);
		if (cached) {
			return res.status(200).json(cached);
		}

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

		const responseBody = {
			success: true,
			message: "Authors fetched successfully.",
			data: authors,
			pagination: {
				current_page: parseInt(page),
				total_pages: totalPages,
				total_items: totalAuthors,
				items_per_page: parseInt(limit),
				has_next: parseInt(page) < totalPages,
				has_previous: parseInt(page) > 1,
			},
		};

		authorsCache.set(cacheKey, responseBody);
		return res.status(200).json(responseBody);
	} catch (error) {
		logger.error({ err: error }, "Error fetching authors");
		return res.status(500).json({
			success: false,
			message: "Internal server error.",
		});
	}
};

const getAuthorById = async (req, res) => {
	try {
		const { id } = req.params;

		if (!id || isNaN(id)) {
			return res.status(400).json({
				success: false,
				message: "Valid author ID is required",
			});
		}

		const author = await findAuthorById(id);
		if (!author) {
			return res.status(404).json({
				success: false,
				message: "Author not found.",
			});
		}

		const includeBooks = req.query.include_books === "true";
		let authorData = author;

		if (includeBooks) {
			const books = await getBooksByAuthorId(id);
			authorData = {
				...author,
				books,
				books_count: books.length,
			};
		}

		res.status(200).json({
			success: true,
			message: "Author fetched successfully.",
			data: authorData,
		});
	} catch (error) {
		logger.error({ err: error }, "Error fetching author");
		return res.status(500).json({
			success: false,
			message: "Internal server error.",
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
				message: "Valid author ID is required",
			});
		}

		const existingAuthor = await findAuthorById(parseInt(id));
		if (!existingAuthor) {
			return res.status(404).json({
				success: false,
				message: "Author not found.",
			});
		}

		if (updateData.email && updateData.email !== existingAuthor.email) {
			const emailExists = await findAuthorByEmail(updateData.email);
			if (emailExists) {
				return res.status(409).json({
					success: false,
					message: "Another author with this email already exists.",
				});
			}
		}

		const updatedAuthor = await updateAuthor(parseInt(id), updateData);
		authorsCache.clear();

		res.status(200).json({
			success: true,
			message: "Author updated successfully.",
			data: updatedAuthor,
		});
	} catch (error) {
		logger.error({ err: error }, "Error updating author");
		return res.status(500).json({
			success: false,
			message: "Internal server error.",
		});
	}
};

const deleteAuthorByIdController = async (req, res) => {
	try {
		const { id } = req.params;

		if (!id || isNaN(id)) {
			return res.status(400).json({
				success: false,
				message: "Valid author ID is required",
			});
		}

		const existingAuthor = await findAuthorById(parseInt(id));
		if (!existingAuthor) {
			return res.status(404).json({
				success: false,
				message: "Author not found.",
			});
		}

		const authorBooks = await getBooksByAuthorId(parseInt(id));
		if (authorBooks.length > 0) {
			return res.status(409).json({
				success: false,
				message:
					"Cannot delete author with associated books. Please remove or reassign the books first.",
			});
		}

		const deleted = await deleteAuthorById(parseInt(id));
		if (!deleted) {
			return res.status(404).json({
				success: false,
				message: "Author not found or already deleted",
			});
		}

		authorsCache.clear();

		res.status(200).json({
			success: true,
			message: "Author deleted successfully.",
		});
	} catch (error) {
		logger.error({ err: error }, "Error deleting author");
		res.status(500).json({
			success: false,
			message: "Internal server error.",
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
