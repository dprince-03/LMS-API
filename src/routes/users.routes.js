const express = require('express');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser } = require('../controllers/users.controllers');

const userRouter = express.Router();

// Define routes for user management Admin only
userRouter.get('/user', getAllUsers); // Retrieve all users (Admin).
userRouter.get('/user/:id', getUserById); // Retrieve specific user by ID (Admin).
userRouter.post('/user', createUser); // Create a new user - Libarian (Admin).
userRouter.put('/user/:id', updateUser); // Update a user by ID (Admin).
userRouter.delete('/user/:id', deleteUser); // Delete a user by ID (Admin).

module.exports = userRouter;