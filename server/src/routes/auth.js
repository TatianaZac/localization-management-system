// Цей файл зіставляє маршрути авторизації з контролером та middleware сесії.

const express = require("express");
const {
    register,
    login,
    getCurrentUser,
    logout
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, getCurrentUser);
router.post("/logout", requireAuth, logout);

module.exports = router;
