// Детермінований пошук термінів і вибір значення за контекстом без ШІ.
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'was',
  'were',
  'will',
  'with',
  'your'
])

function normalizeText(value) {
  return (value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
}

function comparisonText(value) {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\p{M}_]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function termRanges(value, term) {
  const text = normalizeText(value)
  const needle = normalizeText(term)
  if (!needle) return []
  const word = /[\p{L}\p{N}\p{M}_]/u
  const ranges = []
  let start = text.indexOf(needle)
  while (start !== -1) {
    const before = Array.from(text.slice(0, start)).at(-1) ?? ''
    const after = Array.from(text.slice(start + needle.length))[0] ?? ''
    if (
      (!word.test(needle[0]) || !word.test(before)) &&
      (!word.test(needle.at(-1)) || !word.test(after))
    )
      ranges.push({ start, end: start + needle.length })
    start = text.indexOf(needle, start + 1)
  }
  return ranges
}

function containsTerm(value, term) {
  return termRanges(value, term).length > 0
}

function contextParts(value, term, occurrenceIndex = 0) {
  const tokens = comparisonText(value).split(' ').filter(Boolean)
  const termTokens = comparisonText(term).split(' ').filter(Boolean)
  const termStarts = []
  for (let index = 0; index <= tokens.length - termTokens.length; index += 1) {
    if (termTokens.every((token, offset) => tokens[index + offset] === token)) {
      termStarts.push(index)
    }
  }
  const termStart = termStarts[occurrenceIndex] ?? -1
  let before = ''
  let after = ''
  if (termStart >= 0) {
    let beforeIndex = termStart - 1
    while (beforeIndex >= 0 && STOP_WORDS.has(tokens[beforeIndex])) beforeIndex -= 1
    before = tokens[beforeIndex] ?? ''
    let afterIndex = termStart + termTokens.length
    while (afterIndex < tokens.length && STOP_WORDS.has(tokens[afterIndex])) afterIndex += 1
    after = tokens[afterIndex] ?? ''
  }
  const termSet = new Set(termTokens)
  const content = new Set(
    tokens.filter(
      (token) =>
        !STOP_WORDS.has(token) && !termSet.has(token) && token !== before && token !== after
    )
  )
  return { before, after, content }
}

function scoreSingleContext(source, term, example, sourceOccurrenceIndex = 0) {
  const sourceParts = contextParts(source, term, sourceOccurrenceIndex)
  const exampleOccurrenceCount = termRanges(example, term).length
  let bestScore = 0
  for (let exampleIndex = 0; exampleIndex < exampleOccurrenceCount; exampleIndex += 1) {
    const exampleParts = contextParts(example, term, exampleIndex)
    let score =
      exampleOccurrenceCount === 1 &&
      termRanges(source, term).length === 1 &&
      comparisonText(source) === comparisonText(example)
        ? 5
        : 0
    if (sourceParts.before && sourceParts.before === exampleParts.before) score += 2
    if (sourceParts.after && sourceParts.after === exampleParts.after) score += 2
    score += [...sourceParts.content].filter((word) => exampleParts.content.has(word)).length
    bestScore = Math.max(bestScore, score)
  }
  return bestScore
}

function scoreContext(source, term, example, sourceOccurrenceIndex = 0) {
  const examples = (example ?? '')
    .split(/\r?\n/gu)
    .map((value) => value.trim())
    .filter(Boolean)
  if (!examples.length) return 0
  return Math.max(
    ...examples.map((value) => scoreSingleContext(source, term, value, sourceOccurrenceIndex))
  )
}

function rankEntries(source, entries) {
  const groups = new Map()
  entries.forEach((entry) => {
    const key = normalizeText(entry.concept.term)
    if (!groups.has(key)) groups.set(key, { key, term: entry.concept.term, entries: [] })
    groups.get(key).entries.push(entry)
  })
  const occupied = []
  return [...groups.values()]
    .sort((left, right) => right.key.length - left.key.length)
    .flatMap((group) => {
      const allRanges = termRanges(source, group.term)
      const ranges = allRanges
        .map((range, occurrenceIndex) => ({ ...range, occurrenceIndex }))
        .filter(
          (range) => !occupied.some((used) => range.start < used.end && range.end > used.start)
        )
      if (!ranges.length) return []
      occupied.push(...ranges)
      return ranges.map((range, visibleIndex) => {
        const candidates = group.entries
          .map((entry) => ({
            entry,
            score: scoreContext(source, group.term, entry.example, range.occurrenceIndex)
          }))
          .sort((left, right) => right.score - left.score || left.entry.id - right.entry.id)
        const decisive =
          candidates.length === 1 ||
          (candidates[0].score >= 2 && candidates[0].score - (candidates[1]?.score ?? 0) >= 2)
        return {
          ...group,
          key: `${group.key}:${range.start}-${range.end}`,
          candidates,
          chosen: decisive ? candidates[0].entry : null,
          occurrenceNumber: visibleIndex + 1,
          occurrenceCount: ranges.length,
          range: { start: range.start, end: range.end }
        }
      })
    })
}

// Неоднозначний термін не створює хибного попередження.
async function checkTerminology(db, projectId, localeId, source, value) {
  if (!value) return []
  const entries = await db.glossaryEntry.findMany({
    where: { status: 'APPROVED', localeId, concept: { projectId } },
    include: { concept: true },
    orderBy: { id: 'asc' }
  })
  const warnings = rankEntries(source, entries)
    .filter(({ chosen }) => chosen && !containsTerm(value, chosen.translation))
    .map(({ term, chosen }) => ({
      term,
      translation: chosen.translation
    }))
  return [
    ...new Map(
      warnings.map((warning) => [`${warning.term}\u0000${warning.translation}`, warning])
    ).values()
  ]
}

module.exports = { containsTerm, scoreContext, rankEntries, checkTerminology }
