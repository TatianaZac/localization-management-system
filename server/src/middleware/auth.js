// Цей файл перевіряє сесію користувача та право власності на проєкт.

const prisma = require('../prisma')
const { hashSessionToken } = require('../utils/sessions')
const { getProjectId } = require('../utils/validation')
const { sendNotFound } = require('../utils/sendNotFound')

// Читає Bearer-токен, знаходить активну сесію та додає користувача до req.
async function requireAuth(req, res, next) {
  try {
    const match = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)

    if (!match) {
      return res.status(401).json({ error: 'Потрібно увійти в акаунт' })
    }

    const tokenHash = hashSessionToken(match[1])
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!session || session.expiresAt <= new Date()) {
      // Прострочений запис більше не потрібний; deleteMany безпечно працює і для відсутньої сесії.
      if (session) {
        await prisma.session.deleteMany({ where: { id: session.id } })
      }
      return res.status(401).json({ error: 'Сесія недійсна або завершилася. Увійди знову.' })
    }

    req.user = session.user
    req.sessionTokenHash = tokenHash
    next()
  } catch (error) {
    next(error)
  }
}

// Для всіх маршрутів з :projectId знаходить роль власника або запрошеного учасника.
async function requireProjectAccess(req, res, next, projectIdValue) {
  try {
    const projectId = getProjectId(projectIdValue)

    if (!projectId) {
      return res.status(400).json({ error: 'Некоректний ідентифікатор проєкту' })
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        members: {
          where: { userId: req.user.id },
          select: {
            role: true,
            locales: { select: { localeId: true } }
          },
          take: 1
        }
      }
    })

    const memberRole = project?.members[0]?.role
    const role = project?.ownerId === req.user.id ? 'OWNER' : memberRole

    // Повертаємо 404, а не 403: сторонньому користувачу не розкриваємо існування проєкту.
    if (!project || !role) return sendNotFound(res, 'проєкт')

    req.projectRole = role
    // null означає необмежений доступ власника, масив — конкретні мови учасника.
    req.projectLocaleIds =
      role === 'OWNER' ? null : project.members[0].locales.map(({ localeId }) => localeId)
    next()
  } catch (error) {
    next(error)
  }
}

// Обмежує налаштування, імпорт і керування учасниками лише власником проєкту.
function requireProjectOwner(req, res, next) {
  if (req.projectRole !== 'OWNER') {
    return res.status(403).json({ error: 'Цю дію може виконати лише власник проєкту' })
  }

  next()
}

module.exports = { requireAuth, requireProjectAccess, requireProjectOwner }
