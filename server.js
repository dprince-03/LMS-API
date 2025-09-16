require('dotenv').config();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const morgan = require('morgan');

const authRouter = require('./src/routes/auth.routes');

const app = express();

const PORT = process.env.PORT || 5080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5000', 
    credentials: true, // Allow cookies to be sent
}));

app.use('/', authRouter);

app.listen(PORT, () => {
    console.log(`\n## Server is starting... ##`);
    console.log(`Server is running on: http://localhost:${PORT}`);
    console.log(``);
    console.log(`- if you used nodemon (npm run watch), the server will restart automatically on code changes \n- you don't need to stop and start the server manually \n- just save the file and nodemon will restart the server for you \n- or you can type 'rs' and press enter to restart the server manually \n`);
    console.log(`## press Ctrl+C to stop the server ##`);
});
``