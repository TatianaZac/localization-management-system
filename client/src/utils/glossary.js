// Шукає буквальний термін без урахування регістру, але з межами слів Unicode.
// Тому «sign in» знайдеться у «Please sign in», а «cat» не збігатиметься з «category».
export function matchesGlossaryTerm(source, term) {
  const normalize = (text) => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
  const text = normalize(source ?? '')
  const needle = normalize(term ?? '')
  if (!needle) return false
  const word = /[\p{L}\p{N}\p{M}_]/u
  let start = text.indexOf(needle)
  while (start !== -1) {
    const before = Array.from(text.slice(0, start)).at(-1) ?? ''
    const after = Array.from(text.slice(start + needle.length))[0] ?? ''
    if ((!word.test(needle[0]) || !word.test(before))
      && (!word.test(needle.at(-1)) || !word.test(after))) return true
    start = text.indexOf(needle, start + 1)
  }
  return false
}
