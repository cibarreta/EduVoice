const bcrypt = require("bcryptjs");
const db = require("../config/database");
const Feedback = require("../models/Feedback");
const { recordAudit } = require("../services/auditLog");
const { notifyActiveAdmins } = require("../services/notifications");
const {
    AttachmentValidationError,
    storeAttachments,
    deleteStoredFiles
} = require("../services/attachments");

const VALID_PRIORITIES = ["Low", "Normal", "High", "Urgent"];

async function createSubmission(req, submission) {
    const connection = await db.getConnection();
    let storedPaths = [];
    try {
        await connection.beginTransaction();
        const feedbackId = await Feedback.createFeedback({
            user_id: req.session.user.id,
            ...submission
        }, connection);
        const stored = await storeAttachments(
            connection,
            req.files,
            feedbackId,
            req.session.user.id
        );
        storedPaths = stored.storedPaths;
        await notifyActiveAdmins(connection, {
            feedbackId,
            eventType: "submission_created",
            title: "New submission",
            message: `A new ${submission.type} submission (#${feedbackId}) is ready for review.`
        });
        await recordAudit(connection, {
            actorUserId: req.session.user.id,
            action: "submission.created",
            entityType: "feedback",
            entityId: feedbackId,
            details: {
                type: submission.type,
                priority: submission.priority,
                attachmentCount: stored.attachments.length
            }
        });
        await connection.commit();
        return feedbackId;
    } catch (error) {
        await connection.rollback();
        await deleteStoredFiles(storedPaths);
        throw error;
    } finally {
        connection.release();
    }
}

async function getCategories() {
    const [categories] = await db.execute(
        "SELECT id, name FROM categories ORDER BY name"
    );
    return categories;
}

async function renderSubmissionForm(res, view, error, status = 200) {
    const categories = await getCategories();
    return res.status(status).render(view, { categories, error });
}

exports.dashboard = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [stats, recentSubmissions] = await Promise.all([
            Feedback.getFeedbackStatsByUser(userId),
            Feedback.getRecentByUser(userId, 5)
        ]);

        res.render("student/dashboard", {
            user: req.session.user,
            stats,
            recentSubmissions
        });
    } catch (error) {
        console.error("Unable to load student dashboard:", error);
        res.status(500).render("errors/500");
    }
};

exports.showSubmitFeedback = async (req, res) => {
    try {
        await renderSubmissionForm(res, "student/submit-feedback", null);
    } catch (error) {
        console.error("Unable to load feedback form:", error);
        res.status(500).render("errors/500");
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const { title, description, category_id } = body;
        if (
            typeof title !== "string" ||
            typeof description !== "string" ||
            !title.trim() ||
            !description.trim() ||
            title.trim().length > 200 ||
            description.trim().length > 10000
        ) {
            return await renderSubmissionForm(
                res,
                "student/submit-feedback",
                "Enter a title (up to 200 characters) and a description (up to 10,000 characters).",
                400
            );
        }

        const categoryId = category_id ? Number(category_id) : null;
        const priority = body.priority === undefined ? "Normal" : body.priority;
        if (
            !VALID_PRIORITIES.includes(priority) ||
            body.is_anonymous !== undefined &&
                !["1", "on"].includes(body.is_anonymous)
        ) {
            return await renderSubmissionForm(
                res,
                "student/submit-feedback",
                "Please select a valid priority and anonymity option.",
                400
            );
        }
        if (categoryId !== null) {
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return await renderSubmissionForm(
                    res,
                    "student/submit-feedback",
                    "Please select a valid category.",
                    400
                );
            }
            const [categories] = await db.execute(
                "SELECT id FROM categories WHERE id = ?",
                [categoryId]
            );
            if (categories.length === 0) {
                return await renderSubmissionForm(
                    res,
                    "student/submit-feedback",
                    "Please select a valid category.",
                    400
                );
            }
        }

        await createSubmission(req, {
            category_id: categoryId,
            title: title.trim(),
            description: description.trim(),
            type: "feedback",
            is_anonymous: body.is_anonymous ? 1 : 0,
            priority
        });

        req.session.success = "Feedback submitted successfully.";
        res.redirect("/student/submissions");
    } catch (error) {
        if (error instanceof AttachmentValidationError) {
            return await renderSubmissionForm(res, "student/submit-feedback", error.message, 400);
        }
        console.error("Unable to submit feedback:", error);
        res.status(500).render("errors/500");
    }
};

exports.showSubmitSuggestion = async (req, res) => {
    try {
        await renderSubmissionForm(res, "student/submit-suggestion", null);
    } catch (error) {
        console.error("Unable to load suggestion form:", error);
        res.status(500).render("errors/500");
    }
};

exports.submitSuggestion = async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const { title, description, category_id } = body;
        if (
            typeof title !== "string" ||
            typeof description !== "string" ||
            !title.trim() ||
            !description.trim() ||
            title.trim().length > 200 ||
            description.trim().length > 10000
        ) {
            return await renderSubmissionForm(
                res,
                "student/submit-suggestion",
                "Enter a title (up to 200 characters) and a description (up to 10,000 characters).",
                400
            );
        }

        const categoryId = category_id ? Number(category_id) : null;
        const priority = body.priority === undefined ? "Normal" : body.priority;
        if (
            !VALID_PRIORITIES.includes(priority) ||
            body.is_anonymous !== undefined &&
                !["1", "on"].includes(body.is_anonymous)
        ) {
            return await renderSubmissionForm(
                res,
                "student/submit-suggestion",
                "Please select a valid priority and anonymity option.",
                400
            );
        }
        if (categoryId !== null) {
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return await renderSubmissionForm(
                    res,
                    "student/submit-suggestion",
                    "Please select a valid category.",
                    400
                );
            }
            const [categories] = await db.execute(
                "SELECT id FROM categories WHERE id = ?",
                [categoryId]
            );
            if (categories.length === 0) {
                return await renderSubmissionForm(
                    res,
                    "student/submit-suggestion",
                    "Please select a valid category.",
                    400
                );
            }
        }

        await createSubmission(req, {
            category_id: categoryId,
            title: title.trim(),
            description: description.trim(),
            type: "suggestion",
            is_anonymous: body.is_anonymous ? 1 : 0,
            priority
        });

        req.session.success = "Suggestion submitted successfully.";
        res.redirect("/student/submissions");
    } catch (error) {
        if (error instanceof AttachmentValidationError) {
            return await renderSubmissionForm(res, "student/submit-suggestion", error.message, 400);
        }
        console.error("Unable to submit suggestion:", error);
        res.status(500).render("errors/500");
    }
};

exports.listSubmissions = async (req, res) => {
    try {
        const currentFilter = ["feedback", "suggestion"].includes(req.query.type)
            ? req.query.type
            : "all";
        const [allSubmissions, feedbackSubmissions, suggestions] = await Promise.all([
            Feedback.getFeedbackByUser(req.session.user.id),
            Feedback.getFeedbackByUser(req.session.user.id, "feedback"),
            Feedback.getFeedbackByUser(req.session.user.id, "suggestion")
        ]);
        const submissions = currentFilter === "all"
            ? allSubmissions
            : currentFilter === "feedback"
                ? feedbackSubmissions
                : suggestions;

        res.render("student/submissions", {
            submissions,
            currentFilter,
            counts: {
                all: allSubmissions.length,
                feedback: feedbackSubmissions.length,
                suggestion: suggestions.length
            }
        });
    } catch (error) {
        console.error("Unable to load student submissions:", error);
        res.status(500).render("errors/500");
    }
};

exports.submissionDetails = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).render("errors/404");
        }

        const submission = await Feedback.getFeedbackById(id, req.session.user.id);
        if (!submission) {
            return res.status(404).render("errors/404", {
                message: "Submission not found."
            });
        }

        res.render("student/submission-details", {
            submission,
            responses: submission.responses
        });
    } catch (error) {
        console.error("Unable to load student submission:", error);
        res.status(500).render("errors/500");
    }
};

exports.showProfile = (req, res) => {
    res.render("student/profile", { user: req.session.user });
};

exports.updateName = async (req, res) => {
    try {
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        if (!name || name.length > 150) {
            req.session.error = "Enter a name up to 150 characters.";
            return res.redirect("/student/profile");
        }

        await db.execute("UPDATE users SET name = ? WHERE id = ?", [
            name,
            req.session.user.id
        ]);
        req.session.user.name = name;
        req.session.success = "Profile updated successfully.";
        res.redirect("/student/profile");
    } catch (error) {
        console.error("Unable to update student profile:", error);
        req.session.error = "Unable to update your profile.";
        res.redirect("/student/profile");
    }
};

exports.changePassword = async (req, res) => {
    try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const current_password = typeof body.current_password === "string" ? body.current_password : "";
        const new_password = typeof body.new_password === "string" ? body.new_password : "";
        const confirm_password = typeof body.confirm_password === "string" ? body.confirm_password : "";
        if (!current_password || !new_password || !confirm_password) {
            req.session.error = "Please fill in all password fields.";
            return res.redirect("/student/profile");
        }
        if (new_password.length < 8) {
            req.session.error = "New password must be at least 8 characters.";
            return res.redirect("/student/profile");
        }
        if (new_password !== confirm_password) {
            req.session.error = "New passwords do not match.";
            return res.redirect("/student/profile");
        }

        const [rows] = await db.execute(
            "SELECT password FROM users WHERE id = ?",
            [req.session.user.id]
        );
        if (rows.length === 0 || !(await bcrypt.compare(current_password, rows[0].password))) {
            req.session.error = "Current password is incorrect.";
            return res.redirect("/student/profile");
        }

        const hashedPassword = await bcrypt.hash(new_password, 12);
        await db.execute("UPDATE users SET password = ? WHERE id = ?", [
            hashedPassword,
            req.session.user.id
        ]);
        req.session.success = "Password changed successfully.";
        res.redirect("/student/profile");
    } catch (error) {
        console.error("Unable to change student password:", error);
        req.session.error = "Unable to change your password.";
        res.redirect("/student/profile");
    }
};
