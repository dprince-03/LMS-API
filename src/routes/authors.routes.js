const express = require('express');

const { 
    createAuthor,
    getAllAuthors,
    getAuthorById,
    updateAuthorById,
    deleteAuthorById,
} = require('../controllers/authors.controllers');

const authorRouter = express.Router();

authorRouter.post('/author/create-profile', createAuthor);
authorRouter.get('/author', getAllAuthors);
authorRouter.get('/author/:id', getAuthorById);
authorRouter.put('/author/:id', updateAuthorById);
authorRouter.delete('/author/:id', deleteAuthorById);

module.exports = authorRouter;