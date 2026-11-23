const express = require("express");
const router = express.Router();

const studentController = require("../controllers/studentController");
const { isStudent } = require("../middleware/authMiddleware");
const uploadAttachments = require("../middleware/uploadAttachments");

router.get(
    "/submit",
    isStudent,
    (req, res) => res.redirect("/student/submit")
);

router.post(
    "/submit",
    isStudent,
    uploadAttachments,
    studentController.submitSubmission
);

router.get(
    "/my-feedback",
    isStudent,
    (req, res) => res.redirect("/student/submissions")
);

router.get(
    "/my-feedback/:id",
    isStudent,
    (req, res) => res.redirect(`/student/submissions/${req.params.id}`)
);

module.exports = router;