const db = require("../config/database");

const VALID_STATUSES = [
    "Pending",
    "Under Review",
    "In Progress",
    "Resolved",
    "Rejected"
];

async function getAllFeedback({
    type,
    search,
    category_id,
    status,
    dateFrom,
    dateTo,
    page,
    perPage,
    assigned_to
}) {
    const whereConditions = [];
    const params = [];

    if (type) {
        whereConditions.push("f.type = ?");
        params.push(type);
    }

    if (search && search.trim()) {
        whereConditions.push("(f.title LIKE ? OR f.description LIKE ? OR u.name LIKE ?)");
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    if (category_id) {
        whereConditions.push("f.category_id = ?");
        params.push(Number(category_id));
    }

    if (status) {
        whereConditions.push("f.status = ?");
        params.push(status);
    }

    if (dateFrom) {
        whereConditions.push("DATE(f.created_at) >= ?");
        params.push(dateFrom);
    }

    if (dateTo) {
        whereConditions.push("DATE(f.created_at) <= ?");
        params.push(dateTo);
    }

    if (assigned_to !== undefined && assigned_to !== null && assigned_to !== "") {
        whereConditions.push("f.assigned_to = ?");
        params.push(Number(assigned_to));
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    const countSql = `
        SELECT COUNT(*) AS total
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        ${whereClause}
    `;

    const [countRows] = await db.execute(countSql, params);
    const total = countRows[0].total;

    let limitClause = "";
    const limitParams = [];

    if (page && perPage) {
        const pageNum = Number(page) || 1;
        const perPageNum = Number(perPage) || 10;
        const offset = (pageNum - 1) * perPageNum;
        limitClause = "LIMIT ? OFFSET ?";
        limitParams.push(perPageNum, offset);
    }

    const dataSql = `
        SELECT
            f.*,
            u.name AS student_name,
            u.student_id,
            u.email AS student_email,
            c.name AS category_name,
            s.name AS assigned_name
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN users s ON f.assigned_to = s.id
        ${whereClause}
        ORDER BY f.created_at DESC
        ${limitClause}
    `;

    const [rows] = await db.execute(dataSql, [...params, ...limitParams]);

    return { rows, total };
}

async function getFeedbackById(id) {
    const [rows] = await db.execute(`
        SELECT
            f.*,
            u.name AS student_name,
            u.student_id,
            u.email AS student_email,
            c.name AS category_name,
            s.name AS assigned_name
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN users s ON f.assigned_to = s.id
        WHERE f.id = ?
    `, [id]);

    return rows[0];
}

async function getResponses(id) {
    const [rows] = await db.execute(`
        SELECT
            r.*,
            u.name AS responder_name,
            u.role AS responder_role
        FROM feedback_responses r
        JOIN users u ON r.admin_id = u.id
        WHERE r.feedback_id = ?
        ORDER BY r.created_at ASC
    `, [id]);

    return rows;
}

async function updateStatus(id, status) {
    const [result] = await db.execute(
        "UPDATE feedback SET status = ? WHERE id = ?",
        [status, id]
    );

    return result.affectedRows;
}

async function addResponse(feedbackId, responderId, response) {
    const [result] = await db.execute(
        `INSERT INTO feedback_responses
        (feedback_id, admin_id, response)
        VALUES (?, ?, ?)`,
        [feedbackId, responderId, response]
    );

    return result.insertId;
}

async function assignStaff(id, assigned_to) {
    const [result] = await db.execute(
        "UPDATE feedback SET assigned_to = ? WHERE id = ?",
        [assigned_to, id]
    );

    return result.affectedRows;
}

async function getAllRecent(limit) {
    const [rows] = await db.execute(`
        SELECT
            f.*,
            u.name AS student_name,
            c.name AS category_name
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        ORDER BY f.created_at DESC
        LIMIT ?
    `, [Number(limit)]);

    return rows;
}

async function getStatsByStatus() {
    const [rows] = await db.execute(`
        SELECT status, COUNT(*) AS count
        FROM feedback
        GROUP BY status
        ORDER BY status
    `);

    return rows;
}

async function getStatsByCategory() {
    const [rows] = await db.execute(`
        SELECT
            c.id,
            c.name AS category_name,
            COUNT(f.id) AS count
        FROM categories c
        LEFT JOIN feedback f ON c.id = f.category_id
        GROUP BY c.id, c.name
        ORDER BY count DESC
    `);

    return rows;
}

async function getTypeCounts() {
    const [rows] = await db.execute(`
        SELECT type, COUNT(*) AS count
        FROM feedback
        GROUP BY type
    `);

    return rows;
}

async function getMonthlyTrends(months) {
    const numMonths = Number(months) || 6;
    const [rows] = await db.execute(`
        SELECT
            DATE_FORMAT(created_at, '%Y-%m') AS month,
            type,
            COUNT(*) AS count
        FROM feedback
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m'), type
        ORDER BY month ASC
    `, [numMonths]);

    return rows;
}

async function getAllStats() {
    const [rows] = await db.execute(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
        FROM feedback
    `);

    const stats = rows[0];
    return {
        total: Number(stats.total) || 0,
        pending: Number(stats.pending) || 0,
        in_progress: Number(stats.in_progress) || 0,
        resolved: Number(stats.resolved) || 0,
        rejected: Number(stats.rejected) || 0
    };
}

module.exports = {
    VALID_STATUSES,
    getAllFeedback,
    getFeedbackById,
    getResponses,
    updateStatus,
    addResponse,
    assignStaff,
    getAllRecent,
    getStatsByStatus,
    getStatsByCategory,
    getTypeCounts,
    getMonthlyTrends,
    getAllStats
};
