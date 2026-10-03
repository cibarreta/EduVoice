
require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../config/database");

async function createAdmin() {
    const name = process.env.ADMIN_NAME;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!name || !email || !password || password.length < 12) {
        throw new Error(
            "Provide ADMIN_NAME, ADMIN_EMAIL, and a password of at least 12 characters."
        );
    }

    const [existing] = await pool.execute(
        "SELECT id FROM users WHERE email = ?",
        [email.trim().toLowerCase()]
    );

    if (existing.length > 0) {
        throw new Error("An account with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await pool.execute(
        `INSERT INTO users (name, email, password, role)
         VALUES (?, ?, ?, 'admin')`,
        [name.trim(), email.trim().toLowerCase(), hashedPassword]
    );

    console.log("Administrator account created.");
}

createAdmin()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });