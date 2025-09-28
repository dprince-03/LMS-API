const { parse } = require("dotenv");
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


    } catch (error) {
        console.error('Error updating user:', error.message);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const deleteUserController = async (req, res) => {};

module.exports = {
    createUser: createUserController,
    getAllUsers: getAllUsersController,
    getUserById: getUserByIdController,
    updateUser: updateUserController,
    deleteUser: deleteUserController,
    // getUserProfile,
    // getPublicUsers,
};