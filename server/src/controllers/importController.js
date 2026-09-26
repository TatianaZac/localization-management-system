// Цей файл приймає JSON вихідної локалі та передає його сервісу імпорту.

const prisma = require("../prisma");
const { importSourceTexts } = require("../services/sourceImportService");
const { getLocaleCode, getProjectId } = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

// Перевіряє проєкт і вміст запиту, а потім імпортує вихідні тексти.
async function importSourceFile(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);

        if (!projectId) {
            return res.status(400).json({
                error: "Project id is invalid"
            });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                locales: {
                    where: { isSource: false },
                    select: { id: true }
                }
            }
        });

        if (!project) {
            return sendNotFound(res);
        }

        const sourceLocaleCode = getLocaleCode(
            req.body.sourceLocaleCode || project.sourceLocaleCode
        );

        if (sourceLocaleCode !== project.sourceLocaleCode) {
            return res.status(400).json({
                error: "This endpoint imports only the project's source locale"
            });
        }

        const content = Object.prototype.hasOwnProperty.call(req.body, "content")
            ? req.body.content
            : req.body;
        const summary = await importSourceTexts(project, content, {
            pageId: req.body.pageId, pageName: req.body.pageName, fileName: req.body.fileName,
            versionName: req.body.versionName
        });

        res.json(summary);
    } catch (error) {
        if (
            error.message.includes("Localization file") ||
            error.message.includes("Value for key")
        ) {
            return res.status(400).json({
                error: error.message
            });
        }

        next(error);
    }
}

module.exports = { importSourceFile };
