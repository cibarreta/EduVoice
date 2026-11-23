const multer = require("multer");
const path = require("path");
const { MIME_EXTENSIONS } = require("../services/attachments");
const { isValidCsrfToken, submittedCsrfToken } = require("./csrf");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 3 * 1024 * 1024,
        files: 3,
        fields: 20
    },
    fileFilter(req, file, callback) {
        const expectedExtension = MIME_EXTENSIONS[file.mimetype];
        const extension = path.extname(file.originalname).toLowerCase();
        const extensionMatches = expectedExtension === extension ||
            expectedExtension === ".jpg" && extension === ".jpeg";

        if (!expectedExtension || !extensionMatches) {
            return callback(new Error("Choose a PDF, JPEG, PNG, GIF, or WebP attachment."));
        }
        callback(null, true);
    }
});

function uploadAttachments(req, res, next) {
    upload.array("attachments", 3)(req, res, (error) => {
        if (!error) {
            if (!isValidCsrfToken(submittedCsrfToken(req), req.session.csrfToken)) {
                return res.status(403).render("errors/403", {
                    user: req.session.user || null,
                    message: "This request could not be verified. Reload the page and try again."
                });
            }
            return next();
        }

        if (error instanceof multer.MulterError) {
            const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "Each attachment must be 3 MB or smaller."
                : "You can attach up to 3 files.";
            return res.status(status).render("errors/400", {
                user: req.session.user || null,
                message
            });
        }

        if (error.message === "Choose a PDF, JPEG, PNG, GIF, or WebP attachment.") {
            return res.status(400).render("errors/400", {
                user: req.session.user || null,
                message: error.message
            });
        }

        next(error);
    });
}

module.exports = uploadAttachments;
