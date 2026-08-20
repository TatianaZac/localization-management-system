const express = require("express");
const cors = require("cors");
const projectRoutes = require("./routes/projects");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
    res.send("Localization Management API");
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Localization Management API is running"
    });
});

app.use("/api/projects", projectRoutes);
app.use(errorHandler);

module.exports = app;
