// Цей файл обробляє збереження тексту й статусу окремого перекладу.

const prisma = require('../prisma')
const { checkTerminology } = require('../services/terminologyCheck')
const { getProjectId, getText, hasTrailingWhitespace } = require('../utils/validation')
const { sendNotFound } = require('../utils/sendNotFound')

const ALLOWED_STATUSES = new Set(['TRANSLATED', 'REVIEWED', 'NEEDS_REVISION'])

function hasLocaleAccess(req, localeId) {
  return !Array.isArray(req.projectLocaleIds) || req.projectLocaleIds.includes(localeId)
}

// Перевіряє та оновлює переклад, прив'язуючи його до актуальної версії оригіналу.
async function updateTranslation(req, res, next, db = prisma) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const translationId = getProjectId(req.params.translationId)

    if (!projectId || !translationId) {
      return res.status(400).json({
        error: 'Некоректний проєкт або переклад'
      })
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
        },
        versions: { orderBy: { number: 'desc' } }
      }
    })

    if (!translation) {
      return sendNotFound(res, 'переклад')
    }

    if (!hasLocaleAccess(req, translation.localeId)) {
      return res.status(403).json({ error: 'Ця мова не призначена цьому учаснику' })
    }

    // Вік версії не обмежує роботу: забороняємо запис лише у видалені версії.
    if (translation.translationKey.pageVersion?.deletedAt) {
      return res.status(409).json({ error: 'Ця версія більше не доступна для редагування' })
    }

    if (translation.locale.isSource) {
      return res.status(400).json({
        error: 'Базову мову не можна редагувати як переклад'
      })
    }

    const hasSubmittedValue = Object.prototype.hasOwnProperty.call(req.body, 'value')
    if (hasSubmittedValue && hasTrailingWhitespace(req.body.value)) {
      return res.status(400).json({
        error: 'Прибери пробіли наприкінці перекладу'
      })
    }

    const submittedValue = getText(req.body.value)
    const requestedStatus = getText(req.body.status).toUpperCase()
    const isRevision = requestedStatus === 'NEEDS_REVISION'
    const reviewReason = getText(req.body.reviewReason)
    const requestedVersion = Number(req.body.versionNumber || translation.currentVersion)
    const reviewedVersion =
      req.projectRole === 'REVIEWER'
        ? translation.versions.find((version) => version.number === requestedVersion)
        : null
    const value = reviewedVersion?.value ?? submittedValue

    if (requestedStatus && !ALLOWED_STATUSES.has(requestedStatus)) {
      return res.status(400).json({
        error: 'Некоректний статус перекладу'
      })
    }

    if ((requestedStatus === 'REVIEWED' || isRevision) && !value) {
      return res.status(400).json({
        error: 'Порожній переклад не можна затвердити'
      })
    }

    if (req.projectRole === 'REVIEWER' && hasSubmittedValue && !submittedValue) {
      return res.status(400).json({ error: 'Порожній переклад не можна затвердити' })
    }

    if (req.projectRole === 'OWNER') {
      return res.status(403).json({
        error: 'Власник керує проєктом, але не редагує переклади'
      })
    }

    if (req.projectRole === 'EDITOR' && (requestedStatus === 'REVIEWED' || isRevision)) {
      return res.status(403).json({
        error: 'Редактор не може затверджувати переклади'
      })
    }

    if (req.projectRole === 'REVIEWER') {
      // Рецензент обирає збережену версію, але не може передати довільний текст.
      if (
        !reviewedVersion ||
        !['REVIEWED', 'NEEDS_REVISION'].includes(requestedStatus) ||
        (hasSubmittedValue && submittedValue !== reviewedVersion.value)
      ) {
        return res.status(403).json({
          error: 'Рецензент може працювати лише зі збереженою версією перекладу'
        })
      }
    }

    if (isRevision && (!reviewReason || reviewReason.length > 2000)) {
      return res.status(400).json({ error: 'Вкажи причину повернення: від 1 до 2000 символів' })
    }

    // Порожнє поле очищає переклад. Інакше звичайне збереження
    // переводить його у стан TRANSLATED, а кнопка перевірки — REVIEWED.
    const status = value ? requestedStatus || 'TRANSLATED' : 'NEW'
    const currentSource = translation.translationKey.sourceTexts[0]
    if (
      req.projectRole === 'REVIEWER' &&
      requestedStatus === 'REVIEWED' &&
      reviewedVersion.sourceVersion !== currentSource?.version
    ) {
      return res.status(409).json({
        error: 'Цю версію створено для старої редакції оригіналу'
      })
    }
    const terminologyWarnings = await checkTerminology(
      db,
      projectId,
      translation.localeId,
      currentSource?.value,
      value,
      { semantic: true }
    )
    const nextVersion = (translation.versions[0]?.number ?? 0) + 1
    const sourceVersion =
      req.projectRole === 'REVIEWER'
        ? reviewedVersion.sourceVersion
        : (currentSource?.version ?? null)
    const versionChange =
      req.projectRole === 'EDITOR' && value
        ? {
            create: {
              number: nextVersion,
              value,
              sourceVersion,
              authorId: req.user.id,
              authorName: req.user.name,
              authorRole: req.projectRole,
              status
            }
          }
        : req.projectRole === 'REVIEWER'
          ? {
              update: {
                where: { id: reviewedVersion.id },
                data: {
                  status,
                  reviewReason: isRevision ? reviewReason : null,
                  reviewerId: req.user.id,
                  reviewerName: req.user.name,
                  reviewedAt: new Date()
                }
              }
            }
          : undefined

    const updatedTranslation = await db.translation.update({
      where: { id: translationId },
      data: {
        value: value || null,
        status,
        sourceVersion,
        currentVersion:
          req.projectRole === 'REVIEWER' ? reviewedVersion.number : value ? nextVersion : null,
        reviewReason: isRevision ? reviewReason : null,
        ...(versionChange ? { versions: versionChange } : {}),
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
        history: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 },
        versions: { orderBy: { number: 'desc' } },
        locale: {
          select: {
            code: true,
            name: true
          }
        }
      }
    })

    res.json({ ...updatedTranslation, terminologyWarnings })
  } catch (error) {
    next(error)
  }
}

// Зберігає примітку редактора, не змінюючи текст або статус перекладу.
async function updateTranslationComment(req, res, next, db = prisma) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const translationId = getProjectId(req.params.translationId)

    if (!projectId || !translationId) {
      return res.status(400).json({
        error: 'Некоректний проєкт або переклад'
      })
    }

    if (req.projectRole === 'OWNER') {
      return res.status(403).json({
        error: 'Власник може читати коментарі, але не редагувати їх'
      })
    }

    if (typeof req.body.comment !== 'string') {
      return res.status(400).json({
        error: 'Коментар до перекладу має бути текстом'
      })
    }

    const translation = await db.translation.findFirst({
      where: {
        id: translationId,
        translationKey: { projectId },
        locale: { isSource: false }
      },
      include: { translationKey: { include: { pageVersion: true } } }
    })

    if (!translation) {
      return sendNotFound(res, 'переклад')
    }

    if (!hasLocaleAccess(req, translation.localeId)) {
      return res.status(403).json({ error: 'Ця мова не призначена цьому учаснику' })
    }

    if (translation.translationKey.pageVersion?.deletedAt) {
      return res.status(409).json({ error: 'Ця версія більше не доступна для редагування' })
    }

    const comment = getText(req.body.comment)

    if (comment.length > 2000) {
      return res.status(400).json({
        error: 'Коментар до перекладу задовгий'
      })
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
    })

    res.json(updatedTranslation)
  } catch (error) {
    next(error)
  }
}

// Відповідь відправляється лише після commit. Спільне блокування з імпортом
// та видаленням не дозволяє видалити версію між перевіркою й записом перекладу.
function withPageLock(handler) {
  return async (req, res, next) => {
    try {
      const result = await prisma.$transaction(
        async (db) => {
          const id = getProjectId(req.params.translationId)
          const projectId = getProjectId(req.params.projectId)
          const translation =
            id && projectId
              ? await db.translation.findFirst({
                  where: { id, translationKey: { projectId } },
                  select: {
                    translationKey: {
                      select: { pageVersion: { select: { pageId: true } } }
                    }
                  }
                })
              : null
          if (translation) {
            const pageId = translation.translationKey.pageVersion.pageId
            await db.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${pageId}::bigint)`
          }
          const response = {
            code: 200,
            body: null,
            status(code) {
              this.code = code
              return this
            },
            json(body) {
              this.body = body
              return this
            }
          }
          await handler(
            req,
            response,
            (error) => {
              throw error
            },
            db
          )
          return { code: response.code, body: response.body }
        },
        { timeout: 60000 }
      )
      res.status(result.code).json(result.body)
    } catch (error) {
      next(error)
    }
  }
}

module.exports = { updateTranslation, updateTranslationComment, withPageLock }
