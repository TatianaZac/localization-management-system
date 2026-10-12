// Команда пропонує; рецензент відповідає за погодження мовних рішень.
const prisma = require('../prisma')
const { getText, getProjectId } = require('../utils/validation')
const include = {
  concept: true,
  locale: { select: { code: true, name: true } }
}

// Термін і визначення спільні для всіх мов поняття.
function serialize(entry) {
  return {
    ...entry,
    term: entry.concept.term,
    definition: entry.concept.definition
  }
}

function localeScope(req) {
  return Array.isArray(req.projectLocaleIds) ? { localeId: { in: req.projectLocaleIds } } : {}
}

function hasLocaleAccess(req, localeId) {
  return !Array.isArray(req.projectLocaleIds) || req.projectLocaleIds.includes(localeId)
}

// Читає лише словник проєкту, доступ до якого перевірив middleware.
async function getGlossary(req, res, next) {
  try {
    const entries = await prisma.glossaryEntry.findMany({
      where: {
        concept: { projectId: Number(req.params.projectId) },
        ...localeScope(req)
      },
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
    })
    res.json(entries.map(serialize))
  } catch (error) {
    next(error)
  }
}

// Створює пропозицію, зберігаючи чинний затверджений варіант до нового рішення.
async function saveGlossaryEntry(req, res, next) {
  try {
    if (!['OWNER', 'EDITOR', 'REVIEWER'].includes(req.projectRole))
      return res.status(403).json({ error: 'Недостатньо прав' })
    const projectId = Number(req.params.projectId)
    const term = getText(req.body.term).normalize('NFKC').replace(/\s+/gu, ' ')
    const definition = getText(req.body.definition)
    const translation = getText(req.body.translation)
    const note = getText(req.body.note)
    const example = getText(req.body.example)
    if (
      !term ||
      term.length > 200 ||
      !translation ||
      translation.length > 500 ||
      definition.length > 2000 ||
      note.length > 2000 ||
      example.length > 1000
    ) {
      return res.status(400).json({
        error:
          'Вкажи термін (до 200), переклад (до 500), пояснення (до 2000) і приклад (до 1000 символів)'
      })
    }
    const locale = await prisma.locale.findFirst({
      where: { projectId, code: getText(req.body.localeCode), isSource: false }
    })
    if (!locale) return res.status(400).json({ error: 'Обери цільову мову цього проєкту' })
    if (!hasLocaleAccess(req, locale.id)) {
      return res.status(403).json({ error: 'Ця мова не призначена цьому учаснику' })
    }
    const conceptId = req.body.conceptId == null ? null : getProjectId(String(req.body.conceptId))
    if (req.body.conceptId != null && !conceptId)
      return res.status(400).json({ error: 'Некоректне поняття' })
    const entry = await prisma.$transaction(async (tx) => {
      let concept = conceptId
        ? await tx.glossaryConcept.findFirst({
            where: { id: conceptId, projectId }
          })
        : await tx.glossaryConcept.findUnique({
            where: {
              projectId_normalizedTerm: {
                projectId,
                normalizedTerm: term.toLowerCase()
              }
            }
          })
      if (conceptId && !concept) return null
      // Пропозиція не перезаписує спільне визначення вже наявного поняття.
      if (!concept)
        concept = await tx.glossaryConcept.create({
          data: {
            projectId,
            term,
            normalizedTerm: term.toLowerCase(),
            definition
          }
        })
      // Рецензент є фінальною мовною інстанцією: його власний запис не потребує
      // окремого погодження та одразу замінює попередню рекомендацію цією мовою.
      const reviewer = req.projectRole === 'REVIEWER'
      if (reviewer)
        await tx.glossaryEntry.updateMany({
          where: {
            conceptId: concept.id,
            localeId: locale.id,
            status: 'APPROVED'
          },
          data: {
            status: 'ARCHIVED',
            decisionNote: 'Замінено терміном, доданим рецензентом'
          }
        })
      return tx.glossaryEntry.create({
        data: {
          conceptId: concept.id,
          localeId: locale.id,
          translation,
          note,
          example,
          authorId: req.user.id,
          authorName: req.user.name,
          status: reviewer ? 'APPROVED' : 'PENDING',
          reviewerId: reviewer ? req.user.id : null,
          reviewerName: reviewer ? req.user.name : null,
          reviewedAt: reviewer ? new Date() : null
        },
        include
      })
    })
    if (!entry) return res.status(404).json({ error: 'Поняття не знайдено' })
    res.status(201).json(serialize(entry))
  } catch (error) {
    if (error.code === 'P2002')
      return res.status(409).json({
        error: 'Для цього терміна й мови вже є пропозиція на погодженні.'
      })
    next(error)
  }
}

// Рецензент виправляє вибраний запис напряму; після збереження він стає чинною рекомендацією.
async function updateGlossaryEntry(req, res, next) {
  try {
    const id = getProjectId(req.params.entryId)
    const projectId = Number(req.params.projectId)
    const term = getText(req.body.term).normalize('NFKC').replace(/\s+/gu, ' ')
    const definition = getText(req.body.definition)
    const translation = getText(req.body.translation)
    const note = getText(req.body.note)
    const example = getText(req.body.example)
    if (
      !id ||
      !term ||
      term.length > 200 ||
      !translation ||
      translation.length > 500 ||
      definition.length > 2000 ||
      note.length > 2000 ||
      example.length > 1000
    ) {
      return res.status(400).json({
        error:
          'Вкажи термін (до 200), переклад (до 500), пояснення (до 2000) і приклад (до 1000 символів)'
      })
    }
    const entry = await prisma.$transaction(async (tx) => {
      const current = await tx.glossaryEntry.findFirst({
        where: { id, concept: { projectId }, ...localeScope(req) },
        include
      })
      if (!current) return null
      await tx.glossaryEntry.updateMany({
        where: {
          conceptId: current.conceptId,
          localeId: current.localeId,
          status: 'APPROVED',
          id: { not: id }
        },
        data: {
          status: 'ARCHIVED',
          decisionNote: 'Замінено відредагованим терміном'
        }
      })
      await tx.glossaryConcept.update({
        where: { id: current.conceptId },
        data: {
          term,
          normalizedTerm: term.toLowerCase(),
          definition
        }
      })
      return tx.glossaryEntry.update({
        where: { id },
        data: {
          translation,
          note,
          example,
          status: 'APPROVED',
          reviewerId: req.user.id,
          reviewerName: req.user.name,
          reviewedAt: new Date(),
          decisionNote: ''
        },
        include
      })
    })
    if (!entry) return res.status(404).json({ error: 'Термін не знайдено' })
    res.json(serialize(entry))
  } catch (error) {
    if (error.code === 'P2002')
      return res.status(409).json({ error: 'Термін із такою назвою вже існує.' })
    next(error)
  }
}

// Явне видалення доступне лише рецензенту; порожнє поняття також прибираємо.
async function deleteGlossaryEntry(req, res, next) {
  try {
    const id = getProjectId(req.params.entryId)
    const projectId = Number(req.params.projectId)
    if (!id) return res.status(400).json({ error: 'Некоректний термін' })
    const deleted = await prisma.$transaction(async (tx) => {
      const entry = await tx.glossaryEntry.findFirst({
        where: { id, concept: { projectId }, ...localeScope(req) }
      })
      if (!entry) return null
      await tx.glossaryEntry.delete({ where: { id } })
      const remaining = await tx.glossaryEntry.count({
        where: { conceptId: entry.conceptId }
      })
      if (!remaining) await tx.glossaryConcept.delete({ where: { id: entry.conceptId } })
      return entry
    })
    if (!deleted) return res.status(404).json({ error: 'Термін не знайдено' })
    res.json({ id: deleted.id })
  } catch (error) {
    next(error)
  }
}

// Власник керує командою, але не отримує мовні повноваження рецензента.
function requireGlossaryReviewer(req, res, next) {
  if (req.projectRole !== 'REVIEWER')
    return res.status(403).json({ error: 'Погоджувати та архівувати терміни може лише рецензент' })
  next()
}

// Погодження нової версії й архівування попередньої відбуваються атомарно.
async function reviewGlossaryEntry(req, res, next) {
  try {
    if (req.projectRole !== 'REVIEWER')
      return res.status(403).json({ error: 'Лише рецензент може прийняти рішення' })
    const id = getProjectId(req.params.entryId)
    const { action, updatedAt } = req.body
    const decisionNote = getText(req.body.decisionNote)
    if (!id || !['approve', 'archive'].includes(action) || decisionNote.length > 2000)
      return res.status(400).json({ error: 'Некоректне рішення' })
    const result = await prisma.$transaction(
      async (tx) => {
        const entry = await tx.glossaryEntry.findFirst({
          where: {
            id,
            concept: { projectId: Number(req.params.projectId) },
            ...localeScope(req)
          },
          include
        })
        if (!entry) return { code: 404, error: 'Термін не знайдено' }
        if (
          entry.updatedAt.toISOString() !== updatedAt ||
          entry.status === 'ARCHIVED' ||
          (action === 'approve' && entry.status !== 'PENDING')
        ) {
          return {
            code: 409,
            error: 'Запис уже змінився. Онови список перед рішенням.'
          }
        }
        if (action === 'approve') {
          await tx.glossaryEntry.updateMany({
            where: {
              conceptId: entry.conceptId,
              localeId: entry.localeId,
              status: 'APPROVED'
            },
            data: {
              status: 'ARCHIVED',
              decisionNote: 'Замінено новою затвердженою версією'
            }
          })
        }
        const updated = await tx.glossaryEntry.update({
          where: { id },
          data: {
            status: action === 'approve' ? 'APPROVED' : 'ARCHIVED',
            reviewerId: req.user.id,
            reviewerName: req.user.name,
            reviewedAt: new Date(),
            decisionNote
          },
          include
        })
        return { entry: serialize(updated) }
      },
      { isolationLevel: 'Serializable' }
    )
    if (result.error) return res.status(result.code).json({ error: result.error })
    res.json(result.entry)
  } catch (error) {
    if (['P2034', 'P2002'].includes(error.code))
      return res.status(409).json({ error: 'Інший рецензент уже змінив запис. Онови список.' })
    next(error)
  }
}

// Уточнює спільне визначення поняття для всіх його мов.
async function updateGlossaryConcept(req, res, next) {
  try {
    if (req.projectRole !== 'REVIEWER')
      return res.status(403).json({ error: 'Лише рецензент може змінити визначення' })
    const id = getProjectId(req.params.conceptId)
    const definition = getText(req.body.definition)
    if (!id || definition.length > 2000)
      return res.status(400).json({ error: 'Некоректне визначення' })
    const result = await prisma.glossaryConcept.updateMany({
      where: { id, projectId: Number(req.params.projectId) },
      data: { definition }
    })
    if (!result.count) return res.status(404).json({ error: 'Поняття не знайдено' })
    res.json({ id, definition })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getGlossary,
  saveGlossaryEntry,
  requireGlossaryReviewer,
  reviewGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
  updateGlossaryConcept
}
