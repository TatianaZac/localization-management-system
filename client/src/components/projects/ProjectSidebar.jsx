import CreateProjectForm from './CreateProjectForm'
import '../../styles/ProjectSidebar.css'

function ProjectSidebar({
  projects,
  selectedProjectId,
  isSaving,
  onSelectProject,
  onCreateProject,
}) {
  return (
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
        {projects.length === 0 && <p className="muted">Ще немає проєктів.</p>}
        {projects.map((project) => (
          <button
            className={selectedProjectId === project.id ? 'project-button active' : 'project-button'}
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            type="button"
          >
            <strong>{project.name}</strong>
            <span>{project.keyCount} ключів · {project.localeCount} мови</span>
          </button>
        ))}
      </nav>

      <CreateProjectForm isSaving={isSaving} onCreate={onCreateProject} />
    </aside>
  )
}

export default ProjectSidebar
