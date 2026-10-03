
const express = require("express");
const router = express.Router();

const { isStudent } = require("../middleware/authMiddleware");
const studentController = require("../controllers/studentController");
const uploadAttachments = require("../middleware/uploadAttachments");

router.get("/dashboard", isStudent, studentController.dashboard);

router.get("/submit-feedback", isStudent, studentController.showSubmitFeedback);
router.post("/submit-feedback", isStudent, uploadAttachments, studentController.submitFeedback);

router.get("/submit-suggestion", isStudent, studentController.showSubmitSuggestion);
router.post("/submit-suggestion", isStudent, uploadAttachments, studentController.submitSuggestion);

router.get("/submissions", isStudent, studentController.listSubmissions);
router.get("/submissions/:id", isStudent, studentController.submissionDetails);

router.get("/profile", isStudent, studentController.showProfile);
router.post("/profile/update-name", isStudent, studentController.updateName);
router.post("/profile/change-password", isStudent, studentController.changePassword);

router.get("/my-feedback", isStudent, (req, res) => {
    res.redirect("/student/submissions");
});

router.get("/my-feedback/:id", isStudent, (req, res) => {
    res.redirect(`/student/submissions/${req.params.id}`);
});

router.get("/submit", isStudent, (req, res) => {
    res.redirect("/student/submit-feedback");
});

router.post("/submit", isStudent, uploadAttachments, studentController.submitFeedback);

module.exports = router;
