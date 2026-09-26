import { useState } from 'react'

// Попередній перегляд нічого не зберігає: нова версія виникає лише після підтвердження.
export default function PageImport({ page, keys, busy, onImport, onClose }) {
  const [name, setName] = useState('')
  const [versionName, setVersionName] = useState('')
  const [file, setFile] = useState(null)
  const [changes, setChanges] = useState([])
  const [error, setError] = useState('')

  async function readFile(event) {
    const selected = event.target.files?.[0]
    setFile(null); setChanges([]); setError('')
    if (!selected) return
    try {
      const content = JSON.parse(await selected.text())
      const entries = new Map()
      // Ті самі крапкові шляхи, що на сервері; сервер повторно перевіряє весь файл.
      function visit(value, prefix = '') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Очікується JSON-об’єкт')
        for (const [key, child] of Object.entries(value)) {
          const path = prefix ? `${prefix}.${key}` : key
          if (typeof child === 'string' && child.trim()) {
            if (entries.has(path)) throw new Error('Неоднозначний ключ: ' + path)
            entries.set(path, child)
          } else if (child && typeof child === 'object' && !Array.isArray(child)) visit(child, path)
          else throw new Error('Очікується непорожній текст: ' + path)
        }
      }
      visit(content)
      if (!entries.size) throw new Error('Файл порожній')
      const old = new Map(keys.map(k => [k.key, k.sourceTexts[0]?.value]))
      const diff = [...entries].map(([key, value]) => ({ key, value, before: old.get(key),
        type: !old.has(key) ? 'Новий' : old.get(key) === value ? 'Без змін' : 'Змінений' }))
      for (const [key, before] of old) if (!entries.has(key)) diff.push({ key, before, type: 'Видалений' })
      setChanges(diff); setFile({ content, fileName: selected.name })
    } catch (err) { setError(err.message) }
  }

  return <section className="page-import" aria-label="Імпорт версії">
    <header className="import-heading"><span className="import-file-icon" aria-hidden="true">{'{ }'}</span><div><p className="eyebrow">{page?.name ?? 'Сторінки проєкту'}</p><h1>{page ? 'Нова версія' : 'Нова сторінка'}</h1></div></header>
    <div className="import-fields">
    {!page && <label>Назва сторінки<input value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder="Наприклад, Акаунт" disabled={busy} /></label>}
    <label>Назва версії<input value={versionName} maxLength={100} onChange={e => setVersionName(e.target.value)} placeholder="Наприклад, Оновлення профілю або Release 2.4" disabled={busy} required /></label>
    </div>
    <label className="import-upload"><span className="import-upload-title">{file ? file.fileName : 'Оберіть файл оригіналу'}</span><span className="import-upload-hint">JSON · {file ? 'Натисніть, щоб замінити файл' : 'Натисніть, щоб вибрати файл'}</span><input aria-label="Файл оригіналу JSON" type="file" accept=".json,application/json" onChange={readFile} disabled={busy} /></label>
    {error && <p role="alert">{error}</p>}
    {file && <>
      <div className="import-stats">{['Новий', 'Змінений', 'Видалений', 'Без змін'].map((type, index) => <div className={'import-stat stat-' + index} key={type}><strong>{changes.filter(c => c.type === type).length}</strong><span>{['Нових', 'Змінених', 'Видалених', 'Без змін'][index]}</span></div>)}</div>
      <div className="import-diff"><table><thead><tr><th>Ключ</th><th>Зміна</th><th>Було</th><th>Буде</th></tr></thead>
        <tbody>{changes.filter(c => c.type !== 'Без змін').map(c => <tr key={c.key}><td>{c.key}</td><td>{c.type}</td><td>{c.before ?? '—'}</td><td>{c.value ?? '—'}</td></tr>)}</tbody></table></div>
      <p>Попередня версія збережеться. Змінені переклади потребуватимуть перевірки.</p>
    </>}
    <div className="editor-actions">
      <button className="button secondary" onClick={onClose} disabled={busy}>Скасувати</button>
      <button className="button primary" disabled={busy || !file || !versionName.trim() || (!page && !name.trim())}
        onClick={() => onImport(file.content, { fileName: file.fileName, versionName: versionName.trim(), ...(page ? { pageId: page.id } : { pageName: name.trim() }) })}>
        {busy ? 'Створюємо…' : 'Створити версію'}
      </button>
    </div>
  </section>
}
