// Цей файл формує та повертає JSON-файл перекладів вибраної локалі.

const prisma = require("../prisma");
const { selectPageVersion } = require('../services/pageSelection');
const { buildLocalizationObject } = require("../utils/buildLocalizationObject");
const {
    getLocaleCode,
    getProjectId,
    isValidLocaleCode
} = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

// Збирає переклади локалі у вкладений об'єкт і надсилає його як JSON-файл.
async function exportLocale(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const localeCode = getLocaleCode(req.params.localeCode);

        if (!projectId || !isValidLocaleCode(localeCode)) {
            return res.status(400).json({
                error: "Project id or locale code is invalid"
            });
        }

        const selection = await selectPageVersion(projectId, req.query);
        if (!selection.selectedVersionId) return sendNotFound(res, 'Page version');
        const locale = await prisma.locale.findUnique({
            where: {
                projectId_code: {
                    projectId,
                    code: localeCode
                }
            },
            include: {
                translations: {
                    where: { translationKey: { pageVersionId: selection.selectedVersionId } },
                    include: {
                        translationKey: {
                            select: { key: true }
                        }
                    }
                }
            }
        });

        if (!locale || locale.isSource) {
            return sendNotFound(res, "Target locale");
        }

        const entries = locale.translations
            .map((translation) => ({
                key: translation.translationKey.key,
                // Незавершені рядки теж потрапляють у файл як порожні значення,
                // щоб структура експорту повністю збігалася з оригіналом.
                value: translation.value || ""
            }))
            .sort((left, right) => left.key.localeCompare(right.key));

        const content = buildLocalizationObject(entries);

        res.setHeader("Content-Disposition", `attachment; filename="${localeCode}.json"`);
        res.json(content);
    } catch (error) {
        next(error);
    }
}

module.exports = { exportLocale };
