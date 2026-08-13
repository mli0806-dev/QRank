const path = require('path');
const mysql = require('mysql2');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),
    queueLimit: 0,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
});

module.exports = pool.promise();