
exports.dashboard = async (req, res) => {
    try {
        res.render("student/dashboard", {
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

exports.showSubmitFeedback = async (req, res) => {
    try {
        const db = require("../config/database");
        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );
        res.render("student/submit-feedback", {
            categories,
            error: null
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const Feedback = require("../models/Feedback");
        const db = require("../config/database");
        const { title, description, category_id } = req.body;

        if (!title?.trim() || !description?.trim()) {
            const [categories] = await db.execute(
                "SELECT * FROM categories ORDER BY name"
            );
            return res.status(400).render("student/submit-feedback", {
                categories,
                error: "Please complete all required fields."
            });
        }

        const categoryId = category_id ? Number(category_id) : null;
        if (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0)) {
            const [categories] = await db.execute(
                "SELECT * FROM categories ORDER BY name"
            );
            return res.status(400).render("student/submit-feedback", {
                categories,
                error: "Please select a valid category."
            });
        }

        await Feedback.createFeedback({
            user_id: req.session.user.id,
            category_id: categoryId,
            title: title.trim(),
            description: description.trim()
        });

        req.session.success = "Feedback submitted successfully.";
        res.redirect("/student/submissions");
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to submit feedback.");
    }
};

exports.showSubmitSuggestion = async (req, res) => {
    try {
        res.render("student/submit-suggestion", {
            error: null
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

exports.submitSuggestion = async (req, res) => {
    try {
        const db = require("../config/database");
        const { title, description } = req.body;

        if (!title?.trim() || !description?.trim()) {
            return res.status(400).render("student/submit-suggestion", {
                error: "Please complete all required fields."
            });
        }

        await db.execute(
            `INSERT INTO submissions (user_id, type, title, description, status, created_at)
             VALUES (?, 'suggestion', ?, ?, 'Pending', NOW())`,
            [req.session.user.id, title.trim(), description.trim()]
        );

        req.session.success = "Suggestion submitted successfully.";
        res.redirect("/student/submissions");
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to submit suggestion.");
    }
};

exports.listSubmissions = async (req, res) => {
    try {
        const db = require("../config/database");
        const [submissions] = await db.execute(
            `SELECT s.*, c.name AS category_name
             FROM submissions s
             LEFT JOIN categories c ON s.category_id = c.id
             WHERE s.user_id = ?
             ORDER BY s.created_at DESC`,
            [req.session.user.id]
        );
        res.render("student/submissions", {
            submissions
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

exports.submissionDetails = async (req, res) => {
    try {
        const db = require("../config/database");
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        const [rows] = await db.execute(
            `SELECT s.*, c.name AS category_name, u.name AS user_name
             FROM submissions s
             LEFT JOIN categories c ON s.category_id = c.id
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.id = ? AND s.user_id = ?`,
            [id, req.session.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).send("Submission not found.");
        }

        const [responses] = await db.execute(
            `SELECT r.*, u.name AS responder_name
             FROM responses r
             LEFT JOIN users u ON r.responder_id = u.id
             WHERE r.submission_id = ?
             ORDER BY r.created_at ASC`,
            [id]
        );

        res.render("student/submission-details", {
            submission: rows[0],
            responses
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

exports.showProfile = async (req, res) => {
    try {
        res.render("student/profile", {
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

exports.updateName = async (req, res) => {
    try {
        const db = require("../config/database");
        const { name } = req.body;
        if (!name?.trim()) {
            req.session.error = "Name cannot be empty.";
            return res.redirect("/student/profile");
        }

        await db.execute("UPDATE users SET name = ? WHERE id = ?", [
            name.trim(),
            req.session.user.id
        ]);

        req.session.user.name = name.trim();
        req.session.success = "Name updated successfully.";
        res.redirect("/student/profile");
    } catch (error) {
        console.error(error);
        req.session.error = "Unable to update name.";
        res.redirect("/student/profile");
    }
};

exports.changePassword = async (req, res) => {
    try {
        const bcrypt = require("bcryptjs");
        const db = require("../config/database");
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            req.session.error = "Please fill in all password fields.";
            return res.redirect("/student/profile");
        }

        if (new_password.length < 8) {
            req.session.error = "New password must be at least 8 characters.";
            return res.redirect("/student/profile");
        }

        if (new_password !== confirm_password) {
            req.session.error = "New passwords do not match.";
            return res.redirect("/student/profile");
        }

        const [rows] = await db.execute(
            "SELECT password FROM users WHERE id = ?",
            [req.session.user.id]
        );

        if (
            rows.length === 0 ||
            !(await bcrypt.compare(current_password, rows[0].password))
        ) {
            req.session.error = "Current password is incorrect.";
            return res.redirect("/student/profile");
        }

        const hashedPassword = await bcrypt.hash(new_password, 12);
        await db.execute("UPDATE users SET password = ? WHERE id = ?", [
            hashedPassword,
            req.session.user.id
        ]);

        req.session.success = "Password changed successfully.";
        res.redirect("/student/profile");
    } catch (error) {
        console.error(error);
        req.session.error = "Unable to change password.";
        res.redirect("/student/profile");
    }
};
