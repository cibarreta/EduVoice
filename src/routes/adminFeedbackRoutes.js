const express = require("express");
const router = express.Router();

const controller = require("../controllers/adminFeedbackController");
const { isAdmin } = require("../middleware/authMiddleware");

router.get("/", isAdmin, controller.getAllFeedback);

router.get("/:id", isAdmin, controller.getFeedbackDetails);

router.post("/:id/status", isAdmin, controller.updateStatus);

router.post("/:id/respond", isAdmin, controller.addResponse);

module.exports = router;