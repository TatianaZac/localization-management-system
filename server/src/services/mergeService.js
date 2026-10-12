// Створює новий незмінний знімок сторінки з двох наявних версій.

const prisma = require('../prisma')

function invalid(message, status = 400) {
  const error = new Error(message)
  error.status = status
  throw error
}

function copyTranslationVersion(version) {
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

function legacyTranslationVersion(translation) {
  if (!translation?.value) return []
  return [
    {
      number: 1,
      value: translation.value,
      sourceVersion: translation.sourceVersion,
      authorId: null,
      authorName: 'Перенесено з попередніх даних',
      authorRole: 'SYSTEM',
      status: translation.status,
      reviewReason: translation.reviewReason
    }
  ]
}

function currentSource(key) {
  return key?.sourceTexts.find((source) => source.isCurrent) ?? key?.sourceTexts[0]
}

function translationFor(key, localeId) {
  return key?.translations.find((translation) => translation.localeId === localeId)
}

function translationCreateData(translation, source, originalSource, forceOutdated = false) {
  const value = translation?.value ?? null
  const sourceChanged = Boolean(
    value && originalSource && source && originalSource.value !== source.value
  )
  const versions = translation?.versions?.length
    ? translation.versions.map(copyTranslationVersion)
    : legacyTranslationVersion(translation)

  return {
    localeId: translation?.localeId,
    value,
    comment: translation?.comment ?? null,
    reviewReason: sourceChanged || forceOutdated ? null : (translation?.reviewReason ?? null),
    copiedFromTranslationId: translation?.id ?? null,
    currentVersion: translation?.currentVersion ?? null,
    sourceVersion: translation?.sourceVersion ?? source.version,
    status: value ? (sourceChanged || forceOutdated ? 'OUTDATED' : translation.status) : 'NEW',
    ...(versions.length ? { versions: { create: versions } } : {})
  }
}

async function mergePageVersions(projectId, input, actor) {
  const pageId = Number(input.pageId)
  const targetVersionId = Number(input.targetVersionId)
  const incomingVersionId = Number(input.incomingVersionId)
  const localeCode = String(input.localeCode || '')
    .trim()
    .toLowerCase()
  const decisions = input.decisions && typeof input.decisions === 'object' ? input.decisions : {}

  if (![pageId, targetVersionId, incomingVersionId].every(Number.isSafeInteger)) {
    invalid('Некоректно вказано сторінку або версії')
  }
  if (targetVersionId === incomingVersionId) invalid('Обери дві різні версії')
  if (!localeCode) invalid('Не вказано мову об’єднання')

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(${pageId}::bigint)`

      const page = await tx.localizationPage.findFirst({
        where: { id: pageId, projectId },
        include: {
          versions: {
            where: {
              id: { in: [targetVersionId, incomingVersionId] },
              deletedAt: null
            },
            include: {
              translationKeys: {
                include: {
                  sourceTexts: { orderBy: { version: 'desc' } },
                  translations: { include: { versions: { orderBy: { number: 'asc' } } } }
                }
              }
            }
          }
        }
      })
      if (!page) invalid('Сторінку не знайдено', 404)

      const target = page.versions.find((version) => version.id === targetVersionId)
      const incoming = page.versions.find((version) => version.id === incomingVersionId)
      if (!target || !incoming) invalid('Версію не знайдено на цій сторінці', 404)

      const locale = await tx.locale.findFirst({
        where: { projectId, code: localeCode, isSource: false }
      })
      if (!locale) invalid('Мову об’єднання не знайдено', 404)

      const targetKeys = new Map(target.translationKeys.map((key) => [key.key, key]))
      const incomingKeys = new Map(incoming.translationKeys.map((key) => [key.key, key]))
      for (const [key, choice] of Object.entries(decisions)) {
        if (
          !targetKeys.has(key) ||
          !incomingKeys.has(key) ||
          !['target', 'incoming'].includes(choice)
        ) {
          invalid(`Некоректне рішення для ключа ${key}`)
        }
      }

      const lastNumber = await tx.pageVersion.aggregate({
        where: { pageId },
        _max: { number: true }
      })
      const number = (lastNumber._max.number ?? 0) + 1
      const summary = {
        type: 'MERGE',
        total: incoming.translationKeys.length,
        added: incoming.translationKeys.filter((key) => !targetKeys.has(key.key)).length,
        removed: target.translationKeys.filter((key) => !incomingKeys.has(key.key)).length,
        localeCode,
        mergedFrom: {
          targetVersionId: target.id,
          targetVersionNumber: target.number,
          incomingVersionId: incoming.id,
          incomingVersionNumber: incoming.number
        },
        mergedBy: { id: actor.id, name: actor.name }
      }
      const result = await tx.pageVersion.create({
        data: {
          pageId,
          number,
          name: null,
          fileName: `merge-v${number}.json`,
          summary
        }
      })

      for (const incomingKey of incoming.translationKeys) {
        const targetKey = targetKeys.get(incomingKey.key)
        const choice = targetKey && decisions[incomingKey.key] === 'target' ? 'target' : 'incoming'
        const selectedKey = choice === 'target' ? targetKey : incomingKey
        const source = currentSource(selectedKey)
        const sourceChangedBetweenParents =
          Boolean(targetKey) &&
          currentSource(targetKey)?.value !== currentSource(incomingKey)?.value
        if (!source) invalid(`Для ключа ${incomingKey.key} відсутній оригінал`)

        const translations = incomingKey.translations.map((incomingTranslation) => {
          const targetTranslation = translationFor(targetKey, incomingTranslation.localeId)
          const useTarget =
            choice === 'target' &&
            incomingTranslation.localeId === locale.id &&
            Boolean(targetTranslation)
          const originKey = useTarget ? targetKey : incomingKey
          const originTranslation = useTarget ? targetTranslation : incomingTranslation
          const forceOutdated =
            incomingTranslation.localeId === locale.id &&
            choice === 'incoming' &&
            sourceChangedBetweenParents
          return translationCreateData(
            originTranslation,
            source,
            currentSource(originKey),
            forceOutdated
          )
        })

        await tx.translationKey.create({
          data: {
            projectId,
            pageVersionId: result.id,
            key: incomingKey.key,
            sourceTexts: {
              create: {
                value: source.value,
                version: source.version,
                isCurrent: true
              }
            },
            translations: { create: translations }
          }
        })
      }

      return {
        pageId,
        versionId: result.id,
        versionNumber: number,
        summary
      }
    },
    { isolationLevel: 'Serializable', timeout: 60000 }
  )
}

module.exports = { mergePageVersions }
