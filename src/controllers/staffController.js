
exports.dashboard = async (req, res) => {
    try {
        const db = require("../config/database");
        const [assignedCount] = await db.execute(
            "SELECT COUNT(*) AS count FROM submissions WHERE assigned_to = ?",
            [req.session.user.id]
        );
        const [pendingCount] = await db.execute(
            "SELECT COUNT(*) AS count FROM submissions WHERE assigned_to = ? AND status = 'Pending'",
            [req.session.user.id]
        );
        const [inProgressCount] = await db.execute(
            "SELECT COUNT(*) AS count FROM submissions WHERE assigned_to = ? AND status = 'In Progress'",
            [req.session.user.id]
        );
        const [resolvedCount] = await db.execute(
            "SELECT COUNT(*) AS count FROM submissions WHERE assigned_to = ? AND status = 'Resolved'",
            [req.session.user.id]
        );

        res.render("staff/dashboard", {
            user: req.session.user,
            stats: {
                assignedCount: assignedCount[0].count,
                pendingCount: pendingCount[0].count,
                inProgressCount: inProgressCount[0].count,
                resolvedCount: resolvedCount[0].count
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

exports.listSubmissions = async (req, res) => {
    try {
        const db = require("../config/database");
        const [submissions] = await db.execute(
            `SELECT s.*, u.name AS user_name, c.name AS category_name
             FROM submissions s
             LEFT JOIN users u ON s.user_id = u.id
             LEFT JOIN categories c ON s.category_id = c.id
             WHERE s.assigned_to = ? OR s.assigned_to IS NULL
             ORDER BY s.created_at DESC`,
            [req.session.user.id]
        );
        res.render("staff/submissions", {
            submissions
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load submissions.");
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
            `SELECT s.*, c.name AS category_name, u.name AS user_name,
                    u.email AS user_email, u.student_id
             FROM submissions s
             LEFT JOIN categories c ON s.category_id = c.id
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).send("Submission not found.");
        }

        const [responses] = await db.execute(
            `SELECT r.*, u.name AS responder_name, u.role AS responder_role
             FROM responses r
             LEFT JOIN users u ON r.responder_id = u.id
             WHERE r.submission_id = ?
             ORDER BY r.created_at ASC`,
            [id]
        );

        res.render("staff/submission-details", {
            submission: rows[0],
            responses
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load submission details.");
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const db = require("../config/database");
        const id = Number(req.params.id);
        const { status } = req.body;

        const VALID_STATUSES = [
            "Pending",
            "Under Review",
            "In Progress",
            "Resolved",
            "Rejected"
        ];

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).send("Invalid status.");
        }

        await db.execute(
            "UPDATE submissions SET status = ?, updated_at = NOW() WHERE id = ?",
            [status, id]
        );

        req.session.success = "Status updated successfully.";
        res.redirect(`/staff/submissions/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update status.");
    }
};

exports.respond = async (req, res) => {
    try {
        const db = require("../config/database");
        const id = Number(req.params.id);
        const response = req.body.response?.trim();

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        if (!response) {
            req.session.error = "Response cannot be empty.";
            return res.redirect(`/staff/submissions/${id}`);
        }

        await db.execute(
            `INSERT INTO responses (submission_id, responder_id, response, created_at)
             VALUES (?, ?, ?, NOW())`,
            [id, req.session.user.id, response]
        );

        req.session.success = "Response submitted successfully.";
        res.redirect(`/staff/submissions/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to submit response.");
    }
};

exports.showProfile = async (req, res) => {
    try {
        res.render("staff/profile", {
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
            return res.redirect("/staff/profile");
        }

        await db.execute("UPDATE users SET name = ? WHERE id = ?", [
            name.trim(),
            req.session.user.id
        ]);

        req.session.user.name = name.trim();
        req.session.success = "Name updated successfully.";
        res.redirect("/staff/profile");
    } catch (error) {
        console.error(error);
        req.session.error = "Unable to update name.";
        res.redirect("/staff/profile");
    }
};

exports.changePassword = async (req, res) => {
    try {
        const bcrypt = require("bcryptjs");
        const db = require("../config/database");
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            req.session.error = "Please fill in all password fields.";
            return res.redirect("/staff/profile");
        }

        if (new_password.length < 8) {
            req.session.error = "New password must be at least 8 characters.";
            return res.redirect("/staff/profile");
        }

        if (new_password !== confirm_password) {
            req.session.error = "New passwords do not match.";
            return res.redirect("/staff/profile");
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
            return res.redirect("/staff/profile");
        }

        const hashedPassword = await bcrypt.hash(new_password, 12);
        await db.execute("UPDATE users SET password = ? WHERE id = ?", [
            hashedPassword,
            req.session.user.id
        ]);

        req.session.success = "Password changed successfully.";
        res.redirect("/staff/profile");
    } catch (error) {
        console.error(error);
        req.session.error = "Unable to change password.";
        res.redirect("/staff/profile");
    }
};
