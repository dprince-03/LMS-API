const express = require('express');

const { 
    register,
    login,
    signOut,
 } = require('../controllers/auth.controllers');

const authRouter = express.Router();

authRouter.post("auth/sign-up", register); // create user
authRouter.post("auth/sign-in", login); // login user
authRouter.post("/signOut", signOut); // sign out user

module.exports = authRouter;