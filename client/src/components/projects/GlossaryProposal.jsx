// Швидка пропозиція не змушує залишати редактор і втрачати чернетку перекладу.
import { useState } from 'react'
import { saveGlossaryEntry } from '../../api/localizationApi'

export default function GlossaryProposal({ projectId, localeCode, example, onSaved, onClose }) {
  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [definition, setDefinition] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Сервер завжди створює PENDING, навіть якщо пропозицію надсилає рецензент.
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const entry = await saveGlossaryEntry(projectId, null, { term, translation, definition, localeCode, example: example.slice(0, 1000) })
      onSaved(entry)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <form className="glossary-quick" onSubmit={submit}>
    <label>Термін<input autoFocus required maxLength={200} disabled={busy} value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Слово або словосполучення" /></label>
    <label>Переклад · {localeCode}<input required maxLength={500} disabled={busy} value={translation} onChange={(event) => setTranslation(event.target.value)} /></label>
    <label>Значення<textarea rows={2} maxLength={2000} disabled={busy} value={definition} onChange={(event) => setDefinition(event.target.value)} /></label>
    {error && <p role="alert" className="glossary-error">{error}</p>}
    <button className="button primary" disabled={busy}>{busy ? 'Надсилаємо…' : 'На погодження'}</button>
    <button className="button secondary" type="button" disabled={busy} onClick={onClose}>Скасувати</button>
  </form>
}
