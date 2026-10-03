const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const MySQLStore = require("express-mysql-session")(session);
const path = require("path");
const crypto = require("crypto");
const { isValidCsrfToken, submittedCsrfToken } = require("./middleware/csrf");
require("dotenv").config();

const app = express();
const rawSecret = process.env.SESSION_SECRET;
const isProd = process.env.NODE_ENV === "production";
const DEFAULT_SECRET = "change-this-secret";
const hasConfiguredSecret = Boolean(rawSecret && rawSecret !== DEFAULT_SECRET);
const sessionSecret = hasConfiguredSecret
    ? rawSecret
    : (isProd ? null : crypto.randomBytes(32).toString("hex"));

if (isProd && (!hasConfiguredSecret || rawSecret.length < 32)) {
    throw new Error("Set SESSION_SECRET to a random value of at least 32 characters in production.");
} else if (rawSecret === DEFAULT_SECRET) {
    console.warn(
        "\x1b[33m[SECURITY WARNING]\x1b[0m SESSION_SECRET is the example placeholder. " +
        "A temporary secret was generated; configure a persistent random secret."
    );
} else if (!isProd && !rawSecret) {
    console.info(
        "[INFO] SESSION_SECRET not provided; generated a per-process random secret. " +
        "Sessions will NOT persist across server restarts until you set SESSION_SECRET."
    );
}

const dbPool = require("./config/database");

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

// Persistent MySQL session store (replaces MemoryStore)
const sessionStore = new MySQLStore({
    schema: {
        tableName: "sessions"
    },
    createDatabaseTable: true,
    expiration: 1000 * 60 * 60 * 24 * 7,
    endConnectionOnClose: false,
    clearExpired: true,
    checkExpirationInterval: 1000 * 60 * 15
}, dbPool);

app.locals.sessionStoreReady = sessionStore.onReady();
app.locals.sessionStoreReady.catch(function (err) {
    console.error("[SESSION STORE] Failed to initialize MySQL session store:", err?.message || err);
});

app.use(
    session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: isProd,
            maxAge: 1000 * 60 * 60 * 12
        }
    })
);

// Login rate limiter (applied to POST /login only)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: "Too many login attempts from this IP. Please try again in 15 minutes."
});
app.set("loginLimiter", loginLimiter);

const { setFlash } = require("./middleware/authMiddleware");
app.use(setFlash);

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.role = req.session.user?.role || "student";
    res.locals.currentPath = req.path;
    next();
});

app.use((req, res, next) => {
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (!safeMethods.includes(req.method)) {
        const isMultipartSubmission = req.method === "POST" &&
            req.is("multipart/form-data") &&
            ["/student/submit-feedback", "/student/submit-suggestion", "/student/submit"].includes(req.path);
        if (!isMultipartSubmission &&
            !isValidCsrfToken(submittedCsrfToken(req), req.session.csrfToken)) {
            console.warn("[CSRF] Invalid or missing token:", req.method, req.originalUrl, "from", req.ip);
            return res.status(403).render("errors/403", {
                user: req.session.user || null,
                message: "This request could not be verified. Reload the page and try again."
            });
        }
    }

    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
});

// Landing page
app.get("/", (req, res) => {
    res.render("pages/index");
});

app.get("/about", (req, res) => {
    res.render("pages/about");
});


const authRoutes = require("./routes/authRoutes");

// Authentication routes
app.use("/", authRoutes);


const studentRoutes = require("./routes/studentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const staffRoutes = require("./routes/staffRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const adminFeedbackRoutes = require("./routes/adminFeedbackRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

// Student routes
app.use("/student", studentRoutes);

// Admin routes
app.use("/admin", adminRoutes);

// Staff routes
app.use("/staff", staffRoutes);

// Feedback routes
app.use("/feedback", feedbackRoutes);

app.use("/admin/feedback", adminFeedbackRoutes);
app.use("/", notificationRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render("errors/404", {
        user: req.session.user || null
    });
});

app.use((error, req, res, next) => {
    console.error("Request failed:", error);
    if (res.headersSent) {
        return next(error);
    }

    res.status(500).render("errors/500", {
        user: req.session?.user || null
    });
});

module.exports = app;