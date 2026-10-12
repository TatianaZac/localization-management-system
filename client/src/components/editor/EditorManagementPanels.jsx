import ProjectMembers from '../projects/ProjectMembers'
import PageImport from '../projects/PageImport'
import LanguageScreen from './LanguageScreen'

function EditorManagementPanels({
  activePage,
  canManageProject,
  importMode,
  isLoadingMembers,
  isSaving,
  localeCode,
  membersData,
  onAddLocale,
  onAddMember,
  onCloseImport,
  onDeleteLocale,
  onDeleteMember,
  onImport,
  onLanguageChange,
  onLocaleChange,
  onMemberLocaleChange,
  onMemberRoleChange,
  onRenameLocale,
  onToggleLocaleForm,
  project,
  selectedLocaleCode,
  showLocaleForm,
  showLocaleManager,
  showMembers,
  targetLocales,
  utilitySection
}) {
  return (
    <>
      {utilitySection && (
        <section className="utility-placeholder">
          <span aria-hidden="true">{utilitySection === 'tasks' ? '✓' : '⌁'}</span>
          <h1>{utilitySection === 'tasks' ? 'Завдання' : 'Статистика'}</h1>
          <p>Цей розділ поки порожній.</p>
        </section>
      )}
      {importMode && (
        <PageImport
          key={`${importMode}-${project.selectedPageId}`}
          page={importMode === 'version' ? activePage : null}
          keys={importMode === 'version' ? project.translationKeys : []}
          busy={isSaving}
          onImport={onImport}
          onClose={onCloseImport}
        />
      )}
      {showMembers &&
        (isLoadingMembers || !membersData ? (
          <div className="panel-loading">Завантажуємо учасників…</div>
        ) : (
          <ProjectMembers
            data={membersData}
            isSaving={isSaving}
            locales={targetLocales}
            onAdd={onAddMember}
            onDelete={onDeleteMember}
            onLocaleChange={onMemberLocaleChange}
            onRoleChange={onMemberRoleChange}
          />
        ))}
      {showLocaleManager && (
        <LanguageScreen
          canManageProject={canManageProject}
          isSaving={isSaving}
          localeCode={localeCode}
          onAddLocale={onAddLocale}
          onDeleteLocale={onDeleteLocale}
          onLanguageChange={onLanguageChange}
          onOpenLocale={onLocaleChange}
          onRenameLocale={onRenameLocale}
          onToggleForm={onToggleLocaleForm}
          pageCount={project.pages?.length ?? 0}
          project={project}
          selectedLocaleCode={selectedLocaleCode}
          showLocaleForm={showLocaleForm}
        />
      )}
    </>
  )
}

export default EditorManagementPanels
