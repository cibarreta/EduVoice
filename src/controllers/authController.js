
const bcrypt = require("bcryptjs");
const pool = require("../config/database");

// Show registration page
exports.showRegister = (req, res) => {
    res.render("auth/register", { error: null });
};

// Register a student
exports.register = async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const { student_id, name, email, password, confirm_password } = body;
        const studentId = typeof student_id === "string" ? student_id.trim() : "";
        const normalizedName = typeof name === "string" ? name.trim() : "";
        const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

        if (
            !studentId ||
            !normalizedName ||
            !normalizedEmail ||
            typeof password !== "string" ||
            typeof confirm_password !== "string" ||
            password !== confirm_password
        ) {
            return res.status(400).render("auth/register", {
                error: password !== confirm_password
                    ? "Passwords do not match."
                    : "Please fill in all required fields."
            });
        }

        if (
            password.length < 8 ||
            normalizedName.length > 150 ||
            studentId.length > 50 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            return res.status(400).render("auth/register", {
                error: "Enter a valid name, student ID, email, and password of at least 8 characters."
            });
        }

        const [existing] = await pool.execute(
            "SELECT id FROM users WHERE email = ? OR student_id = ?",
            [normalizedEmail, studentId]
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
                studentId,
                normalizedName,
                normalizedEmail,
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
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const { email, password } = body;

        if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
            return res.status(400).render("auth/login", {
                error: "Please enter your email and password."
            });
        }

        const [users] = await pool.execute(
            `SELECT id, name, email, password, role, is_active
             FROM users
             WHERE email = ?`,
            [email.trim().toLowerCase()]
        );

        if (
            users.length === 0 ||
            !users[0].is_active ||
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
            if (user.role === "staff") {
                return res.redirect("/staff/dashboard");
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