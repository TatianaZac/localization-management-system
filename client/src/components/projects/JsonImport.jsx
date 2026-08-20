import '../../styles/JsonImport.css'

function JsonImport({ isSaving, onImport, onImportError }) {
  async function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const content = JSON.parse(await file.text())
      await onImport(content)
    } catch (error) {
      onImportError(error)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <article className="card import-card">
      <p className="eyebrow">Імпорт оригіналу</p>
      <h2>Завантаж JSON-файл</h2>
      <p className="card-copy">
        Вкладені об’єкти перетворюються на ключі, наприклад
        <code> auth.login </code>. Зміни тексту створюють нову версію оригіналу.
      </p>
      <label className={isSaving ? 'file-picker disabled' : 'file-picker'}>
        <input
          accept=".json,application/json"
          disabled={isSaving}
          onChange={handleFileChange}
          type="file"
        />
        <span>Обрати JSON-файл</span>
        <small>Наприклад, examples/en.json</small>
      </label>
    </article>
  )
}

export default JsonImport
