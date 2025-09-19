const express = require('express');

const { 
    signUp,
    register,
    signIn,
    login,
    signOut,
    googleAccount,
 } = require('../controllers/auth.controllers');

const authRouter = express.Router();

authRouter.get('auth/sign-up', signUp); // page
authRouter.post("auth/sign-up", register); // create user
authRouter.get("auth/sign-in", signIn); // page
authRouter.post("auth/sign-in", login); // login user

authRouter.post('auth/sign-up/google', googleAccount);
authRouter.post('auth/sign-in/google', googleAccount);


authRouter.post("/signOut", signOut); // sign out user

module.exports = authRouter;