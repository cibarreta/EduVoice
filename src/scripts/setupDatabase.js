const mysql = require("mysql2/promise");
const { readFile } = require("fs/promises");
const path = require("path");
require("dotenv").config();

const databaseName = process.env.DB_NAME;

async function migrateLegacyUsersTable(connection, escapedDatabaseName) {
    const [tables] = await connection.query(
        `SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
        [databaseName]
    );

    if (tables.length === 0) {
        return;
    }

    const [columns] = await connection.query(
        `SHOW COLUMNS FROM ${escapedDatabaseName}.users`
    );
    const columnNames = new Set(columns.map((column) => column.Field));
    const alterOperations = [];

    if (!columnNames.has("student_id")) {
        alterOperations.push("ADD COLUMN student_id VARCHAR(50) NULL");
    }

    if (!columnNames.has("email")) {
        alterOperations.push("ADD COLUMN email VARCHAR(254) NULL");
    }

    if (!columnNames.has("password")) {
        alterOperations.push("ADD COLUMN password VARCHAR(255) NULL");
    }

    if (columnNames.has("username")) {
        alterOperations.push("MODIFY COLUMN username VARCHAR(60) NULL");
    }

    if (columnNames.has("password_hash")) {
        alterOperations.push("MODIFY COLUMN password_hash VARCHAR(255) NULL");
    }

    if (alterOperations.length > 0) {
        await connection.query(
            `ALTER TABLE ${escapedDatabaseName}.users ${alterOperations.join(", ")}`
        );
    }

    const [indexes] = await connection.query(
        `SHOW INDEX FROM ${escapedDatabaseName}.users`
    );
    const uniqueSingleColumnIndexes = new Set(
        indexes
            .filter((index) => index.Non_unique === 0 && index.Seq_in_index === 1)
            .map((index) => index.Column_name)
    );
    const indexOperations = [];

    if (columnNames.has("email") || alterOperations.some((operation) => operation.includes("ADD COLUMN email "))) {
        if (!uniqueSingleColumnIndexes.has("email")) {
            indexOperations.push("ADD UNIQUE KEY uq_users_email (email)");
        }
    }

    if (columnNames.has("student_id") || alterOperations.some((operation) => operation.includes("ADD COLUMN student_id "))) {
        if (!uniqueSingleColumnIndexes.has("student_id")) {
            indexOperations.push("ADD UNIQUE KEY uq_users_student_id (student_id)");
        }
    }

    if (indexOperations.length > 0) {
        await connection.query(
            `ALTER TABLE ${escapedDatabaseName}.users ${indexOperations.join(", ")}`
        );
    }
}

async function setupDatabase() {
    if (!databaseName) {
        throw new Error("DB_NAME is missing from the environment.");
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    try {
        const escapedDatabaseName = mysql.escapeId(databaseName);
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS ${escapedDatabaseName}
             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await connection.query(`USE ${escapedDatabaseName}`);
        await migrateLegacyUsersTable(connection, escapedDatabaseName);

        const schemaPath = path.join(__dirname, "../../database/eduvoice.sql");
        const schema = await readFile(schemaPath, "utf8");
        const schemaForDatabase = schema.split("`eduvoice`").join(escapedDatabaseName);

        await connection.query(schemaForDatabase);

        console.log(`Database "${databaseName}" is ready.`);
    } finally {
        await connection.end();
    }
}

setupDatabase().catch((error) => {
    console.error(`Database setup failed: ${error.message}`);
    process.exitCode = 1;
});