const bcrypt = require("bcryptjs");
const Feedback = require("../models/AdminFeedback");
const db = require("../config/database");

const VALID_STATUSES = [
    "Pending",
    "Under Review",
    "In Progress",
    "Resolved",
    "Rejected"
];

async function getUserCounts() {
    const [rows] = await db.execute(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) AS students,
            SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) AS staff,
            SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins,
            SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active
        FROM users
    `);
    return {
        total: Number(rows[0].total) || 0,
        students: Number(rows[0].students) || 0,
        staff: Number(rows[0].staff) || 0,
        admins: Number(rows[0].admins) || 0,
        active: Number(rows[0].active) || 0
    };
}

async function getAllUsers({ role, search, page, perPage }) {
    const whereConditions = [];
    const params = [];

    if (role) {
        whereConditions.push("role = ?");
        params.push(role);
    }

    if (search && search.trim()) {
        whereConditions.push("(name LIKE ? OR email LIKE ? OR student_id LIKE ?)");
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`,
        params
    );
    const total = countRows[0].total;

    const pageNum = Number(page) || 1;
    const perPageNum = Number(perPage) || 10;
    const offset = (pageNum - 1) * perPageNum;

    const [rows] = await db.execute(
        `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, perPageNum, offset]
    );

    return { rows, total };
}

async function getUserById(id) {
    const [rows] = await db.execute(
        "SELECT * FROM users WHERE id = ?",
        [id]
    );
    return rows[0];
}

async function getUserSubmissionStats(userId) {
    const [rows] = await db.execute(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
        FROM feedback
        WHERE user_id = ?
    `, [userId]);

    const s = rows[0];
    return {
        total: Number(s.total) || 0,
        pending: Number(s.pending) || 0,
        resolved: Number(s.resolved) || 0,
        rejected: Number(s.rejected) || 0
    };
}

async function getUserRecentSubmissions(userId, limit) {
    const [rows] = await db.execute(`
        SELECT
            f.*,
            c.name AS category_name
        FROM feedback f
        LEFT JOIN categories c ON f.category_id = c.id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        LIMIT ?
    `, [userId, Number(limit)]);
    return rows;
}

async function updateUserRole(id, role) {
    const [result] = await db.execute(
        "UPDATE users SET role = ? WHERE id = ?",
        [role, id]
    );
    return result.affectedRows;
}

async function toggleUserActive(id) {
    const [rows] = await db.execute(
        "SELECT is_active FROM users WHERE id = ?",
        [id]
    );
    if (rows.length === 0) return 0;
    const newStatus = rows[0].is_active ? 0 : 1;
    const [result] = await db.execute(
        "UPDATE users SET is_active = ? WHERE id = ?",
        [newStatus, id]
    );
    return result.affectedRows;
}

exports.dashboard = async (req, res) => {
    try {
        const stats = await Feedback.getAllStats();
        const userCounts = await getUserCounts();
        const recentSubmissions = await Feedback.getAllRecent(10);

        res.render("admin/dashboard", {
            stats,
            userCounts,
            recentSubmissions,
            user: req.session.user,
            activePage: "dashboard"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load dashboard.");
    }
};

exports.listFeedback = async (req, res) => {
    try {
        const { search, category_id, status, dateFrom, dateTo } = req.query;
        const page = Number(req.query.page) || 1;
        const perPage = 10;

        const { rows: submissions, total } = await Feedback.getAllFeedback({
            type: "feedback",
            search,
            category_id,
            status,
            dateFrom,
            dateTo,
            page,
            perPage
        });

        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );

        const statuses = VALID_STATUSES;
        const totalPages = Math.ceil(total / perPage);
        const filters = { search, category_id, status, dateFrom, dateTo };

        res.render("admin/feedback", {
            submissions,
            categories,
            statuses,
            filters,
            page,
            totalPages,
            user: req.session.user,
            activePage: "feedback"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load feedback.");
    }
};

exports.listSuggestions = async (req, res) => {
    try {
        const { search, category_id, status, dateFrom, dateTo } = req.query;
        const page = Number(req.query.page) || 1;
        const perPage = 10;

        const { rows: submissions, total } = await Feedback.getAllFeedback({
            type: "suggestion",
            search,
            category_id,
            status,
            dateFrom,
            dateTo,
            page,
            perPage
        });

        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );

        const statuses = VALID_STATUSES;
        const totalPages = Math.ceil(total / perPage);
        const filters = { search, category_id, status, dateFrom, dateTo };

        res.render("admin/suggestions", {
            submissions,
            categories,
            statuses,
            filters,
            page,
            totalPages,
            user: req.session.user,
            activePage: "suggestions"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load suggestions.");
    }
};

exports.submissionDetails = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        const submission = await Feedback.getFeedbackById(id);

        if (!submission) {
            return res.status(404).send("Submission not found.");
        }

        const responses = await Feedback.getResponses(id);

        const [staffUsers] = await db.execute(
            "SELECT * FROM users WHERE role = 'staff' AND is_active = 1 ORDER BY name"
        );

        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );

        const statuses = VALID_STATUSES;
        const activePage = submission.type === "suggestion" ? "suggestions" : "feedback";

        res.render("admin/submission-details", {
            submission,
            responses,
            staffUsers,
            categories,
            statuses,
            user: req.session.user,
            activePage
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load submission details.");
    }
};

exports.updateSubmissionStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).send("Invalid status.");
        }

        await Feedback.updateStatus(id, status);

        req.session.success = "Status updated successfully.";
        res.redirect(`/admin/submissions/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update status.");
    }
};

exports.respondToSubmission = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const response = req.body.response?.trim();

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        if (!response) {
            req.session.error = "Response cannot be empty.";
            return res.redirect("back");
        }

        await Feedback.addResponse(id, req.session.user.id, response);

        const submission = await Feedback.getFeedbackById(id);
        if (submission && submission.status === "Pending") {
            await Feedback.updateStatus(id, "Under Review");
        }

        req.session.success = "Response submitted successfully.";
        res.redirect("back");
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to submit response.");
    }
};

exports.assignStaff = async (req, res) => {
    try {
        const id = Number(req.params.id);
        let { assigned_to } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        if (assigned_to === "" || assigned_to === null || assigned_to === undefined) {
            assigned_to = null;
        } else {
            assigned_to = Number(assigned_to);
            if (!Number.isInteger(assigned_to) || assigned_to <= 0) {
                assigned_to = null;
            }
        }

        await Feedback.assignStaff(id, assigned_to);

        req.session.success = "Staff assigned successfully.";
        res.redirect(`/admin/submissions/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to assign staff.");
    }
};

exports.listUsers = async (req, res) => {
    try {
        const { search, role } = req.query;
        const page = Number(req.query.page) || 1;
        const perPage = 10;

        const { rows: users, total } = await getAllUsers({
            role,
            search,
            page,
            perPage
        });

        const totalPages = Math.ceil(total / perPage);
        const filters = { search, role };

        res.render("admin/users", {
            users,
            filters,
            page,
            totalPages,
            user: req.session.user,
            activePage: "users"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load users.");
    }
};

exports.userDetails = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid user ID.");
        }

        const userDetail = await getUserById(id);

        if (!userDetail) {
            return res.status(404).send("User not found.");
        }

        const userStats = await getUserSubmissionStats(id);
        const userSubmissions = await getUserRecentSubmissions(id, 10);

        res.render("admin/user-details", {
            userDetail,
            userStats,
            userSubmissions,
            user: req.session.user,
            activePage: "users"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load user details.");
    }
};

exports.updateUserRole = async (req, res) => {
    try {
        if (req.session.user.role !== "admin") {
            return res.status(403).send("Permission denied.");
        }

        const id = Number(req.params.id);
        const { role } = req.body;
        const validRoles = ["student", "staff", "admin"];

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid user ID.");
        }

        if (!validRoles.includes(role)) {
            return res.status(400).send("Invalid role.");
        }

        await updateUserRole(id, role);

        req.session.success = "User role updated successfully.";
        res.redirect(`/admin/users/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update user role.");
    }
};

exports.toggleUserActive = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid user ID.");
        }

        await toggleUserActive(id);

        req.session.success = "User status updated successfully.";
        res.redirect(`/admin/users/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update user status.");
    }
};

exports.statistics = async (req, res) => {
    try {
        const statsByStatus = await Feedback.getStatsByStatus();
        const statsByCategory = await Feedback.getStatsByCategory();
        const typeCounts = await Feedback.getTypeCounts();
        const monthlyTrends = await Feedback.getMonthlyTrends(6);
        const userCounts = await getUserCounts();
        const allStats = await Feedback.getAllStats();

        const denominator = allStats.total - allStats.rejected;
        const resolutionRate = denominator > 0
            ? (allStats.resolved / denominator) * 100
            : 0;

        res.render("admin/statistics", {
            statsByStatus,
            statsByCategory,
            typeCounts,
            monthlyTrends,
            userCounts,
            allStats,
            resolutionRate: Number(resolutionRate.toFixed(2)),
            user: req.session.user,
            activePage: "statistics"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load statistics.");
    }
};

exports.showProfile = async (req, res) => {
    try {
        const userDetail = await getUserById(req.session.user.id);

        res.render("admin/profile", {
            userDetail,
            user: req.session.user,
            activePage: "profile"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load profile.");
    }
};

exports.updateAdminName = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name?.trim()) {
            req.session.error = "Name cannot be empty.";
            return res.redirect("/admin/profile");
        }

        await db.execute(
            "UPDATE users SET name = ? WHERE id = ?",
            [name.trim(), req.session.user.id]
        );

        req.session.user.name = name.trim();
        req.session.success = "Name updated successfully.";
        res.redirect("/admin/profile");
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update name.");
    }
};

exports.changeAdminPassword = async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            req.session.error = "Please fill in all password fields.";
            return res.redirect("/admin/profile");
        }

        if (new_password.length < 8) {
            req.session.error = "New password must be at least 8 characters.";
            return res.redirect("/admin/profile");
        }

        if (new_password !== confirm_password) {
            req.session.error = "New passwords do not match.";
            return res.redirect("/admin/profile");
        }

        const [users] = await db.execute(
            "SELECT password FROM users WHERE id = ?",
            [req.session.user.id]
        );

        if (users.length === 0) {
            req.session.error = "User not found.";
            return res.redirect("/admin/profile");
        }

        const isMatch = await bcrypt.compare(current_password, users[0].password);
        if (!isMatch) {
            req.session.error = "Current password is incorrect.";
            return res.redirect("/admin/profile");
        }

        const hashedPassword = await bcrypt.hash(new_password, 12);
        await db.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, req.session.user.id]
        );

        req.session.success = "Password changed successfully.";
        res.redirect("/admin/profile");
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to change password.");
    }
};
