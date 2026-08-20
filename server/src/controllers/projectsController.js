const prisma = require("../prisma");
const {
    getLocaleCode,
    getProjectId,
    getText,
    isValidLocaleCode
} = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

async function getProjects(req, res, next) {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { updatedAt: "desc" },
            include: {
                _count: {
                    select: {
                        locales: true,
                        translationKeys: true
                    }
                }
            }
        });

        res.json(projects.map(({ _count, ...project }) => ({
            ...project,
            localeCount: _count.locales,
            keyCount: _count.translationKeys
        })));
    } catch (error) {
        next(error);
    }
}

async function createProject(req, res, next) {
    try {
        const name = getText(req.body.name);
        const description = getText(req.body.description) || null;
        const sourceLocale = req.body.sourceLocale || {};
        const sourceLocaleCode = getLocaleCode(sourceLocale.code || "en");
        const sourceLocaleName = getText(sourceLocale.name) || sourceLocaleCode;

        if (!name) {
            return res.status(400).json({
                error: "Project name is required"
            });
        }

        if (!isValidLocaleCode(sourceLocaleCode)) {
            return res.status(400).json({
                error: "Source locale code is invalid"
            });
        }

        const project = await prisma.project.create({
            data: {
                name,
                description,
                sourceLocaleCode,
                locales: {
                    create: {
                        code: sourceLocaleCode,
                        name: sourceLocaleName,
                        isSource: true
                    }
                }
            },
            include: {
                locales: true
            }
        });

        res.status(201).json(project);
    } catch (error) {
        next(error);
    }
}

async function getProject(req, res, next) {
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
                    orderBy: { code: "asc" }
                },
                translationKeys: {
                    orderBy: { key: "asc" },
                    include: {
                        sourceTexts: {
                            where: { isCurrent: true }
                        },
                        translations: {
                            include: {
                                locale: {
                                    select: {
                                        code: true,
                                        name: true
                                    }
                                }
                            },
                            orderBy: {
                                localeId: "asc"
                            }
                        }
                    }
                }
            }
        });

        if (!project) {
            return sendNotFound(res);
        }

        res.json(project);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProjects,
    createProject,
    getProject
};
