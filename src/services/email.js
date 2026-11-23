const nodemailer = require("nodemailer");

function createTransporter() {
    const host = process.env.SMTP_HOST;
    const from = process.env.SMTP_FROM;
    if (!host || !from) {
        throw new Error("SMTP_HOST and SMTP_FROM must be configured to send password reset emails.");
    }

    const port = Number(process.env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("SMTP_PORT must be a valid TCP port.");
    }
    if (
        (process.env.SMTP_USER && !process.env.SMTP_PASS) ||
        (!process.env.SMTP_USER && process.env.SMTP_PASS)
    ) {
        throw new Error("Configure both SMTP_USER and SMTP_PASS, or leave both empty.");
    }
    if (process.env.NODE_ENV === "production" && !process.env.APP_BASE_URL) {
        throw new Error("APP_BASE_URL must be configured in production.");
    }
    getResetUrl("configuration-check");

    const auth = process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined;

    return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === "true",
        auth
    });
}

function getResetUrl(token) {
    const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    let resetUrl;
    try {
        resetUrl = new URL("/reset-password", baseUrl);
    } catch {
        throw new Error("APP_BASE_URL must be a valid absolute URL.");
    }
    if (!["http:", "https:"].includes(resetUrl.protocol) || resetUrl.username || resetUrl.password) {
        throw new Error("APP_BASE_URL must use HTTP or HTTPS and must not contain credentials.");
    }
    resetUrl.searchParams.set("token", token);
    return resetUrl;
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

async function sendPasswordResetEmail(user, token, transporter) {
    const resetUrl = getResetUrl(token);

    const safeName = escapeHtml(user.name || "EduVoice user");
    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Reset your EduVoice password",
        text: `Hello ${user.name || "EduVoice user"},\n\nUse this link to reset your EduVoice password. It expires in 30 minutes:\n${resetUrl.href}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hello ${safeName},</p><p>Use the link below to reset your EduVoice password. It expires in 30 minutes.</p><p><a href="${resetUrl.href}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`
    });
}

module.exports = { createTransporter, sendPasswordResetEmail };
