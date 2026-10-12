// Це спільний список мов для додавання учасника та редагування його доступу.

import { useEffect, useRef, useState } from 'react'

export default function LocaleMultiSelect({ disabled, label, locales, onChange, selectedIds }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const selectedLocales = locales.filter((locale) => selectedIds.includes(locale.id))

  useEffect(() => {
    function closeOutside(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false)
    }

    function closeWithEscape(event) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [])

  function toggleLocale(localeId) {
    const nextIds = selectedIds.includes(localeId)
      ? selectedIds.filter((id) => id !== localeId)
      : [...selectedIds, localeId]
    onChange(nextIds)
  }

  return (
    <div className="locale-multiselect" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="locale-multiselect-trigger"
        disabled={disabled || locales.length === 0}
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <span className="locale-chip-list">
          {selectedLocales.length === 0 && (
            <span className="locale-placeholder">
              {locales.length === 0 ? 'Немає цільових мов' : label}
            </span>
          )}
          {selectedLocales.map((locale) => (
            <span className="locale-chip" key={locale.id}>
              <b>{locale.code.toUpperCase()}</b>
              {locale.name}
            </span>
          ))}
        </span>
        <span aria-hidden="true" className="locale-multiselect-arrow">
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="locale-multiselect-menu" role="listbox">
          {locales.map((locale) => (
            <label key={locale.id}>
              <input
                checked={selectedIds.includes(locale.id)}
                disabled={disabled}
                onChange={() => toggleLocale(locale.id)}
                type="checkbox"
              />
              <span className="locale-code">{locale.code.toUpperCase()}</span>
              <span>{locale.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
