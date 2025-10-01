const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { 
    createUser,
    findUserByEmailOrUsername, 
    verifyPassword,
    updateUserLastLogin, 
} = require('../models/users.model');


function generateJWT (userId, email, role) {
    return jwt.sign(
        {
            id: userId,
            email,
            role,
        }, 
        process.env.JWT_SECRET, 
        {
            expiresIn: process.env.JWT_EXPIRE || '7d',
        }
    );
}

// @desc    Register new user
// @access  Public
// user registration routes
const register = async (req, res) => {
    try {
        const { 
            first_name, 
            last_name, 
            user_name,
            phone,
            email, 
            password,
            image_url, 
        } = req.body;
        
        if ( !first_name || !last_name || !user_name || !email || !password ) {
            return res.status(400).json({ 
                error: true,
                message: 'All fields are required !',
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if ( !emailRegex.test(email) ) {
            return res.status(400).json({
                success: false, 
                message: 'Invalid email format',
            });
        }

        if ( password.length < 8 ) {
            res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long',
            });
        }

        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);

        if ( !hasUpperCase || !hasLowerCase || !hasNumber ) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
            });
        }
    
        // hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const exisitingUser = await findUserByEmailOrUsername(email);
        if ( exisitingUser ) {
            return res.status(409).json({
                success: false,
                message: 'User with this email or username already exists'
            });
        }

        const userData = {
            first_name,
            last_name,
            user_name,
            phone,
            email,
            password: hashedPassword,
            image_url,
            role: 'User',
            is_active: true,
            email_verified: false,
        };

        const newUser = await createUser(userData);

        const token = generateJWT( newUser.id, newUser.email, newUser.role );

        const userResponse = {
            id: newUser.id,
            first_name: newUser.first_name,
            last_name: newUser.last_name,
            full_name: newUser.full_name,
            user_name: newUser.user_name,
            email: newUser.email,
            role: newUser.role,
            is_active: newUser.is_active,
            email_verified: newUser.email_verified
        };

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                user: userResponse,
                token,
                token_type: 'Bearer',
                expires_in: process.env.JWT_EXPIRE || '7d'
            }
        });

    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(400).json({
            status: 'fail',
            message: 'Unable to register user',
            error: error.message,
        });
    }
};

// @desc    Login user
// @access  Public
// user login routes
const login = async (req, res) => {
    try {
        const { email_or_username, password } = req.body;
    
        if ( !email_or_username || !password ) {
            res.status(400).json({
                error: true,
                message: 'All fields are required !',
            });
        }

        const user = await findUserByEmailOrUsername( email_or_username );
        if ( !user ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if ( !user.is_active ) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated. Please contact administrator'
            });
        }

        const isPasswordValid = await verifyPassword(password, user.password);
        if ( !isPasswordValid ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        await updateUserLastLogin(user.id);

        const token = generateJWT( user.id, user.email, user.role );

        const userResponse = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            full_name: user.full_name,
            user_name: user.user_name,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            email_verified: user.email_verified,
            last_login: new Date().toISOString()
        };
    
        return res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                user: userResponse,
                token,
                token_type: 'Bearer',
                expires_in: process.env.JWT_EXPIRE || '7d',
            },
        });

    } catch (error) {
        console.error("Error logging in user:", error);
        return res.status(500).json({
            status: 'fail',
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};

// @desc    Logout user
// @route   POST
// @access  Public
const logout = (req, res) => {
    try {
        // const clearCookie = () => { 
        //     res.cookie('jwt', 'loggedOut', {
        //         expires: new Date(Date.now() + 10 + 1000),
        //         httpOnly: true,
        //         secure: { [req.secure|| req.headers[ 'x-forwarded-pronto' ] === 'https' ] : true },
        //         sameSite: 'strict',
        //     });
        // };
    
        // if (clearCookie) {
        //     res.status(200).json({
        //         status: 'success',
        //         message: 'User signed out successfully',
        //     });
        // }

        if ( req.user ) {
            console.log(`User ${req.user.id} (${req.user.email}) logged out at ${new Date().toISOString()}`);
        }

        res.status(200).json({
            success: true,
            message: 'Logout successful',
            data: {
                logged_out_at: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error logging out user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const getMe = async (req, res) => {
    try {
        if ( !req.user ) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed',
            });
        }

        const userResponse = {
             id: req.user.id,
            first_name: req.user.first_name,
            last_name: req.user.last_name,
            full_name: req.user.full_name,
            user_name: req.user.user_name,
            email: req.user.email,
            role: req.user.role,
            is_active: req.user.is_active,
            email_verified: req.user.email_verified,
            last_login: req.user.last_login,
            created_at: req.user.created_at
        };

        res.status(200).json({
            success: true,
            message: 'User profile retrieved successfully',
            data: userResponse,
        });

    } catch (error) {
        console.error(`Error getting user profile: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};

const refreshToken = async (req, res) => {
    try {
        if ( !req.user ) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const token = generateJWT(req.user.id, req.user.email, req.user.role);

        res.status(200).json({
            success: false,
            message: 'Token refreshed successfully',
            data: {
                token,
                token_type: 'Bearer',
                expires_in: process.env.JWT_EXPIRE || '7d',
            },
        });

    } catch (error) {
        console.error('Error refreshing token:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        // This endpoint requires authentication middleware
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Validate required fields
        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        // Validate new password strength
        if (new_password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await verifyPassword(current_password, req.user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Don't allow same password
        if (current_password === new_password) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        // Update password
        const { updateUserById } = require('../models/users.model');
        await updateUserById(req.user.id, { password: new_password });

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Error changing password:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    logout,
    getMe,
    refreshToken,
    changePassword,
};