import { useState } from 'react'

function CreateProjectForm({ isSaving, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()

    const wasCreated = await onCreate({ name, description })

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
      <button className="button primary full-width" disabled={isSaving} type="submit">
        Створити проєкт
      </button>
    </form>
  )
}

export default CreateProjectForm
