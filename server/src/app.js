// Цей файл створює Express-застосунок, підключає middleware та маршрути API.

const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Повертає коротку назву API на кореневому маршруті.
app.get("/", (req, res) => {
    res.send("Localization Management API");
});

// Повідомляє клієнтам, що сервер запущений і готовий приймати запити.
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Localization Management API is running"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use(errorHandler);

module.exports = app;
