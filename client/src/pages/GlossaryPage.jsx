// Таблиця показує словник; бічна панель — пропозиції, авторів і рішення рецензента.
import { useEffect, useState } from 'react'
import { getGlossary, saveGlossaryEntry, reviewGlossaryEntry, updateGlossaryConcept } from '../api/localizationApi'
import '../styles/ProjectEditorPage.css'
import '../styles/Glossary.css'

const labels = { APPROVED: 'Затверджено', PENDING: 'На погодженні', ARCHIVED: 'Архів' }
const blank = { term: '', definition: '', translation: '', note: '', example: '' }

// Дати й автори старих записів можуть бути відсутні — не підставляємо вигадані дані.
function date(value) { return value ? new Date(value).toLocaleString('uk-UA') : '—' }

export default function GlossaryPage({ projectId, project, seed }) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [localeCode, setLocaleCode] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('ACTIVE')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(null)
  const [definitionDraft, setDefinitionDraft] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    getGlossary(projectId).then((terms) => {
      if (!active) return
      setEntries(terms)
      const code = project.locales.find((locale) => !locale.isSource && locale.code === seed?.localeCode)?.code
        ?? project.locales.find((locale) => !locale.isSource)?.code ?? ''
      setLocaleCode(code)
      if (seed && code) setForm({ ...blank, ...seed, localeCode: code })
    }).catch((err) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, seed])

  const reviewer = project?.currentUserRole === 'REVIEWER'
  const locales = project?.locales.filter((locale) => !locale.isSource) ?? []
  const selected = entries.find((entry) => entry.id === selectedId)
  const concepts = [...new Map(entries.map((entry) => [entry.conceptId, entry])).values()]
  // Якщо користувач ввів уже відомий термін, повторно використовуємо спільне поняття.
  const knownConcept = form && concepts.find((entry) => entry.conceptId === form.conceptId
    || entry.concept.normalizedTerm === form.term.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim())
  const visible = entries.filter((entry) => entry.locale.code === localeCode
    && (filter === 'ACTIVE' ? entry.status !== 'ARCHIVED' : entry.status === filter)
    && [entry.term, entry.translation, entry.definition, entry.note].some((text) => text.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => a.term.localeCompare(b.term) || b.id - a.id)

  // Перечитуємо список після дії: погодження могло також архівувати попередню версію.
  async function refresh() { setEntries(await getGlossary(projectId)) }

  // Зберігає пропозицію, а права на погодження залишаються окремими.
  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const saved = await saveGlossaryEntry(projectId, null, { ...form, conceptId: knownConcept?.conceptId ?? null })
      setEntries((current) => [saved, ...current]); setSelectedId(saved.id)
      setLocaleCode(saved.locale.code); setFilter('PENDING'); setQuery(''); setForm(null)
      setNotice('Пропозицію надіслано на погодження.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  // Дата версії не дозволяє затвердити застарілий стан із давно відкритої вкладки.
  async function decide(action) {
    if (!selected || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await reviewGlossaryEntry(projectId, selected.id, { action, updatedAt: selected.updatedAt, decisionNote })
      await refresh(); setConfirmArchive(false); setDecisionNote('')
      setFilter(action === 'approve' ? 'APPROVED' : 'ARCHIVED')
      setNotice(action === 'approve' ? 'Термін затверджено. Він доступний у підказках.' : 'Запис переміщено в архів.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  // Уточнення значення є спільним для всіх мов цього поняття.
  async function saveDefinition() {
    setBusy(true); setError('')
    try {
      await updateGlossaryConcept(projectId, selected.conceptId, definitionDraft)
      await refresh(); setDefinitionDraft(null); setNotice('Визначення оновлено для всіх мов.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  // Очищає чернетку рішення при виборі іншого запису.
  function select(entry) {
    setSelectedId(entry.id); setDecisionNote(''); setConfirmArchive(false); setDefinitionDraft(null); setError('')
  }

  // Редагування затвердженого або архівного тексту створює нову пропозицію.
  function propose(entry) {
    setForm(entry ? { ...blank, conceptId: entry.conceptId, term: entry.term, definition: entry.definition,
      translation: entry.locale.code === localeCode ? entry.translation : '', note: entry.note, example: entry.example, localeCode }
      : { ...blank, localeCode })
    setError(''); setNotice(''); setConfirmArchive(false); setDefinitionDraft(null)
  }

  if (loading) return <div className="editor-content" role="status">Завантажуємо глосарій…</div>

  // Навігація й списки версій належать спільній оболонці, тут лише вміст глосарію.
  return <div className="editor-content glossary-page">
        <div className="project-title-row"><div><h1>Глосарій</h1><p>Спільні поняття та погоджені переклади · {project.sourceLocaleCode.toUpperCase()}</p></div>
          <button className="button primary" disabled={!localeCode || busy || Boolean(form)} onClick={() => propose(null)}>+ Запропонувати термін</button>
        </div>
        {error && <p role="alert" className="glossary-error">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="glossary-toolbar">
          <label>Пошук<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Термін, переклад або значення" /></label>
          <label>Мова<select disabled={busy || Boolean(form)} value={localeCode} onChange={(event) => { setLocaleCode(event.target.value); setSelectedId(null) }}>
            {!locales.length && <option value="">Немає цільових мов</option>}{locales.map((locale) => <option key={locale.id} value={locale.code}>{locale.name} ({locale.code})</option>)}
          </select></label>
          <label>Статус<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ACTIVE">Усі активні</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="button secondary" disabled={busy} onClick={() => refresh().catch((err) => setError(err.message))}>Оновити</button>
        </div>
        <div className="glossary-workarea">
          <div className="glossary-list">
            {!visible.length ? <p>{error ? 'Не вдалося завантажити терміни.' : !entries.length ? 'Запропонуйте новий термін' : 'За вибраними умовами нічого не знайдено.'}</p> : <table>
              <thead><tr><th>Термін</th><th>Переклад</th><th>Статус</th><th>Значення</th></tr></thead>
              <tbody>{visible.map((entry) => <tr className={selectedId === entry.id ? 'glossary-selected' : ''} key={entry.id}>
                <td><button className="glossary-term" disabled={Boolean(form) || busy} onClick={() => select(entry)}>{entry.term}</button></td><td>{entry.translation}</td>
                <td><span className={'glossary-status ' + entry.status.toLowerCase()}>{labels[entry.status]}</span></td><td>{entry.definition || '—'}</td>
              </tr>)}</tbody>
            </table>}
          </div>
          <aside className="glossary-panel" aria-label="Деталі терміна">
            {form ? <form className="glossary-form" onSubmit={save}>
              <h2>{form.conceptId ? 'Запропонувати зміну / переклад' : 'Новий термін'}</h2>
              <label>Термін · {project.sourceLocaleCode.toUpperCase()}<input autoFocus list="glossary-concepts" required maxLength={200} disabled={busy || Boolean(form.conceptId)} value={form.term} placeholder="Наприклад, Workspace" onChange={(event) => setForm({ ...form, term: event.target.value })} /></label>
              <datalist id="glossary-concepts">{concepts.map((entry) => <option key={entry.conceptId} value={entry.term} />)}</datalist>
              <label>Значення поняття<textarea rows={2} maxLength={2000} disabled={busy || Boolean(knownConcept)} value={knownConcept?.definition ?? form.definition} placeholder="Що означає термін у цьому проєкті?" onChange={(event) => setForm({ ...form, definition: event.target.value })} /></label>
              {knownConcept && <small>Використовуємо наявне спільне поняття.</small>}
              <label>Мова перекладу<select disabled={busy} value={form.localeCode} onChange={(event) => setForm({ ...form, localeCode: event.target.value })}>{locales.map((locale) => <option key={locale.id} value={locale.code}>{locale.name}</option>)}</select></label>
              <label>Пропонований переклад<input required maxLength={500} disabled={busy} value={form.translation} placeholder="Наприклад, Робочий простір" onChange={(event) => setForm({ ...form, translation: event.target.value })} /></label>
              <label>Приклад використання<textarea rows={2} maxLength={1000} disabled={busy} value={form.example} placeholder="Create a workspace" onChange={(event) => setForm({ ...form, example: event.target.value })} /></label>
              <label>Примітка для рецензента<textarea rows={2} maxLength={2000} disabled={busy} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
              <div className="glossary-buttons"><button className="button primary" disabled={busy}>{busy ? 'Надсилаємо…' : 'На погодження'}</button><button type="button" className="button secondary" disabled={busy} onClick={() => setForm(null)}>Скасувати</button></div>
            </form> : selected ? <div className="glossary-details">
              <h2>{selected.term}</h2><span className={'glossary-status ' + selected.status.toLowerCase()}>{labels[selected.status]}</span>
              <h3>Значення</h3><p>{selected.definition || 'Не вказано'}</p>
              {reviewer && (definitionDraft === null ? <button disabled={busy} onClick={() => setDefinitionDraft(selected.definition)}>Уточнити визначення</button> : <>
                <label>Визначення для всіх мов<textarea maxLength={2000} value={definitionDraft} disabled={busy} onChange={(event) => setDefinitionDraft(event.target.value)} /></label>
                <div className="glossary-buttons"><button disabled={busy} onClick={saveDefinition}>Зберегти визначення</button><button disabled={busy} onClick={() => setDefinitionDraft(null)}>Скасувати</button></div>
              </>)}
              <h3>{selected.locale.name}</h3><p><strong>{selected.translation}</strong></p>
              {selected.example && <><h3>Приклад</h3><p>{selected.example}</p></>}
              {selected.note && <><h3>Примітка</h3><p>{selected.note}</p></>}
              <dl><dt>Запропонував/-ла</dt><dd>{selected.authorName ?? 'Автор невідомий (старий запис)'}</dd><dt>Створено</dt><dd>{date(selected.createdAt)}</dd>
                {selected.reviewerName && <><dt>Рішення рецензента</dt><dd>{selected.reviewerName} · {date(selected.reviewedAt)}</dd></>}
              </dl>
              {selected.decisionNote && <p>{selected.decisionNote}</p>}
              {reviewer && selected.status !== 'ARCHIVED' && <div className="glossary-review">
                <label>Коментар до рішення<textarea rows={2} maxLength={2000} disabled={busy} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} /></label>
                <div className="glossary-buttons">
                  {selected.status === 'PENDING' && <button className="button primary" disabled={busy} onClick={() => decide('approve')}>Затвердити</button>}
                  <button disabled={busy} onClick={() => setConfirmArchive(true)}>До архіву</button>
                </div>
                {confirmArchive && <div className="glossary-confirm"><p>Архівувати цей варіант? Він зникне з рекомендацій, але залишиться в історії.</p><button disabled={busy} onClick={() => decide('archive')}>Так, архівувати</button><button disabled={busy} onClick={() => setConfirmArchive(false)}>Скасувати</button></div>}
              </div>}
              <button className="button secondary" disabled={busy} onClick={() => propose(selected)}>Запропонувати зміну / іншу мову</button>
              <h3>Варіанти та історія поняття</h3>
              <ul className="glossary-variants">{entries.filter((entry) => entry.conceptId === selected.conceptId).map((entry) => <li key={entry.id}>
                <button disabled={busy} onClick={() => select(entry)}>{entry.locale.code}: {entry.translation} · {labels[entry.status]}</button>
              </li>)}</ul>
            </div> : <div className="glossary-details"><h2>Деталі терміна</h2><p>Обери термін у таблиці або запропонуй новий.</p></div>}
          </aside>
        </div>
      </div>
}
