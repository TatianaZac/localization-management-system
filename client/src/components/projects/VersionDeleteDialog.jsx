import { useEffect, useRef } from 'react'

// Нативний діалог утримує фокус усередині та повертає його до кнопки після закриття.
export default function VersionDeleteDialog({ version, isLatest, busy, error, onCancel, onConfirm }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  return <dialog ref={dialog} className="version-delete-dialog" aria-labelledby="delete-version-title"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2 id="delete-version-title">Видалити «{version.name || `Версія ${version.number}`}»?</h2>
    <p>Версія зникне зі списку й буде недоступна для перегляду та експорту. Інші версії залишаться.</p>
    {isLatest && <p>Попередня версія стане останньою та відкриватиметься за замовчуванням.</p>}
    <p className="delete-version-note">Історія збережеться в базі даних, але відновлення через інтерфейс поки немає.</p>
    {error && <p role="alert" className="message error">{error}</p>}
    <div className="editor-actions">
      <button autoFocus type="button" className="button secondary" disabled={busy} onClick={onCancel}>Скасувати</button>
      <button type="button" className="button delete-version-confirm" disabled={busy} onClick={onConfirm}>{busy ? 'Видалення…' : 'Видалити версію'}</button>
    </div>
  </dialog>
}
