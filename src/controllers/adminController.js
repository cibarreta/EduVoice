const bcrypt = require("bcryptjs");
const Feedback = require("../models/AdminFeedback");
const db = require("../config/database");
const { recordAudit } = require("../services/auditLog");
const {
    createNotification,
    notifyDepartmentStaff
} = require("../services/notifications");

const VALID_STATUSES = [
    "Pending",
    "Under Review",
    "In Progress",
    "Resolved",
    "Rejected"
];
const VALID_SORTS = ["newest", "oldest", "status", "title"];

function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "";
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
        ? ""
        : value;
}

function getListFilters(query) {
    const rawCategory = query.category || query.category_id;
    const categoryNumber = Number(rawCategory);
    const sort = VALID_SORTS.includes(query.sort) ? query.sort : "newest";
    return {
        search: typeof query.search === "string" ? query.search.trim() : "",
        categoryId: Number.isInteger(categoryNumber) && categoryNumber > 0
            ? categoryNumber
            : "",
        status: VALID_STATUSES.includes(query.status) ? query.status : "",
        priority: ["Low", "Normal", "High", "Urgent"].includes(query.priority)
            ? query.priority
            : "",
        departmentId: /^\d+$/.test(query.department_id || "") &&
            Number(query.department_id) > 0
            ? Number(query.department_id)
            : "",
        dateFrom: validDate(query.dateFrom),
        dateTo: validDate(query.dateTo),
        sort
    };
}

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
        whereConditions.push("u.role = ?");
        params.push(role);
    }

    if (search && search.trim()) {
        whereConditions.push("(u.name LIKE ? OR u.email LIKE ? OR u.student_id LIKE ?)");
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const [countRows] = await db.execute(
        `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
        params
    );
    const total = countRows[0].total;

    const pageNum = Number(page) || 1;
    const perPageNum = Number(perPage) || 10;
    const offset = (pageNum - 1) * perPageNum;

    const [rows] = await db.execute(
        `SELECT u.id, u.student_id, u.name, u.email, u.role, u.is_active,
                u.department_id, d.name AS department_name, u.created_at, u.updated_at
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         ${whereClause}
         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
        [...params, perPageNum, offset]
    );

    return { rows, total };
}

async function getUserById(id) {
    const [rows] = await db.execute(
        `SELECT u.id, u.student_id, u.name, u.email, u.role, u.is_active,
                u.department_id, d.name AS department_name, u.created_at, u.updated_at
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = ?`,
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

async function activeAdminCount() {
    const [rows] = await db.execute(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1"
    );
    return Number(rows[0].count) || 0;
}

exports.dashboard = async (req, res) => {
    try {
        const rawStats = await Feedback.getAllStats();
        const userCounts = await getUserCounts();
        const recentSubmissions = await Feedback.getAllRecent(10);

        const monthlyRaw = await Feedback.getMonthlyTrends(7);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartBuckets = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            chartBuckets.push({ key, label: monthNames[d.getMonth()], count: 0 });
        }
        monthlyRaw.forEach(function (row) {
            const match = chartBuckets.find(function (b) { return b.key === row.month; });
            if (match) { match.count += Number(row.count) || 0; }
        });
        const chartData = chartBuckets.map(function (b) {
            return { label: b.label, count: b.count };
        });

        const stats = {
            totalSubmissions: rawStats.total,
            pending: rawStats.pending,
            inProgress: rawStats.in_progress,
            resolved: rawStats.resolved,
            rejected: rawStats.rejected,
            totalStudents: userCounts.students,
            totalStaff: userCounts.staff,
            totalAdmins: userCounts.admins
        };

        res.render("admin/dashboard", {
            stats,
            userCounts,
            chartData,
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
        const { search, categoryId, status, priority, departmentId, dateFrom, dateTo, sort } = getListFilters(req.query);
        const requestedPage = Number(req.query.page);
        const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
        const perPage = 10;

        const { rows: submissions, total } = await Feedback.getAllFeedback({
            type: "feedback",
            search,
            category_id: categoryId,
            status,
            priority,
            department_id: departmentId,
            dateFrom,
            dateTo,
            sort,
            page,
            perPage
        });

        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );
        const [departments] = await db.execute("SELECT id, name FROM departments ORDER BY name");

        const statuses = VALID_STATUSES;
        const totalPages = Math.ceil(total / perPage);
        res.render("admin/feedback", {
            submissions,
            categories,
            departments,
            statuses,
            filters: { search, category_id: categoryId, status, priority, department_id: departmentId, dateFrom, dateTo, sort },
            searchQuery: search || "",
            selectedCategory: categoryId || "",
            selectedStatus: status || "",
            selectedPriority: priority || "",
            selectedDepartment: departmentId || "",
            dateFrom: dateFrom || "",
            dateTo: dateTo || "",
            selectedSort: sort,
            page,
            totalPages,
            user: req.session.user,
            showAllSubmissions: false,
            activePage: "feedback"
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load feedback.");
    }
};

exports.listSuggestions = async (req, res) => {
    try {
        const { search, categoryId, status, priority, departmentId, dateFrom, dateTo, sort } = getListFilters(req.query);
        const requestedPage = Number(req.query.page);
        const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
        const perPage = 10;

        const { rows: submissions, total } = await Feedback.getAllFeedback({
            type: "suggestion",
            search,
            category_id: categoryId,
            status,
            priority,
            department_id: departmentId,
            dateFrom,
            dateTo,
            sort,
            page,
            perPage
        });

        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );
        const [departments] = await db.execute("SELECT id, name FROM departments ORDER BY name");

        const statuses = VALID_STATUSES;
        const totalPages = Math.ceil(total / perPage);
        res.render("admin/suggestions", {
            submissions,
            categories,
            departments,
            statuses,
            filters: { search, category_id: categoryId, status, priority, department_id: departmentId, dateFrom, dateTo, sort },
            searchQuery: search || "",
            selectedCategory: categoryId || "",
            selectedStatus: status || "",
            selectedPriority: priority || "",
            selectedDepartment: departmentId || "",
            dateFrom: dateFrom || "",
            dateTo: dateTo || "",
            selectedSort: sort,
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

exports.listAllSubmissions = async (req, res) => {
    try {
        const { search, categoryId, status, priority, departmentId, dateFrom, dateTo, sort } = getListFilters(req.query);
        const requestedPage = Number(req.query.page);
        const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
        const perPage = 10;
        const { rows: submissions, total } = await Feedback.getAllFeedback({
            search,
            category_id: categoryId,
            status,
            priority,
            department_id: departmentId,
            dateFrom,
            dateTo,
            sort,
            page,
            perPage
        });
        const [categories] = await db.execute(
            "SELECT id, name FROM categories ORDER BY name"
        );
        const [departments] = await db.execute("SELECT id, name FROM departments ORDER BY name");

        res.render("admin/feedback", {
            submissions,
            categories,
            departments,
            statuses: VALID_STATUSES,
            filters: { search, category_id: categoryId, status, priority, department_id: departmentId, dateFrom, dateTo, sort },
            searchQuery: search,
            selectedCategory: categoryId,
            selectedStatus: status,
            selectedPriority: priority,
            selectedDepartment: departmentId,
            dateFrom,
            dateTo,
            selectedSort: sort,
            page,
            totalPages: Math.ceil(total / perPage),
            showAllSubmissions: true,
            user: req.session.user,
            activePage: "submissions"
        });
    } catch (error) {
        console.error("Unable to load all submissions:", error);
        res.status(500).render("errors/500");
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
        if (submission.is_anonymous) {
            submission.student_name = "Anonymous";
            submission.student_id = null;
            submission.student_email = null;
        }

        const [responses, attachments] = await Promise.all([
            Feedback.getResponses(id),
            Feedback.getAttachments(id)
        ]);

        const [staffUsers] = await db.execute(
            `SELECT u.id, u.name, u.department_id, d.name AS department_name
             FROM users u
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.role = 'staff' AND u.is_active = 1
             ORDER BY u.name`
        );

        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );
        const [departments] = await db.execute("SELECT id, name FROM departments ORDER BY name");

        const statuses = VALID_STATUSES;
        const activePage = submission.type === "suggestion" ? "suggestions" : "feedback";

        res.render("admin/submission-details", {
            submission,
            responses,
            attachments,
            staffUsers,
            departments,
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
        const status = req.body && typeof req.body === "object"
            ? req.body.status
            : undefined;
        const resolutionNotes = typeof req.body.resolution_notes === "string"
            ? req.body.resolution_notes.trim()
            : "";

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).send("Invalid status.");
        }
        if (resolutionNotes.length > 3000 || status === "Resolved" && !resolutionNotes) {
            req.session.error = status === "Resolved"
                ? "Add resolution notes before marking this submission resolved."
                : "Resolution notes must be 3,000 characters or fewer.";
            return res.redirect(`/admin/submissions/${id}`);
        }
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                "SELECT user_id, status FROM feedback WHERE id = ? FOR UPDATE",
                [id]
            );
            const submission = rows[0];
            if (!submission) {
                await connection.rollback();
                return res.status(404).render("errors/404", {
                    user: req.session.user,
                    message: "Submission not found."
                });
            }
            await connection.execute(
                `UPDATE feedback
                 SET status = ?, resolution_notes = IF(? = '', resolution_notes, ?)
                 WHERE id = ?`,
                [status, resolutionNotes, resolutionNotes, id]
            );
            if (submission.status !== status || resolutionNotes) {
                await recordAudit(connection, {
                    actorUserId: req.session.user.id,
                    action: "feedback.updated",
                    entityType: "feedback",
                    entityId: id,
                    details: {
                        statusFrom: submission.status,
                        statusTo: status,
                        resolutionNotesUpdated: Boolean(resolutionNotes)
                    }
                });
                await createNotification(connection, {
                    userId: submission.user_id,
                    feedbackId: id,
                    eventType: "status_updated",
                    title: "Submission status updated",
                    message: `Your submission #${id} is now ${status}.`
                });
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

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
        const response = typeof req.body.response === "string"
            ? req.body.response.trim()
            : "";

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        if (!response || response.length > 10000) {
            req.session.error = "Enter a response of up to 10,000 characters.";
            return res.redirect(`/admin/submissions/${id}`);
        }

        const submission = await Feedback.getFeedbackById(id);
        if (!submission) {
            return res.status(404).render("errors/404", {
                user: req.session.user,
                message: "Submission not found."
            });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                "SELECT user_id, status FROM feedback WHERE id = ? FOR UPDATE",
                [id]
            );
            const current = rows[0];
            if (!current) {
                await connection.rollback();
                return res.status(404).render("errors/404", {
                    user: req.session.user,
                    message: "Submission not found."
                });
            }
            await connection.execute(
                "INSERT INTO feedback_responses (feedback_id, admin_id, response) VALUES (?, ?, ?)",
                [id, req.session.user.id, response]
            );
            if (current.status === "Pending") {
                await connection.execute(
                    "UPDATE feedback SET status = 'Under Review' WHERE id = ?",
                    [id]
                );
                await createNotification(connection, {
                    userId: current.user_id,
                    feedbackId: id,
                    eventType: "status_updated",
                    title: "Submission status updated",
                    message: `Your submission #${id} is now Under Review.`
                });
            }
            await createNotification(connection, {
                userId: current.user_id,
                feedbackId: id,
                eventType: "response_added",
                title: "You received a response",
                message: `A school administrator responded to your submission #${id}.`
            });
            await recordAudit(connection, {
                actorUserId: req.session.user.id,
                action: "feedback.response_added",
                entityType: "feedback",
                entityId: id,
                details: { responseLength: response.length }
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        req.session.success = "Response submitted successfully.";
        res.redirect(`/admin/submissions/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to submit response.");
    }
};

exports.assignStaff = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const rawAssignedTo = req.body && typeof req.body === "object"
            ? req.body.assigned_to
            : undefined;
        const rawDepartmentId = req.body && typeof req.body === "object"
            ? req.body.department_id
            : undefined;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid submission ID.");
        }

        let assignedTo = null;
        let departmentId = null;
        if (rawDepartmentId !== "" && rawDepartmentId !== undefined) {
            departmentId = typeof rawDepartmentId === "string" ? Number(rawDepartmentId) : NaN;
            if (!Number.isInteger(departmentId) || departmentId <= 0) {
                req.session.error = "Please select a valid department.";
                return res.redirect(`/admin/submissions/${id}`);
            }
            const [departments] = await db.execute("SELECT id FROM departments WHERE id = ?", [departmentId]);
            if (departments.length === 0) {
                req.session.error = "Please select a valid department.";
                return res.redirect(`/admin/submissions/${id}`);
            }
        }
        if (rawAssignedTo !== "" && rawAssignedTo !== undefined) {
            assignedTo = typeof rawAssignedTo === "string" ? Number(rawAssignedTo) : NaN;
            if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
                req.session.error = "Please select an active staff member.";
                return res.redirect(`/admin/submissions/${id}`);
            }

            const [staffUsers] = await db.execute(
                "SELECT id, department_id FROM users WHERE id = ? AND role = 'staff' AND is_active = 1",
                [assignedTo]
            );
            if (staffUsers.length === 0 ||
                staffUsers[0].department_id === null && departmentId !== null ||
                staffUsers[0].department_id !== null &&
                    departmentId !== null &&
                    Number(staffUsers[0].department_id) !== departmentId) {
                req.session.error = "Please select an active staff member.";
                return res.redirect(`/admin/submissions/${id}`);
            }
            departmentId = staffUsers[0].department_id === null
                ? null
                : Number(staffUsers[0].department_id);
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [currentRows] = await connection.execute(
                "SELECT user_id, assigned_to, department_id FROM feedback WHERE id = ? FOR UPDATE",
                [id]
            );
            const current = currentRows[0];
            if (!current) {
                await connection.rollback();
                return res.status(404).render("errors/404", {
                    user: req.session.user,
                    message: "Submission not found."
                });
            }
            await connection.execute(
                "UPDATE feedback SET assigned_to = ?, department_id = ? WHERE id = ?",
                [assignedTo, departmentId, id]
            );
            const assignmentChanged =
                Number(current.assigned_to) !== Number(assignedTo) ||
                (current.department_id === null
                    ? departmentId !== null
                    : Number(current.department_id) !== Number(departmentId));
            if (assignmentChanged && assignedTo !== null) {
                await createNotification(connection, {
                    userId: assignedTo,
                    feedbackId: id,
                    eventType: "feedback_assigned",
                    title: "Submission assigned to you",
                    message: `Submission #${id} has been assigned to you.`
                });
            } else if (assignmentChanged && departmentId !== null) {
                await notifyDepartmentStaff(connection, departmentId, {
                    feedbackId: id,
                    eventType: "feedback_assigned",
                    title: "New submission in your department queue",
                    message: `Submission #${id} is available in your department queue.`
                });
            }
            if (assignmentChanged) {
                await recordAudit(connection, {
                    actorUserId: req.session.user.id,
                    action: "feedback.assigned",
                    entityType: "feedback",
                    entityId: id,
                    details: {
                        assignedTo,
                        departmentId,
                        previousAssignedTo: current.assigned_to,
                        previousDepartmentId: current.department_id
                    }
                });
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        req.session.success = "Staff assigned successfully.";
        res.redirect(`/admin/submissions/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to assign staff.");
    }
};

exports.updatePriority = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const priority = typeof req.body.priority === "string" ? req.body.priority : "";
        if (!Number.isSafeInteger(id) || id <= 0 ||
            !["Low", "Normal", "High", "Urgent"].includes(priority)) {
            return res.status(400).render("errors/400", {
                user: req.session.user,
                message: "Select a valid priority."
            });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                "SELECT priority, user_id FROM feedback WHERE id = ? FOR UPDATE",
                [id]
            );
            if (!rows[0]) {
                await connection.rollback();
                return res.status(404).render("errors/404", { user: req.session.user });
            }
            const oldPriority = rows[0].priority;
            if (oldPriority !== priority) {
                await connection.execute("UPDATE feedback SET priority = ? WHERE id = ?", [priority, id]);
                await recordAudit(connection, {
                    actorUserId: req.session.user.id,
                    action: "feedback.priority_updated",
                    entityType: "feedback",
                    entityId: id,
                    details: { from: oldPriority, to: priority }
                });
                await createNotification(connection, {
                    userId: rows[0].user_id,
                    feedbackId: id,
                    eventType: "priority_updated",
                    title: "Submission priority updated",
                    message: `The priority of submission #${id} is now ${priority}.`
                });
            }
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        req.session.success = "Priority updated successfully.";
        res.redirect(`/admin/submissions/${id}`);
    } catch (error) {
        console.error("Unable to update submission priority:", error);
        res.status(500).render("errors/500");
    }
};

exports.listUsers = async (req, res) => {
    try {
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const allowedRoles = ["student", "staff", "admin"];
        const role = typeof req.query.role === "string" && allowedRoles.includes(req.query.role)
            ? req.query.role
            : "";
        const requestedPage = Number(req.query.page);
        const page = Number.isInteger(requestedPage) && requestedPage > 0
            ? requestedPage
            : 1;
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
        const [departments] = await db.execute("SELECT id, name FROM departments ORDER BY name");

        res.render("admin/user-details", {
            userDetail,
            userStats,
            userSubmissions,
            departments,
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
        const role = req.body && typeof req.body === "object"
            ? req.body.role
            : undefined;
        const validRoles = ["student", "staff", "admin"];

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid user ID.");
        }
        if (id === Number(req.session.user.id)) {
            req.session.error = "You cannot change your own administrator role.";
            return res.redirect(`/admin/users/${id}`);
        }

        if (!validRoles.includes(role)) {
            return res.status(400).send("Invalid role.");
        }

        const target = await getUserById(id);
        if (!target) {
            return res.status(404).render("errors/404", { user: req.session.user });
        }
        if (
            target.role === "admin" &&
            target.is_active &&
            role !== "admin" &&
            await activeAdminCount() <= 1
        ) {
            req.session.error = "The last active administrator cannot be demoted.";
            return res.redirect(`/admin/users/${id}`);
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(
                "UPDATE users SET role = ?, department_id = IF(? = 'staff', department_id, NULL) WHERE id = ?",
                [role, role, id]
            );
            await recordAudit(connection, {
                actorUserId: req.session.user.id,
                action: "user.role_updated",
                entityType: "user",
                entityId: id,
                details: { from: target.role, to: role }
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

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

        if (id === Number(req.session.user.id)) {
            req.session.error = "You cannot deactivate your own administrator account.";
            return res.redirect(`/admin/users/${id}`);
        }

        const target = await getUserById(id);
        if (!target) {
            return res.status(404).render("errors/404", { user: req.session.user });
        }
        if (
            target.role === "admin" &&
            target.is_active &&
            await activeAdminCount() <= 1
        ) {
            req.session.error = "The last active administrator cannot be deactivated.";
            return res.redirect(`/admin/users/${id}`);
        }

        const newStatus = Number(target.is_active) ? 0 : 1;
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);
            await recordAudit(connection, {
                actorUserId: req.session.user.id,
                action: newStatus ? "user.activated" : "user.deactivated",
                entityType: "user",
                entityId: id,
                details: { isActive: Boolean(newStatus) }
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }

        req.session.success = "User status updated successfully.";
        res.redirect(`/admin/users/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update user status.");
    }
};

exports.updateUserDepartment = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const rawDepartmentId = req.body.department_id;
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).render("errors/400", { user: req.session.user });
        }
        const target = await getUserById(id);
        if (!target) return res.status(404).render("errors/404", { user: req.session.user });
        if (target.role !== "staff") {
            req.session.error = "Departments can only be assigned to staff accounts.";
            return res.redirect(`/admin/users/${id}`);
        }
        let departmentId = null;
        if (rawDepartmentId !== "") {
            departmentId = typeof rawDepartmentId === "string" ? Number(rawDepartmentId) : NaN;
            if (!Number.isSafeInteger(departmentId) || departmentId <= 0) {
                req.session.error = "Select a valid department.";
                return res.redirect(`/admin/users/${id}`);
            }
            const [departments] = await db.execute("SELECT id FROM departments WHERE id = ?", [departmentId]);
            if (!departments.length) {
                req.session.error = "Select a valid department.";
                return res.redirect(`/admin/users/${id}`);
            }
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute("UPDATE users SET department_id = ? WHERE id = ?", [departmentId, id]);
            await recordAudit(connection, {
                actorUserId: req.session.user.id,
                action: "user.department_updated",
                entityType: "user",
                entityId: id,
                details: {
                    from: target.department_id,
                    to: departmentId
                }
            });
            await createNotification(connection, {
                userId: id,
                eventType: "department_updated",
                title: "Your department was updated",
                message: departmentId
                    ? "An administrator assigned you to a department."
                    : "An administrator removed your department assignment."
            });
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        req.session.success = "Staff department updated successfully.";
        res.redirect(`/admin/users/${id}`);
    } catch (error) {
        console.error("Unable to update staff department:", error);
        res.status(500).render("errors/500");
    }
};

exports.statistics = async (req, res) => {
    try {
        const [
            statsByStatus,
            statsByCategory,
            typeCounts,
            monthlyTrends,
            userCounts,
            allStats,
            avgResolutionDays,
            priorityCounts,
            departmentCounts
        ] = await Promise.all([
            Feedback.getStatsByStatus(),
            Feedback.getStatsByCategory(),
            Feedback.getTypeCounts(),
            Feedback.getMonthlyTrends(6),
            getUserCounts(),
            Feedback.getAllStats(),
            Feedback.getAvgResolutionDays(),
            Feedback.getPriorityCounts(),
            Feedback.getDepartmentCounts()
        ]);

        const statusCount = {};
        VALID_STATUSES.forEach(function (s) { statusCount[s] = 0; });
        statsByStatus.forEach(function (row) {
            if (VALID_STATUSES.includes(row.status)) {
                statusCount[row.status] = Number(row.count) || 0;
            }
        });

        const typeCount = { feedback: 0, suggestion: 0 };
        typeCounts.forEach(function (row) {
            if (row.type === "feedback" || row.type === "suggestion") {
                typeCount[row.type] = Number(row.count) || 0;
            }
        });
        const priorityStats = priorityCounts.map((row) => ({
            priority: row.priority,
            count: Number(row.count) || 0
        }));
        const departmentStats = departmentCounts.map((row) => ({
            name: row.name,
            count: Number(row.count) || 0
        }));

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthBuckets = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            monthBuckets.push({ key, label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`, feedback: 0, suggestions: 0 });
        }
        monthlyTrends.forEach(function (row) {
            const match = monthBuckets.find(function (b) { return b.key === row.month; });
            if (!match) return;
            const amt = Number(row.count) || 0;
            if (row.type === "suggestion") match.suggestions += amt;
            else match.feedback += amt;
        });
        const monthlyData = monthBuckets;

        const categoryStats = statsByCategory.map(function (row) {
            return {
                id: row.id,
                name: row.name || row.category_name,
                count: Number(row.count) || 0
            };
        });

        const totalSubmissions = allStats.total;
        const pendingCount = statusCount["Pending"] || 0;
        const underReviewCount = statusCount["Under Review"] || 0;
        const inProgressCount = statusCount["In Progress"] || 0;
        const resolvedCount = statusCount["Resolved"] || 0;
        const rejectedCount = statusCount["Rejected"] || 0;
        const feedbackCount = typeCount.feedback;
        const suggestionsCount = typeCount.suggestion;

        const denominator = allStats.total - allStats.rejected;
        const resolutionRate = denominator > 0
            ? (allStats.resolved / denominator) * 100
            : 0;

        res.render("admin/statistics", {
            statsByStatus,
            statsByCategory,
            categoryStats,
            typeCounts,
            priorityStats,
            departmentStats,
            monthlyTrends,
            monthlyData,
            userCounts,
            allStats,
            totalSubmissions,
            pendingCount,
            underReviewCount,
            inProgressCount,
            resolvedCount,
            rejectedCount,
            feedbackCount,
            suggestionsCount,
            resolutionRate: Number(resolutionRate.toFixed(2)),
            avgResolutionDays,
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
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const name = typeof body.name === "string" ? body.name.trim() : "";

        if (!name || name.length > 150) {
            req.session.error = "Enter a name up to 150 characters.";
            return res.redirect("/admin/profile");
        }

        await db.execute(
            "UPDATE users SET name = ? WHERE id = ?",
            [name, req.session.user.id]
        );

        req.session.user.name = name;
        req.session.success = "Name updated successfully.";
        res.redirect("/admin/profile");
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update name.");
    }
};

exports.changeAdminPassword = async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const currentValue = body.current_password || body.currentPassword;
        const newValue = body.new_password || body.newPassword;
        const confirmValue = body.confirm_password || body.confirmPassword;
        const current_password = typeof currentValue === "string" ? currentValue : "";
        const new_password = typeof newValue === "string" ? newValue : "";
        const confirm_password = typeof confirmValue === "string" ? confirmValue : "";

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
