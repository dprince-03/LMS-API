require('dotenv').config();
const express = require('express');

const app = express();

const PORT = process.env.PORT || 5080;

app.use('/', (req, res) => {
    res.send('Hello World! This is my first Express.js server.');
    res.status(200);
    res.end();
});

app.listen(PORT, () => {
    console.log(`\n## Server is starting... ##`);
    console.log(`Server is running on: http://localhost:${PORT}`);
    console.log(``);
    onsole.log(`- if you used nodemon (npm run watch), the server will restart automatically on code changes \n- you don't need to stop and start the server manually \n- just save the file and nodemon will restart the server for you \n- or you can type 'rs' and press enter to restart the server manually \n`);
    console.log(`## press Ctrl+C to stop the server ##`);
});
