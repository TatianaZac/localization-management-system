// Цей файл зіставляє маршрути API проєктів із відповідними контролерами.

const express = require("express");
const {
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    getProject,
} = require("../controllers/projectsController");
const {
    addLocale,
    updateLocale,
    deleteLocale
} = require("../controllers/localesController");
const { importSourceFile } = require("../controllers/importController");
const {
    updateTranslation,
    updateTranslationComment,
    withPageLock
} = require("../controllers/translationsController");
const { exportLocale } = require("../controllers/exportController");
const {
    getMembers,
    addMember,
    updateMember,
    deleteMember
} = require("../controllers/membersController");
const {
    requireAuth,
    requireProjectAccess,
    requireProjectOwner
} = require("../middleware/auth");

const router = express.Router();
const { deleteVersion } = require('../controllers/versionsController');
const { getGlossary, saveGlossaryEntry, requireGlossaryReviewer, reviewGlossaryEntry, updateGlossaryConcept } = require('../controllers/glossaryController');

router.use(requireAuth);
router.param("projectId", requireProjectAccess);

router.get("/", getProjects);
router.post("/", createProject);
router.get("/:projectId", getProject);
router.get('/:projectId/glossary', getGlossary);
router.post('/:projectId/glossary', saveGlossaryEntry);
router.patch('/:projectId/glossary/:entryId/review', requireGlossaryReviewer, reviewGlossaryEntry);
router.patch('/:projectId/glossary-concepts/:conceptId', requireGlossaryReviewer, updateGlossaryConcept);
router.patch("/:projectId", requireProjectOwner, updateProject);
router.delete("/:projectId", requireProjectOwner, deleteProject);
router.get("/:projectId/members", requireProjectOwner, getMembers);
router.post("/:projectId/members", requireProjectOwner, addMember);
router.patch("/:projectId/members/:memberId", requireProjectOwner, updateMember);
router.delete("/:projectId/members/:memberId", requireProjectOwner, deleteMember);
router.post("/:projectId/locales", requireProjectOwner, addLocale);
router.patch("/:projectId/locales/:localeId", requireProjectOwner, updateLocale);
router.delete("/:projectId/locales/:localeId", requireProjectOwner, deleteLocale);
router.post("/:projectId/import", requireProjectOwner, importSourceFile);
router.delete('/:projectId/versions/:versionId', requireProjectOwner, deleteVersion);
router.patch("/:projectId/translations/:translationId", withPageLock(updateTranslation));
router.patch("/:projectId/translations/:translationId/comment", withPageLock(updateTranslationComment));
router.get("/:projectId/export/:localeCode", exportLocale);

module.exports = router;
