import { GLOSSARY_STATUS_LABELS } from './glossaryUtils'

function GlossaryToolbar({
  busy,
  filter,
  formOpen,
  localeCode,
  locales,
  onFilterChange,
  onLocaleChange,
  onQueryChange,
  onRefresh,
  query
}) {
  return (
    <div className="glossary-toolbar">
      <label>
        Пошук
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Термін, переклад або значення"
        />
      </label>
      <label>
        Мова
        <select
          disabled={busy || formOpen}
          value={localeCode}
          onChange={(event) => onLocaleChange(event.target.value)}
        >
          {!locales.length && <option value="">Немає цільових мов</option>}
          {locales.map((locale) => (
            <option key={locale.id} value={locale.code}>
              {locale.name} ({locale.code})
            </option>
          ))}
        </select>
      </label>
      <label>
        Статус
        <select value={filter} onChange={(event) => onFilterChange(event.target.value)}>
          <option value="ACTIVE">Усі активні</option>
          {Object.entries(GLOSSARY_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button className="button secondary" disabled={busy} onClick={onRefresh}>
        Оновити
      </button>
    </div>
  )
}

export default GlossaryToolbar
