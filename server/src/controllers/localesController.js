// Цей файл обробляє додавання цільових мов до локалізаційного проєкту.

const prisma = require("../prisma");
const {
    getLocaleCode,
    getProjectId,
    getText,
    isValidLocaleCode
} = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

// Створює цільову локаль і порожні переклади для всіх наявних ключів.
async function addLocale(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const code = getLocaleCode(req.body.code);
        const name = getText(req.body.name);

        if (!projectId) {
            return res.status(400).json({
                error: "Project id is invalid"
            });
        }

        if (!isValidLocaleCode(code) || !name) {
            return res.status(400).json({
                error: "Locale code and name are required"
            });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { sourceLocaleCode: true }
        });

        if (!project) {
            return sendNotFound(res);
        }

        if (code === project.sourceLocaleCode) {
            return res.status(400).json({
                error: "The source locale is already created with the project"
            });
        }

        const locale = await prisma.$transaction(async (transaction) => {
            const createdLocale = await transaction.locale.create({
                data: {
                    projectId,
                    code,
                    name,
                    isSource: false
                }
            });

            const translationKeys = await transaction.translationKey.findMany({
                where: { projectId },
                select: {
                    id: true,
                    sourceTexts: {
                        where: { isCurrent: true },
                        select: { version: true }
                    }
                }
            });

            if (translationKeys.length > 0) {
                await transaction.translation.createMany({
                    data: translationKeys.map((translationKey) => ({
                        translationKeyId: translationKey.id,
                        localeId: createdLocale.id,
                        sourceVersion: translationKey.sourceTexts[0]?.version ?? null
                    }))
                });
            }

            return createdLocale;
        });

        res.status(201).json(locale);
    } catch (error) {
        next(error);
    }
}

// Перейменовує цільову мову; стабільний код локалі після створення не змінюється.
async function updateLocale(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const localeId = getProjectId(req.params.localeId);
        const name = getText(req.body.name);

        if (!projectId || !localeId) {
            return res.status(400).json({
                error: "Project id or locale id is invalid"
            });
        }

        if (!name) {
            return res.status(400).json({
                error: "Locale name is required"
            });
        }

        const locale = await prisma.locale.findFirst({
            where: { id: localeId, projectId }
        });

        if (!locale) {
            return sendNotFound(res, "Locale");
        }

        if (locale.isSource) {
            return res.status(400).json({
                error: "The source locale cannot be edited here"
            });
        }

        const updatedLocale = await prisma.locale.update({
            where: { id: localeId },
            data: { name }
        });

        res.json(updatedLocale);
    } catch (error) {
        next(error);
    }
}

// Видаляє лише цільову мову; пов'язані з нею переклади база видаляє каскадно.
async function deleteLocale(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const localeId = getProjectId(req.params.localeId);

        if (!projectId || !localeId) {
            return res.status(400).json({
                error: "Project id or locale id is invalid"
            });
        }

        const locale = await prisma.locale.findFirst({
            where: { id: localeId, projectId }
        });

        if (!locale) {
            return sendNotFound(res, "Locale");
        }

        // Оригінальна мова є опорою для всіх ключів, тому видаляти її окремо не можна.
        if (locale.isSource) {
            return res.status(400).json({
                error: "The source locale cannot be deleted"
            });
        }

        await prisma.locale.delete({
            where: { id: localeId }
        });

        res.status(204).end();
    } catch (error) {
        next(error);
    }
}

module.exports = { addLocale, updateLocale, deleteLocale };
