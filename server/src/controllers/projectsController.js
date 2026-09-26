// Цей файл обробляє створення, отримання та перелік локалізаційних проєктів.

const prisma = require("../prisma");
const { selectPageVersion } = require('../services/pageSelection');
const {
    getLocaleCode,
    getProjectId,
    getText,
    isValidLocaleCode
} = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

// Повертає всі проєкти разом із кількістю мов і ключів у кожному.
async function getProjects(req, res, next) {
    try {
        const projects = await prisma.project.findMany({
            where: {
                OR: [
                    { ownerId: req.user.id },
                    { members: { some: { userId: req.user.id } } }
                ]
            },
            orderBy: { updatedAt: "desc" },
            include: {
                pages: { select: { versions: { where: { deletedAt: null }, orderBy: { number: 'desc' }, take: 1,
                    select: { _count: { select: { translationKeys: true } } } } } },
                members: {
                    where: { userId: req.user.id },
                    select: { role: true },
                    take: 1
                },
                _count: {
                    select: {
                        locales: true,
                        translationKeys: true
                    }
                }
            }
        });

        res.json(projects.map(({ _count, members, pages, ...project }) => ({
            ...project,
            currentUserRole: project.ownerId === req.user.id
                ? "OWNER"
                : members[0]?.role,
            localeCount: _count.locales,
            keyCount: pages.reduce((sum, page) => sum + (page.versions[0]?._count.translationKeys ?? 0), 0)
        })));
    } catch (error) {
        next(error);
    }
}

// Перевіряє вхідні дані та створює проєкт із його вихідною локаллю.
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
                // Власник береться лише з перевіреної сесії, а не з даних браузера.
                ownerId: req.user.id,
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

// Оновлює назву й опис проєкту, не змінюючи його мови та переклади.
async function updateProject(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const name = getText(req.body.name);
        const description = getText(req.body.description) || null;

        if (!projectId) {
            return res.status(400).json({
                error: "Project id is invalid"
            });
        }

        if (!name) {
            return res.status(400).json({
                error: "Project name is required"
            });
        }

        const existingProject = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!existingProject) {
            return sendNotFound(res, "Project");
        }

        const project = await prisma.project.update({
            where: { id: projectId },
            data: { name, description }
        });

        res.json({ ...project, currentUserRole: req.projectRole });
    } catch (error) {
        next(error);
    }
}

// Видаляє проєкт; залежні мови, ключі й переклади видаляються каскадно базою даних.
async function deleteProject(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);

        if (!projectId) {
            return res.status(400).json({
                error: "Project id is invalid"
            });
        }

        const existingProject = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true }
        });

        if (!existingProject) {
            return sendNotFound(res, "Project");
        }

        await prisma.project.delete({
            where: { id: projectId }
        });

        res.status(204).end();
    } catch (error) {
        next(error);
    }
}

// Повертає один проєкт із локалями, актуальними текстами та перекладами.
async function getProject(req, res, next) {
    try {
        const projectId = getProjectId(req.params.projectId);

        if (!projectId) {
            return res.status(400).json({
                error: "Project id is invalid"
            });
        }

        const selection = await selectPageVersion(projectId, req.query);
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                locales: {
                    orderBy: { code: "asc" }
                },
                translationKeys: {
                    where: { pageVersionId: selection.selectedVersionId ?? -1 },
                    orderBy: { key: "asc" },
                    include: {
                        sourceTexts: {
                            orderBy: { version: "desc" }
                        },
                        translations: {
                            include: {
                                history: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 },
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

        res.json({ ...project, ...selection, currentUserRole: req.projectRole });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProjects,
    createProject,
    updateProject,
    deleteProject,
    getProject
};
