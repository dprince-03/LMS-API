


const createUser = async (req, res) => {};
const getAllUsers = async (req, res) => {};
const getUserById = async (req, res) => {};
const updateUser = async (req, res) => {};
const deleteUser = async (req, res) => {
    res.send('Delete User by ID');
    res.status(200).json({
        status: 'success',
        message: 'Delete User by ID',
    });
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
};