const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const signUp = async (req, res) => {
    res.send('Sign Up Page');
    res.status(200).json({
        status: 'success',
        message: 'Sign Up Page',
    });
};

const register = async (req, res) => {
    const { firstName, lastName, username, email, password} = req.body;
    
    if ( !firstName || !lastName || !username || !email || !password ) {
        return res.status(400).json({ 
            error: true,
            message: 'All fields are required !',
        });
    }


};

const signIn = async (req, res) => {};

const login = async (req, res) => {};

const googleAccount = async (req, res) => {};

const signOut = async (req, res) => {
    try {
        const clearCookie = () => { 
            res.cookie('jwt', 'loggedOut', {
                expires: new Date(Date.now() + 10 + 1000),
                httpOnly: true,
                secure: { [req.secure|| req.headers[ 'x-forwarded-pronto' ] === 'https' ] : true },
                sameSite: 'strict',
            });
        };
    
        if (clearCookie) {
            res.status(200).json({
                status: 'success',
                message: 'User signed out successfully',
            });
        } else {
            res.status(400).json({
                status: 'fail',
                message: 'Unable to sign out user',
            });
        }
        
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
    
};

module.exports = {
    signUp,
    register,
    signIn,
    login,
    signOut,
    googleAccount,
};