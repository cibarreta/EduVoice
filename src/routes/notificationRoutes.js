const express = require("express");
const { authorizeRoles, isAdmin } = require("../middleware/authMiddleware");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

const activeUser = authorizeRoles("student", "staff", "admin");

router.get("/notifications", activeUser, notificationController.list);
router.post("/notifications/read-all", activeUser, notificationController.markAllRead);
router.post("/notifications/:id/read", activeUser, notificationController.markRead);
router.get("/attachments/:id", activeUser, notificationController.downloadAttachment);
router.get("/admin/audit-logs", isAdmin, notificationController.auditLogs);

module.exports = router;
