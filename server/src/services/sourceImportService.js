// Кожний імпорт створює окремий набір ключів сторінки; переклади версій редагуються незалежно.
const prisma = require('../prisma')
const { parseLocalizationImport } = require('../utils/parseLocalizationImport')

function invalid(message, status = 400) {
  const error = new Error(message)
  error.status = status
  throw error
}

function copyVersion(version) {
  return {
    number: version.number,
    value: version.value,
    sourceVersion: version.sourceVersion,
    authorId: version.authorId,
    authorName: version.authorName,
    authorRole: version.authorRole,
    status: version.status,
    reviewReason: version.reviewReason,
    reviewerId: version.reviewerId,
    reviewerName: version.reviewerName,
    reviewedAt: version.reviewedAt,
    createdAt: version.createdAt
  }
}

// Старі записи без окремої версії не губимо: після першого імпорту вони стають v1.
function legacyVersion(saved) {
  if (!saved?.value) return []
  return [
    {
      number: 1,
      value: saved.value,
      sourceVersion: saved.sourceVersion,
      authorId: null,
      authorName: 'Перенесено з попередніх даних',
      authorRole: 'SYSTEM',
      status: saved.status,
      reviewReason: saved.reviewReason
    }
  ]
}

async function importSourceTexts(project, content, options = {}) {
  const parsedImport = parseLocalizationImport(content)
  const entries = parsedImport.sourceEntries
  if (!entries.length) invalid('Файл локалізації порожній')
  if (parsedImport.sourceLocaleCode && parsedImport.sourceLocaleCode !== project.sourceLocaleCode) {
    invalid('Мова оригіналу у файлі не збігається з базовою мовою проєкту')
  }
  const incomingKeys = new Set(entries.map((e) => e.key))
  if (incomingKeys.size !== entries.length) invalid('Файл локалізації містить неоднозначні ключі')
  const pageName = typeof options.pageName === 'string' ? options.pageName.trim() : ''
  if (pageName.length > 100) invalid('Назва сторінки: не більше 100 символів')
  if (options.pageId && pageName) invalid('Обери існуючу сторінку або створи нову')
  const fileName = typeof options.fileName === 'string' ? options.fileName.trim() : 'source.json'
  const versionName = typeof options.versionName === 'string' ? options.versionName.trim() : null
  // Старі клієнти можуть не передавати назву; явно порожню або некоректну відхиляємо.
  if (options.versionName !== undefined && (!versionName || versionName.length > 100))
    invalid('Назва версії має містити від 1 до 100 символів')
  if (!fileName || fileName.length > 255) invalid('Некоректна назва файлу')

  // Serializable не дозволить двом імпортам створити однаковий номер версії
  // або скопіювати наполовину оновлені переклади.
  return prisma.$transaction(
    async (tx) => {
      let page
      if (options.pageId !== undefined) {
        if (!Number.isSafeInteger(options.pageId) || options.pageId < 1)
          invalid('Некоректна сторінка')
        page = await tx.localizationPage.findFirst({
          where: { id: options.pageId, projectId: project.id }
        })
        if (!page) invalid('Сторінку не знайдено', 404)
      } else if (pageName) {
        page = await tx.localizationPage.create({
          data: { projectId: project.id, name: pageName }
        })
      } else {
        const pages = await tx.localizationPage.findMany({
          where: { projectId: project.id }
        })
        if (pages.length > 1) invalid('Обери сторінку для імпорту')
        page =
          pages[0] ??
          (await tx.localizationPage.create({
            data: { projectId: project.id, name: 'ui.json' }
          }))
      }
      // Імпорт і збереження перекладу однієї сторінки не виконуються одночасно:
      // завершена версія не може отримати запізнілий запис після створення наступної.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${page.id}::bigint)`
      const lastNumber = await tx.pageVersion.aggregate({
        where: { pageId: page.id },
        _max: { number: true }
      })
      const previous = await tx.pageVersion.findFirst({
        where: { pageId: page.id, deletedAt: null },
        orderBy: { number: 'desc' },
        include: {
          translationKeys: {
            include: {
              sourceTexts: { where: { isCurrent: true } },
              translations: { include: { versions: { orderBy: { number: 'asc' } } } }
            }
          }
        }
      })
      const oldKeys = new Map((previous?.translationKeys ?? []).map((k) => [k.key, k]))
      const summary = {
        total: entries.length,
        created: 0,
        updated: 0,
        unchanged: 0,
        removed: [...oldKeys.keys()].filter((key) => !incomingKeys.has(key)).length
      }
      const version = await tx.pageVersion.create({
        data: {
          pageId: page.id,
          number: (lastNumber._max.number ?? 0) + 1,
          name: versionName,
          fileName
        }
      })
      const locales = await tx.locale.findMany({
        where: { projectId: project.id, isSource: false }
      })
      const importedLocale = parsedImport.importedTranslation
        ? locales.find((locale) => locale.code === parsedImport.importedTranslation.localeCode)
        : null
      if (parsedImport.importedTranslation && !importedLocale) {
        invalid(`Спочатку додай мову ${parsedImport.importedTranslation.localeCode} до мов проєкту`)
      }
      for (const entry of entries) {
        const old = oldKeys.get(entry.key)
        const source = old?.sourceTexts[0]
        const same = source?.value === entry.value
        summary[!old ? 'created' : same ? 'unchanged' : 'updated']++
        // Номер тексту зберігає сумісність зі старою історією рядків після міграції.
        const sourceNumber = source ? source.version + (same ? 0 : 1) : 1
        await tx.translationKey.create({
          data: {
            projectId: project.id,
            pageVersionId: version.id,
            key: entry.key,
            sourceTexts: {
              create: { value: entry.value, version: sourceNumber }
            },
            translations: {
              create: locales.map((locale) => {
                const saved = old?.translations.find((t) => t.localeId === locale.id)
                const savedVersions = saved?.versions?.length
                  ? saved.versions.map(copyVersion)
                  : legacyVersion(saved)
                const savedCurrentVersion =
                  saved?.currentVersion ?? savedVersions.at(-1)?.number ?? null
                const importedValue =
                  locale.id === importedLocale?.id
                    ? parsedImport.importedTranslation.values.get(entry.key)
                    : null
                if (importedValue !== null) {
                  const translationUnchanged = same && saved?.value === importedValue
                  const nextVersion = (savedVersions.at(-1)?.number ?? 0) + 1
                  const versions = translationUnchanged
                    ? savedVersions
                    : [
                        ...savedVersions,
                        {
                          number: nextVersion,
                          value: importedValue,
                          sourceVersion: sourceNumber,
                          authorId: options.actor?.id ?? null,
                          authorName: options.actor?.name ?? 'Імпортовано з файлу',
                          authorRole: options.actor?.role ?? 'SYSTEM',
                          status: 'TRANSLATED'
                        }
                      ]
                  return {
                    localeId: locale.id,
                    value: importedValue,
                    status: translationUnchanged ? saved.status : 'TRANSLATED',
                    sourceVersion: sourceNumber,
                    currentVersion: translationUnchanged ? savedCurrentVersion : nextVersion,
                    comment: saved?.comment ?? null,
                    reviewReason: translationUnchanged ? saved.reviewReason : null,
                    copiedFromTranslationId: saved?.id ?? null,
                    ...(versions.length ? { versions: { create: versions } } : {})
                  }
                }
                return {
                  localeId: locale.id,
                  value: saved?.value ?? null,
                  status: saved?.value ? (same ? saved.status : 'OUTDATED') : 'NEW',
                  sourceVersion: saved?.value ? saved.sourceVersion : sourceNumber,
                  currentVersion: savedCurrentVersion,
                  comment: saved?.comment ?? null,
                  reviewReason: same ? saved?.reviewReason : null,
                  copiedFromTranslationId: saved?.id ?? null,
                  ...(savedVersions.length ? { versions: { create: savedVersions } } : {})
                }
              })
            }
          }
        })
      }
      // Відсутні в новому файлі ключі не копіюємо; у попередній версії вони залишаються.
      await tx.pageVersion.update({
        where: { id: version.id },
        data: { summary }
      })
      return {
        ...summary,
        importedLocaleCode: importedLocale?.code ?? null,
        importedTranslations: importedLocale ? entries.length : 0,
        pageId: page.id,
        versionId: version.id,
        versionNumber: version.number,
        versionName: version.name
      }
    },
    { isolationLevel: 'Serializable', timeout: 60000 }
  )
}

module.exports = { importSourceTexts }
