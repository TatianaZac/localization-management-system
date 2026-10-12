// Цей файл обробляє створення, отримання та перелік локалізаційних проєктів.

const prisma = require('../prisma')
const { selectPageVersion } = require('../services/pageSelection')
const { getLocaleCode, getProjectId, getText, isValidLocaleCode } = require('../utils/validation')
const { sendNotFound } = require('../utils/sendNotFound')

// Повертає всі проєкти разом із кількістю мов і ключів у кожному.
async function getProjects(req, res, next) {
  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [{ ownerId: req.user.id }, { members: { some: { userId: req.user.id } } }]
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        pages: {
          select: {
            versions: {
              where: { deletedAt: null },
              orderBy: { number: 'desc' },
              take: 1,
              select: { _count: { select: { translationKeys: true } } }
            }
          }
        },
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
    })

    res.json(
      projects.map(({ _count, members, pages, ...project }) => ({
        ...project,
        currentUserRole: project.ownerId === req.user.id ? 'OWNER' : members[0]?.role,
        localeCount: _count.locales,
        keyCount: pages.reduce(
          (sum, page) => sum + (page.versions[0]?._count.translationKeys ?? 0),
          0
        )
      }))
    )
  } catch (error) {
    next(error)
  }
}

// Перевіряє вхідні дані та створює проєкт із його вихідною локаллю.
async function createProject(req, res, next) {
  try {
    const name = getText(req.body.name)
    const description = getText(req.body.description) || null
    const sourceLocale = req.body.sourceLocale || {}
    const sourceLocaleCode = getLocaleCode(sourceLocale.code || 'en')
    const sourceLocaleName = getText(sourceLocale.name) || sourceLocaleCode

    if (!name) {
      return res.status(400).json({
        error: 'Вкажи назву проєкту'
      })
    }

    if (!isValidLocaleCode(sourceLocaleCode)) {
      return res.status(400).json({
        error: 'Некоректний код базової мови'
      })
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
    })

    res.status(201).json(project)
  } catch (error) {
    next(error)
  }
}

// Оновлює назву й опис проєкту, не змінюючи його мови та переклади.
async function updateProject(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const name = getText(req.body.name)
    const description = getText(req.body.description) || null

    if (!projectId) {
      return res.status(400).json({
        error: 'Некоректний ідентифікатор проєкту'
      })
    }

    if (!name) {
      return res.status(400).json({
        error: 'Вкажи назву проєкту'
      })
    }

    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    })

    if (!existingProject) {
      return sendNotFound(res, 'проєкт')
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: { name, description }
    })

    res.json({ ...project, currentUserRole: req.projectRole })
  } catch (error) {
    next(error)
  }
}

// Видаляє проєкт; залежні мови, ключі й переклади видаляються каскадно базою даних.
async function deleteProject(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)

    if (!projectId) {
      return res.status(400).json({
        error: 'Некоректний ідентифікатор проєкту'
      })
    }

    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true }
    })

    if (!existingProject) {
      return sendNotFound(res, 'проєкт')
    }

    await prisma.project.delete({
      where: { id: projectId }
    })

    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

// Повертає один проєкт із локалями, актуальними текстами та перекладами.
async function getProject(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)

    if (!projectId) {
      return res.status(400).json({
        error: 'Некоректний ідентифікатор проєкту'
      })
    }

    const selection = await selectPageVersion(projectId, req.query)
    const assignedLocaleIds = Array.isArray(req.projectLocaleIds) ? req.projectLocaleIds : null
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        locales: {
          where: assignedLocaleIds
            ? { OR: [{ isSource: true }, { id: { in: assignedLocaleIds } }] }
            : undefined,
          orderBy: { code: 'asc' }
        },
        translationKeys: {
          where: { pageVersionId: selection.selectedVersionId ?? -1 },
          orderBy: { key: 'asc' },
          include: {
            sourceTexts: {
              orderBy: { version: 'desc' }
            },
            translations: {
              where: assignedLocaleIds ? { localeId: { in: assignedLocaleIds } } : undefined,
              include: {
                history: {
                  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                  take: 50
                },
                versions: {
                  orderBy: { number: 'desc' }
                },
                locale: {
                  select: {
                    code: true,
                    name: true
                  }
                }
              },
              orderBy: {
                localeId: 'asc'
              }
            }
          }
        }
      }
    })

    if (!project) {
      return sendNotFound(res)
    }

    // Статистика мов охоплює останню версію кожної сторінки, а не лише відкритий файл.
    const latestVersions = selection.pages.map((page) => page.versions[0]).filter(Boolean)
    const latestVersionIds = latestVersions.map((version) => version.id)
    const latestKeys = latestVersionIds.length
      ? await prisma.translationKey.findMany({
          where: { projectId, pageVersionId: { in: latestVersionIds } },
          select: {
            translations: {
              where: assignedLocaleIds ? { localeId: { in: assignedLocaleIds } } : undefined,
              select: { localeId: true, value: true, updatedAt: true }
            }
          }
        })
      : []
    const sourceUpdatedAt = latestVersions.reduce(
      (latest, version) => (!latest || version.createdAt > latest ? version.createdAt : latest),
      null
    )
    const localeStats = Object.fromEntries(
      project.locales.map((locale) => {
        if (locale.isSource) {
          return [
            locale.code,
            {
              completed: latestKeys.length,
              total: latestKeys.length,
              percent: 100,
              updatedAt: sourceUpdatedAt
            }
          ]
        }

        const translations = latestKeys
          .flatMap((translationKey) => translationKey.translations)
          .filter((translation) => translation.localeId === locale.id)
        const completed = translations.filter((translation) => getText(translation.value)).length
        const updatedAt = translations.reduce(
          (latest, translation) =>
            !latest || translation.updatedAt > latest ? translation.updatedAt : latest,
          null
        )
        return [
          locale.code,
          {
            completed,
            total: latestKeys.length,
            percent: latestKeys.length ? Math.round((completed / latestKeys.length) * 100) : 0,
            updatedAt
          }
        ]
      })
    )

    res.json({
      ...project,
      ...selection,
      localeStats,
      currentUserRole: req.projectRole
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProject
}
