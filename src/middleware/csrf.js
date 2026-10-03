const crypto = require("crypto");

function isValidCsrfToken(submittedToken, expectedToken) {
    const submitted = Buffer.from(
        typeof submittedToken === "string" ? submittedToken : ""
    );
    const expected = Buffer.from(
        typeof expectedToken === "string" ? expectedToken : ""
    );

    return expected.length > 0 &&
        submitted.length === expected.length &&
        crypto.timingSafeEqual(expected, submitted);
}

function submittedCsrfToken(req) {
    return req.body?._csrf || req.get("x-csrf-token") || "";
}

module.exports = { isValidCsrfToken, submittedCsrfToken };
