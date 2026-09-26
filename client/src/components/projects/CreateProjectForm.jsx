// Цей файл містить керовану React-форму для створення локалізаційного проєкту.

import { useState } from 'react'

// Збирає назву, опис і дані вихідної мови та передає їх батьківському компоненту.
function CreateProjectForm({ isSaving, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceCode, setSourceCode] = useState('en')
  const [sourceName, setSourceName] = useState('English')

  // Скасовує стандартне надсилання форми, створює проєкт і очищає успішно надіслані поля.
  async function handleSubmit(event) {
    event.preventDefault()

    const wasCreated = await onCreate({
      name,
      description,
      sourceLocale: { code: sourceCode, name: sourceName },
    })

    if (wasCreated) {
      setName('')
      setDescription('')
    }
  }

  return (
    <form className="new-project-form" onSubmit={handleSubmit}>
      <h2>Новий проєкт</h2>
      <label>
        Назва
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Наприклад, Online Shop"
          required
        />
      </label>
      <label>
        Опис <span className="optional">необов’язково</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Що локалізуємо?"
          rows={2}
        />
      </label>
      <div className="form-row">
        <label>
          Код оригіналу
          <input
            value={sourceCode}
            onChange={(event) => setSourceCode(event.target.value)}
            placeholder="en"
            required
          />
        </label>
        <label>
          Мова оригіналу
          <input
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="English"
            required
          />
        </label>
      </div>
      <button className="button primary full-width" disabled={isSaving} type="submit">
        {isSaving ? 'Створення…' : 'Створити й відкрити проєкт'}
      </button>
    </form>
  )
}

export default CreateProjectForm
