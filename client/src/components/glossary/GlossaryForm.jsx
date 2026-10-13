import { Check, FileText, Globe2, Languages, Layers3, MessageSquare, Type } from 'lucide-react'

function GlossaryForm({
  busy,
  concepts,
  form,
  knownConcept,
  locales,
  onCancel,
  onChange,
  onSubmit,
  reviewer,
  sourceLocaleCode
}) {
  return (
    <form className="glossary-form" onSubmit={onSubmit}>
      <div className="glossary-form-heading">
        <span className="glossary-form-heading-icon">
          <FileText aria-hidden="true" size={22} strokeWidth={2} />
        </span>
        <h2>
          {form.entryId
            ? 'Редагувати термін'
            : form.fixedTerm
              ? 'Нове значення'
              : form.conceptId
                ? 'Запропонувати зміну / переклад'
                : 'Новий термін'}
        </h2>
      </div>
      {!form.entryId && !form.fixedTerm && (
        <label>
          Поняття
          <span className="glossary-field-control">
            <Layers3 aria-hidden="true" className="glossary-field-icon" size={18} />
            <select
              disabled={busy}
              value={form.conceptId ?? ''}
              onChange={(event) => {
                const conceptId = Number(event.target.value)
                const concept = concepts.find((entry) => entry.conceptId === conceptId)
                onChange(
                  concept
                    ? {
                        ...form,
                        conceptId: concept.conceptId,
                        term: concept.term,
                        definition: concept.definition
                      }
                    : { ...form, conceptId: null, term: '', definition: '' }
                )
              }}
            >
              <option value="">Створити нове поняття</option>
              {concepts.map((entry) => (
                <option key={entry.conceptId} value={entry.conceptId}>
                  {entry.term} — {entry.definition || 'без визначення'}
                </option>
              ))}
            </select>
          </span>
        </label>
      )}
      <label>
        Термін · {sourceLocaleCode.toUpperCase()}
        <span className="glossary-field-control">
          <Type aria-hidden="true" className="glossary-field-icon" size={18} />
          <input
            autoFocus
            required
            maxLength={200}
            disabled={busy || form.fixedTerm || (Boolean(form.conceptId) && !form.entryId)}
            value={form.term}
            placeholder="Наприклад, Workspace"
            onChange={(event) => onChange({ ...form, term: event.target.value })}
          />
        </span>
      </label>
      <label>
        Значення поняття
        <span className="glossary-field-control multiline">
          <FileText aria-hidden="true" className="glossary-field-icon" size={18} />
          <textarea
            rows={2}
            maxLength={2000}
            disabled={busy || (Boolean(knownConcept) && !form.entryId)}
            value={form.entryId ? form.definition : (knownConcept?.definition ?? form.definition)}
            placeholder="Що означає термін у цьому проєкті?"
            onChange={(event) => onChange({ ...form, definition: event.target.value })}
          />
        </span>
      </label>
      {knownConcept && !form.entryId && (
        <small>Новий мовний варіант буде додано до вибраного поняття.</small>
      )}
      <label>
        Мова перекладу
        <span className="glossary-field-control">
          <Globe2 aria-hidden="true" className="glossary-field-icon" size={18} />
          <select
            disabled={busy || Boolean(form.entryId)}
            value={form.localeCode}
            onChange={(event) => onChange({ ...form, localeCode: event.target.value })}
          >
            {locales.map((locale) => (
              <option key={locale.id} value={locale.code}>
                {locale.name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label>
        Пропонований переклад
        <span className="glossary-field-control">
          <Languages aria-hidden="true" className="glossary-field-icon" size={19} />
          <input
            required
            maxLength={500}
            disabled={busy}
            value={form.translation}
            placeholder="Наприклад, Робочий простір"
            onChange={(event) => onChange({ ...form, translation: event.target.value })}
          />
        </span>
      </label>
      <label>
        Контекст
        <span className="glossary-field-control multiline">
          <FileText aria-hidden="true" className="glossary-field-icon" size={18} />
          <textarea
            rows={2}
            maxLength={1000}
            disabled={busy}
            value={form.example}
            placeholder="Речення мовою оригіналу, де вжито термін"
            onChange={(event) => onChange({ ...form, example: event.target.value })}
          />
        </span>
      </label>
      <label>
        Примітка для рецензента
        <span className="glossary-field-control multiline">
          <MessageSquare aria-hidden="true" className="glossary-field-icon" size={18} />
          <textarea
            rows={2}
            maxLength={2000}
            disabled={busy}
            value={form.note}
            placeholder="Необов’язково"
            onChange={(event) => onChange({ ...form, note: event.target.value })}
          />
        </span>
      </label>
      <div className="glossary-buttons">
        <button className="button primary" disabled={busy}>
          {!busy && <Check aria-hidden="true" size={19} strokeWidth={2.4} />}
          {busy
            ? 'Зберігаємо…'
            : form.entryId
              ? 'Зберегти зміни'
              : reviewer
                ? 'Додати й затвердити'
                : 'На погодження'}
        </button>
        <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>
          Скасувати
        </button>
      </div>
    </form>
  )
}

export default GlossaryForm
