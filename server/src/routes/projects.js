const express = require("express");
const {
    getProjects,
    createProject,
    getProject,
} = require("../controllers/projectsController");
const { addLocale } = require("../controllers/localesController");
const { importSourceFile } = require("../controllers/importController");

const router = express.Router();

router.get("/", getProjects);
router.post("/", createProject);
router.get("/:projectId", getProject);
router.post("/:projectId/locales", addLocale);
router.post("/:projectId/import", importSourceFile);

module.exports = router;
