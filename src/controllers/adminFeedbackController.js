const AdminFeedback = require("../models/AdminFeedback");

const VALID_STATUSES = [
    "Pending",
    "Under Review",
    "In Progress",
    "Resolved",
    "Rejected"
];

// Display all feedback
exports.getAllFeedback = async (req, res) => {
    try {
        const feedbackList = await AdminFeedback.getAllFeedback();

        res.render("admin/feedback-list", {
            feedbackList
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load feedback.");
    }
};

// Display one feedback entry
exports.getFeedbackDetails = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid feedback ID.");
        }

        const feedback = await AdminFeedback.getFeedbackById(id);

        if (!feedback) {
            return res.status(404).send("Feedback not found.");
        }

        const responses = await AdminFeedback.getResponses(id);

        res.render("admin/feedback-details", {
            feedback,
            responses,
            error: null,
            success: null
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to load feedback details.");
    }
};

// Update feedback status
exports.updateStatus = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid feedback ID.");
        }

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).send("Invalid feedback status.");
        }

        const feedback = await AdminFeedback.getFeedbackById(id);

        if (!feedback) {
            return res.status(404).send("Feedback not found.");
        }

        await AdminFeedback.updateStatus(id, status);

        res.redirect(`/admin/feedback/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to update feedback status.");
    }
};

// Submit an admin response
exports.addResponse = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const response = req.body.response?.trim();

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).send("Invalid feedback ID.");
        }

        if (!response) {
            return res.status(400).send("Response cannot be empty.");
        }

        const feedback = await AdminFeedback.getFeedbackById(id);

        if (!feedback) {
            return res.status(404).send("Feedback not found.");
        }

        await AdminFeedback.addResponse(
            id,
            req.session.user.id,
            response
        );

        res.redirect(`/admin/feedback/${id}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("Unable to submit response.");
    }
};