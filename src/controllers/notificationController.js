const db = require("../config/database");
const { getAttachmentPath } = require("../services/attachments");

exports.list = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [notifications] = await db.execute(
            `SELECT id, feedback_id, event_type, title, message, read_at, created_at
             FROM notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 100`,
            [userId]
        );
        res.render("pages/notifications", { notifications, user: req.session.user });
    } catch (error) {
        console.error("Unable to load notifications:", error);
        res.status(500).render("errors/500");
    }
};

exports.markRead = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
            return res.status(400).render("errors/400", {
                user: req.session.user,
                message: "Invalid notification."
            });
        }
        await db.execute(
            "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND read_at IS NULL",
            [notificationId, req.session.user.id]
        );
        const allowedReturnPath = new RegExp(
            `^/${req.session.user.role}/submissions/\\d+$`
        );
        const returnTo = req.body && typeof req.body.return_to === "string"
            ? req.body.return_to
            : "";
        const target = allowedReturnPath.test(returnTo)
            ? returnTo
            : "/notifications";
        res.redirect(target);
    } catch (error) {
        console.error("Unable to update notification:", error);
        res.status(500).render("errors/500");
    }
};

exports.markAllRead = async (req, res) => {
    try {
        await db.execute(
            "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL",
            [req.session.user.id]
        );
        req.session.success = "Notifications marked as read.";
        res.redirect("/notifications");
    } catch (error) {
        console.error("Unable to mark notifications as read:", error);
        res.status(500).render("errors/500");
    }
};

exports.downloadAttachment = async (req, res) => {
    try {
        const attachmentId = Number(req.params.id);
        if (!Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
            return res.status(404).render("errors/404", { user: req.session.user });
        }

        const [rows] = await db.execute(
            `SELECT a.storage_key, a.original_name, a.mime_type, f.user_id,
                    f.assigned_to, f.department_id, viewer.department_id AS viewer_department_id
             FROM feedback_attachments a
             JOIN feedback f ON f.id = a.feedback_id
             JOIN users viewer ON viewer.id = ?
             WHERE a.id = ?`,
            [req.session.user.id, attachmentId]
        );
        const attachment = rows[0];
        if (!attachment) {
            return res.status(404).render("errors/404", { user: req.session.user });
        }

        const { role, id: userId } = req.session.user;
        const allowed = role === "admin" ||
            role === "student" && Number(attachment.user_id) === Number(userId) ||
            role === "staff" && (
                Number(attachment.assigned_to) === Number(userId) ||
                attachment.assigned_to === null &&
                    (attachment.department_id === null
                        ? attachment.viewer_department_id === null
                        : Number(attachment.department_id) === Number(attachment.viewer_department_id))
            );
        if (!allowed) {
            return res.status(404).render("errors/404", {
                user: req.session.user,
                message: "Attachment not found."
            });
        }

        const filePath = await getAttachmentPath(attachment.storage_key);
        if (!filePath) {
            throw new Error("Attachment has an invalid storage key.");
        }
        res.set("X-Content-Type-Options", "nosniff");
        res.type(attachment.mime_type);
        res.download(filePath, attachment.original_name);
    } catch (error) {
        console.error("Unable to download attachment:", error);
        if (!res.headersSent) res.status(500).render("errors/500");
    }
};

exports.auditLogs = async (req, res) => {
    try {
        const [logs] = await db.execute(`
            SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
                   u.name AS actor_name, u.email AS actor_email
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.actor_user_id
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT 250
        `);
        res.render("admin/audit-logs", { logs, user: req.session.user });
    } catch (error) {
        console.error("Unable to load audit logs:", error);
        res.status(500).render("errors/500");
    }
};
