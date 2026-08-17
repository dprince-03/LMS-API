const { 
    findUserByEmail,
    findUserByUsername,
    createUser,
    findAllUsers,
    countUsers,
    findUserById,
    getUserBorrowRecords,
    getUserActiveBorrowedCount,
    getUserOverdueBooks,
    canUserBorrowMore,
} = require("../models/users.model");


const createUserController = async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            user_name,
            phone,
            email,
            password,
            image_url,
            role,
            is_active,
            email_verified,
        } = req.body;

        if ( !first_name || !last_name || !email || !password ) {
            return res.status(400).json({
                success: false,
                message: 'First name, username, email and password are required !',
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if ( !emailRegex.test(email) ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Email format',
            });
        }

        if ( password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        const existingEmail = await findUserByEmail(email);
        if ( existingEmail ) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        const existingUsername = await findUserByUsername(user_name);
        if ( existingUsername ) {
            return res.status(409).json({
                success: false,
                message: 'Username is already taken'
            });
        }

        const validRoles = ['Admin', 'Librarian', 'User'];
        if ( role && !validRoles.includes(role) ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be Admin, Librarian, or User'
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
            role: role || 'User',
            is_active: is_active !== undefined ? is_active : true,
            email_verified: email_verified || false,
        };

        const newUser = await createUser(userData);

        res.status(201).json({
            success: true,
            message: 'User created successfully !',
            data: newUser,
        });


    } catch (error) {
        console.error('Error creating user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const getAllUsersController = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            role,
            is_active,
        } = req.query;

        const offset = ( parseInt(page) - 1 ) * parseInt(limit);

        const options = {
            limit: parseInt(limit),
            offset,
            search,
        };

        if ( role ) {
            options.role = role;
        }
        if ( is_active !== undefined ) {
            options.is_active = is_active == 'true';
        }

        const filters = { search };
        if ( role ) {
            filters.role = role;
        }
        if ( is_active !== undefined ) {
            filters.is_active = is_active == 'true';
        }

        const users = await findAllUsers(options);

        const totalUser = await countUsers(filters);
        const totalPages = Math.ceil( totalUser / parseInt(limit) );

        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: users,
            paginations: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalUser,
                items_per_page: parseInt(limit),
                has_next: parseInt(page) < totalPages,
                has_prev: parseInt(page) > 1,
            },
            filters: {
                 search: search || null,
                role: role || null,
                is_active: is_active !== undefined ? (is_active === 'true') : null
            },
        });


    } catch (error) {
        console.error('Error fetching users:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const getUserByIdController = async (req, res) => {
    try {
        const { id } = req.params;

        if ( !id || isNaN(id) ) {
            return res.status(400).json({
                success: false,
                message: 'Valid user ID is required'
            });
        }

        const user = await findUserById(parseInt(id));

        if ( !user ) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

         // Get additional data based on query params
        const includeBorrows = req.query.include_borrows === 'true';
        const includeStats = req.query.include_stats === 'true';

        let userData = user;

        if ( includeBorrows ) {
            const borrowRecords = await getUserBorrowRecords(user.id, { limit: 10});
            userData = {
                ...userData,
                recent_borrows: borrowRecords,
            };
        }

        if ( includeStats ) {
            const activeBorrows = await getUserActiveBorrowedCount(user.id);
            const overdueBooks = await getUserOverdueBooks(user.id);
            const canBorrow = await canUserBorrowMore(user.id);

            userData = {
                ...userData,
                statistics: {
                    active_borrows: activeBorrows,
                    overdue_books: overdueBooks.length,
                    can_borrow_more: canBorrow,
                    overdue_details: overdueBooks,
                },
            };
        }

        res.status(200).json({
            success: true,
            message: 'User retrieved successfully',
            data: userData,
        });


    } catch (error) {
        console.error('Error fetching user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const updateUserController = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        if ( !id || isNaN(id) ) {
            return res.status(400).json({
                success: false,
                message: 'Valid user ID is required'
            });
        }

        const existingUser = await findUserById(parseInt(id));
        if ( !existingUser ) {
             return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if ( updateData.email && updateData.email !== existingUser.email ) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if ( !emailRegex.test(updateData.email) ) {
                 return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }
            
            const emailExist = await findUserByEmail(updateData.email);
            if ( emailExist ) {
                return res.status(409).json({
                    success: false,
                    message: 'Email is already taken by another user'
                });
            }
        }

        if ( updateData.user_name && updateData.user_name !== existingUser.user_name ) {
            const usernameExist = await findUserByUsername(updateData.user_name);
            if ( usernameExist ) {
                return res.status(409).json({
                    success: false,
                    message: 'Username is already taken'
                });
            }
        }

         // Validate password strength if being updated
        if (updateData.password && updateData.password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Validate role if being updated
        if (updateData.role) {
            const validRoles = ['Admin', 'Librarian', 'User'];
            if (!validRoles.includes(updateData.role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role. Must be Admin, Librarian, or User'
                });
            }
        }

        // Remove undefined and null values, and protect certain fields
        const protectedFields = ['id', 'created_at', 'updated_at', 'deleted_at'];
        const filteredData = {};
        
        Object.keys(updateData).forEach(key => {
            if (!protectedFields.includes(key) && updateData[key] !== undefined && updateData[key] !== null) {
                filteredData[key] = updateData[key];
            }
        });

        if (Object.keys(filteredData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields to update'
            });
        }

        // Update user
        const updatedUser = await updateUserById(parseInt(id), filteredData);

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
        });


    } catch (error) {
        console.error('Error updating user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const deleteUserController = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Valid user ID is required'
            });
        }

        // Check if user exists
        const existingUser = await findUserById(parseInt(id));
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has active borrows (business rule)
        const activeBorrows = await getUserActiveBorrowedCount(parseInt(id));
        if (activeBorrows > 0) {
            return res.status(409).json({
                success: false,
                message: `Cannot delete user. User has ${activeBorrows} active borrow(s)`,
                active_borrows: activeBorrows
            });
        }

        // Prevent deleting the last admin (business rule)
        if (existingUser.role === 'Admin') {
            const adminUsers = await findAllUsers({ role: 'Admin', limit: 100 });
            const activeAdmins = adminUsers.filter(user => user.is_active && user.id !== parseInt(id));
            
            if (activeAdmins.length === 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Cannot delete the last active admin user'
                });
            }
        }

        // Soft delete user (sets deleted_at timestamp)
        const deleted = await deleteUserById(parseInt(id));

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'User not found or already deleted'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
        
    } catch (error) {
         console.error('Error deleting user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};


// Get user profile (for current logged-in user) - GET /users/profile
const getUserProfileController = async (req, res) => {
    try {
        // This will be used after authentication middleware is implemented
        // For now, it's a placeholder
        const userId = req.user?.id; // Will come from auth middleware

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const user = await findUserById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user statistics
        const activeBorrows = await getUserActiveBorrowedCount(userId);
        const overdueBooks = await getUserOverdueBooks(userId);
        const recentBorrows = await getUserBorrowRecords(userId, { limit: 5 });

        const userProfile = {
            ...user,
            statistics: {
                active_borrows: activeBorrows,
                overdue_books: overdueBooks.length,
                can_borrow_more: await canUserBorrowMore(userId)
            },
            recent_activity: recentBorrows
        };

        res.status(200).json({
            success: true,
            message: 'User profile retrieved successfully',
            data: userProfile
        });

    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get users list for public view (limited data) - GET /users/public
const getPublicUsersController = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            role,
            is_active = 'true' 
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const options = {
            limit: parseInt(limit),
            offset,
            is_active: is_active === 'true'
        };

        if (role) options.role = role;

        const users = await findAllUsers(options);
        
        // Convert to public format (less sensitive data)
        const publicUsers = users.map(formatUserPublic);

        const filters = { is_active: is_active === 'true' };
        if (role) filters.role = role;

        const totalUsers = await countUsers(filters);
        const totalPages = Math.ceil(totalUsers / parseInt(limit));

        res.status(200).json({
            success: true,
            message: 'Public users list retrieved successfully',
            data: publicUsers,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_items: totalUsers,
                items_per_page: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching public users:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    createUser: createUserController,
    getAllUsers: getAllUsersController,
    getUserById: getUserByIdController,
    updateUser: updateUserController,
    deleteUser: deleteUserController,
    getUserProfile: getUserProfileController,
    getPublicUsers: getPublicUsersController
};