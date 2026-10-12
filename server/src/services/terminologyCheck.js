// Буквальне зіставлення з межами слів: account не збігається з accounting.
// Відмінки та синоніми автоматично не визначаємо, тому результат — попередження.
function containsTerm(value, term) {
  const normalize = (text) =>
    (text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
  const text = normalize(value)
  const needle = normalize(term)
  if (!needle) return false
  const word = /[\p{L}\p{N}\p{M}_]/u
  let start = text.indexOf(needle)
  while (start !== -1) {
    const before = Array.from(text.slice(0, start)).at(-1) ?? ''
    const after = Array.from(text.slice(start + needle.length))[0] ?? ''
    if (
      (!word.test(needle[0]) || !word.test(before)) &&
      (!word.test(needle.at(-1)) || !word.test(after))
    )
      return true
    start = text.indexOf(needle, start + 1)
  }
  return false
}

// Перевіряємо лише погоджені терміни потрібної мови й поточного проєкту.
async function checkTerminology(db, projectId, localeId, source, value, key = '') {
  if (!value) return []
  const entries = await db.glossaryEntry.findMany({
    where: { status: 'APPROVED', localeId, concept: { projectId } },
    include: { concept: true },
    orderBy: { id: 'asc' }
  })
  return entries
    .filter(
      (entry) =>
        (containsTerm(source, entry.concept.term) || containsTerm(key, entry.concept.term)) &&
        !containsTerm(value, entry.translation)
    )
    .map((entry) => ({
      term: entry.concept.term,
      translation: entry.translation
    }))
}

module.exports = { containsTerm, checkTerminology }
