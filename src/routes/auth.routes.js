const express = require('express');
const rate = require('express-rate-limit');

const { 
    signUp,
    register,
    signIn,
    login,
    signOut,
    googleAccount,
 } = require('../controllers/auth.controllers');

const authRouter = express.Router();

authRouter.get('/sign-up', signUp); //page
authRouter.post("/sign-up", register); //create user
authRouter.get("/sign-in", signIn); //page
authRouter.post("/sign-in", login); //login user

authRouter.post('/sign-up/google', googleAccount);
authRouter.post('/sign-in/google', googleAccount);


authRouter.post("/signOut", signOut);

module.exports = authRouter;