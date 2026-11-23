const bcrypt = require("bcryptjs");
const db = require("../config/database");
const Feedback = require("../models/Feedback");
const schoolDepartments = require("../config/schoolDepartments");
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

async function renderSubmissionForm(res, view, error, status = 200, type = "feedback") {
    const [categories, departments] = await Promise.all([
        getCategories(),
        db.execute(
            `SELECT id, name FROM departments WHERE name IN (${schoolDepartments.map(() => "?").join(", ")})
             ORDER BY FIELD(name, ${schoolDepartments.map(() => "?").join(", ")})`,
            [...schoolDepartments, ...schoolDepartments]
        )
    ]);
    return res.status(status).render(view, {
        categories,
        departments: departments[0],
        error,
        submissionType: type
    });
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

exports.showSubmit = async (req, res) => {
    try {
        const type = req.query.type === "suggestion" ? "suggestion" : "feedback";
        await renderSubmissionForm(res, "student/submit-feedback", null, 200, type);
    } catch (error) {
        console.error("Unable to load submission form:", error);
        res.status(500).render("errors/500");
    }
};

async function processSubmission(req, res, forcedType) {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const type = forcedType || body.type;
    const formView = req.path.endsWith("/submit-suggestion")
        ? "student/submit-suggestion"
        : "student/submit-feedback";
    const renderError = (message, status = 400) =>
        renderSubmissionForm(res, formView, message, status, type);

    try {
        const { title, description, category_id } = body;
        const studentDepartmentId = Number(body.student_department_id);
        if (!["feedback", "suggestion"].includes(type)) {
            return await renderError("Please choose Feedback or Suggestion.");
        }
        if (!Number.isInteger(studentDepartmentId) || studentDepartmentId <= 0) {
            return await renderError("Please choose your college or campus.");
        }
        const [departments] = await db.execute(
            `SELECT id FROM departments
             WHERE id = ? AND name IN (${schoolDepartments.map(() => "?").join(", ")})`,
            [studentDepartmentId, ...schoolDepartments]
        );
        if (departments.length === 0) {
            return await renderError("Please choose a valid college or campus.");
        }
        if (
            typeof title !== "string" ||
            typeof description !== "string" ||
            !title.trim() ||
            !description.trim() ||
            title.trim().length > 200 ||
            description.trim().length > 10000
        ) {
            return await renderError(
                "Enter a title (up to 200 characters) and a description (up to 10,000 characters)."
            );
        }

        const categoryId = category_id ? Number(category_id) : null;
        const priority = body.priority === undefined ? "Normal" : body.priority;
        if (
            !VALID_PRIORITIES.includes(priority) ||
            body.is_anonymous !== undefined &&
                !["1", "on"].includes(body.is_anonymous)
        ) {
            return await renderError("Please select a valid priority and anonymity option.");
        }
        if (categoryId !== null) {
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return await renderError("Please select a valid category.");
            }
            const [categories] = await db.execute(
                "SELECT id FROM categories WHERE id = ?",
                [categoryId]
            );
            if (categories.length === 0) {
                return await renderError("Please select a valid category.");
            }
        }

        const feedbackId = await createSubmission(req, {
            category_id: categoryId,
            student_department_id: studentDepartmentId,
            title: title.trim(),
            description: description.trim(),
            type,
            is_anonymous: body.is_anonymous ? 1 : 0,
            priority
        });

        const ticketNumber = `EV-${String(feedbackId).padStart(6, "0")}`;
        req.session.success = `${type === "feedback" ? "Feedback" : "Suggestion"} submitted successfully. Ticket number: ${ticketNumber}.`;
        res.redirect("/student/submissions");
    } catch (error) {
        if (error instanceof AttachmentValidationError) {
            return await renderError(error.message);
        }
        console.error(`Unable to submit ${type || "submission"}:`, error);
        res.status(500).render("errors/500");
    }
}

exports.submitSubmission = (req, res) => processSubmission(req, res);

exports.submitFeedback = (req, res) => processSubmission(req, res, "feedback");
exports.submitSuggestion = (req, res) => processSubmission(req, res, "suggestion");

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
