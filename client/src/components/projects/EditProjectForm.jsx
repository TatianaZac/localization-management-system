// Цей файл містить форму зміни основних даних наявного проєкту.

import { useEffect, useState } from 'react'

// Дає змогу змінити назву й опис, залишаючи мову оригіналу незмінною.
function EditProjectForm({ isSaving, onCancel, onSave, project }) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')

  // Синхронізує поля, коли користувач обирає для редагування інший проєкт.
  useEffect(() => {
    setName(project.name)
    setDescription(project.description ?? '')
  }, [project])

  function handleSubmit(event) {
    event.preventDefault()
    onSave({ name, description })
  }

  return (
    <form className="edit-project-form" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Налаштування</p>
        <h2>Редагування проєкту</h2>
      </div>
      <label>
        Назва
        <input
          autoFocus
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>
      <label>
        Опис <span className="optional">необов’язково</span>
        <textarea
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          value={description}
        />
      </label>
      <p className="form-hint">Мова оригіналу: {project.sourceLocaleCode.toUpperCase()}</p>
      <div className="form-actions">
        <button className="button secondary" disabled={isSaving} onClick={onCancel} type="button">
          Скасувати
        </button>
        <button className="button primary" disabled={isSaving} type="submit">
          {isSaving ? 'Збереження…' : 'Зберегти зміни'}
        </button>
      </div>
    </form>
  )
}

export default EditProjectForm
