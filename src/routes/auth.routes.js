const express = require('express');

const { 
    register,
    login,
    signOut,
 } = require('../controllers/auth.controllers');

const authRouter = express.Router();

authRouter.post("/auth/register", register); // create user
authRouter.post("/auth/login", login); // login user
authRouter.post("/signOut", signOut); // sign out user

module.exports = authRouter;