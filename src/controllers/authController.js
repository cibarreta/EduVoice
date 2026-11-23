
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../config/database");
const { createTransporter, sendPasswordResetEmail } = require("../services/email");

const RESET_TOKEN_TTL_MINUTES = 30;

function hashResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function isValidResetToken(token) {
    return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

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

        if (body.agreement !== "yes") {
            return res.status(400).render("auth/register", {
                error: "Please accept the User Agreement to create an account."
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

exports.showForgotPassword = (req, res) => {
    res.render("auth/forgot-password", { error: null, success: null });
};

exports.requestPasswordReset = async (req, res) => {
    const email = typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).render("auth/forgot-password", {
            error: "Enter a valid email address.",
            success: null
        });
    }

    try {
        const transporter = createTransporter();
        const [users] = await pool.execute(
            "SELECT id, name, email FROM users WHERE email = ? AND is_active = 1",
            [email]
        );

        if (users.length > 0) {
            const user = users[0];
            const token = crypto.randomBytes(32).toString("hex");
            const tokenHash = hashResetToken(token);
            const connection = await pool.getConnection();

            try {
                await connection.beginTransaction();
                await connection.execute(
                    "DELETE FROM password_reset_tokens WHERE user_id = ?",
                    [user.id]
                );
                await connection.execute(
                    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${RESET_TOKEN_TTL_MINUTES} MINUTE))`,
                    [user.id, tokenHash]
                );
                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            try {
                await sendPasswordResetEmail(user, token, transporter);
            } catch (error) {
                try {
                    await pool.execute(
                        "DELETE FROM password_reset_tokens WHERE token_hash = ?",
                        [tokenHash]
                    );
                } catch (cleanupError) {
                    console.error("Unable to remove unsent password reset token:", cleanupError.message);
                }
                console.error("Unable to send password reset email:", error.message);
            }
        }

        return res.render("auth/forgot-password", {
            error: null,
            success: "If an active account exists for that email, a password reset link will be sent shortly."
        });
    } catch (error) {
        console.error("Unable to process password reset request:", error.message);
        return res.status(503).render("auth/forgot-password", {
            error: "Password reset email is currently unavailable. Please contact the system administrator.",
            success: null
        });
    }
};

exports.showResetPassword = async (req, res) => {
    res.set("Cache-Control", "no-store");
    const token = req.query.token;
    if (!isValidResetToken(token)) {
        return res.status(400).render("auth/reset-password", {
            error: "This password reset link is invalid or has expired.",
            token: ""
        });
    }

    try {
        const [tokens] = await pool.execute(
            `SELECT id FROM password_reset_tokens
             WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()`,
            [hashResetToken(token)]
        );
        if (tokens.length === 0) {
            return res.status(400).render("auth/reset-password", {
                error: "This password reset link is invalid or has expired.",
                token: ""
            });
        }

        return res.render("auth/reset-password", { error: null, token });
    } catch (error) {
        console.error("Unable to validate password reset link:", error.message);
        return res.status(500).render("auth/reset-password", {
            error: "Unable to validate this password reset link. Please try again later.",
            token: ""
        });
    }
};

exports.resetPassword = async (req, res) => {
    const token = req.body?.token;
    const password = req.body?.password;
    const confirmPassword = req.body?.confirm_password;
    if (
        !isValidResetToken(token) ||
        typeof password !== "string" ||
        typeof confirmPassword !== "string" ||
        password.length < 8 ||
        password.length > 128 ||
        password !== confirmPassword
    ) {
        return res.status(400).render("auth/reset-password", {
            error: password !== confirmPassword
                ? "Passwords do not match."
                : "Use a valid reset link and a password between 8 and 128 characters.",
            token: isValidResetToken(token) ? token : ""
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [tokens] = await connection.execute(
            `SELECT pr.id, pr.user_id
             FROM password_reset_tokens pr
             JOIN users u ON u.id = pr.user_id
             WHERE pr.token_hash = ?
               AND pr.expires_at > UTC_TIMESTAMP()
               AND u.is_active = 1
             FOR UPDATE`,
            [hashResetToken(token)]
        );

        if (tokens.length === 0) {
            await connection.rollback();
            return res.status(400).render("auth/reset-password", {
                error: "This password reset link is invalid or has expired.",
                token: ""
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        await connection.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, tokens[0].user_id]
        );
        await connection.execute(
            "DELETE FROM password_reset_tokens WHERE user_id = ?",
            [tokens[0].user_id]
        );
        await connection.commit();
        return res.render("auth/login", {
            error: null,
            success: "Your password has been changed. You can now log in."
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error("Unable to reset password:", error.message);
        return res.status(500).render("auth/reset-password", {
            error: "Unable to change your password. Please try again later.",
            token: isValidResetToken(token) ? token : ""
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
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