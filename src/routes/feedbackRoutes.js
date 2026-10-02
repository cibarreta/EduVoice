const express = require("express");
const router = express.Router();

const feedbackController = require("../controllers/feedbackController");
const { isStudent } = require("../middleware/authMiddleware");

router.get(
    "/submit",
    isStudent,
    feedbackController.showSubmitForm
);

router.post(
    "/submit",
    isStudent,
    feedbackController.submitFeedback
);

router.get(
    "/my-feedback",
    isStudent,
    feedbackController.getMyFeedback
);

router.get(
    "/my-feedback/:id",
    isStudent,
    feedbackController.getFeedbackDetails
);

module.exports = router;