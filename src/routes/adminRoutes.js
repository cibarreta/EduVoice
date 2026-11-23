
const express = require("express");
const router = express.Router();

const { isAdmin } = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");

router.get("/dashboard", isAdmin, adminController.dashboard);

router.get("/feedback", isAdmin, adminController.listFeedback);
router.get("/suggestions", isAdmin, adminController.listSuggestions);
router.get("/submissions", isAdmin, adminController.listAllSubmissions);

router.get("/submissions/:id", isAdmin, adminController.submissionDetails);
router.post("/submissions/:id/status", isAdmin, adminController.updateSubmissionStatus);
router.post("/submissions/:id/respond", isAdmin, adminController.respondToSubmission);
router.post("/submissions/:id/assign", isAdmin, adminController.assignStaff);
router.post("/submissions/:id/priority", isAdmin, adminController.updatePriority);
router.post("/feedback/:id/status", isAdmin, adminController.updateSubmissionStatus);
router.post("/feedback/:id/respond", isAdmin, adminController.respondToSubmission);

router.get("/users", isAdmin, adminController.listUsers);
router.get("/users/:id", isAdmin, adminController.userDetails);
router.post("/users/:id/role", isAdmin, adminController.updateUserRole);
router.post("/users/:id/department", isAdmin, adminController.updateUserDepartment);
router.post("/users/:id/toggle-active", isAdmin, adminController.toggleUserActive);

router.get("/statistics", isAdmin, adminController.statistics);

router.get("/profile", isAdmin, adminController.showProfile);
router.post("/profile/update-name", isAdmin, adminController.updateAdminName);
router.post("/profile/change-password", isAdmin, adminController.changeAdminPassword);

router.get("/feedback/:id", isAdmin, (req, res) => {
    res.redirect(`/admin/submissions/${req.params.id}`);
});

module.exports = router;
