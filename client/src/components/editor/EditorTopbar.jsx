// Верхня панель показує поточне місце в проєкті та дані активного користувача.

export default function EditorTopbar({
  activePage,
  activeSection,
  activeVersion,
  onBack,
  onLogout,
  projectName,
  roleLabel,
  showLocaleManager,
  showMembers,
  userName,
  utilitySection
}) {
  return (
    <header className="editor-topbar">
      <div className="breadcrumbs">
        <button onClick={onBack} type="button">
          Проєкти
        </button>
        <span>›</span>
        <strong>{projectName}</strong>
        <span>›</span>
        <span>
          {activePage?.name ?? 'Сторінки'}
          {activeVersion ? ` · ${activeVersion.name || `Версія ${activeVersion.number}`}` : ''}
        </span>
        {activeSection === 'glossary' && <span>› Глосарій</span>}
        {activeSection === 'merge' && <span>› Merge версій</span>}
        {utilitySection === 'tasks' && <span>› Завдання</span>}
        {utilitySection === 'statistics' && <span>› Статистика</span>}
        {showLocaleManager && <span>› Мови проєкту</span>}
        {showMembers && <span>› Учасники</span>}
      </div>
      <div className="editor-user">
        <span>{userName.slice(0, 2).toUpperCase()}</span>
        <small>
          {userName} · {roleLabel}
        </small>
        <button onClick={onLogout} type="button">
          Вийти
        </button>
      </div>
    </header>
  )
}
