
const bcrypt = require("bcryptjs");
const pool = require("../config/database");

// Show registration page
exports.showRegister = (req, res) => {
    res.render("auth/register", { error: null });
};

// Register a student
exports.register = async (req, res) => {
    try {
        const { student_id, name, email, password } = req.body;

        if (!student_id || !name || !email || !password) {
            return res.status(400).render("auth/register", {
                error: "Please fill in all required fields."
            });
        }

        if (password.length < 8) {
            return res.status(400).render("auth/register", {
                error: "Password must be at least 8 characters."
            });
        }

        const [existing] = await pool.execute(
            "SELECT id FROM users WHERE email = ? OR student_id = ?",
            [email.trim(), student_id.trim()]
        );

        if (existing.length > 0) {
            return res.status(409).render("auth/register", {
                error: "Email or student ID is already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await pool.execute(
            `INSERT INTO users (student_id, name, email, password, role)
             VALUES (?, ?, ?, ?, 'student')`,
            [
                student_id.trim(),
                name.trim(),
                email.trim().toLowerCase(),
                hashedPassword
            ]
        );

        return res.redirect("/login");
    } catch (error) {
        console.error("Registration error:", error.message);

        return res.status(500).render("auth/register", {
            error: "Unable to register. Please try again."
        });
    }
};

// Show login page
exports.showLogin = (req, res) => {
    res.render("auth/login", { error: null });
};

// Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("auth/login", {
                error: "Please enter your email and password."
            });
        }

        const [users] = await pool.execute(
            "SELECT * FROM users WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (
            users.length === 0 ||
            !(await bcrypt.compare(password, users[0].password))
        ) {
            return res.status(401).render("auth/login", {
                error: "Invalid email or password."
            });
        }

        const user = users[0];

        req.session.regenerate((err) => {
            if (err) {
                console.error("Session error:", err.message);
                return res.status(500).send("Unable to log in.");
            }

            req.session.user = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };

            if (user.role === "admin") {
                return res.redirect("/admin/dashboard");
            }

            return res.redirect("/student/dashboard");
        });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).send("Unable to log in.");
    }
};

// Logout
exports.logout = (req, res, next) => {
    req.session.destroy((err) => {
        if (err) {
            return next(err);
        }

        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
};