// Координує дані глосарію; таблиця, форма й панель деталей живуть в окремих компонентах.
import { useEffect, useState } from 'react'
import {
  deleteGlossaryEntry,
  getGlossary,
  reviewGlossaryEntry,
  saveGlossaryEntry,
  updateGlossaryEntry
} from '../api/localizationApi'
import GlossaryDetails from '../components/glossary/GlossaryDetails'
import GlossaryForm from '../components/glossary/GlossaryForm'
import GlossaryTable from '../components/glossary/GlossaryTable'
import GlossaryToolbar from '../components/glossary/GlossaryToolbar'
import { EMPTY_GLOSSARY_FORM } from '../components/glossary/glossaryUtils'
import '../styles/ProjectEditorPage.css'
import '../styles/Glossary.css'

const GLOSSARY_STATUS_PRIORITY = { PENDING: 3, APPROVED: 2, ARCHIVED: 1 }

function pickConceptEntries(items) {
  const byConcept = new Map()
  items.forEach((entry) => {
    const current = byConcept.get(entry.conceptId)
    if (
      !current ||
      GLOSSARY_STATUS_PRIORITY[entry.status] > GLOSSARY_STATUS_PRIORITY[current.status] ||
      (entry.status === current.status && entry.id > current.id)
    ) {
      byConcept.set(entry.conceptId, entry)
    }
  })
  return [...byConcept.values()]
}

export default function GlossaryPage({
  activeLocaleCode,
  onLocaleChange,
  projectId,
  project,
  seed
}) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])
  const [localeCode, setLocaleCode] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('ACTIVE')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    let active = true
    setLoading(true)
    getGlossary(projectId)
      .then((terms) => {
        if (!active) return
        setEntries(terms)
        const code =
          project.locales.find((locale) => !locale.isSource && locale.code === seed?.localeCode)
            ?.code ??
          project.locales.find((locale) => !locale.isSource && locale.code === activeLocaleCode)
            ?.code ??
          project.locales.find((locale) => !locale.isSource)?.code ??
          ''
        setLocaleCode(code)
        if (code) onLocaleChange(code)
        if (seed && code) setForm({ ...EMPTY_GLOSSARY_FORM, ...seed, localeCode: code })
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [projectId, seed])

  useEffect(() => {
    const exists = project.locales.some(
      (locale) => !locale.isSource && locale.code === activeLocaleCode
    )
    if (exists && activeLocaleCode !== localeCode) {
      setLocaleCode(activeLocaleCode)
      setSelectedId(null)
    }
  }, [activeLocaleCode, project.locales])

  const reviewer = project.currentUserRole === 'REVIEWER'
  const locales = project.locales.filter((locale) => !locale.isSource)
  const selected = entries.find((entry) => entry.id === selectedId)
  const concepts = [...new Map(entries.map((entry) => [entry.conceptId, entry])).values()]
  const knownConcept =
    form && form.conceptId ? concepts.find((entry) => entry.conceptId === form.conceptId) : null
  const filteredEntries = entries
    .filter(
      (entry) =>
        entry.locale.code === localeCode &&
        (filter === 'ACTIVE' ? entry.status !== 'ARCHIVED' : entry.status === filter) &&
        [entry.term, entry.translation, entry.definition, entry.note].some((text) =>
          text.toLowerCase().includes(query.trim().toLowerCase())
        )
    )
    .sort((a, b) => a.term.localeCompare(b.term) || b.id - a.id)
  const visible = [
    ...new Map(
      filteredEntries.map((entry) => {
        const normalizedTerm = entry.concept.normalizedTerm
        const group = filteredEntries.filter(
          (candidate) => candidate.concept.normalizedTerm === normalizedTerm
        )
        const meanings = pickConceptEntries(group)
        const representative =
          group.find((candidate) => candidate.status === 'PENDING') ??
          group.find((candidate) => candidate.status === 'APPROVED') ??
          group[0]
        return [
          normalizedTerm,
          {
            ...representative,
            entryIds: group.map((candidate) => candidate.id),
            meaningCount: meanings.length,
            additionalMeaningCount: Math.max(0, meanings.length - 1),
            definition:
              meanings.length > 1 ? `${meanings.length} значення` : representative.definition,
            updatedAt: group.reduce(
              (latest, candidate) =>
                new Date(candidate.updatedAt) > new Date(latest) ? candidate.updatedAt : latest,
              representative.updatedAt
            )
          }
        ]
      })
    ).values()
  ]
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  const pageEntries = visible.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => setCurrentPage(1), [localeCode, filter, query])
  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount)
  }, [currentPage, pageCount])

  async function refresh() {
    setEntries(await getGlossary(projectId))
  }

  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = form.entryId
        ? await updateGlossaryEntry(projectId, form.entryId, form)
        : await saveGlossaryEntry(projectId, null, {
            ...form,
            conceptId: knownConcept?.conceptId ?? null
          })
      await refresh()
      setSelectedId(saved.id)
      setLocaleCode(saved.locale.code)
      onLocaleChange(saved.locale.code)
      setForm(null)
      setNotice(
        form.entryId
          ? 'Термін оновлено.'
          : reviewer
            ? 'Термін додано й автоматично затверджено.'
            : 'Пропозицію надіслано на погодження.'
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function decide(action) {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await reviewGlossaryEntry(projectId, selected.id, {
        action,
        updatedAt: selected.updatedAt,
        decisionNote
      })
      await refresh()
      setConfirmArchive(false)
      setDecisionNote('')
      setFilter(action === 'approve' ? 'APPROVED' : 'ARCHIVED')
      setNotice(
        action === 'approve'
          ? 'Термін затверджено. Він доступний у підказках.'
          : 'Запис переміщено в архів.'
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  function select(entry) {
    if (busy) return
    setForm(null)
    setSelectedId(entry.id)
    setDecisionNote('')
    setConfirmArchive(false)
    setConfirmDelete(false)
    setError('')
  }

  function resetPanelMessages() {
    setError('')
    setNotice('')
    setConfirmArchive(false)
    setConfirmDelete(false)
  }

  function propose(entry) {
    setForm(
      entry
        ? {
            ...EMPTY_GLOSSARY_FORM,
            conceptId: entry.conceptId,
            term: entry.term,
            definition: entry.definition,
            translation: entry.locale.code === localeCode ? entry.translation : '',
            note: entry.note,
            example: entry.example,
            localeCode
          }
        : { ...EMPTY_GLOSSARY_FORM, localeCode }
    )
    resetPanelMessages()
  }

  function addMeaning(entry) {
    setForm({
      ...EMPTY_GLOSSARY_FORM,
      conceptId: null,
      fixedTerm: true,
      term: entry.term,
      localeCode
    })
    resetPanelMessages()
  }

  function edit(entry) {
    setForm({
      ...EMPTY_GLOSSARY_FORM,
      entryId: entry.id,
      conceptId: entry.conceptId,
      term: entry.term,
      definition: entry.definition,
      translation: entry.translation,
      note: entry.note,
      example: entry.example,
      localeCode: entry.locale.code
    })
    resetPanelMessages()
  }

  async function remove() {
    if (!selected || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await deleteGlossaryEntry(projectId, selected.id)
      await refresh()
      setSelectedId(null)
      setConfirmDelete(false)
      setNotice('Термін видалено.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="editor-content glossary-loading" role="status">
        <span aria-hidden="true" className="glossary-loading-spinner" />
        <strong>Завантажуємо глосарій…</strong>
        <small>Готуємо терміни для вибраної мови</small>
      </div>
    )
  }

  const panelOpen = Boolean(form || selected)
  return (
    <div className={'editor-content glossary-page' + (panelOpen ? ' glossary-panel-open' : '')}>
      <div className="project-title-row">
        <div>
          <h1>Глосарій</h1>
          <p>
            Спільні поняття та погоджені переклади · {project.sourceLocaleCode.toUpperCase()} →{' '}
            {locales.find((locale) => locale.code === localeCode)?.name ?? 'Мова перекладу'}
          </p>
        </div>
        <button
          className="button primary"
          disabled={!localeCode || busy || Boolean(form)}
          onClick={() => propose(null)}
        >
          {reviewer ? '+ Додати термін' : '+ Запропонувати термін'}
        </button>
      </div>
      {error && (
        <p role="alert" className="glossary-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="glossary-workarea">
        <div className="glossary-main">
          <GlossaryToolbar
            busy={busy}
            filter={filter}
            formOpen={Boolean(form)}
            localeCode={localeCode}
            locales={locales}
            onFilterChange={setFilter}
            onLocaleChange={(code) => {
              setLocaleCode(code)
              onLocaleChange(code)
              setSelectedId(null)
            }}
            onQueryChange={setQuery}
            onRefresh={() => refresh().catch((requestError) => setError(requestError.message))}
            query={query}
          />
          <GlossaryTable
            busy={busy}
            currentPage={safePage}
            entries={pageEntries}
            error={error}
            hasEntries={Boolean(entries.length)}
            localeCode={localeCode}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            onSelect={select}
            pageSize={pageSize}
            selectedId={selectedId}
            sourceLocaleCode={project.sourceLocaleCode}
            totalItems={visible.length}
          />
        </div>
        {panelOpen && (
          <aside className="glossary-panel" aria-label="Деталі терміна">
            {selected && !form && (
              <button
                aria-label="Закрити деталі терміна"
                className="glossary-panel-close"
                onClick={() => setSelectedId(null)}
                title="Закрити"
                type="button"
              >
                ×
              </button>
            )}
            {form ? (
              <GlossaryForm
                busy={busy}
                concepts={concepts}
                form={form}
                knownConcept={knownConcept}
                locales={locales}
                onCancel={() => setForm(null)}
                onChange={setForm}
                onSubmit={save}
                reviewer={reviewer}
                sourceLocaleCode={project.sourceLocaleCode}
              />
            ) : selected ? (
              <GlossaryDetails
                busy={busy}
                confirmArchive={confirmArchive}
                confirmDelete={confirmDelete}
                decisionNote={decisionNote}
                onArchive={() => setConfirmArchive(true)}
                onDecide={decide}
                onCancelArchive={() => setConfirmArchive(false)}
                onCancelDelete={() => setConfirmDelete(false)}
                onDecisionNoteChange={setDecisionNote}
                onDelete={remove}
                onAddMeaning={() => addMeaning(selected)}
                onEdit={edit}
                onRequestDelete={(entry) => {
                  select(entry)
                  setConfirmDelete(true)
                }}
                onSelect={select}
                reviewer={reviewer}
                selected={selected}
                meanings={pickConceptEntries(
                  entries.filter(
                    (entry) =>
                      entry.locale.code === localeCode &&
                      entry.concept.normalizedTerm === selected.concept.normalizedTerm &&
                      (filter === 'ARCHIVED'
                        ? entry.status === 'ARCHIVED'
                        : entry.status !== 'ARCHIVED')
                  )
                )}
              />
            ) : null}
          </aside>
        )}
      </div>
    </div>
  )
}
