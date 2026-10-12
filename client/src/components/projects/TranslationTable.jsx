// Цей файл відображає таблицю ключів локалізації та керує редагуванням її рядків.

import { useEffect, useState } from 'react'
import Pagination from '../Pagination'
import '../../styles/TranslationTable.css'

// Перетворює внутрішній статус перекладу на зрозумілий український підпис.
function statusLabel(status) {
  const labels = {
    NEW: 'Не перекладено',
    TRANSLATED: 'Перекладено',
    REVIEWED: 'Перевірено',
    OUTDATED: 'Потребує уваги',
    NEEDS_REVISION: 'На доопрацюванні'
  }

  return labels[status] ?? status
}

// Показує один ключ, його оригінал і редагований переклад зі станом збереження.
function TranslationRow({
  canEdit,
  translationKey,
  targetLocaleCode,
  isSelected,
  onSelect,
  onSave
}) {
  const translation = translationKey.translations.find(
    (item) => item.locale.code === targetLocaleCode
  )
  const [draft, setDraft] = useState(translation?.value ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    setDraft(translation?.value ?? '')
    setValidationError('')
  }, [translation?.value, targetLocaleCode])

  const hasChanges = draft !== (translation?.value ?? '')

  // Enter зберігає лише змінений текст; затвердження виконується окремо в панелі.
  async function save() {
    // Після зауваження можна повторно подати навіть незмінений коректний текст.
    if (
      !translation ||
      !canEdit ||
      isSaving ||
      (!hasChanges && !['NEEDS_REVISION', 'OUTDATED'].includes(translation.status))
    )
      return

    if (draft.trim().length > 0 && draft.trimEnd() !== draft) {
      setValidationError('Прибери пробіли після останнього слова')
      return
    }

    setValidationError('')
    setIsSaving(true)
    try {
      await onSave(translation.id, draft, 'TRANSLATED')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <tr className={isSelected ? 'selected-row' : ''} onClick={onSelect}>
      <td className="select-cell">
        <input
          aria-label={'Обрати ' + translationKey.key}
          checked={isSelected}
          onChange={onSelect}
          type="checkbox"
        />
      </td>
      <td>
        <code className="key-code">{translationKey.key}</code>
      </td>
      <td>
        <span className="source-copy">{translationKey.sourceTexts[0]?.value}</span>
      </td>
      <td className="translation-edit-cell">
        <input
          className="translation-input"
          aria-label={'Переклад ' + translationKey.key}
          disabled={!translation || !canEdit || isSaving}
          aria-describedby={validationError ? `translation-error-${translation?.id}` : undefined}
          aria-invalid={Boolean(validationError)}
          onChange={(event) => {
            setDraft(event.target.value)
            if (validationError) setValidationError('')
          }}
          onFocus={onSelect}
          onKeyDown={(event) => {
            // Enter під час складання символу (IME) не повинен передчасно зберігати текст.
            if (canEdit && event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void save()
            }
          }}
          placeholder={
            translation ? (canEdit ? 'Введи переклад' : 'Лише перегляд') : 'Спочатку додай мову'
          }
          value={draft}
        />
        {canEdit && (validationError || isSaving || hasChanges) && (
          <small
            className={`translation-save-hint${validationError ? ' error' : ''}`}
            id={validationError ? `translation-error-${translation?.id}` : undefined}
            role={validationError ? 'alert' : 'status'}
          >
            {validationError || (isSaving ? 'Зберігаємо…' : 'Не збережено · натисни Enter')}
          </small>
        )}
      </td>
      <td>
        <span className={'status ' + (translation?.status ?? 'NEW').toLowerCase()}>
          {statusLabel(translation?.status ?? 'NEW')}
        </span>
      </td>
    </tr>
  )
}

// Формує таблицю перекладів або повідомлення про відсутність видимих рядків.
function TranslationTable({
  canEdit,
  translationKeys,
  targetLocaleCode,
  selectedKeyId,
  onSelectKey,
  onSaveTranslation,
  paginationKey
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const pageCount = Math.max(1, Math.ceil(translationKeys.length / pageSize))
  const safePage = Math.min(currentPage, pageCount)
  const pageKeys = translationKeys.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Новий пошук, статус або мова завжди починаються з першої сторінки результатів.
  useEffect(() => {
    setCurrentPage(1)
    onSelectKey(translationKeys[0]?.id ?? null)
  }, [paginationKey])

  useEffect(() => {
    if (currentPage > pageCount) setCurrentPage(pageCount)
  }, [currentPage, pageCount])

  function changePage(page) {
    const nextPage = Math.min(Math.max(page, 1), pageCount)
    setCurrentPage(nextPage)
    onSelectKey(translationKeys[(nextPage - 1) * pageSize]?.id ?? null)
  }

  function changePageSize(size) {
    setPageSize(size)
    setCurrentPage(1)
    onSelectKey(translationKeys[0]?.id ?? null)
  }

  return (
    <section className="translation-table-card">
      {translationKeys.length === 0 ? (
        <div className="empty-table">
          <strong>Рядків не знайдено</strong>
          <span>Зміни пошук або фільтр чи імпортуй JSON-файл.</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="translation-table">
            {/* Ширини не залежать від довжини тексту, вибраної мови чи фільтра. */}
            <colgroup>
              <col className="translation-col-select" />
              <col className="translation-col-key" />
              <col className="translation-col-source" />
              <col />
              <col className="translation-col-status" />
            </colgroup>
            <thead>
              <tr>
                <th aria-label="Вибір" />
                <th>Ключ</th>
                <th>Оригінальний текст</th>
                <th>Переклад</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {pageKeys.map((translationKey) => (
                <TranslationRow
                  canEdit={canEdit}
                  isSelected={selectedKeyId === translationKey.id}
                  key={translationKey.id}
                  onSave={onSaveTranslation}
                  onSelect={() => onSelectKey(translationKey.id)}
                  targetLocaleCode={targetLocaleCode}
                  translationKey={translationKey}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <footer className="table-footer">
        {canEdit && <span>Enter — зберегти переклад у вибраному полі</span>}
        <span>{translationKeys.length} знайдено</span>
      </footer>
      {translationKeys.length > 0 && (
        <Pagination
          currentPage={safePage}
          itemLabel="рядків"
          onPageChange={changePage}
          onPageSizeChange={changePageSize}
          pageSize={pageSize}
          totalItems={translationKeys.length}
        />
      )}
    </section>
  )
}

export default TranslationTable
