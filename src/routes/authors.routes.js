const express = require('express');

const { 
    createAuthorController,
    getAllAuthors,
    getAuthorById,
    updateAuthorById,
    deleteAuthorByIdController,
} = require('../controllers/authors.controllers');

const authorRouter = express.Router();

authorRouter.post('/author/create-profile', createAuthorController);
authorRouter.get('/author', getAllAuthors);
authorRouter.get('/author/:id', getAuthorById);
authorRouter.put('/author/:id', updateAuthorById);
authorRouter.delete('/author/:id', deleteAuthorByIdController);

module.exports = authorRouter;