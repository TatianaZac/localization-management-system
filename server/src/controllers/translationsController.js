// Цей файл обробляє збереження тексту й статусу окремого перекладу.

const prisma = require("../prisma");
const { getProjectId, getText } = require("../utils/validation");
const { sendNotFound } = require("../utils/sendNotFound");

const ALLOWED_STATUSES = new Set(["TRANSLATED", "REVIEWED", "NEEDS_REVISION"]);

// Перевіряє та оновлює переклад, прив'язуючи його до актуальної версії оригіналу.
async function updateTranslation(req, res, next, db = prisma) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const translationId = getProjectId(req.params.translationId);

        if (!projectId || !translationId) {
            return res.status(400).json({
                error: "Project id or translation id is invalid"
            });
        }

        const translation = await db.translation.findFirst({
            where: {
                id: translationId,
                translationKey: { projectId }
            },
            include: {
                locale: true,
                translationKey: {
                    include: {
                        pageVersion: true,
                        sourceTexts: {
                            where: { isCurrent: true },
                            take: 1
                        }
                    }
                }
            }
        });

        if (!translation) {
            return sendNotFound(res, "Translation");
        }

        // Вік версії не обмежує роботу: забороняємо запис лише у видалені версії.
        if (translation.translationKey.pageVersion?.deletedAt) {
            return res.status(409).json({ error: 'Ця версія більше не доступна для редагування' });
        }

        if (translation.locale.isSource) {
            return res.status(400).json({
                error: "The source locale cannot be edited as a translation"
            });
        }

        const value = getText(req.body.value);
        const requestedStatus = getText(req.body.status).toUpperCase();
        const isRevision = requestedStatus === "NEEDS_REVISION";
        const reviewReason = getText(req.body.reviewReason);

        if (requestedStatus && !ALLOWED_STATUSES.has(requestedStatus)) {
            return res.status(400).json({
                error: "Translation status is invalid"
            });
        }

        if ((requestedStatus === "REVIEWED" || isRevision) && !value) {
            return res.status(400).json({
                error: "An empty translation cannot be reviewed"
            });
        }

        if (req.projectRole === "OWNER") {
            return res.status(403).json({
                error: "Project owners manage the project but do not edit translations"
            });
        }

        if (req.projectRole === "EDITOR" && (requestedStatus === "REVIEWED" || isRevision)) {
            return res.status(403).json({
                error: "Editors cannot approve translations"
            });
        }

        if (req.projectRole === "REVIEWER") {
            // Рецензент підтверджує вже збережений текст, але не підміняє роботу перекладача.
            const savedValue = getText(translation.value);
            if (!["REVIEWED", "NEEDS_REVISION"].includes(requestedStatus) || value !== savedValue) {
                return res.status(403).json({
                    error: "Reviewers can only approve an existing translation"
                });
            }
        }

        if (isRevision && (!reviewReason || reviewReason.length > 2000)) {
            return res.status(400).json({ error: "Вкажи причину повернення: від 1 до 2000 символів" });
        }

        // Порожнє поле очищає переклад. Інакше звичайне збереження
        // переводить його у стан TRANSLATED, а кнопка перевірки — REVIEWED.
        const status = value ? (requestedStatus || "TRANSLATED") : "NEW";
        const currentSource = translation.translationKey.sourceTexts[0];
        const sourceVersion = isRevision ? translation.sourceVersion : (currentSource?.version ?? null);

        const updatedTranslation = await db.translation.update({
            where: { id: translationId },
            data: {
                value: value || null,
                status,
                // Повернення не підтверджує актуальність тексту й не змінює його версію.
                sourceVersion,
                reviewReason: isRevision ? reviewReason : null,
                // Вкладене створення атомарне: переклад і запис історії збережуться разом.
                // Автор береться із перевіреної сесії, не з тіла запиту клієнта.
                history: {
                    create: {
                        actorId: req.user.id,
                        actorName: req.user.name,
                        actorRole: req.projectRole,
                        value: value || null,
                        status,
                        sourceVersion,
                        reviewReason: isRevision ? reviewReason : null
                    }
                }
            },
            include: {
                history: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 },
                locale: {
                    select: {
                        code: true,
                        name: true
                    }
                }
            }
        });

        res.json(updatedTranslation);
    } catch (error) {
        next(error);
    }
}

// Зберігає примітку редактора, не змінюючи текст або статус перекладу.
async function updateTranslationComment(req, res, next, db = prisma) {
    try {
        const projectId = getProjectId(req.params.projectId);
        const translationId = getProjectId(req.params.translationId);

        if (!projectId || !translationId) {
            return res.status(400).json({
                error: "Project id or translation id is invalid"
            });
        }

        if (req.projectRole === "OWNER") {
            return res.status(403).json({
                error: "Project owners can read comments but cannot edit them"
            });
        }

        if (typeof req.body.comment !== "string") {
            return res.status(400).json({
                error: "Translation comment must be a string"
            });
        }

        const translation = await db.translation.findFirst({
            where: {
                id: translationId,
                translationKey: { projectId },
                locale: { isSource: false }
            },
            include: { translationKey: { include: { pageVersion: true } } }
        });

        if (!translation) {
            return sendNotFound(res, "Translation");
        }

        if (translation.translationKey.pageVersion?.deletedAt) {
            return res.status(409).json({ error: 'Ця версія більше не доступна для редагування' });
        }

        const comment = getText(req.body.comment);

        if (comment.length > 2000) {
            return res.status(400).json({
                error: "Translation comment is too long"
            });
        }

        const updatedTranslation = await db.translation.update({
            where: { id: translationId },
            data: { comment: comment || null },
            include: {
                locale: {
                    select: {
                        code: true,
                        name: true
                    }
                }
            }
        });

        res.json(updatedTranslation);
    } catch (error) {
        next(error);
    }
}

// Відповідь відправляється лише після commit. Спільне блокування з імпортом
// та видаленням не дозволяє видалити версію між перевіркою й записом перекладу.
function withPageLock(handler) {
    return async (req, res, next) => {
        try {
            const result = await prisma.$transaction(async db => {
                const id = getProjectId(req.params.translationId);
                const projectId = getProjectId(req.params.projectId);
                const translation = id && projectId ? await db.translation.findFirst({
                    where: { id, translationKey: { projectId } },
                    select: { translationKey: { select: { pageVersion: { select: { pageId: true } } } } }
                }) : null;
                if (translation) {
                    const pageId = translation.translationKey.pageVersion.pageId;
                    await db.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${pageId}::bigint)`;
                }
                const response = { code: 200, body: null,
                    status(code) { this.code = code; return this; },
                    json(body) { this.body = body; return this; } };
                await handler(req, response, error => { throw error; }, db);
                return { code: response.code, body: response.body };
            }, { timeout: 60000 });
            res.status(result.code).json(result.body);
        } catch (error) { next(error); }
    };
}

module.exports = { updateTranslation, updateTranslationComment, withPageLock };
