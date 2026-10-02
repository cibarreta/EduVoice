
const express = require("express");
const router = express.Router();

const { isStaff } = require("../middleware/authMiddleware");
const staffController = require("../controllers/staffController");

router.get("/dashboard", isStaff, staffController.dashboard);

router.get("/submissions", isStaff, staffController.listSubmissions);
router.get("/submissions/:id", isStaff, staffController.submissionDetails);
router.post("/submissions/:id/status", isStaff, staffController.updateStatus);
router.post("/submissions/:id/respond", isStaff, staffController.respond);

router.get("/profile", isStaff, staffController.showProfile);
router.post("/profile/update-name", isStaff, staffController.updateName);
router.post("/profile/change-password", isStaff, staffController.changePassword);

module.exports = router;
