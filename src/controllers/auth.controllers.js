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
            return res.status(400).json({
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
        // const saltRounds = 10;
        // const hashedPassword = await bcrypt.hash(password, saltRounds);

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
            password,
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
			console.log("Login request body:", req.body); // Debug log
			console.log("Login request headers:", req.headers["content-type"]); // Debug log
			// Check if request body exists
			if (!req.body || Object.keys(req.body).length === 0) {
				return res.status(400).json({
					error: true,
					message: "Request body is missing or empty",
				});
			} // remove them later

			const { emailOrUsername, password } = req.body;

			if (!emailOrUsername || !password) {
				return res.status(400).json({
					error: true,
					message: "All fields are required !",
				});
			}

			const user = await findUserByEmailOrUsername(emailOrUsername);
			if (!user) {
				return res.status(401).json({
					success: false,
					message: "Invalid credentials",
				});
			}

			// ✅ Debug: Check if password is now available
			console.log("User found with password:", {
				id: user.id,
				email: user.email,
				hasPassword: !!user.password,
				password: user.password
					? `Hash: ${user.password.substring(0, 20)}...`
					: "Missing",
			}); // remove later

			if (!user.password) {
				return res.status(500).json({
					success: false,
					message: "User account error: No password set",
				});
			} // remove later

			if (!user.is_active) {
				return res.status(401).json({
					success: false,
					message: "Account is deactivated. Please contact administrator",
				});
			}

			// ✅ CORRECT: Compare the plain text password from request with the hashed password from database
			console.log("Verifying password for user:", user.email);
			console.log("Stored hash:", user.password ? "Exists" : "Missing"); // remove them later

			const isPasswordValid = await verifyPassword(password, user.password);
			if (!isPasswordValid) {
				return res.status(401).json({
					success: false,
					message: "Invalid credentials",
				});
			}

			await updateUserLastLogin(user.id);

			const token = generateJWT(user.id, user.email, user.role);

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
				last_login: new Date().toISOString(),
			};

			res.status(200).json({
				status: "success",
				message: "Login successful",
				data: {
					user: userResponse,
					token,
					token_type: "Bearer",
					expires_in: process.env.JWT_EXPIRE || "7d",
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
        return res.status(500).json({
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
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// testing
const reset_password = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email and new password are required'
            });
        }

        const { findUserByEmail, updateUserById } = require('../models/users.model');
        
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update password (the update function will hash it automatically);
        await updateUserById(user.id, { password: newPassword });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// testing 
const setup_admin = async (req, res) => {
    try {
        const { 
            admin_email, 
            admin_password, 
            setup_key,
            first_name = 'System',
            last_name = 'Administrator'
        } = req.body;

        // Validate required fields
        if (!admin_email || !admin_password || !setup_key) {
            return res.status(400).json({
                success: false,
                message: 'Admin email, password, and setup key are required'
            });
        }

        // Verify setup key from environment
        if (setup_key !== process.env.INITIAL_SETUP_KEY) {
            return res.status(401).json({
                success: false,
                message: 'Invalid setup key'
            });
        }

        // Check password strength
        if (admin_password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        const hasUpperCase = /[A-Z]/.test(admin_password);
        const hasLowerCase = /[a-z]/.test(admin_password);
        const hasNumber = /\d/.test(admin_password);

        if (!hasUpperCase || !hasLowerCase || !hasNumber) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain uppercase, lowercase, and numbers'
            });
        }

        const { createUser, countUsers, findUserByEmail } = require('../models/users.model');

        // Check if admin already exists
        const existingAdmin = await findUserByEmail(admin_email);
        if (existingAdmin) {
            return res.status(409).json({
                success: false,
                message: 'Admin user already exists'
            });
        }

        // Check if any users exist (prevent multiple admins via this endpoint)
        const userCount = await countUsers();
        if (userCount > 0) {
            return res.status(403).json({
                success: false,
                message: 'System already initialized. Use regular registration or contact existing admin.'
            });
        }

        // Create admin user
        const adminData = {
            first_name,
            last_name,
            user_name: admin_email.split('@')[0],
            email: admin_email,
            password: admin_password,
            role: 'Admin',
            is_active: true,
            email_verified: true
        };

        const adminUser = await createUser(adminData);

        // Log the setup event
        console.log(`🔐 Admin setup completed: ${admin_email}`);

        res.status(201).json({
            success: true,
            message: 'System administrator created successfully',
            data: {
                user: {
                    id: adminUser.id,
                    first_name: adminUser.first_name,
                    last_name: adminUser.last_name,
                    email: adminUser.email,
                    role: adminUser.role
                }
            }
        });

    } catch (error) {
        console.error('Admin setup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to setup system administrator',
            error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
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
    reset_password,
    setup_admin
};