// Контрольні приклади для реальної моделі; не змінюють базу даних.
const fs = require('node:fs')
const path = require('node:path')
const { rankEntries } = require('../src/services/terminologyCheck')
const { addSemanticRecommendations, MODEL_NAME } = require('../src/services/semanticTerminology')

const entries = [
  {
    id: 1,
    concept: { term: 'bank' },
    translation: 'банк',
    example: 'The bank approved a loan.\nShe deposited money at the bank.'
  },
  {
    id: 2,
    concept: { term: 'bank' },
    translation: 'берег',
    example: 'They walked along the river bank.\nThe boat reached the bank of the river.'
  }
]
const examples = [
  { source: 'The bank approved a loan.', expected: 1 },
  { source: 'The bank provides mortgages and savings accounts.', expected: 1 },
  { source: 'Wild flowers grow on the bank beside the stream.', expected: 2 },
  { source: 'Check the bank.', expected: null }
]

async function main() {
  const items = await addSemanticRecommendations(
    examples.map(({ source }, index) => ({
      id: index,
      source,
      matches: rankEntries(source, entries)
    }))
  )
  const results = items.map((item, index) => {
    const match = item.matches[0]
    return {
      source: item.source,
      expectedEntryId: examples[index].expected,
      chosenEntryId: match.chosen?.id ?? null,
      translation: match.chosen?.translation ?? null,
      resolution: match.resolution,
      matchesExpectation: (match.chosen?.id ?? null) === examples[index].expected,
      candidates: match.candidates.map(({ entry, score, semanticScore }) => ({
        translation: entry.translation,
        lexicalScore: score,
        semanticScore
      }))
    }
  })
  const report = { model: MODEL_NAME, results }
  fs.writeFileSync(
    path.resolve(__dirname, '../../docs/semantic-examples.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  console.log(JSON.stringify(report, null, 2))
  if (results.some((result) => !result.matchesExpectation)) process.exitCode = 1
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
