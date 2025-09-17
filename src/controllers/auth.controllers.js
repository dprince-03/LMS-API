const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// @desc    Register new user
// @access  Public
// user registration routes
const signUp = (req, res) => {
    res.send('Sign Up Page');
    res.status(200).json({
        status: 'success',
        message: 'Sign Up Page',
    });
};

const register = async (req, res) => {
    try {
        const { firstName, lastName, username, email, password} = req.body;
        
        if ( !firstName || !lastName || !username || !email || !password ) {
            return res.status(400).json({ 
                error: true,
                message: 'All fields are required !',
            });
        }
    
        // hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log(req.body);       
    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(400).json({
            status: 'fail',
            message: 'Unable to register user',
        });
    }
};

const signIn = async (req, res) => {
    res.send('Sign In Page');
    res.status(200).json({
        status: 'success',
        message: 'Sign In Page',
    });
};

const login = async (req, res) => {
    
    try {
        const { email , password } = req.body;
    
        if (!email || !password) {
            res.status(400).json({
                error: true,
                message: 'All fields are required !',
            });
        }
    
        console.log(req.body);
        return res.status(200).json({
            status: 'success',
            message: 'Login successful',
        });        
    } catch (error) {
        console.error("Error logging in user:", error);
        return res.status(400).json({
            status: 'fail',
            message: 'Unable to login user',
        });
    }
};

const googleAccount = async (req, res) => {};

// @desc    Logout user
// @route   POST
// @access  Public
const signOut = (req, res) => {
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
        }
        
    } catch (error) {
        console.error("Error signing up user:", error);
        return res.status(400).json({
            status: 'fail',
            message: 'Unable to sign out user',
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