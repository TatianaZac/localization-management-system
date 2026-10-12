// Цей файл керує учасниками, ролями та призначеними цільовими мовами проєкту.

const prisma = require('../prisma')
const { getProjectId, getText } = require('../utils/validation')
const { sendNotFound } = require('../utils/sendNotFound')

const ALLOWED_ROLES = new Set(['EDITOR', 'REVIEWER'])
const memberSelect = {
  id: true,
  role: true,
  user: { select: { id: true, name: true, email: true } },
  locales: {
    select: {
      locale: { select: { id: true, code: true, name: true } }
    }
  }
}

function getRole(value) {
  const role = getText(value).toUpperCase()
  return ALLOWED_ROLES.has(role) ? role : null
}

function readLocaleIds(value) {
  if (value === undefined) return { provided: false, valid: true, ids: [] }
  if (!Array.isArray(value)) return { provided: true, valid: false, ids: [] }

  const ids = [...new Set(value.map(Number))]
  return {
    provided: true,
    valid: ids.every((id) => Number.isSafeInteger(id) && id > 0),
    ids
  }
}

function serializeMember(member) {
  return {
    id: member.id,
    role: member.role,
    user: member.user,
    locales: member.locales.map(({ locale }) => locale).sort((a, b) => a.name.localeCompare(b.name))
  }
}

async function resolveTargetLocaleIds(projectId, localeInput) {
  const locales = await prisma.locale.findMany({
    where: {
      projectId,
      isSource: false,
      ...(localeInput.provided ? { id: { in: localeInput.ids } } : {})
    },
    select: { id: true }
  })

  if (localeInput.provided && locales.length !== localeInput.ids.length) return null
  return locales.map((locale) => locale.id)
}

// Повертає власника окремо та список учасників із їхніми мовами.
async function getMembers(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        owner: { select: { id: true, name: true, email: true } },
        members: {
          orderBy: { createdAt: 'asc' },
          select: memberSelect
        }
      }
    })

    res.json({
      owner: { ...project.owner, role: 'OWNER' },
      members: project.members.map(serializeMember)
    })
  } catch (error) {
    next(error)
  }
}

// Додає за email лише зареєстрованого користувача та призначає йому цільові мови.
async function addMember(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const email = getText(req.body.email).toLowerCase()
    const role = getRole(req.body.role)
    const localeInput = readLocaleIds(req.body.localeIds)

    if (!email || !role || !localeInput.valid) {
      return res.status(400).json({
        error: 'Вкажи коректну електронну пошту, роль і мови проєкту'
      })
    }

    const [project, user, localeIds] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true }
      }),
      prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true }
      }),
      resolveTargetLocaleIds(projectId, localeInput)
    ])

    if (!user) return sendNotFound(res, 'зареєстрованого користувача')
    if (!localeIds) return res.status(400).json({ error: 'Обери мови саме цього проєкту' })

    if (user.id === project.ownerId) {
      return res.status(400).json({ error: 'Власник проєкту вже є його учасником' })
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } }
    })

    if (existingMember) {
      return res.status(409).json({ error: 'Цей користувач уже є учасником проєкту' })
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
        role,
        locales: {
          create: localeIds.map((localeId) => ({ localeId }))
        }
      },
      select: memberSelect
    })

    res.status(201).json(serializeMember(member))
  } catch (error) {
    next(error)
  }
}

// Роль і мови можна змінювати незалежно, не торкаючись прав власника.
async function updateMember(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const memberId = getProjectId(req.params.memberId)
    const localeInput = readLocaleIds(req.body.localeIds)

    if (!memberId || !localeInput.valid) {
      return res.status(400).json({ error: 'Некоректний учасник або список мов' })
    }

    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { id: true, role: true }
    })

    if (!member) return sendNotFound(res, 'учасника проєкту')

    const role = req.body.role === undefined ? member.role : getRole(req.body.role)
    if (!role) return res.status(400).json({ error: 'Некоректна роль у проєкті' })

    const localeIds = await resolveTargetLocaleIds(projectId, localeInput)
    if (!localeIds) return res.status(400).json({ error: 'Обери мови саме цього проєкту' })

    const updatedMember = await prisma.projectMember.update({
      where: { id: memberId },
      data: {
        role,
        ...(localeInput.provided
          ? {
              locales: {
                deleteMany: {},
                create: localeIds.map((localeId) => ({ localeId }))
              }
            }
          : {})
      },
      select: memberSelect
    })

    res.json(serializeMember(updatedMember))
  } catch (error) {
    next(error)
  }
}

// Відкликає доступ учасника; його акаунт і виконані переклади залишаються в системі.
async function deleteMember(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const memberId = getProjectId(req.params.memberId)

    if (!memberId) {
      return res.status(400).json({ error: 'Некоректний ідентифікатор учасника' })
    }

    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { id: true }
    })

    if (!member) return sendNotFound(res, 'учасника проєкту')

    await prisma.projectMember.delete({ where: { id: memberId } })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

module.exports = { getMembers, addMember, updateMember, deleteMember }
