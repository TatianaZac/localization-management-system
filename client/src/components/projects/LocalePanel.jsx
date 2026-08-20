import { useState } from 'react'
import '../../styles/LocalePanel.css'

function LocalePanel({ locales, isSaving, onAddLocale }) {
  const [code, setCode] = useState('uk')
  const [name, setName] = useState('Українська')

  async function handleSubmit(event) {
    event.preventDefault()

    const wasAdded = await onAddLocale({ code, name })

    if (wasAdded) {
      setCode('')
      setName('')
    }
  }

  return (
    <article className="card locale-panel">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Мови</p>
          <h2>Локалі проєкту</h2>
        </div>
        <span className="count-badge">{locales.length}</span>
      </div>

      <div className="locale-list">
        {locales.map((locale) => (
          <div className="locale-row" key={locale.id}>
            <span className="locale-code">{locale.code}</span>
            <span>{locale.name}</span>
            {locale.isSource && <span className="source-badge">оригінал</span>}
          </div>
        ))}
      </div>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          aria-label="Код мови"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="uk"
          required
        />
        <input
          aria-label="Назва мови"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Українська"
          required
        />
        <button className="button secondary" disabled={isSaving} type="submit">
          Додати
        </button>
      </form>
    </article>
  )
}

export default LocalePanel
