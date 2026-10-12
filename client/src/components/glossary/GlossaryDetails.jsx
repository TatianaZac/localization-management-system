import { formatGlossaryDate, GLOSSARY_STATUS_LABELS } from './glossaryUtils'

function GlossaryDetails({
  busy,
  confirmArchive,
  confirmDelete,
  decisionNote,
  definitionDraft,
  entries,
  onArchive,
  onDecide,
  onCancelArchive,
  onCancelDelete,
  onDecisionNoteChange,
  onDefinitionDraftChange,
  onDelete,
  onEdit,
  onSaveDefinition,
  onSelect,
  reviewer,
  selected
}) {
  return (
    <div className="glossary-details">
      <div className="glossary-details-header">
        <h2>{selected.term}</h2>
        <span className={'glossary-status ' + selected.status.toLowerCase()}>
          {GLOSSARY_STATUS_LABELS[selected.status]}
        </span>
      </div>
      <section className="glossary-detail-section">
        <h3>Значення</h3>
        <p className="glossary-value-box">{selected.definition || 'Не вказано'}</p>
        {reviewer &&
          (definitionDraft === null ? (
            <button
              className="glossary-definition-button"
              disabled={busy}
              onClick={() => onDefinitionDraftChange(selected.definition)}
            >
              ✎ Уточнити визначення
            </button>
          ) : (
            <>
              <label>
                Визначення для всіх мов
                <textarea
                  maxLength={2000}
                  value={definitionDraft}
                  disabled={busy}
                  onChange={(event) => onDefinitionDraftChange(event.target.value)}
                />
              </label>
              <div className="glossary-buttons">
                <button disabled={busy} onClick={onSaveDefinition}>
                  Зберегти визначення
                </button>
                <button disabled={busy} onClick={() => onDefinitionDraftChange(null)}>
                  Скасувати
                </button>
              </div>
            </>
          ))}
      </section>
      <section className="glossary-detail-section glossary-translation-section">
        <h3>◎ {selected.locale.name}</h3>
        <p className="glossary-value-box">
          <strong>{selected.translation}</strong>
        </p>
        {selected.example && (
          <>
            <h3>Приклад</h3>
            <p>{selected.example}</p>
          </>
        )}
        {selected.note && (
          <>
            <h3>Примітка</h3>
            <p>{selected.note}</p>
          </>
        )}
        <dl className="glossary-metadata">
          <div>
            <dt>Запропонував/-ла</dt>
            <dd>{selected.authorName ?? 'Автор невідомий (старий запис)'}</dd>
          </div>
          <div>
            <dt>Створено</dt>
            <dd>{formatGlossaryDate(selected.createdAt)}</dd>
          </div>
          {selected.reviewerName && (
            <div>
              <dt>Рішення рецензента</dt>
              <dd>
                {selected.reviewerName} · {formatGlossaryDate(selected.reviewedAt)}
              </dd>
            </div>
          )}
        </dl>
        {selected.decisionNote && <p>{selected.decisionNote}</p>}
      </section>
      {reviewer && (
        <section className="glossary-detail-section glossary-review">
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
            <button className="edit" disabled={busy} onClick={onEdit}>
              <span>✎</span>Редагувати
            </button>
            <button className="delete" disabled={busy} onClick={onDelete}>
              <span>×</span>Видалити
            </button>
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
      <section className="glossary-detail-section glossary-history-section">
        <h3>Варіанти та історія поняття</h3>
        <ul className="glossary-variants">
          {entries
            .filter((entry) => entry.conceptId === selected.conceptId)
            .map((entry) => (
              <li key={entry.id}>
                <button disabled={busy} onClick={() => onSelect(entry)}>
                  {entry.locale.code}: {entry.translation} · {GLOSSARY_STATUS_LABELS[entry.status]}{' '}
                  <span>›</span>
                </button>
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}

export default GlossaryDetails
