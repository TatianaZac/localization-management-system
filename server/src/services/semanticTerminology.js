// Семантичний рівень використовується лише тоді, коли детермінованих балів недостатньо.
const path = require('node:path')

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'
const MIN_SIMILARITY = 0.3
const MIN_MARGIN = 0.06
const MAX_CACHE_SIZE = 2000

let extractorPromise = null
const embeddingCache = new Map()

function exampleLines(entry) {
  return (entry.example ?? '')
    .split(/\r?\n/gu)
    .map((value) => value.trim())
    .filter(Boolean)
}

function occurrenceContext(source, match) {
  if ((match.occurrenceCount ?? 1) === 1 || !match.range) return source
  const normalized = (source ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
  const tokens = [...normalized.matchAll(/\S+/gu)].map((token) => ({
    value: token[0],
    start: token.index,
    end: token.index + token[0].length
  }))
  const occurrenceIndex = tokens.findIndex(
    (token) => token.start < match.range.end && token.end > match.range.start
  )
  if (occurrenceIndex < 0) return source
  return tokens
    .slice(Math.max(0, occurrenceIndex - 4), occurrenceIndex + 5)
    .map(({ value }) => value)
    .join(' ')
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers')
      .then(async ({ env, pipeline }) => {
        env.cacheDir = path.resolve(__dirname, '../../.cache/transformers')
        return pipeline('feature-extraction', MODEL_NAME, { dtype: 'q8' })
      })
      .catch((error) => {
        extractorPromise = null
        throw error
      })
  }
  return extractorPromise
}

function rememberEmbedding(text, embedding) {
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    embeddingCache.delete(embeddingCache.keys().next().value)
  }
  embeddingCache.set(text, embedding)
}

async function embedTexts(texts) {
  const unique = [...new Set(texts.filter(Boolean))]
  const missing = unique.filter((text) => !embeddingCache.has(text))
  if (missing.length) {
    const extractor = await getExtractor()
    const output = await extractor(missing, { pooling: 'mean', normalize: true })
    const dimensions = output.dims.at(-1)
    missing.forEach((text, index) => {
      const start = index * dimensions
      rememberEmbedding(text, Float32Array.from(output.data.slice(start, start + dimensions)))
    })
  }
  return new Map(unique.map((text) => [text, embeddingCache.get(text)]))
}

function cosine(left, right) {
  let value = 0
  for (let index = 0; index < left.length; index += 1) value += left[index] * right[index]
  return value
}

function decorateResolvedMatch(match) {
  return {
    ...match,
    resolution: match.chosen ? (match.candidates.length === 1 ? 'SINGLE' : 'LEXICAL') : 'AMBIGUOUS',
    candidates: match.candidates.map((candidate) => ({ ...candidate, semanticScore: null }))
  }
}

// Обробляємо джерела одним пакетом: модель і приклади не перераховуються для кожного рядка.
async function addSemanticRecommendations(items) {
  const prepared = items.map((item) => ({
    ...item,
    matches: item.matches.map(decorateResolvedMatch)
  }))
  const unresolved = prepared.flatMap((item) =>
    item.matches
      .filter((match) => !match.chosen && match.candidates.length > 1)
      .map((match) => ({ match, context: occurrenceContext(item.source, match) }))
  )
  if (!unresolved.length) return prepared

  const texts = unresolved.flatMap(({ context, match }) => [
    context,
    ...match.candidates.flatMap(({ entry }) => exampleLines(entry))
  ])
  if (!texts.length) return prepared

  try {
    const embeddings = await embedTexts(texts)
    for (const { context, match } of unresolved) {
      const sourceEmbedding = embeddings.get(context)
      const candidates = match.candidates
        .map((candidate) => {
          const similarities = exampleLines(candidate.entry)
            .map((example) => embeddings.get(example))
            .filter(Boolean)
            .map((embedding) => cosine(sourceEmbedding, embedding))
          return {
            ...candidate,
            // Один випадково схожий приклад не повинен вирішувати весь вибір.
            // Середнє значення вимагає, щоб новий контекст загалом відповідав
            // прикладам цього значення, а не лише повторював окремі слова.
            semanticScore: similarities.length
              ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
              : null
          }
        })
        .sort(
          (left, right) =>
            (right.semanticScore ?? -1) - (left.semanticScore ?? -1) ||
            right.score - left.score ||
            left.entry.id - right.entry.id
        )
      const best = candidates[0]
      const second = candidates[1]
      const margin = (best?.semanticScore ?? -1) - (second?.semanticScore ?? -1)
      const decisive =
        best?.semanticScore !== null && best.semanticScore >= MIN_SIMILARITY && margin >= MIN_MARGIN

      match.candidates = candidates
      match.chosen = decisive ? best.entry : null
      match.resolution = decisive ? 'SEMANTIC' : 'AMBIGUOUS'
    }
  } catch (error) {
    // Відсутність моделі не блокує переклад: залишається безпечний стан «неоднозначно».
    console.warn('Semantic terminology fallback is unavailable:', error.message)
  }

  return prepared
}

module.exports = {
  MODEL_NAME,
  MIN_MARGIN,
  MIN_SIMILARITY,
  addSemanticRecommendations
}
