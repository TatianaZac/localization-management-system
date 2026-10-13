import { useEffect, useState } from 'react'
import { formatGlossaryDate, GLOSSARY_STATUS_LABELS } from './glossaryUtils'

function GlossaryDetails({
  busy,
  confirmArchive,
  confirmDelete,
  decisionNote,
  onArchive,
  onDecide,
  onCancelArchive,
  onCancelDelete,
  onDecisionNoteChange,
  onDelete,
  onAddMeaning,
  onEdit,
  onRequestDelete,
  onSelect,
  reviewer,
  selected,
  meanings
}) {
  const [expandedConcepts, setExpandedConcepts] = useState(() => new Set([selected.conceptId]))
  const [openMenu, setOpenMenu] = useState(null)
  const selectedMeaningNumber =
    meanings.findIndex((entry) => entry.conceptId === selected.conceptId) + 1

  useEffect(() => {
    setExpandedConcepts((current) => new Set([...current, selected.conceptId]))
  }, [selected.conceptId])

  function toggleMeaning(entry) {
    onSelect(entry)
    setExpandedConcepts((current) => {
      const next = new Set(current)
      if (next.has(entry.conceptId)) next.delete(entry.conceptId)
      else next.add(entry.conceptId)
      return next
    })
    setOpenMenu(null)
  }

  return (
    <div className="glossary-details">
      <div className="glossary-details-header">
        <h2>{selected.term}</h2>
        <span className={'glossary-status ' + selected.status.toLowerCase()}>
          {GLOSSARY_STATUS_LABELS[selected.status]}
        </span>
      </div>
      <section className="glossary-detail-section glossary-meanings-section">
        <div className="glossary-section-heading">
          <h3>Значення терміна ({meanings.length})</h3>
          <button className="glossary-add-meaning" disabled={busy} onClick={onAddMeaning}>
            + Додати значення
          </button>
        </div>
        <div className="glossary-meaning-list">
          {meanings.map((entry, index) => (
            <article
              className={
                'glossary-meaning-card' +
                (entry.conceptId === selected.conceptId ? ' selected' : '')
              }
              key={entry.conceptId}
            >
              <div
                className="glossary-meaning-heading"
                onClick={() => toggleMeaning(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    toggleMeaning(entry)
                  }
                }}
                role="button"
                tabIndex={busy ? -1 : 0}
              >
                <span className="glossary-meaning-number">{index + 1}</span>
                <strong className="glossary-meaning-title">{entry.translation}</strong>
                <span className={'glossary-status ' + entry.status.toLowerCase()}>
                  {GLOSSARY_STATUS_LABELS[entry.status]}
                </span>
                <span className="glossary-meaning-actions">
                  {reviewer && (
                    <span className="glossary-meaning-menu">
                      <button
                        aria-expanded={openMenu === entry.conceptId}
                        aria-label={`Дії для значення ${index + 1}`}
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(entry)
                          setOpenMenu((current) =>
                            current === entry.conceptId ? null : entry.conceptId
                          )
                        }}
                        type="button"
                      >
                        ⋮
                      </button>
                      {openMenu === entry.conceptId && (
                        <span className="glossary-meaning-menu-popover" role="menu">
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              setOpenMenu(null)
                              onEdit(entry)
                            }}
                            role="menuitem"
                            type="button"
                          >
                            Редагувати
                          </button>
                          <button
                            className="delete"
                            onClick={(event) => {
                              event.stopPropagation()
                              setOpenMenu(null)
                              onRequestDelete(entry)
                            }}
                            role="menuitem"
                            type="button"
                          >
                            Видалити
                          </button>
                        </span>
                      )}
                    </span>
                  )}
                  <button
                    aria-label={
                      expandedConcepts.has(entry.conceptId)
                        ? `Згорнути значення ${index + 1}`
                        : `Розгорнути значення ${index + 1}`
                    }
                    className="glossary-meaning-toggle"
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation()
                      toggleMeaning(entry)
                    }}
                    type="button"
                  >
                    {expandedConcepts.has(entry.conceptId) ? '⌃' : '⌄'}
                  </button>
                </span>
              </div>
              {expandedConcepts.has(entry.conceptId) && (
                <dl className="glossary-meaning-fields">
                  <div>
                    <dt>Переклад ({entry.locale.code.toUpperCase()})</dt>
                    <dd>
                      <strong>{entry.translation}</strong>
                    </dd>
                  </div>
                  <div>
                    <dt>Визначення</dt>
                    <dd>{entry.definition || 'Не вказано'}</dd>
                  </div>
                  {entry.example && (
                    <div>
                      <dt>Контекст</dt>
                      <dd>{entry.example}</dd>
                    </div>
                  )}
                  {entry.note && (
                    <div>
                      <dt>Примітка</dt>
                      <dd>{entry.note}</dd>
                    </div>
                  )}
                  <div className="glossary-meaning-metadata">
                    <dt>Метадані</dt>
                    <dd>
                      <span>
                        Запропонував/-ла:{' '}
                        <strong>{entry.authorName ?? 'Автор невідомий (старий запис)'}</strong>
                      </span>
                      <span>
                        Створено: <strong>{formatGlossaryDate(entry.createdAt)}</strong>
                      </span>
                      {entry.reviewerName && (
                        <span>
                          Рішення: <strong>{entry.reviewerName}</strong> ·{' '}
                          {formatGlossaryDate(entry.reviewedAt)}
                        </span>
                      )}
                      {entry.decisionNote && <span>Коментар: {entry.decisionNote}</span>}
                    </dd>
                  </div>
                </dl>
              )}
            </article>
          ))}
        </div>
      </section>
      {reviewer && (
        <section className="glossary-detail-section glossary-review">
          <h3>Рішення для значення {selectedMeaningNumber}</h3>
          {selected.status !== 'ARCHIVED' && (
            <label>
              Коментар до рішення
              <textarea
                rows={3}
                maxLength={2000}
                disabled={busy}
                value={decisionNote}
                placeholder="Залиште коментар…"
                onChange={(event) => onDecisionNoteChange(event.target.value)}
              />
              <small>{decisionNote.length}/2000</small>
            </label>
          )}
          <div className="glossary-decision-actions">
            {selected.status === 'PENDING' && (
              <button className="approve" disabled={busy} onClick={() => onDecide('approve')}>
                <span>✓</span>Затвердити
              </button>
            )}
            {selected.status !== 'ARCHIVED' && (
              <button className="archive" disabled={busy} onClick={onArchive}>
                <span>◷</span>До архіву
              </button>
            )}
          </div>
          {confirmArchive && (
            <div className="glossary-confirm">
              <p>Архівувати цей варіант? Він зникне з рекомендацій, але залишиться в історії.</p>
              <button disabled={busy} onClick={() => onDecide('archive')}>
                Так, архівувати
              </button>
              <button disabled={busy} onClick={onCancelArchive}>
                Скасувати
              </button>
            </div>
          )}
          {confirmDelete && (
            <div className="glossary-confirm glossary-delete-confirm">
              <p>Видалити цей запис без можливості відновлення?</p>
              <button disabled={busy} onClick={onDelete}>
                Так, видалити
              </button>
              <button disabled={busy} onClick={onCancelDelete}>
                Скасувати
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default GlossaryDetails
