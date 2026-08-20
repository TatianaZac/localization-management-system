const prisma = require("../prisma");
const {
    getLocaleCode,
    getProjectId,
    getText,
    isValidLocaleCode
} = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

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

module.exports = { addLocale };
