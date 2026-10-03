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
    assigned_to,
    available_to,
    available_department_id,
    hideAnonymousIdentity = false,
    priority,
    department_id,
    sort
}) {
    const whereConditions = [];
    const params = [];

    if (type) {
        whereConditions.push("f.type = ?");
        params.push(type);
    }

    if (priority) {
        whereConditions.push("f.priority = ?");
        params.push(priority);
    }

    if (department_id) {
        whereConditions.push("f.department_id = ?");
        params.push(Number(department_id));
    }

    if (search && search.trim()) {
        whereConditions.push(hideAnonymousIdentity
            ? "(f.title LIKE ? OR f.description LIKE ? OR (f.is_anonymous = 0 AND u.name LIKE ?))"
            : "(f.title LIKE ? OR f.description LIKE ? OR u.name LIKE ?)");
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

    if (available_to !== undefined && available_to !== null && available_to !== "") {
        if (available_department_id !== undefined && available_department_id !== null) {
            whereConditions.push("(f.assigned_to = ? OR (f.assigned_to IS NULL AND f.department_id = ?))");
            params.push(Number(available_to), Number(available_department_id));
        } else {
            whereConditions.push("(f.assigned_to = ? OR (f.assigned_to IS NULL AND f.department_id IS NULL))");
            params.push(Number(available_to));
        }
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
            CASE WHEN f.is_anonymous = 1 THEN 'Anonymous' ELSE u.name END AS student_name,
            CASE WHEN f.is_anonymous = 1 THEN NULL ELSE u.student_id END AS student_id,
            CASE WHEN f.is_anonymous = 1 THEN NULL ELSE u.email END AS student_email,
            c.name AS category_name,
            d.name AS department_name,
            s.name AS assigned_name
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN departments d ON f.department_id = d.id
        LEFT JOIN users s ON f.assigned_to = s.id
        ${whereClause}
        ORDER BY ${
            {
                oldest: "f.created_at ASC",
                status: "f.status ASC, f.created_at DESC",
                title: "f.title ASC, f.created_at DESC"
            }[sort] || "f.created_at DESC"
        }
        ${limitClause}
    `;

    const [rows] = await db.execute(dataSql, [...params, ...limitParams]);

    return { rows, total };
}

async function getFeedbackById(id) {
    const [rows] = await db.execute(`
        SELECT
            f.*,
            CASE WHEN f.is_anonymous = 1 THEN 'Anonymous' ELSE u.name END AS student_name,
            CASE WHEN f.is_anonymous = 1 THEN NULL ELSE u.student_id END AS student_id,
            CASE WHEN f.is_anonymous = 1 THEN NULL ELSE u.email END AS student_email,
            c.name AS category_name,
            d.name AS department_name,
            s.name AS assigned_name
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN departments d ON f.department_id = d.id
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
            u.name AS admin_name,
            u.name AS staff_name,
            u.role AS responder_role,
            u.role AS admin_role,
            u.role AS role
        FROM feedback_responses r
        JOIN users u ON r.admin_id = u.id
        WHERE r.feedback_id = ?
        ORDER BY r.created_at ASC
    `, [id]);

    return rows;
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

async function getFeedbackByIdForStaff(id, staffId, departmentId = null) {
    const [rows] = await db.execute(`
        SELECT
            f.*,
            CASE WHEN f.is_anonymous = 1 THEN 'Anonymous' ELSE u.name END AS student_name,
            CASE WHEN f.is_anonymous = 1 THEN NULL ELSE u.student_id END AS student_id,
            CASE WHEN f.is_anonymous = 1 THEN NULL ELSE u.email END AS student_email,
            c.name AS category_name,
            s.name AS assigned_name
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN users s ON f.assigned_to = s.id
        WHERE f.id = ? AND (
            f.assigned_to = ? OR
            (f.assigned_to IS NULL AND f.department_id <=> ?)
        )
    `, [id, staffId, departmentId]);

    return rows[0];
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
            CASE WHEN f.is_anonymous = 1 THEN 'Anonymous' ELSE u.name END AS student_name,
            c.name AS category_name,
            d.name AS department_name
        FROM feedback f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN categories c ON f.category_id = c.id
        LEFT JOIN departments d ON f.department_id = d.id
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
            c.name AS name,
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

async function getPriorityCounts() {
    const [rows] = await db.execute(
        "SELECT priority, COUNT(*) AS count FROM feedback GROUP BY priority ORDER BY priority"
    );
    return rows;
}

async function getDepartmentCounts() {
    const [rows] = await db.execute(`
        SELECT d.id, d.name, COUNT(f.id) AS count
        FROM departments d
        LEFT JOIN feedback f ON f.department_id = d.id
        GROUP BY d.id, d.name
        ORDER BY d.name
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
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN priority = 'Urgent' THEN 1 ELSE 0 END) AS urgent
        FROM feedback
    `);

    const stats = rows[0];
    return {
        total: Number(stats.total) || 0,
        pending: Number(stats.pending) || 0,
        in_progress: Number(stats.in_progress) || 0,
        resolved: Number(stats.resolved) || 0,
        rejected: Number(stats.rejected) || 0,
        urgent: Number(stats.urgent) || 0
    };
}

async function getAvgResolutionDays() {
    const [rows] = await db.execute(`
        SELECT AVG(DATEDIFF(updated_at, created_at)) AS avg_days
        FROM feedback
        WHERE status IN ('Resolved', 'Rejected')
          AND updated_at IS NOT NULL
          AND created_at IS NOT NULL
    `);
    if (!rows || !rows.length) return 0;
    const raw = Number(rows[0].avg_days);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(0, Math.round(raw * 10) / 10);
}

module.exports = {
    VALID_STATUSES,
    getAllFeedback,
    getFeedbackById,
    getFeedbackByIdForStaff,
    getResponses,
    getAttachments,
    updateStatus,
    addResponse,
    assignStaff,
    getAllRecent,
    getStatsByStatus,
    getStatsByCategory,
    getTypeCounts,
    getPriorityCounts,
    getDepartmentCounts,
    getMonthlyTrends,
    getAllStats,
    getAvgResolutionDays
};
