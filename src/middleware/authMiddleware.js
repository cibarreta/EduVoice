
function isAuthenticated(req, res, next) {
    if (!req.session || !req.session.user) {
        req.flash = req.flash || {};
        return res.redirect("/login");
    }

    next();
}

function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.redirect("/login");
        }

        const user = req.session.user;

        if (!allowedRoles.includes(user.role)) {
            return res.status(403).render("errors/403", {
                user: req.session.user,
                message: "You do not have permission to access this page."
            });
        }

        next();
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