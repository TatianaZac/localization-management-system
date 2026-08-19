const express = require("express");
const cors = require("cors");
const prisma = require("./prisma");
const { flattenLocalizationObject } = require("./localization");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function getProjectId(value) {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }

    return Number(value);
}

function getText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function getLocaleCode(value) {
    return getText(value).toLowerCase();
}

function sendNotFound(res, entity = "Project") {
    return res.status(404).json({ error: entity + " was not found" });
}

app.get("/", (req, res) => {
    res.send("Localization Management API");
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "Localization Management API is running"
    });
});

app.get("/api/projects", async (req, res, next) => {
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
});

app.post("/api/projects", async (req, res, next) => {
    try {
        const name = getText(req.body.name);
        const description = getText(req.body.description) || null;
        const sourceLocale = req.body.sourceLocale || {};
        const sourceLocaleCode = getLocaleCode(sourceLocale.code || "en");
        const sourceLocaleName = getText(sourceLocale.name) || sourceLocaleCode;

        if (!name) {
            return res.status(400).json({ error: "Project name is required" });
        }

        if (!/^[a-z]{2,3}(-[a-z]{2})?$/.test(sourceLocaleCode)) {
            return res.status(400).json({ error: "Source locale code is invalid" });
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
});

app.get("/api/projects/:projectId", async (req, res, next) => {
    try {
        const projectId = getProjectId(req.params.projectId);

        if (!projectId) {
            return res.status(400).json({ error: "Project id is invalid" });
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
});

app.post("/api/projects/:projectId/locales", async (req, res, next) => {
    try {
        const projectId = getProjectId(req.params.projectId);
        const code = getLocaleCode(req.body.code);
        const name = getText(req.body.name);

        if (!projectId) {
            return res.status(400).json({ error: "Project id is invalid" });
        }

        if (!/^[a-z]{2,3}(-[a-z]{2})?$/.test(code) || !name) {
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
});

app.post("/api/projects/:projectId/import", async (req, res, next) => {
    try {
        const projectId = getProjectId(req.params.projectId);

        if (!projectId) {
            return res.status(400).json({ error: "Project id is invalid" });
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

        const sourceLocaleCode = getLocaleCode(req.body.sourceLocaleCode || project.sourceLocaleCode);

        if (sourceLocaleCode !== project.sourceLocaleCode) {
            return res.status(400).json({
                error: "This endpoint imports only the project's source locale"
            });
        }

        const content = Object.prototype.hasOwnProperty.call(req.body, "content")
            ? req.body.content
            : req.body;
        const entries = flattenLocalizationObject(content);

        if (entries.length === 0) {
            return res.status(400).json({ error: "Localization file is empty" });
        }

        const summary = await prisma.$transaction(async (transaction) => {
            const result = {
                total: entries.length,
                created: 0,
                updated: 0,
                unchanged: 0
            };
            const changedKeyIds = [];

            for (const entry of entries) {
                const translationKey = await transaction.translationKey.upsert({
                    where: {
                        projectId_key: {
                            projectId,
                            key: entry.key
                        }
                    },
                    create: {
                        projectId,
                        key: entry.key
                    },
                    update: {}
                });

                const currentSource = await transaction.sourceText.findFirst({
                    where: {
                        translationKeyId: translationKey.id,
                        isCurrent: true
                    }
                });

                if (!currentSource) {
                    const sourceText = await transaction.sourceText.create({
                        data: {
                            translationKeyId: translationKey.id,
                            value: entry.value,
                            version: 1
                        }
                    });

                    if (project.locales.length > 0) {
                        await transaction.translation.createMany({
                            data: project.locales.map((locale) => ({
                                translationKeyId: translationKey.id,
                                localeId: locale.id,
                                sourceVersion: sourceText.version
                            }))
                        });
                    }

                    result.created += 1;
                    continue;
                }

                if (currentSource.value === entry.value) {
                    result.unchanged += 1;
                    continue;
                }

                await transaction.sourceText.update({
                    where: { id: currentSource.id },
                    data: { isCurrent: false }
                });

                await transaction.sourceText.create({
                    data: {
                        translationKeyId: translationKey.id,
                        value: entry.value,
                        version: currentSource.version + 1
                    }
                });

                changedKeyIds.push(translationKey.id);
                result.updated += 1;
            }

            if (changedKeyIds.length > 0) {
                await transaction.translation.updateMany({
                    where: {
                        translationKeyId: { in: changedKeyIds },
                        value: { not: null }
                    },
                    data: {
                        status: "OUTDATED"
                    }
                });
            }

            return result;
        });

        res.json(summary);
    } catch (error) {
        if (error.message.includes("Localization file") || error.message.includes("Value for key")) {
            return res.status(400).json({ error: error.message });
        }

        next(error);
    }
});

app.use((error, req, res, next) => {
    if (error.code === "P2002") {
        return res.status(409).json({
            error: "A record with this value already exists"
        });
    }

    console.error(error);
    res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
