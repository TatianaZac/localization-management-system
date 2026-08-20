import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import './App.css'

type Locale = {
  id: number
  code: string
  name: string
  isSource: boolean
}

type Translation = {
  id: number
  value: string | null
  status: 'NEW' | 'TRANSLATED' | 'REVIEWED' | 'OUTDATED'
  sourceVersion: number | null
  locale: Pick<Locale, 'code' | 'name'>
}

type SourceText = {
  id: number
  value: string
  version: number
}

type TranslationKey = {
  id: number
  key: string
  sourceTexts: SourceText[]
  translations: Translation[]
}

type ProjectSummary = {
  id: number
  name: string
  description: string | null
  sourceLocaleCode: string
  createdAt: string
  updatedAt: string
  localeCount: number
  keyCount: number
}

type Project = Omit<ProjectSummary, 'localeCount' | 'keyCount'> & {
  locales: Locale[]
  translationKeys: TranslationKey[]
}

type ImportSummary = {
  total: number
  created: number
  updated: number
  unchanged: number
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? 'The request could not be completed')
  }

  return body as T
}

function statusLabel(status: Translation['status']) {
  const labels = {
    NEW: 'Новий',
    TRANSLATED: 'Перекладено',
    REVIEWED: 'Перевірено',
    OUTDATED: 'Застаріло',
  }

  return labels[status]
}

function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [newLocaleCode, setNewLocaleCode] = useState('uk')
  const [newLocaleName, setNewLocaleName] = useState('Українська')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function loadProjects() {
    const data = await request<ProjectSummary[]>('/projects')
    setProjects(data)
  }

  async function loadProject(projectId: number) {
    const data = await request<Project>('/projects/' + projectId)
    setSelectedProject(data)
  }

  useEffect(() => {
    void loadProjects().catch((requestError: Error) => setError(requestError.message))
  }, [])

  async function selectProject(projectId: number) {
    setError('')
    setNotice('')

    try {
      await loadProject(projectId)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося відкрити проєкт')
    }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const project = await request<{ id: number }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: newProjectName,
          description: newProjectDescription,
          sourceLocale: {
            code: 'en',
            name: 'English',
          },
        }),
      })

      setNewProjectName('')
      setNewProjectDescription('')
      await loadProject(project.id)
      await loadProjects()
      setNotice('Проєкт створено. Тепер додай мову перекладу та імпортуй файл.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося створити проєкт')
    } finally {
      setIsSaving(false)
    }
  }

  async function addLocale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProject) {
      return
    }

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await request<Locale>('/projects/' + selectedProject.id + '/locales', {
        method: 'POST',
        body: JSON.stringify({
          code: newLocaleCode,
          name: newLocaleName,
        }),
      })

      await loadProject(selectedProject.id)
      await loadProjects()
      setNotice('Мову перекладу додано.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не вдалося додати мову')
    } finally {
      setIsSaving(false)
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file || !selectedProject) {
      return
    }

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const content = JSON.parse(await file.text())
      const summary = await request<ImportSummary>('/projects/' + selectedProject.id + '/import', {
        method: 'POST',
        body: JSON.stringify({ content }),
      })

      await loadProject(selectedProject.id)
      await loadProjects()
      setNotice(
        'Імпорт завершено: нових ключів — ' + summary.created +
        ', оновлених — ' + summary.updated +
        ', без змін — ' + summary.unchanged + '.',
      )
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Не вдалося імпортувати файл'
      setError('Імпорт не виконано: ' + message)
    } finally {
      event.target.value = ''
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">L</span>
          <div>
            <strong>LocaleFlow</strong>
            <span>Localization workspace</span>
          </div>
        </div>

        <div className="sidebar-heading">
          <span>Проєкти</span>
          <span className="project-total">{projects.length}</span>
        </div>

        <nav className="project-list" aria-label="Проєкти">
          {projects.length === 0 && (
            <p className="muted">Ще немає проєктів.</p>
          )}
          {projects.map((project) => (
            <button
              className={selectedProject?.id === project.id ? 'project-button active' : 'project-button'}
              key={project.id}
              onClick={() => void selectProject(project.id)}
              type="button"
            >
              <strong>{project.name}</strong>
              <span>{project.keyCount} ключів · {project.localeCount} мови</span>
            </button>
          ))}
        </nav>

        <form className="new-project-form" onSubmit={createProject}>
          <h2>Новий проєкт</h2>
          <label>
            Назва
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Наприклад, Online Shop"
              required
            />
          </label>
          <label>
            Опис <span className="optional">необов’язково</span>
            <textarea
              value={newProjectDescription}
              onChange={(event) => setNewProjectDescription(event.target.value)}
              placeholder="Що локалізуємо?"
              rows={2}
            />
          </label>
          <button className="button primary full-width" disabled={isSaving} type="submit">
            Створити проєкт
          </button>
        </form>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Інформаційна система локалізації</p>
            <h1>{selectedProject ? selectedProject.name : 'Почнімо з проєкту'}</h1>
            <p className="subtitle">
              {selectedProject?.description ?? 'Створи проєкт, додай мову перекладу та імпортуй JSON-файл.'}
            </p>
          </div>
          {selectedProject && (
            <span className="project-id">Проєкт #{selectedProject.id}</span>
          )}
        </header>

        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success">{notice}</div>}

        {!selectedProject ? (
          <section className="empty-state">
            <div className="empty-icon">1</div>
            <h2>Створи перший локалізаційний проєкт</h2>
            <p>
              Англійська мова створиться автоматично як джерело. Потім можна додати українську
              та завантажити приклад <code>en.json</code>.
            </p>
          </section>
        ) : (
          <>
            <section className="dashboard-grid">
              <article className="card">
                <div className="card-heading">
                  <div>
                    <p className="eyebrow">Мови</p>
                    <h2>Локалі проєкту</h2>
                  </div>
                  <span className="count-badge">{selectedProject.locales.length}</span>
                </div>

                <div className="locale-list">
                  {selectedProject.locales.map((locale) => (
                    <div className="locale-row" key={locale.id}>
                      <span className="locale-code">{locale.code}</span>
                      <span>{locale.name}</span>
                      {locale.isSource && <span className="source-badge">оригінал</span>}
                    </div>
                  ))}
                </div>

                <form className="inline-form" onSubmit={addLocale}>
                  <input
                    aria-label="Код мови"
                    value={newLocaleCode}
                    onChange={(event) => setNewLocaleCode(event.target.value)}
                    placeholder="uk"
                    required
                  />
                  <input
                    aria-label="Назва мови"
                    value={newLocaleName}
                    onChange={(event) => setNewLocaleName(event.target.value)}
                    placeholder="Українська"
                    required
                  />
                  <button className="button secondary" disabled={isSaving} type="submit">
                    Додати
                  </button>
                </form>
              </article>

              <article className="card import-card">
                <p className="eyebrow">Імпорт оригіналу</p>
                <h2>Завантаж JSON-файл</h2>
                <p className="card-copy">
                  Вкладені об’єкти перетворюються на ключі, наприклад
                  <code> auth.login </code>. Зміни тексту створюють нову версію оригіналу.
                </p>
                <label className={isSaving ? 'file-picker disabled' : 'file-picker'}>
                  <input accept=".json,application/json" disabled={isSaving} onChange={importFile} type="file" />
                  <span>Обрати JSON-файл</span>
                  <small>Наприклад, examples/en.json</small>
                </label>
              </article>

              <article className="card metric-card">
                <p className="eyebrow">Вміст</p>
                <strong className="metric">{selectedProject.translationKeys.length}</strong>
                <span>локалізаційних ключів</span>
              </article>
            </section>

            <section className="table-card">
              <div className="table-heading">
                <div>
                  <p className="eyebrow">Поточна версія</p>
                  <h2>Рядки локалізації</h2>
                </div>
                <span>{selectedProject.translationKeys.length} ключів</span>
              </div>

              {selectedProject.translationKeys.length === 0 ? (
                <p className="empty-table">Імпортуй англомовний JSON, щоб побачити ключі тут.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Ключ</th>
                        <th>Оригінал</th>
                        <th>Переклади</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProject.translationKeys.map((translationKey) => (
                        <tr key={translationKey.id}>
                          <td><code>{translationKey.key}</code></td>
                          <td>
                            <span>{translationKey.sourceTexts[0]?.value}</span>
                            <small>Версія {translationKey.sourceTexts[0]?.version}</small>
                          </td>
                          <td>
                            {translationKey.translations.map((translation) => (
                              <div className="translation-row" key={translation.id}>
                                <span className="locale-code">{translation.locale.code}</span>
                                <span>{translation.value ?? 'Ще не перекладено'}</span>
                                <span className={'status ' + translation.status.toLowerCase()}>
                                  {statusLabel(translation.status)}
                                </span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}

export default App
