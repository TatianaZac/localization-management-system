// Цей файл відображає таблицю ключів локалізації та керує редагуванням її рядків.

import { useEffect, useState } from 'react'
import '../../styles/TranslationTable.css'

// Перетворює внутрішній статус перекладу на зрозумілий український підпис.
function statusLabel(status) {
  const labels = {
    NEW: 'Не перекладено',
    TRANSLATED: 'Перекладено',
    REVIEWED: 'Перевірено',
    OUTDATED: 'Потребує уваги',
    NEEDS_REVISION: 'На доопрацюванні',
  }

  return labels[status] ?? status
}

// Показує один ключ, його оригінал і редагований переклад зі станом збереження.
function TranslationRow({ canEdit, translationKey, targetLocaleCode, isSelected, onSelect, onSave }) {
  const translation = translationKey.translations.find(
    (item) => item.locale.code === targetLocaleCode,
  )
  const [draft, setDraft] = useState(translation?.value ?? '')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setDraft(translation?.value ?? '')
  }, [translation?.value, targetLocaleCode])

  const hasChanges = draft !== (translation?.value ?? '')

  // Enter зберігає лише змінений текст; затвердження виконується окремо в панелі.
  async function save() {
    // Після зауваження можна повторно подати навіть незмінений коректний текст.
    if (!translation || !canEdit || isSaving || (!hasChanges && !['NEEDS_REVISION', 'OUTDATED'].includes(translation.status))) return

    setIsSaving(true)
    try {
      await onSave(translation.id, draft, 'TRANSLATED')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <tr className={isSelected ? 'selected-row' : ''} onClick={onSelect}>
      <td className="select-cell"><input aria-label={'Обрати ' + translationKey.key} checked={isSelected} onChange={onSelect} type="checkbox" /></td>
      <td><code className="key-code">{translationKey.key}</code></td>
      <td><span className="source-copy">{translationKey.sourceTexts[0]?.value}</span></td>
      <td className="translation-edit-cell">
        <input
          className="translation-input"
          aria-label={'Переклад ' + translationKey.key}
          disabled={!translation || !canEdit || isSaving}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={onSelect}
          onKeyDown={(event) => {
            // Enter під час складання символу (IME) не повинен передчасно зберігати текст.
            if (canEdit && event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void save()
            }
          }}
          placeholder={translation ? (canEdit ? 'Введи переклад' : 'Лише перегляд') : 'Спочатку додай мову'}
          value={draft}
        />
        {canEdit && (isSaving || hasChanges) && (
          <small className="translation-save-hint" role="status">
            {isSaving ? 'Зберігаємо…' : 'Не збережено · натисни Enter'}
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
}) {
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
              {translationKeys.map((translationKey) => (
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
        <span>{translationKeys.length} рядків на сторінці</span>
      </footer>
    </section>
  )
}

export default TranslationTable
