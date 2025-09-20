

const createBooksPg = (req, res) => {
    res.send('Create Books Page');
    res.status(200).json({
        status: 'success',
        message: 'Create Books Page',
    });
};

const createBooks = (req, res) => {};

const getAllBooks = async(req, res) => {
    try {
        
    } catch (error) {
        
    }
};
const getBooksById = (req, res) => {};
const updateBooksById = (req, res) => {};
const deleteBooksById = (req, res)=> {};
const borrowBooks = (req, res) => {};
const returnBooks = (req, res) => {};

module.exports = {
    createBooksPg,
    createBooks,
    getAllBooks,
    getBooksById,
    updateBooksById,
    deleteBooksById,
    borrowBooks,
    returnBooks,
};