// Цей файл показує мови проєкту та керує перейменуванням і видаленням цільових мов.

import { useEffect, useState } from 'react'

// Окремий рядок зберігає власну чернетку назви, щоб редагування мов не заважало одне одному.
function LocaleRow({ isSaving, locale, onDelete, onRename }) {
  const [name, setName] = useState(locale.name)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  useEffect(() => {
    setName(locale.name)
  }, [locale.name])

  async function handleRename() {
    const wasUpdated = await onRename(locale.id, name)
    if (!wasUpdated) setName(locale.name)
  }

  async function handleDelete() {
    const wasDeleted = await onDelete(locale.id)
    if (!wasDeleted) setIsConfirmingDelete(false)
  }

  return (
    <li className="locale-row">
      <span className="locale-code">{locale.code.toUpperCase()}</span>
      {locale.isSource ? (
        <>
          <div className="locale-copy">
            <strong>{locale.name}</strong>
            <small>Мова оригіналу</small>
          </div>
          <span className="source-badge">Оригінал</span>
        </>
      ) : (
        <>
          <label>
            Назва мови
            <input
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>
          <div className="locale-row-actions">
            {isConfirmingDelete ? (
              <>
                <button className="small-action" disabled={isSaving} onClick={() => setIsConfirmingDelete(false)} type="button">
                  Ні
                </button>
                <button className="small-action danger" disabled={isSaving} onClick={handleDelete} type="button">
                  Видалити
                </button>
              </>
            ) : (
              <>
                <button
                  className="small-action"
                  disabled={isSaving || !name.trim() || name.trim() === locale.name}
                  onClick={handleRename}
                  type="button"
                >
                  Зберегти
                </button>
                <button className="small-action danger" disabled={isSaving} onClick={() => setIsConfirmingDelete(true)} type="button">
                  Видалити
                </button>
              </>
            )}
          </div>
        </>
      )}
    </li>
  )
}

// Формує єдиний список вихідної та цільових мов проєкту.
function LocaleManager({ isSaving, locales, onClose, onDelete, onRename }) {
  return (
    <section className="locale-manager">
      <div className="locale-manager-heading">
        <div>
          <strong>Мови проєкту</strong>
          <small>Код мови залишається незмінним після створення.</small>
        </div>
        <button aria-label="Закрити керування мовами" onClick={onClose} type="button">×</button>
      </div>
      <ul>
        {locales.map((locale) => (
          <LocaleRow
            isSaving={isSaving}
            key={locale.id}
            locale={locale}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </ul>
    </section>
  )
}

export default LocaleManager
