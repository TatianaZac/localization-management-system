import { useEffect, useState } from 'react'
import {
  createLocale,
  createProject,
  getProject,
  getProjects,
  importSourceFile,
} from '../api/localizationApi'
import JsonImport from '../components/projects/JsonImport'
import LocalePanel from '../components/projects/LocalePanel'
import ProjectSidebar from '../components/projects/ProjectSidebar'
import TranslationTable from '../components/projects/TranslationTable'
import '../styles/ProjectsPage.css'

function getErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage
}

function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function loadProjects() {
    const data = await getProjects()
    setProjects(data)
  }

  async function loadProject(projectId) {
    const data = await getProject(projectId)
    setSelectedProject(data)
  }

  useEffect(() => {
    void loadProjects().catch((requestError) => {
      setError(getErrorMessage(requestError, 'Не вдалося завантажити проєкти'))
    })
  }, [])

  async function selectProject(projectId) {
    setError('')
    setNotice('')

    try {
      await loadProject(projectId)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Не вдалося відкрити проєкт'))
    }
  }

  async function handleCreateProject({ name, description }) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const project = await createProject({
        name,
        description,
        sourceLocale: { code: 'en', name: 'English' },
      })

      await loadProject(project.id)
      await loadProjects()
      setNotice('Проєкт створено. Тепер додай мову перекладу та імпортуй файл.')
      return true
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Не вдалося створити проєкт'))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddLocale(locale) {
    if (!selectedProject) {
      return false
    }

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await createLocale(selectedProject.id, locale)
      await loadProject(selectedProject.id)
      await loadProjects()
      setNotice('Мову перекладу додано.')
      return true
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Не вдалося додати мову'))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleImport(content) {
    if (!selectedProject) {
      return
    }

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const summary = await importSourceFile(selectedProject.id, content)
      await loadProject(selectedProject.id)
      await loadProjects()
      setNotice(
        'Імпорт завершено: нових ключів — ' + summary.created +
        ', оновлених — ' + summary.updated +
        ', без змін — ' + summary.unchanged + '.',
      )
    } catch (requestError) {
      setError('Імпорт не виконано: ' + getErrorMessage(requestError, 'Невідома помилка'))
    } finally {
      setIsSaving(false)
    }
  }

  function handleImportError(importError) {
    setNotice('')
    setError('Імпорт не виконано: ' + getErrorMessage(importError, 'Файл має бути коректним JSON'))
  }

  return (
    <main className="app-shell">
      <ProjectSidebar
        isSaving={isSaving}
        onCreateProject={handleCreateProject}
        onSelectProject={selectProject}
        projects={projects}
        selectedProjectId={selectedProject?.id}
      />

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Інформаційна система локалізації</p>
            <h1>{selectedProject ? selectedProject.name : 'Почнімо з проєкту'}</h1>
            <p className="subtitle">
              {selectedProject?.description ?? 'Створи проєкт, додай мову перекладу та імпортуй JSON-файл.'}
            </p>
          </div>
          {selectedProject && <span className="project-id">Проєкт #{selectedProject.id}</span>}
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
              <LocalePanel
                isSaving={isSaving}
                locales={selectedProject.locales}
                onAddLocale={handleAddLocale}
              />
              <JsonImport
                isSaving={isSaving}
                onImport={handleImport}
                onImportError={handleImportError}
              />
              <article className="card metric-card">
                <p className="eyebrow">Вміст</p>
                <strong className="metric">{selectedProject.translationKeys.length}</strong>
                <span>локалізаційних ключів</span>
              </article>
            </section>

            <TranslationTable translationKeys={selectedProject.translationKeys} />
          </>
        )}
      </section>
    </main>
  )
}

export default ProjectsPage
