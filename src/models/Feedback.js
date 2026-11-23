const db = require("../config/database");

async function createFeedback({
    user_id,
    category_id,
    title,
    description,
    type = "feedback",
    is_anonymous = 0,
    priority = "Normal",
    student_department_id,
    department_id = null,
    assigned_to = null
}, executor = db) {
    const [result] = await executor.execute(
        `INSERT INTO feedback
        (user_id, category_id, title, description, type, is_anonymous, priority, student_department_id, department_id, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            user_id,
            category_id,
            title,
            description,
            type,
            is_anonymous,
            priority,
            student_department_id,
            department_id,
            assigned_to
        ]
    );

    return result.insertId;
}

async function getFeedbackByUser(user_id, type) {
    const conditions = ["f.user_id = ?"];
    const params = [user_id];
    if (type) {
        conditions.push("f.type = ?");
        params.push(type);
    }

    const [rows] = await db.execute(
        `SELECT f.*, CONCAT('EV-', LPAD(f.id, 6, '0')) AS ticket_number,
                c.name AS category_name, sd.name AS student_department_name
         FROM feedback f
         LEFT JOIN categories c ON f.category_id = c.id
         LEFT JOIN departments sd ON f.student_department_id = sd.id
         WHERE ${conditions.join(" AND ")}
         ORDER BY f.created_at DESC`,
        params
    );

    return rows;
}

async function getFeedbackById(id, user_id) {
    const [feedbackRows] = await db.execute(
        `SELECT f.*, CONCAT('EV-', LPAD(f.id, 6, '0')) AS ticket_number,
                c.name AS category_name, sd.name AS student_department_name
         FROM feedback f
         LEFT JOIN categories c ON f.category_id = c.id
         LEFT JOIN departments sd ON f.student_department_id = sd.id
         WHERE f.id = ? AND f.user_id = ?`,
        [id, user_id]
    );

    const feedback = feedbackRows[0];
    if (!feedback) {
        return null;
    }

    const [responses] = await db.execute(
        `SELECT r.*, u.name AS admin_name, u.name AS responder_name,
                u.role AS responder_role
         FROM feedback_responses r
         LEFT JOIN users u ON r.admin_id = u.id
         WHERE r.feedback_id = ?
         ORDER BY r.created_at ASC`,
        [id]
    );

    feedback.responses = responses;
    feedback.attachments = await getAttachments(id);
    return feedback;
}

async function getAttachments(feedbackId) {
    const [rows] = await db.execute(
        `SELECT id, feedback_id, original_name, mime_type, size_bytes, created_at
         FROM feedback_attachments
         WHERE feedback_id = ?
         ORDER BY created_at`,
        [feedbackId]
    );
    return rows;
}

async function getFeedbackStatsByUser(user_id) {
    const [rows] = await db.execute(
        `SELECT status, COUNT(*) as cnt
         FROM feedback
         WHERE user_id = ?
         GROUP BY status`,
        [user_id]
    );

    const stats = {
        total: 0,
        pending: 0,
        in_progress: 0,
        resolved: 0
    };

    for (const row of rows) {
        const count = Number(row.cnt);
        stats.total += count;
        if (row.status === "Pending") {
            stats.pending += count;
        } else if (row.status === "In Progress" || row.status === "Under Review") {
            stats.in_progress += count;
        } else if (row.status === "Resolved") {
            stats.resolved += count;
        }
    }

    return stats;
}


async function getRecentByUser(user_id, limit = 5) {
    const parsedLimit = Number(limit);
    const safeLimit =
        Number.isSafeInteger(parsedLimit) && parsedLimit > 0
            ? Math.min(parsedLimit, 100)
            : 5;

    const [rows] = await db.execute(
        `SELECT f.*, CONCAT('EV-', LPAD(f.id, 6, '0')) AS ticket_number,
                c.name AS category_name, sd.name AS student_department_name
         FROM feedback f
         LEFT JOIN categories c ON f.category_id = c.id
         LEFT JOIN departments sd ON f.student_department_id = sd.id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC
         LIMIT ${safeLimit}`,
        [user_id]
    );

    return rows;
}

module.exports = {
    createFeedback,
    getFeedbackByUser,
    getFeedbackById,
    getAttachments,
    getFeedbackStatsByUser,
    getRecentByUser
};
