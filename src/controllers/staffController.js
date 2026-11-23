const bcrypt = require("bcryptjs");
const db = require("../config/database");
const Feedback = require("../models/AdminFeedback");
const { recordAudit } = require("../services/auditLog");
const { createNotification } = require("../services/notifications");

const VALID_STATUSES = Feedback.VALID_STATUSES;
const PAGE_SIZE = 10;

function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "";
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
        ? ""
        : value;
}

async function getStaffDepartmentId(staffId) {
    const [rows] = await db.execute(
        "SELECT department_id FROM users WHERE id = ? AND role = 'staff' AND is_active = 1",
        [staffId]
    );
    return rows[0] && rows[0].department_id !== null
        ? Number(rows[0].department_id)
        : null;
}

async function canAccessSubmission(id, staffId, departmentId) {
    return Feedback.getFeedbackByIdForStaff(id, staffId, departmentId);
}

exports.dashboard = async (req, res) => {
    try {
        const staffId = req.session.user.id;
        const departmentId = await getStaffDepartmentId(staffId);
        const [countRows] = await db.execute(
            `SELECT
                SUM(CASE WHEN assigned_to = ? THEN 1 ELSE 0 END) AS assigned,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status IN ('Under Review', 'In Progress') THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved
             FROM feedback
             WHERE assigned_to = ? OR (assigned_to IS NULL AND department_id <=> ?)`,
            [staffId, staffId, departmentId]
        );
        const { rows: recentSubmissions } = await Feedback.getAllFeedback({
            available_to: staffId,
            available_department_id: departmentId,
            page: 1,
            perPage: 5
        });

        res.render("staff/dashboard", {
            user: req.session.user,
            stats: {
                assigned: Number(countRows[0].assigned) || 0,
                pending: Number(countRows[0].pending) || 0,
                inProgress: Number(countRows[0].in_progress) || 0,
                resolved: Number(countRows[0].resolved) || 0
            },
            recentSubmissions
        });
    } catch (error) {
        console.error("Unable to load staff dashboard:", error);
        res.status(500).render("errors/500");
    }
};

exports.listSubmissions = async (req, res) => {
    try {
        const rawPage = Number(req.query.page);
        const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
        const query = {
            q: typeof req.query.q === "string" ? req.query.q.trim() : "",
            category: typeof req.query.category === "string" && /^\d+$/.test(req.query.category)
                ? req.query.category
                : "",
            status: typeof req.query.status === "string" ? req.query.status : "",
            priority: typeof req.query.priority === "string" ? req.query.priority : "",
            dateFrom: validDate(req.query.dateFrom),
            dateTo: validDate(req.query.dateTo),
            page
        };
        const categoryId = query.category ? Number(query.category) : "";
        const status = VALID_STATUSES.includes(query.status) ? query.status : "";
        const priority = ["Low", "Normal", "High", "Urgent"].includes(query.priority)
            ? query.priority
            : "";
        const departmentId = await getStaffDepartmentId(req.session.user.id);
        const { rows: submissions, total } = await Feedback.getAllFeedback({
            available_to: req.session.user.id,
            available_department_id: departmentId,
            hideAnonymousIdentity: true,
            search: query.q,
            category_id: categoryId,
            status,
            priority,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            page,
            perPage: PAGE_SIZE
        });
        const [categories] = await db.execute(
            "SELECT id, name FROM categories ORDER BY name"
        );
        const totalPages = Math.ceil(total / PAGE_SIZE);

        res.render("staff/submissions", {
            submissions,
            categories,
            query,
            pagination: {
                page,
                totalPages,
                total,
                from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
                to: Math.min(page * PAGE_SIZE, total)
            }
        });
    } catch (error) {
        console.error("Unable to load staff submissions:", error);
        res.status(500).render("errors/500");
    }
};

exports.submissionDetails = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(404).render("errors/404");
        }

        const departmentId = await getStaffDepartmentId(req.session.user.id);
        const submission = await canAccessSubmission(id, req.session.user.id, departmentId);
        if (!submission) {
            return res.status(404).render("errors/404", {
                message: "Submission not found."
            });
        }

        const [responses, attachments] = await Promise.all([
            Feedback.getResponses(id),
            Feedback.getAttachments(id)
        ]);
        res.render("staff/submission-details", {
            submission,
            responses,
            attachments,
            user: req.session.user
        });
    } catch (error) {
        console.error("Unable to load staff submission:", error);
        res.status(500).render("errors/500");
    }
};

exports.updateStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const status = req.body && typeof req.body === "object"
            ? req.body.status
            : undefined;
        const resolutionNotes = typeof req.body.resolution_notes === "string"
            ? req.body.resolution_notes.trim()
            : "";
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).render("errors/404");
        }
        if (!VALID_STATUSES.includes(status)) {
            req.session.error = "Please select a valid status.";
            return res.redirect(`/staff/submissions/${id}`);
        }
        if (resolutionNotes.length > 3000 || status === "Resolved" && !resolutionNotes) {
            req.session.error = status === "Resolved"
                ? "Add resolution notes before marking this submission resolved."
                : "Resolution notes must be 3,000 characters or fewer.";
            return res.redirect(`/staff/submissions/${id}`);
        }
        const staffId = req.session.user.id;
        const departmentId = await getStaffDepartmentId(staffId);
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                "SELECT user_id, assigned_to, department_id, status FROM feedback WHERE id = ? FOR UPDATE",
                [id]
            );
            const submission = rows[0];
            if (!submission ||
                Number(submission.assigned_to) !== Number(staffId) &&
                    !(submission.assigned_to === null &&
                        (submission.department_id === null
                            ? departmentId === null
                            : Number(submission.department_id) === departmentId))) {
                await connection.rollback();
                return res.status(404).render("errors/404", {
                    user: req.session.user,
                    message: "Submission not found."
                });
            }
            if (submission.assigned_to === null) {
                await connection.execute(
                    "UPDATE feedback SET assigned_to = ? WHERE id = ? AND assigned_to IS NULL",
                    [staffId, id]
                );
                await recordAudit(connection, {
                    actorUserId: staffId,
                    action: "feedback.claimed",
                    entityType: "feedback",
                    entityId: id,
                    details: { departmentId }
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
                    actorUserId: staffId,
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
        res.redirect(`/staff/submissions/${id}`);
    } catch (error) {
        console.error("Unable to update staff submission status:", error);
        res.status(500).render("errors/500");
    }
};

exports.respond = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const response = typeof req.body.response === "string"
            ? req.body.response.trim()
            : "";
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).render("errors/404");
        }
        if (!response || response.length > 10000) {
            req.session.error = "Enter a response of up to 10,000 characters.";
            return res.redirect(`/staff/submissions/${id}`);
        }
        const staffId = req.session.user.id;
        const departmentId = await getStaffDepartmentId(staffId);
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute(
                "SELECT user_id, assigned_to, department_id FROM feedback WHERE id = ? FOR UPDATE",
                [id]
            );
            const submission = rows[0];
            if (!submission ||
                Number(submission.assigned_to) !== Number(staffId) &&
                    !(submission.assigned_to === null &&
                        (submission.department_id === null
                            ? departmentId === null
                            : Number(submission.department_id) === departmentId))) {
                await connection.rollback();
                return res.status(404).render("errors/404", {
                    user: req.session.user,
                    message: "Submission not found."
                });
            }
            if (submission.assigned_to === null) {
                await connection.execute(
                    "UPDATE feedback SET assigned_to = ? WHERE id = ? AND assigned_to IS NULL",
                    [staffId, id]
                );
                await recordAudit(connection, {
                    actorUserId: staffId,
                    action: "feedback.claimed",
                    entityType: "feedback",
                    entityId: id,
                    details: { departmentId }
                });
            }
            await connection.execute(
                "INSERT INTO feedback_responses (feedback_id, admin_id, response) VALUES (?, ?, ?)",
                [id, staffId, response]
            );
            await createNotification(connection, {
                userId: submission.user_id,
                feedbackId: id,
                eventType: "response_added",
                title: "You received a response",
                message: `A staff member responded to your submission #${id}.`
            });
            await recordAudit(connection, {
                actorUserId: staffId,
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
        req.session.success = "Response sent successfully.";
        res.redirect(`/staff/submissions/${id}`);
    } catch (error) {
        console.error("Unable to send staff response:", error);
        res.status(500).render("errors/500");
    }
};

exports.showProfile = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT u.id, u.name, u.email, u.role, u.department_id, d.name AS department_name, u.created_at
             FROM users u
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE u.id = ? AND u.role = 'staff'`,
            [req.session.user.id]
        );
        if (rows.length === 0) {
            req.session.destroy(() => {});
            return res.redirect("/login");
        }
        res.render("staff/profile", {
            staff: rows[0],
            user: req.session.user
        });
    } catch (error) {
        console.error("Unable to load staff profile:", error);
        res.status(500).render("errors/500");
    }
};

exports.updateName = async (req, res) => {
    try {
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        if (!name || name.length > 150) {
            req.session.error = "Enter a name up to 150 characters.";
            return res.redirect("/staff/profile");
        }
        await db.execute("UPDATE users SET name = ? WHERE id = ? AND role = 'staff'", [
            name,
            req.session.user.id
        ]);
        req.session.user.name = name;
        req.session.success = "Profile updated successfully.";
        res.redirect("/staff/profile");
    } catch (error) {
        console.error("Unable to update staff profile:", error);
        req.session.error = "Unable to update your profile.";
        res.redirect("/staff/profile");
    }
};

exports.changePassword = async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const current_password = typeof body.current_password === "string" ? body.current_password : "";
        const new_password = typeof body.new_password === "string" ? body.new_password : "";
        const confirm_password = typeof body.confirm_password === "string" ? body.confirm_password : "";
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
            "SELECT password FROM users WHERE id = ? AND role = 'staff'",
            [req.session.user.id]
        );
        if (rows.length === 0 || !(await bcrypt.compare(current_password, rows[0].password))) {
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
        console.error("Unable to change staff password:", error);
        req.session.error = "Unable to change your password.";
        res.redirect("/staff/profile");
    }
};
