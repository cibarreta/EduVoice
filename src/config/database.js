
const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,

    ssl: process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ca: process.env.DB_SSL_CA
            ? fs.readFileSync(process.env.DB_SSL_CA, "utf8")
            : undefined
        }
        : undefined
});

module.exports = pool;
