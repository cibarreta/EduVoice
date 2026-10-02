const db = require("../config/database");

async function createFeedback({
    user_id,
    category_id,
    title,
    description,
    type = "feedback",
    is_anonymous = 0,
    assigned_to = null
}) {
    const [result] = await db.execute(
        `INSERT INTO feedback
        (user_id, category_id, title, description, type, is_anonymous, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user_id, category_id, title, description, type, is_anonymous, assigned_to]
    );

    return result.insertId;
}

async function getFeedbackByUser(user_id) {
    const [rows] = await db.execute(
        `SELECT f.*, c.name AS category_name
         FROM feedback f
         LEFT JOIN categories c ON f.category_id = c.id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`,
        [user_id]
    );

    return rows;
}

async function getFeedbackById(id, user_id) {
    const [feedbackRows] = await db.execute(
        `SELECT f.*, c.name AS category_name
         FROM feedback f
         LEFT JOIN categories c ON f.category_id = c.id
         WHERE f.id = ? AND f.user_id = ?`,
        [id, user_id]
    );

    const feedback = feedbackRows[0];
    if (!feedback) {
        return null;
    }

    const [responses] = await db.execute(
        `SELECT r.*, u.name AS admin_name
         FROM feedback_responses r
         LEFT JOIN users u ON r.admin_id = u.id
         WHERE r.feedback_id = ?
         ORDER BY r.created_at ASC`,
        [id]
    );

    feedback.responses = responses;
    return feedback;
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
        stats.total += row.cnt;
        if (row.status === "Pending") {
            stats.pending += row.cnt;
        } else if (row.status === "In Progress" || row.status === "Under Review") {
            stats.in_progress += row.cnt;
        } else if (row.status === "Resolved") {
            stats.resolved += row.cnt;
        }
    }

    return stats;
}

async function getRecentByUser(user_id, limit = 5) {
    const [rows] = await db.execute(
        `SELECT f.*, c.name AS category_name
         FROM feedback f
         LEFT JOIN categories c ON f.category_id = c.id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC
         LIMIT ?`,
        [user_id, limit]
    );

    return rows;
}

module.exports = {
    createFeedback,
    getFeedbackByUser,
    getFeedbackById,
    getFeedbackStatsByUser,
    getRecentByUser
};
