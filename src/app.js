const express = require("express");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const app = express();

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production"
        }
    })
);


app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
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
const {
    isStudent,
    isAdmin
} = require("./middleware/authMiddleware");

// Authentication routes
app.use("/", authRoutes);


const studentRoutes = require("./routes/studentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const adminFeedbackRoutes = require("./routes/adminFeedbackRoutes");

// Student routes
app.use("/student", studentRoutes);

// Admin routes
app.use("/admin", adminRoutes);

// Feedback routes
app.use("/feedback", feedbackRoutes);

app.use("/admin/feedback", adminFeedbackRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).send("Page not found");
});

module.exports = app;