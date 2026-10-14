const prisma = require('../prisma')
const { rankEntries } = require('../services/terminologyCheck')
const {
  MODEL_NAME,
  MIN_MARGIN,
  MIN_SIMILARITY,
  addSemanticRecommendations
} = require('../services/semanticTerminology')
const { getLocaleCode, getProjectId } = require('../utils/validation')

function serializeMatch(match) {
  return {
    key: match.key,
    term: match.term,
    occurrenceNumber: match.occurrenceNumber,
    occurrenceCount: match.occurrenceCount,
    recommendedEntryId: match.chosen?.id ?? null,
    resolution: match.resolution,
    candidates: match.candidates.map((candidate) => ({
      entryId: candidate.entry.id,
      lexicalScore: candidate.score,
      semanticScore:
        candidate.semanticScore === null ? null : Number(candidate.semanticScore.toFixed(4))
    }))
  }
}

async function analyzeTerminologyContexts(req, res, next) {
  try {
    const projectId = getProjectId(req.params.projectId)
    const localeCode = getLocaleCode(req.body.localeCode)
    const sources = Array.isArray(req.body.sources) ? req.body.sources : []
    if (!projectId || !localeCode) {
      return res.status(400).json({ error: 'Некоректно вказано проєкт або мову' })
    }
    if (!sources.length || sources.length > 200) {
      return res.status(400).json({ error: 'Передай від 1 до 200 оригінальних текстів' })
    }

    const normalizedSources = sources.map((source, index) => ({
      id: String(source?.id ?? index),
      source: typeof source?.text === 'string' ? source.text.trim() : ''
    }))
    if (
      normalizedSources.some(({ id, source }) => !id || !source || source.length > 5000) ||
      new Set(normalizedSources.map(({ id }) => id)).size !== normalizedSources.length
    ) {
      return res.status(400).json({ error: 'Некоректний список оригінальних текстів' })
    }

    const locale = await prisma.locale.findFirst({ where: { projectId, code: localeCode } })
    if (!locale || locale.isSource) {
      return res.status(404).json({ error: 'Цільову мову не знайдено' })
    }
    if (Array.isArray(req.projectLocaleIds) && !req.projectLocaleIds.includes(locale.id)) {
      return res.status(403).json({ error: 'Ця мова не призначена цьому учаснику' })
    }

    const entries = await prisma.glossaryEntry.findMany({
      where: { status: 'APPROVED', localeId: locale.id, concept: { projectId } },
      include: { concept: true },
      orderBy: { id: 'asc' }
    })
    const analyzed = await addSemanticRecommendations(
      normalizedSources.map((item) => ({
        ...item,
        matches: rankEntries(item.source, entries)
      }))
    )

    res.json({
      model: MODEL_NAME,
      thresholds: { similarity: MIN_SIMILARITY, margin: MIN_MARGIN },
      items: analyzed.map((item) => ({
        id: item.id,
        matches: item.matches.map(serializeMatch)
      }))
    })
  } catch (error) {
    next(error)
  }
}

module.exports = { analyzeTerminologyContexts }
