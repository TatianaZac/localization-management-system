// Цей файл показує список проєктів і форму створення нового проєкту.

import { useEffect, useState } from 'react'
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from '../api/localizationApi'
import CreateProjectForm from '../components/projects/CreateProjectForm'
import EditProjectForm from '../components/projects/EditProjectForm'
import { ROLE_LABELS } from '../components/projects/ProjectMembers'
import '../styles/ProjectsPage.css'

// Завантажує проєкти та керує станами сторінки їх створення і відкриття.
function ProjectsPage({ onLogout, onOpenProject, user }) {
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    getProjects() //Запитуємо список проєктів. Можливі два результати: отримали список або сталася помилка.
      .then(setProjects) //.then — що зробити, якщо отримали список. Коли отримаєш список, передай його у setProjects
      .catch((requestError) => setError(requestError.message))
      .finally(() => setIsLoading(false))
  }, [])

  // Створює проєкт через API й після успіху відкриває його редактор.
  async function handleCreateProject(projectData) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const project = await createProject(projectData)
      // Новий проєкт одразу відкривається: кори  стувачу не треба шукати його у списку.
      onOpenProject(project.id)
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Зберігає змінені дані та оновлює відповідну картку без повторного запиту списку.
  async function handleUpdateProject(projectData) {
    if (!editingProject) return

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const updatedProject = await updateProject(editingProject.id, projectData)
      setProjects((currentProjects) => currentProjects.map((project) => (
        project.id === updatedProject.id
          ? { ...project, ...updatedProject }
          : project
      )))
      setEditingProject(null)
      setNotice('Дані проєкту оновлено.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Видаляє лише проєкт, який користувач явно підтвердив у діалоговому вікні.
  async function handleDeleteProject() {
    if (!deleteCandidate) return

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await deleteProject(deleteCandidate.id)
      setProjects((currentProjects) => currentProjects.filter(
        (project) => project.id !== deleteCandidate.id,
      ))
      if (editingProject?.id === deleteCandidate.id) setEditingProject(null)
      setDeleteCandidate(null)
      setNotice('Проєкт видалено.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="projects-home">
      <header className="home-header">
        <div className="home-brand">
          <span className="brand-symbol">L</span>
          <span>
            <strong>LocaleFlow</strong>
            <small>Localization workspace</small>
          </span>
        </div>
        <div className="home-user">
          <span className="user-chip">{user.name.slice(0, 2).toUpperCase()}</span>
          <span><strong>{user.name}</strong><small>Користувач LocaleFlow</small></span>
          <button onClick={onLogout} type="button">Вийти</button>
        </div>
      </header>

      <section className="home-content">
        <div className="home-intro">
          <p className="eyebrow">Робочий простір</p>
          <h1>Мої проєкти</h1>
          <p>Створюй локалізаційні проєкти, імпортуй оригінали та керуй перекладами.</p>
        </div>

        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}

        <div className="projects-layout">
          <section className="project-collection">
            <div className="section-heading">
              <h2>Проєкти</h2>
              <span>{projects.length}</span>
            </div>

            {isLoading ? (
              <p className="loading-copy">Завантаження проєктів…</p>
            ) : projects.length === 0 ? (
              <div className="project-empty">
                <span>＋</span>
                <h3>Ще немає проєктів</h3>
                <p>Заповни форму праворуч, щоб створити перший.</p>
              </div>
            ) : (
              <div className="project-grid">
                {projects.map((project) => (
                  <article
                    className="project-tile"
                    key={project.id}
                  >
                    <button
                      className="project-tile-main"
                      onClick={() => onOpenProject(project.id)}
                      type="button"
                    >
                      <span className="project-tile-icon">{project.name.slice(0, 1).toUpperCase()}</span>
                      <span className="project-tile-copy">
                        <strong>{project.name}</strong>
                        <small>{project.description || 'Без опису'}</small>
                        <span>{project.keyCount} ключів · {project.localeCount} мов</span>
                        <em className={'project-role ' + project.currentUserRole.toLowerCase()}>{ROLE_LABELS[project.currentUserRole]}</em>
                      </span>
                      <span className="tile-arrow">→</span>
                    </button>
                    {project.currentUserRole === 'OWNER' && <div className="project-tile-actions">
                      <button
                        aria-label={'Редагувати проєкт ' + project.name}
                        onClick={() => {
                          setEditingProject(project)
                          setError('')
                          setNotice('')
                        }}
                        title="Редагувати"
                        type="button"
                      >
                        ✎
                      </button>
                      <button
                        aria-label={'Видалити проєкт ' + project.name}
                        className="danger-icon"
                        onClick={() => setDeleteCandidate(project)}
                        title="Видалити"
                        type="button"
                      >
                        ×
                      </button>
                    </div>}
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="create-project-card">
            {editingProject ? (
              <EditProjectForm
                isSaving={isSaving}
                onCancel={() => setEditingProject(null)}
                onSave={handleUpdateProject}
                project={editingProject}
              />
            ) : (
              <CreateProjectForm isSaving={isSaving} onCreate={handleCreateProject} />
            )}
          </aside>
        </div>
      </section>

      {deleteCandidate && (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="delete-project-title" aria-modal="true" className="confirm-dialog" role="dialog">
            <span className="dialog-warning">!</span>
            <h2 id="delete-project-title">Видалити проєкт?</h2>
            <p>
              Проєкт <strong>{deleteCandidate.name}</strong>, його мови, ключі та переклади буде видалено без можливості відновлення.
            </p>
            <div className="form-actions">
              <button className="button secondary" disabled={isSaving} onClick={() => setDeleteCandidate(null)} type="button">
                Скасувати
              </button>
              <button className="button danger" disabled={isSaving} onClick={handleDeleteProject} type="button">
                {isSaving ? 'Видалення…' : 'Так, видалити'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default ProjectsPage
