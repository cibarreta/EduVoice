const Feedback = require("../models/Feedback");
const db = require("../config/database");

exports.showSubmitForm = async (req, res) => {
    try {
        const [categories] = await db.execute(
            "SELECT * FROM categories ORDER BY name"
        );

        res.render("student/submit-feedback", {
            categories,
            activePage: "submit-feedback"
        });
    } catch (error) {
        console.error(error);
        req.session.error = "An error occurred while loading the form.";
        res.status(500).redirect("back");
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const { title, description, category_id, is_anonymous } = req.body;

        if (!title?.trim() || !description?.trim()) {
            req.session.error = "Please complete all required fields.";
            return res.redirect("back");
        }

        const categoryId = category_id ? Number(category_id) : null;
        const anonymousFlag = is_anonymous ? 1 : 0;

        await Feedback.createFeedback({
            user_id: req.session.user.id,
            category_id: categoryId,
            title: title.trim(),
            description: description.trim(),
            type: "feedback",
            is_anonymous: anonymousFlag,
            assigned_to: null
        });

        req.session.success = "Feedback submitted successfully!";
        res.redirect("/student/submissions");
    } catch (error) {
        console.error(error);
        req.session.error = "Unable to submit feedback.";
        res.redirect("back");
    }
};

exports.getMyFeedback = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const feedbackList = await Feedback.getFeedbackByUser(userId);

        res.render("student/my-feedback", {
            feedbackList,
            activePage: "submissions"
        });
    } catch (error) {
        console.error(error);
        req.session.error = "An error occurred while loading your feedback.";
        res.status(500).redirect("back");
    }
};

exports.getFeedbackDetails = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = req.session.user.id;
        const feedback = await Feedback.getFeedbackById(id, userId);

        if (!feedback) {
            return res.status(404).render("errors/404", {
                user: req.session.user,
                message: "Feedback not found."
            });
        }

        res.render("student/feedback-details", {
            feedback,
            activePage: "submissions"
        });
    } catch (error) {
        console.error(error);
        req.session.error = "An error occurred while loading feedback details.";
        res.status(500).redirect("back");
    }
};
