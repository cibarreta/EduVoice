const db = require("../config/database");

async function getById(id) {
    const [rows] = await db.execute(
        "SELECT * FROM users WHERE id = ?",
        [id]
    );
    return rows[0];
}

async function getByEmail(email) {
    const [rows] = await db.execute(
        "SELECT * FROM users WHERE email = ?",
        [email]
    );
    return rows[0];
}

async function getAll(options = {}) {
    const { role, search, page = 1, perPage = 10 } = options;
    const offset = (page - 1) * perPage;

    let whereClauses = [];
    let params = [];

    if (role) {
        whereClauses.push("u.role = ?");
        params.push(role);
    }

    if (search) {
        whereClauses.push("(u.name LIKE ? OR u.email LIKE ? OR u.student_id LIKE ?)");
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereSql = whereClauses.length > 0
        ? `WHERE ${whereClauses.join(" AND ")}`
        : "";

    const [countRows] = await db.execute(
        `SELECT COUNT(*) as total FROM users u ${whereSql}`,
        params
    );
    const total = countRows[0].total;

    const [users] = await db.execute(
        `SELECT u.* FROM users u ${whereSql}
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, perPage, offset]
    );

    return { users, total };
}

async function countByRole(role) {
    const [rows] = await db.execute(
        "SELECT COUNT(*) as cnt FROM users WHERE role = ?",
        [role]
    );
    return rows[0].cnt;
}

async function updateProfile(id, { name }) {
    const [result] = await db.execute(
        "UPDATE users SET name = ? WHERE id = ?",
        [name, id]
    );
    return result.affectedRows;
}

async function updatePassword(id, hashedPassword) {
    const [result] = await db.execute(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedPassword, id]
    );
    return result.affectedRows;
}

async function updateRole(id, role) {
    const validRoles = ["student", "staff", "admin"];
    if (!validRoles.includes(role)) {
        return 0;
    }
    const [result] = await db.execute(
        "UPDATE users SET role = ? WHERE id = ?",
        [role, id]
    );
    return result.affectedRows;
}

async function toggleActive(id) {
    const [result] = await db.execute(
        "UPDATE users SET is_active = NOT is_active WHERE id = ?",
        [id]
    );
    return result.affectedRows;
}

async function getCounts() {
    const [rows] = await db.execute(
        `SELECT role, COUNT(*) as cnt FROM users GROUP BY role`
    );

    const counts = {
        students: 0,
        staff: 0,
        admins: 0,
        total: 0
    };

    for (const row of rows) {
        if (row.role === "student") {
            counts.students = row.cnt;
        } else if (row.role === "staff") {
            counts.staff = row.cnt;
        } else if (row.role === "admin") {
            counts.admins = row.cnt;
        }
        counts.total += row.cnt;
    }

    return counts;
}

async function isActive(id) {
    const [rows] = await db.execute(
        "SELECT is_active FROM users WHERE id = ?",
        [id]
    );
    if (rows.length === 0) {
        return false;
    }
    return !!rows[0].is_active;
}

module.exports = {
    getById,
    getByEmail,
    getAll,
    countByRole,
    updateProfile,
    updatePassword,
    updateRole,
    toggleActive,
    getCounts,
    isActive
};
