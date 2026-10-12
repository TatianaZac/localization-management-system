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
      <h2>
        {form.entryId
          ? 'Редагувати термін'
          : form.conceptId
            ? 'Запропонувати зміну / переклад'
            : 'Новий термін'}
      </h2>
      <label>
        Термін · {sourceLocaleCode.toUpperCase()}
        <input
          autoFocus
          list="glossary-concepts"
          required
          maxLength={200}
          disabled={busy || (Boolean(form.conceptId) && !form.entryId)}
          value={form.term}
          placeholder="Наприклад, Workspace"
          onChange={(event) => onChange({ ...form, term: event.target.value })}
        />
      </label>
      <datalist id="glossary-concepts">
        {concepts.map((entry) => (
          <option key={entry.conceptId} value={entry.term} />
        ))}
      </datalist>
      <label>
        Значення поняття
        <textarea
          rows={2}
          maxLength={2000}
          disabled={busy || (Boolean(knownConcept) && !form.entryId)}
          value={form.entryId ? form.definition : (knownConcept?.definition ?? form.definition)}
          placeholder="Що означає термін у цьому проєкті?"
          onChange={(event) => onChange({ ...form, definition: event.target.value })}
        />
      </label>
      {knownConcept && !form.entryId && <small>Використовуємо наявне спільне поняття.</small>}
      <label>
        Мова перекладу
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
      </label>
      <label>
        Пропонований переклад
        <input
          required
          maxLength={500}
          disabled={busy}
          value={form.translation}
          placeholder="Наприклад, Робочий простір"
          onChange={(event) => onChange({ ...form, translation: event.target.value })}
        />
      </label>
      <label>
        Приклад використання
        <textarea
          rows={2}
          maxLength={1000}
          disabled={busy}
          value={form.example}
          placeholder="Create a workspace"
          onChange={(event) => onChange({ ...form, example: event.target.value })}
        />
      </label>
      <label>
        Примітка для рецензента
        <textarea
          rows={2}
          maxLength={2000}
          disabled={busy}
          value={form.note}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        />
      </label>
      <div className="glossary-buttons">
        <button className="button primary" disabled={busy}>
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
