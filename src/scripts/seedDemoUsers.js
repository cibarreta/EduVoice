const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

const demoPassword = process.env.DEMO_USER_PASSWORD || "EduVoiceDemo!2026";
const demoUsers = [
    {
        student_id: "Student",
        name: "Demo Student",
        email: "student@my.cspc.edu.ph",
        role: "student"
    },
    {
        student_id: null,
        name: "Staff",
        email: "staff@my.cspc.edu.ph",
        role: "staff"
    },
    {
        student_id: null,
        name: "Admin",
        email: "admind@my.cspc.edu.ph",
        role: "admin"
    }
];

async function seedDemoUsers() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Demo users cannot be seeded when NODE_ENV is production.");
    }

    if (!process.env.DB_NAME) {
        throw new Error("DB_NAME is missing from the environment.");
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const passwordHash = await bcrypt.hash(demoPassword, 12);

        for (const user of demoUsers) {
            await connection.execute(
                `INSERT INTO users (student_id, name, email, password, role, is_active)
                 VALUES (?, ?, ?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE
                    student_id = VALUES(student_id),
                    name = VALUES(name),
                    password = VALUES(password),
                    role = VALUES(role),
                    is_active = 1`,
                [
                    user.student_id,
                    user.name,
                    user.email,
                    passwordHash,
                    user.role
                ]
            );
        }

        console.log(`Seeded demo users in "${process.env.DB_NAME}".`);
        console.log(`Password for all demo accounts: ${demoPassword}`);
        for (const user of demoUsers) {
            console.log(`${user.role}: ${user.email}`);
        }
    } finally {
        await connection.end();
    }
}

seedDemoUsers().catch((error) => {
    console.error(`Demo user seeding failed: ${error.message}`);
    process.exitCode = 1;
});
