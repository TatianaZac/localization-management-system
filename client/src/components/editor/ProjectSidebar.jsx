// Ліва панель відповідає лише за навігацію між розділами, сторінками та їхніми версіями.

import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronRight,
  Ellipsis,
  FileText,
  Folder,
  FolderOpen,
  GitMerge,
  Languages,
  ListChecks,
  Plus,
  Rows3,
  Trash2,
  UsersRound
} from 'lucide-react'

export default function ProjectSidebar({
  activeSection,
  canManageProject,
  expandedPageId,
  importMode,
  isDeletingVersion,
  isSaving,
  isSwitching,
  onAddVersion,
  onBack,
  onOpenGlossary,
  onOpenImport,
  onOpenLocales,
  onOpenMerge,
  onOpenMembers,
  onOpenTranslations,
  onOpenUtility,
  onRequestDeleteVersion,
  onSelectVersion,
  onSetExpandedPageId,
  onSetSidebarMenu,
  project,
  selectedLocaleCode,
  showLocaleManager,
  showMembers,
  sidebarMenu,
  utilitySection
}) {
  return (
    <aside className="editor-sidebar">
      <div className="editor-brand">
        <span>L</span>
        <strong>LocaleFlow</strong>
      </div>
      <button className="sidebar-back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={16} />
        Мої проєкти
      </button>
      <nav className="sidebar-main-nav">
        <button
          className={
            activeSection === 'translations' &&
            !importMode &&
            !showLocaleManager &&
            !showMembers &&
            !utilitySection
              ? 'active'
              : ''
          }
          onClick={onOpenTranslations}
          type="button"
        >
          <Rows3 aria-hidden="true" size={17} />
          Рядки локалізації
        </button>
        <button
          className={activeSection === 'merge' ? 'active' : ''}
          onClick={() => onOpenMerge()}
          type="button"
        >
          <GitMerge aria-hidden="true" size={17} />
          Merge версій
        </button>
        <button
          className={activeSection === 'glossary' ? 'active' : ''}
          onClick={onOpenGlossary}
          type="button"
        >
          <BookOpen aria-hidden="true" size={17} />
          Глосарій
        </button>
        <button
          className={showLocaleManager && activeSection !== 'glossary' ? 'active' : ''}
          onClick={onOpenLocales}
          type="button"
        >
          <Languages aria-hidden="true" size={17} />
          Мови проєкту
        </button>
        {canManageProject && (
          <button
            className={showMembers && activeSection !== 'glossary' ? 'active' : ''}
            onClick={onOpenMembers}
            type="button"
          >
            <UsersRound aria-hidden="true" size={17} />
            Учасники
          </button>
        )}
        <button
          className={utilitySection === 'tasks' ? 'active' : ''}
          onClick={() => onOpenUtility('tasks')}
          type="button"
        >
          <ListChecks aria-hidden="true" size={17} />
          Завдання
        </button>
        <button
          className={utilitySection === 'statistics' ? 'active' : ''}
          onClick={() => onOpenUtility('statistics')}
          type="button"
        >
          <BarChart3 aria-hidden="true" size={17} />
          Статистика
        </button>
      </nav>
      <section className="sidebar-section localization-tree" aria-label="Сторінки та версії">
        <div className="sidebar-section-heading">
          <h2>
            Файли локалізації{' '}
            {selectedLocaleCode && (
              <span className="sidebar-locale-chip">{selectedLocaleCode.toUpperCase()}</span>
            )}
          </h2>
        </div>
        <nav className="page-tree">
          {project.pages?.map((page) => {
            const expanded = expandedPageId === page.id
            const active = page.id === project.selectedPageId
            return (
              <div className="page-tree-node" key={page.id}>
                <div className={'page-folder-row' + (active ? ' active' : '')}>
                  <button
                    className={'page-folder-toggle' + (expanded ? ' expanded' : '')}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'} ${page.name}`}
                    disabled={isSwitching || isSaving}
                    onClick={() => {
                      if (expanded) onSetExpandedPageId(null)
                      else {
                        onSetExpandedPageId(page.id)
                        if (!active) void onSelectVersion(page.id)
                      }
                    }}
                    type="button"
                  >
                    <ChevronRight aria-hidden="true" size={16} />
                  </button>
                  <button
                    className="page-folder-main"
                    aria-pressed={active}
                    disabled={isSwitching || isSaving}
                    onClick={() => {
                      onSetSidebarMenu(null)
                      onSetExpandedPageId(page.id)
                      if (!active) void onSelectVersion(page.id)
                    }}
                    type="button"
                  >
                    {expanded ? (
                      <FolderOpen aria-hidden="true" size={16} strokeWidth={1.7} />
                    ) : (
                      <Folder aria-hidden="true" size={16} strokeWidth={1.7} />
                    )}
                    <span>{page.name}</span>
                    <em>{page.versions.length}</em>
                  </button>
                  {canManageProject && (
                    <button
                      aria-label={`Дії сторінки ${page.name}`}
                      className="sidebar-more"
                      onClick={() =>
                        onSetSidebarMenu((current) =>
                          current?.type === 'page' && current.id === page.id
                            ? null
                            : { type: 'page', id: page.id }
                        )
                      }
                      title="Дії"
                      type="button"
                    >
                      <Ellipsis aria-hidden="true" size={17} />
                    </button>
                  )}
                </div>
                {sidebarMenu?.type === 'page' && sidebarMenu.id === page.id && (
                  <div className="sidebar-action-menu page-actions">
                    <button
                      onClick={() => {
                        onSetExpandedPageId(page.id)
                        if (!active) void onSelectVersion(page.id)
                        else onSetSidebarMenu(null)
                      }}
                      type="button"
                    >
                      <FolderOpen aria-hidden="true" size={15} />
                      Відкрити сторінку
                    </button>
                    <button onClick={() => void onAddVersion(page.id)} type="button">
                      <Plus aria-hidden="true" size={15} />
                      Додати версію
                    </button>
                    <button
                      disabled={page.versions.length < 2 || isSaving || isSwitching}
                      onClick={() => onOpenMerge(page.id)}
                      type="button"
                    >
                      <GitMerge aria-hidden="true" size={15} />
                      Об’єднати версії
                    </button>
                  </div>
                )}
                {expanded && (
                  <div className="page-version-tree">
                    {page.versions.map((version) => {
                      const isCurrentVersion = version.id === project.selectedVersionId
                      return (
                        <div
                          className={'sidebar-version-row' + (isCurrentVersion ? ' active' : '')}
                          key={version.id}
                        >
                          <button
                            type="button"
                            aria-pressed={isCurrentVersion}
                            disabled={isSwitching || isSaving}
                            onClick={() => onSelectVersion(page.id, version.id)}
                          >
                            <FileText
                              aria-hidden="true"
                              className="version-file-icon"
                              size={15}
                              strokeWidth={1.7}
                            />
                            <span>{version.name || `v${version.number}`}</span>
                          </button>
                          {canManageProject && (
                            <button
                              type="button"
                              className="sidebar-more version-more"
                              aria-label={`Дії ${version.name || `версії ${version.number}`}`}
                              disabled={isSwitching || isSaving || isDeletingVersion}
                              onClick={() =>
                                onSetSidebarMenu((current) =>
                                  current?.type === 'version' && current.id === version.id
                                    ? null
                                    : { type: 'version', id: version.id }
                                )
                              }
                            >
                              <Ellipsis aria-hidden="true" size={16} />
                            </button>
                          )}
                          {sidebarMenu?.type === 'version' && sidebarMenu.id === version.id && (
                            <div className="sidebar-action-menu version-actions">
                              <button
                                onClick={() => onSelectVersion(page.id, version.id)}
                                type="button"
                              >
                                <FileText aria-hidden="true" size={15} />
                                Відкрити версію
                              </button>
                              <button onClick={() => void onAddVersion(page.id)} type="button">
                                <Plus aria-hidden="true" size={15} />
                                Додати нову версію
                              </button>
                              <button
                                className="danger"
                                disabled={page.versions.length === 1}
                                onClick={() => onRequestDeleteVersion(version)}
                                type="button"
                              >
                                <Trash2 aria-hidden="true" size={15} />
                                Видалити
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {canManageProject && (
                      <button
                        className="tree-add-version"
                        disabled={isSaving || isSwitching}
                        onClick={() => onOpenImport('version')}
                        type="button"
                      >
                        <Plus aria-hidden="true" size={14} />
                        Додати версію
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        {!project.pages?.length && <small>Сторінок ще немає</small>}
        {canManageProject && (
          <button
            className="sidebar-add"
            disabled={isSaving || isSwitching}
            onClick={() => onOpenImport('new')}
            type="button"
          >
            <Plus aria-hidden="true" size={15} />
            Додати сторінку
          </button>
        )}
      </section>
      <div className="sidebar-project">
        <small>Поточний проєкт</small>
        <strong>{project.name}</strong>
        <span>{project.translationKeys.length} ключів</span>
      </div>
    </aside>
  )
}
