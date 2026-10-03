
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");

router.get("/register", authController.showRegister);
router.post("/register", authController.register);

router.get("/login", authController.showLogin);
router.post("/login", function (req, res, next) {
    const limiter = req.app.get("loginLimiter");
    if (limiter) return limiter(req, res, next);
    next();
}, authController.login);

router.post("/logout", authController.logout);

module.exports = router;