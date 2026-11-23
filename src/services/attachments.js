const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const MIME_EXTENSIONS = {
    "application/pdf": ".pdf",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};

class AttachmentValidationError extends Error {}

const storageDirectory = path.resolve(
    process.env.UPLOAD_DIR || path.join(__dirname, "../../storage/uploads")
);

function hasValidSignature(file) {
    const buffer = file.buffer;
    switch (file.mimetype) {
        case "application/pdf":
            return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
        case "image/gif": {
            const header = buffer.subarray(0, 6).toString("ascii");
            return header === "GIF87a" || header === "GIF89a";
        }
        case "image/jpeg":
            return buffer.length >= 3 &&
                buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        case "image/png":
            return buffer.subarray(0, 8).equals(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            );
        case "image/webp":
            return buffer.length >= 12 &&
                buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
                buffer.subarray(8, 12).toString("ascii") === "WEBP";
        default:
            return false;
    }
}

function safeOriginalName(name) {
    return path.basename(name)
        .replace(/[^\w.\- ()]/g, "_")
        .slice(0, 255) || "attachment";
}

async function storeAttachments(executor, files, feedbackId, uploaderId) {
    const storedPaths = [];
    const attachments = [];
    if (!files || files.length === 0) {
        return { attachments, storedPaths };
    }

    try {
        await fs.mkdir(storageDirectory, { recursive: true });

        for (const file of files || []) {
            const extension = MIME_EXTENSIONS[file.mimetype];
            const originalExtension = path.extname(file.originalname).toLowerCase();
            if (
                !extension ||
                originalExtension !== extension &&
                    !(extension === ".jpg" && originalExtension === ".jpeg") ||
                !hasValidSignature(file)
            ) {
                throw new AttachmentValidationError(
                    "An attachment has an invalid file type or content. Choose a supported PDF or image file."
                );
            }

            const storageKey = `${randomUUID()}${extension}`;
            const fullPath = path.join(storageDirectory, storageKey);
            await fs.writeFile(fullPath, file.buffer, { flag: "wx", mode: 0o600 });
            storedPaths.push(fullPath);

            const attachment = {
                storage_key: storageKey,
                original_name: safeOriginalName(file.originalname),
                mime_type: file.mimetype,
                size_bytes: file.size
            };
            await executor.execute(
                `INSERT INTO feedback_attachments
                    (feedback_id, uploader_id, storage_key, original_name, mime_type, size_bytes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    feedbackId,
                    uploaderId,
                    attachment.storage_key,
                    attachment.original_name,
                    attachment.mime_type,
                    attachment.size_bytes
                ]
            );
            attachments.push(attachment);
        }

        return { attachments, storedPaths };
    } catch (error) {
        await deleteStoredFiles(storedPaths);
        throw error;
    }
}

async function deleteStoredFiles(paths) {
    await Promise.all(paths.map((filePath) =>
        fs.rm(filePath, { force: true }).catch((error) => {
            if (error.code !== "ENOENT") throw error;
        })
    ));
}

async function getAttachmentPath(storageKey) {
    if (!/^[0-9a-f-]{36}\.(pdf|gif|jpg|png|webp)$/.test(storageKey)) {
        return null;
    }
    const fullPath = path.resolve(storageDirectory, storageKey);
    return fullPath.startsWith(`${storageDirectory}${path.sep}`) ? fullPath : null;
}

module.exports = {
    MIME_EXTENSIONS,
    AttachmentValidationError,
    storageDirectory,
    storeAttachments,
    deleteStoredFiles,
    getAttachmentPath
};
