import { matchesGlossaryTerm, rankGlossaryMatches } from './glossary.js'

function getTranslation(translationKey, localeCode) {
  return translationKey?.translations.find((translation) => translation.locale.code === localeCode)
}

function getTranslationAuthor(translation) {
  if (!translation) return ''

  const currentVersion = translation.versions?.find(
    (version) => version.number === translation.currentVersion
  )
  return currentVersion?.authorName ?? translation.versions?.[0]?.authorName ?? ''
}

function getCurrentSource(translationKey) {
  return (
    translationKey?.sourceTexts.find((sourceText) => sourceText.isCurrent) ??
    translationKey?.sourceTexts[0]
  )
}

function analyzeTerminology(source, value, glossary, localeCode) {
  const matches = rankGlossaryMatches(
    source,
    glossary.filter((entry) => entry.status === 'APPROVED' && entry.locale?.code === localeCode)
  )
  const warnings = matches
    .filter(
      (match) =>
        match.recommended && !matchesGlossaryTerm(value ?? '', match.recommended.translation)
    )
    .map((match) => ({
      term: match.term,
      translation: match.recommended.translation,
      occurrenceNumber: match.occurrenceNumber,
      occurrenceCount: match.occurrenceCount
    }))
  const uniqueWarnings = [
    ...new Map(
      warnings.map((warning) => [`${warning.term}\u0000${warning.translation}`, warning])
    ).values()
  ]
  const checkedCount = matches.filter((match) => match.recommended).length

  return {
    hasTerms: matches.length > 0,
    checkedCount,
    ambiguousCount: matches.length - checkedCount,
    compliant: checkedCount > 0 && uniqueWarnings.length === 0,
    warnings: uniqueWarnings
  }
}

export function buildMergeComparison(targetProject, incomingProject, localeCode, glossary = []) {
  const targetKeys = new Map(
    (targetProject.translationKeys ?? []).map((translationKey) => [
      translationKey.key,
      translationKey
    ])
  )
  const incomingKeys = new Map(
    (incomingProject.translationKeys ?? []).map((translationKey) => [
      translationKey.key,
      translationKey
    ])
  )
  const keys = [...new Set([...targetKeys.keys(), ...incomingKeys.keys()])].sort((a, b) =>
    a.localeCompare(b)
  )

  return keys.map((key) => {
    const targetKey = targetKeys.get(key)
    const incomingKey = incomingKeys.get(key)
    const targetTranslation = getTranslation(targetKey, localeCode)
    const incomingTranslation = getTranslation(incomingKey, localeCode)
    const targetSource = getCurrentSource(targetKey)?.value ?? ''
    const incomingSource = getCurrentSource(incomingKey)?.value ?? ''
    const targetValue = targetTranslation?.value ?? ''
    const incomingValue = incomingTranslation?.value ?? ''
    const added = !targetKey && Boolean(incomingKey)
    const removed = Boolean(targetKey) && !incomingKey
    const sourceChanged = Boolean(targetKey && incomingKey && targetSource !== incomingSource)
    const translationChanged = Boolean(targetKey && incomingKey && targetValue !== incomingValue)
    const targetTerminology = analyzeTerminology(targetSource, targetValue, glossary, localeCode)
    const incomingTerminology = analyzeTerminology(
      incomingSource,
      incomingValue,
      glossary,
      localeCode
    )
    const terminologyConflict = Boolean(
      targetTerminology.warnings.length || incomingTerminology.warnings.length
    )

    return {
      id: key,
      key,
      targetSource,
      incomingSource,
      target: targetValue,
      incoming: incomingValue,
      added,
      removed,
      sourceChanged,
      translationChanged,
      terminologyConflict,
      targetTerminology,
      incomingTerminology,
      unchanged:
        Boolean(targetKey && incomingKey) &&
        !sourceChanged &&
        !translationChanged &&
        !terminologyConflict,
      targetStatus: targetTranslation?.status ?? 'NEW',
      incomingStatus: incomingTranslation?.status ?? 'NEW',
      targetAuthor: getTranslationAuthor(targetTranslation),
      incomingAuthor: getTranslationAuthor(incomingTranslation)
    }
  })
}

export function formatMergeVersions(page) {
  return (page?.versions ?? []).map((version) => ({
    id: String(version.id),
    label: version.name || `v${version.number}`,
    date: new Intl.DateTimeFormat('uk-UA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(version.createdAt)),
    keys: version._count?.translationKeys ?? version.summary?.keyCount ?? '—'
  }))
}
