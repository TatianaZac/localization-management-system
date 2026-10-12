import Pagination from '../Pagination'
import { formatGlossaryShortDate, GLOSSARY_STATUS_LABELS } from './glossaryUtils'

function GlossaryTable({
  busy,
  currentPage,
  entries,
  error,
  hasEntries,
  localeCode,
  onPageChange,
  onPageSizeChange,
  onSelect,
  pageSize,
  selectedId,
  sourceLocaleCode,
  totalItems
}) {
  return (
    <div className="glossary-list">
      {!totalItems ? (
        <p>
          {error
            ? 'Не вдалося завантажити терміни.'
            : !hasEntries
              ? 'Запропонуйте новий термін'
              : 'За вибраними умовами нічого не знайдено.'}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Термін ({sourceLocaleCode.toUpperCase()})</th>
              <th>Переклад ({localeCode.toUpperCase()})</th>
              <th>Статус</th>
              <th>Значення / контекст</th>
              <th>Оновлено</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                aria-selected={selectedId === entry.id}
                className={selectedId === entry.id ? 'glossary-selected' : ''}
                key={entry.id}
                onClick={() => onSelect(entry)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(entry)
                  }
                }}
                tabIndex={busy ? -1 : 0}
              >
                <td>
                  <span className="glossary-term">{entry.term}</span>
                </td>
                <td>{entry.translation}</td>
                <td>
                  <span className={'glossary-status ' + entry.status.toLowerCase()}>
                    {GLOSSARY_STATUS_LABELS[entry.status]}
                  </span>
                </td>
                <td>{entry.definition || '—'}</td>
                <td>{formatGlossaryShortDate(entry.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          itemLabel="термінів"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSize={pageSize}
          totalItems={totalItems}
        />
      )}
    </div>
  )
}

export default GlossaryTable
