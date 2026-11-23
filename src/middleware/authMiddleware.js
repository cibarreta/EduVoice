
function isAuthenticated(req, res, next) {
    if (!req.session || !req.session.user) {
        req.flash = req.flash || {};
        return res.redirect("/login");
    }

    next();
}

const pool = require("../config/database");

function authorizeRoles(...allowedRoles) {
    return async (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect("/login");
        }

        try {
            const [rows] = await pool.execute(
                "SELECT role, is_active FROM users WHERE id = ?",
                [req.session.user.id]
            );
            if (rows.length === 0 || !rows[0].is_active) {
                return req.session.destroy(() => {
                    res.clearCookie("connect.sid");
                    res.redirect("/login");
                });
            }

            req.session.user.role = rows[0].role;
            if (!allowedRoles.includes(rows[0].role)) {
                return res.status(403).render("errors/403", {
                    user: req.session.user,
                    message: "You do not have permission to access this page."
                });
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

function setFlash(req, res, next) {
    res.locals.success = req.session ? req.session.success || null : null;
    res.locals.error = req.session ? req.session.error || null : null;
    if (req.session) {
        delete req.session.success;
        delete req.session.error;
    }
    next();
}

const isStudent = authorizeRoles("student");
const isStaff = authorizeRoles("staff");
const isAdmin = authorizeRoles("admin");
const isStaffOrAdmin = authorizeRoles("staff", "admin");

module.exports = {
    isAuthenticated,
    authorizeRoles,
    setFlash,
    isStudent,
    isStaff,
    isAdmin,
    isStaffOrAdmin
};