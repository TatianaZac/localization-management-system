// Цей файл реалізує сторінку редагування мов, оригіналів і перекладів проєкту.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  deletePageVersion,
  downloadLocaleFile,
  getGlossary,
  getProject,
  importSourceFile
} from '../api/localizationApi'
import { ROLE_LABELS } from '../components/projects/ProjectMembers'
import VersionDeleteDialog from '../components/projects/VersionDeleteDialog'
import DismissibleMessage from '../components/editor/DismissibleMessage'
import EditorManagementPanels from '../components/editor/EditorManagementPanels'
import EditorTopbar from '../components/editor/EditorTopbar'
import ProjectSidebar from '../components/editor/ProjectSidebar'
import TranslationWorkspace from '../components/editor/TranslationWorkspace'
import useLocaleManagement from '../hooks/useLocaleManagement'
import useProjectMembers from '../hooks/useProjectMembers'
import useTranslationWorkflow from '../hooks/useTranslationWorkflow'
import GlossaryPage from './GlossaryPage'
import MergeVersionsPage from './MergeVersionsPage'
import '../styles/ProjectEditorPage.css'
import '../styles/Glossary.css'

// Знаходить переклад ключа для вибраного коду локалі.
function getTranslation(translationKey, localeCode) {
  return translationKey.translations.find((translation) => translation.locale.code === localeCode)
}

function localePreferenceKey(userId, projectId) {
  return `localeflow:selected-locale:${userId}:${projectId}`
}

// Координує завантаження проєкту, фільтри, імпорт, експорт і збереження перекладів.
function ProjectEditorPage({
  onBack,
  onGlossary,
  onMerge,
  onTranslations,
  onLogout,
  projectId,
  user,
  activeSection = 'translations',
  glossarySeed
}) {
  const [glossary, setGlossary] = useState([])
  const [glossaryError, setGlossaryError] = useState('')
  const [quickProposal, setQuickProposal] = useState(null)
  const [project, setProject] = useState(null)
  const [selectedLocaleCode, setSelectedLocaleCode] = useState('')
  const [selectedKeyId, setSelectedKeyId] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [utilitySection, setUtilitySection] = useState(null)
  const [notice, setNotice] = useState('')
  const [versionToDelete, setVersionToDelete] = useState(null)
  const [isDeletingVersion, setIsDeletingVersion] = useState(false)
  const [deleteVersionError, setDeleteVersionError] = useState('')
  const [error, setError] = useState('')
  const [importMode, setImportMode] = useState(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const [expandedPageId, setExpandedPageId] = useState(null)
  const [sidebarMenu, setSidebarMenu] = useState(null)
  const selectionRef = useRef({})
  const requestSequence = useRef(0)

  // Завантажує проєкт і відновлює персональний вибір мови з цього браузера.
  async function loadProject(selection = selectionRef.current) {
    const sequence = ++requestSequence.current
    const data = await getProject(projectId, selection)
    // Повільна відповідь на попередній вибір не повинна підмінити нову сторінку.
    if (sequence !== requestSequence.current) return
    selectionRef.current = { pageId: data.selectedPageId, versionId: data.selectedVersionId }
    setProject(data)

    const targetLocales = data.locales.filter((locale) => !locale.isSource)
    const rememberedCode =
      window.localStorage.getItem(localePreferenceKey(user.id, projectId)) ?? ''
    setSelectedLocaleCode((currentCode) => {
      const stillExists = targetLocales.some((locale) => locale.code === currentCode)
      const rememberedExists = targetLocales.some((locale) => locale.code === rememberedCode)
      if (stillExists) return currentCode
      if (rememberedExists) return rememberedCode
      return targetLocales[0]?.code ?? ''
    })
  }

  const {
    addLocale: handleAddLocale,
    localeCode,
    removeLocale: handleDeleteLocale,
    renameLocale: handleRenameLocale,
    selectLanguage,
    setShowLocaleForm,
    setShowLocaleManager,
    showLocaleForm,
    showLocaleManager
  } = useLocaleManagement({
    loadProject,
    projectId,
    setError,
    setIsSaving,
    setNotice,
    setProject,
    setSelectedLocaleCode
  })
  const {
    addMember: handleAddMember,
    changeMemberLocales: handleChangeMemberLocales,
    changeMemberRole: handleChangeMemberRole,
    isLoadingMembers,
    membersData,
    removeMember: handleDeleteMember,
    setShowMembers,
    showMembers,
    toggleMembers: handleToggleMembers
  } = useProjectMembers({ projectId, setError, setIsSaving, setNotice })

  useEffect(() => {
    let active = true
    // Оновлюємо підказки після повернення з іншої вкладки, де могли змінити словник.
    function refreshGlossary() {
      getGlossary(projectId)
        .then((entries) => {
          if (active) {
            setGlossary(entries)
            setGlossaryError('')
          }
        })
        .catch(() => {
          if (active) setGlossaryError('Не вдалося завантажити глосарій.')
        })
    }
    refreshGlossary()
    window.addEventListener('focus', refreshGlossary)
    return () => {
      active = false
      window.removeEventListener('focus', refreshGlossary)
    }
  }, [projectId, activeSection])

  useEffect(() => {
    setIsLoading(true)
    selectionRef.current = {}
    loadProject({})
      .catch((requestError) => setError(requestError.message))
      .finally(() => setIsLoading(false))
  }, [projectId])

  useEffect(() => {
    if (selectedLocaleCode) {
      window.localStorage.setItem(localePreferenceKey(user.id, projectId), selectedLocaleCode)
    }
  }, [projectId, selectedLocaleCode, user.id])

  // Активна сторінка розкривається як папка, а ручне згортання не скидає вибір.
  useEffect(() => {
    if (project?.selectedPageId) setExpandedPageId(project.selectedPageId)
  }, [project?.selectedPageId])

  // Меню дій поводиться як звичайне контекстне меню: закривається поза ним або через Escape.
  useEffect(() => {
    if (!sidebarMenu) return undefined

    function closeSidebarMenu(event) {
      if (!event.target?.closest?.('.sidebar-action-menu, .sidebar-more')) setSidebarMenu(null)
    }

    function closeSidebarMenuOnEscape(event) {
      if (event.key === 'Escape') setSidebarMenu(null)
    }

    document.addEventListener('pointerdown', closeSidebarMenu)
    document.addEventListener('keydown', closeSidebarMenuOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeSidebarMenu)
      document.removeEventListener('keydown', closeSidebarMenuOnEscape)
    }
  }, [sidebarMenu])

  useEffect(() => {
    // Роль могла змінитися в іншій вкладці. Після повернення одразу отримуємо актуальні права.
    function refreshProjectAccess() {
      loadProject().catch((requestError) => setError(requestError.message))
    }

    window.addEventListener('focus', refreshProjectAccess)
    return () => window.removeEventListener('focus', refreshProjectAccess)
  }, [projectId])

  const targetLocales = useMemo(
    () => project?.locales.filter((locale) => !locale.isSource) ?? [],
    [project?.locales]
  )

  // Підраховує кількість рядків у кожному статусі для активної локалі.
  const statusCounts = useMemo(() => {
    const counts = { ALL: 0, NEW: 0, TRANSLATED: 0, OUTDATED: 0, NEEDS_REVISION: 0, REVIEWED: 0 }

    for (const translationKey of project?.translationKeys ?? []) {
      const status = getTranslation(translationKey, selectedLocaleCode)?.status ?? 'NEW'
      counts.ALL += 1
      counts[status] += 1
    }

    return counts
  }, [project, selectedLocaleCode])

  // Відбирає ключі, що відповідають поточному пошуку та фільтру статусу.
  const visibleKeys = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return (project?.translationKeys ?? []).filter((translationKey) => {
      const translation = getTranslation(translationKey, selectedLocaleCode)
      const status = translation?.status ?? 'NEW'
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter
      const matchesQuery =
        !normalizedQuery ||
        [translationKey.key, translationKey.sourceTexts[0]?.value, translation?.value].some(
          (value) => value?.toLowerCase().includes(normalizedQuery)
        )

      return matchesStatus && matchesQuery
    })
  }, [project, query, selectedLocaleCode, statusFilter])

  const selectedKey =
    visibleKeys.find((item) => item.id === selectedKeyId) ?? visibleKeys[0] ?? null
  const selectedTranslation = selectedKey ? getTranslation(selectedKey, selectedLocaleCode) : null

  const {
    approveTranslation: handleApproveTranslation,
    isReviewing,
    returnTranslation: handleReturnTranslation,
    reviewReasonDraft,
    saveTranslation: handleSaveTranslation,
    setReviewReasonDraft,
    setTerminologyWarning,
    terminologyWarning
  } = useTranslationWorkflow({
    project,
    projectId,
    selectedTranslation,
    setError,
    setNotice,
    setProject
  })

  // Перемикання сторінки без versionId автоматично відкриває її останню версію.
  function clearMessages() {
    setError('')
    setNotice('')
    setTerminologyWarning('')
  }

  function openTranslations() {
    clearMessages()
    setSidebarMenu(null)
    setImportMode(null)
    setShowLocaleManager(false)
    setShowLocaleForm(false)
    setShowMembers(false)
    setUtilitySection(null)
    onTranslations()
  }

  function openUtilitySection(section) {
    openTranslations()
    setUtilitySection(section)
  }

  function openMerge(pageId = project?.selectedPageId) {
    clearMessages()
    setSidebarMenu(null)
    setImportMode(null)
    setShowLocaleManager(false)
    setShowMembers(false)
    setUtilitySection(null)
    onMerge({
      localeCode: selectedLocaleCode,
      pageId
    })
  }

  function openLocale(localeCodeToOpen) {
    clearMessages()
    setSelectedLocaleCode(localeCodeToOpen)
  }

  // Форма імпорту — окремий екран, а порівняння завжди з останньою версією сторінки.
  async function openImport(mode) {
    openTranslations()
    if (mode === 'version') {
      setIsSwitching(true)
      try {
        await loadProject({ pageId: project.selectedPageId })
      } catch (err) {
        setError(err.message)
        return
      } finally {
        setIsSwitching(false)
      }
    }
    setError('')
    setNotice('')
    setImportMode(mode)
  }

  async function selectVersion(pageId, versionId) {
    setSidebarMenu(null)
    setShowLocaleManager(false)
    setShowLocaleForm(false)
    setShowMembers(false)
    setUtilitySection(null)
    setIsSwitching(true)
    setError('')
    setNotice('')
    setImportMode(null)
    try {
      await loadProject({ pageId, versionId })
      if (activeSection === 'glossary') onTranslations()
      setSelectedKeyId(null)
      setQuery('')
      setStatusFilter('ALL')
      setQuickProposal(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSwitching(false)
    }
  }

  async function addVersionToPage(pageId) {
    setSidebarMenu(null)
    setExpandedPageId(pageId)
    if (project.selectedPageId !== pageId) await selectVersion(pageId)
    await openImport('version')
  }

  // Після підтвердження імпорту відкриваємо саме новостворений знімок.
  async function handlePageImport(content, options) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const summary = await importSourceFile(projectId, content, options)
      await loadProject({ pageId: summary.pageId, versionId: summary.versionId })
      // Після двомовного імпорту одразу показуємо мову, яку щойно завантажили.
      if (summary.importedLocaleCode) setSelectedLocaleCode(summary.importedLocaleCode)
      setImportMode(null)
      setSelectedKeyId(null)
      setQuery('')
      setStatusFilter('ALL')
      setNotice(`Створено версію «${summary.versionName || summary.versionNumber}».`)
    } catch (requestError) {
      setError('Не вдалося імпортувати файл: ' + requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Формує та завантажує JSON для поточної цільової локалі.
  async function handleExport() {
    if (!selectedLocaleCode) return

    setError('')
    try {
      const fileName = `${activePage.name.replace(/[^\p{L}\p{N}._-]/gu, '_')}-v${activeVersion.number}-${selectedLocaleCode}.json`
      await downloadLocaleFile(projectId, selectedLocaleCode, selectionRef.current, fileName)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  // Після видалення вибраного знімка переходимо на останній доступний.
  async function handleDeleteVersion() {
    setIsDeletingVersion(true)
    setDeleteVersionError('')
    try {
      const result = await deletePageVersion(projectId, versionToDelete.id)
      const selection =
        project.selectedVersionId === versionToDelete.id
          ? { pageId: result.pageId, versionId: result.versionId }
          : selectionRef.current
      selectionRef.current = selection
      setVersionToDelete(null)
      setImportMode(null)
      // Видалення вже виконано: помилка оновлення не повинна пропонувати повторний DELETE.
      try {
        await loadProject(selection)
        setNotice('Версію видалено.')
      } catch (requestError) {
        setError(
          `Версію видалено. Не вдалося оновити список: ${requestError.message}. Оновіть сторінку.`
        )
      }
    } catch (requestError) {
      setDeleteVersionError(requestError.message)
    } finally {
      setIsDeletingVersion(false)
    }
  }

  if (isLoading) {
    return <main className="editor-loading">Відкриваємо проєкт…</main>
  }

  if (!project) {
    return (
      <main className="editor-loading">
        <p>Проєкт не вдалося відкрити.</p>
        <button className="button primary" onClick={onBack} type="button">
          До проєктів
        </button>
      </main>
    )
  }

  const canManageProject = project.currentUserRole === 'OWNER'
  const activePage = project.pages?.find((page) => page.id === project.selectedPageId)
  const activeVersion = activePage?.versions.find(
    (version) => version.id === project.selectedVersionId
  )
  // Переклади кожної доступної версії підтримуються незалежно; права визначає роль.
  const canEditTranslations = project.currentUserRole === 'EDITOR' && !isSwitching
  const canReviewTranslations = project.currentUserRole === 'REVIEWER' && !isSwitching

  return (
    <main className="editor-shell">
      {versionToDelete && (
        <VersionDeleteDialog
          version={versionToDelete}
          isLatest={activePage?.versions[0]?.id === versionToDelete.id}
          busy={isDeletingVersion}
          error={deleteVersionError}
          onCancel={() => setVersionToDelete(null)}
          onConfirm={handleDeleteVersion}
        />
      )}
      <ProjectSidebar
        activeSection={activeSection}
        canManageProject={canManageProject}
        expandedPageId={expandedPageId}
        importMode={importMode}
        isDeletingVersion={isDeletingVersion}
        isSaving={isSaving}
        isSwitching={isSwitching}
        onAddVersion={addVersionToPage}
        onBack={onBack}
        onOpenGlossary={() => {
          clearMessages()
          setSidebarMenu(null)
          setImportMode(null)
          setShowLocaleManager(false)
          setShowMembers(false)
          setUtilitySection(null)
          onGlossary()
        }}
        onOpenImport={openImport}
        onOpenLocales={() => {
          openTranslations()
          setShowLocaleManager(true)
        }}
        onOpenMerge={openMerge}
        onOpenMembers={() => {
          openTranslations()
          if (!showMembers) handleToggleMembers()
          else setShowMembers(true)
        }}
        onOpenTranslations={openTranslations}
        onOpenUtility={openUtilitySection}
        onRequestDeleteVersion={(version) => {
          setSidebarMenu(null)
          setDeleteVersionError('')
          setVersionToDelete(version)
        }}
        onSelectVersion={selectVersion}
        onSetExpandedPageId={setExpandedPageId}
        onSetSidebarMenu={setSidebarMenu}
        project={project}
        selectedLocaleCode={selectedLocaleCode}
        showLocaleManager={showLocaleManager}
        showMembers={showMembers}
        sidebarMenu={sidebarMenu}
        utilitySection={utilitySection}
      />

      <section className="editor-workspace">
        <EditorTopbar
          activePage={activePage}
          activeSection={activeSection}
          activeVersion={activeVersion}
          onBack={onBack}
          onLogout={onLogout}
          projectName={project.name}
          roleLabel={ROLE_LABELS[project.currentUserRole]}
          showLocaleManager={showLocaleManager}
          showMembers={showMembers}
          userName={user.name}
          utilitySection={utilitySection}
        />

        {activeSection === 'glossary' && (
          <GlossaryPage
            activeLocaleCode={selectedLocaleCode}
            onLocaleChange={openLocale}
            projectId={projectId}
            project={project}
            seed={glossarySeed}
          />
        )}
        {activeSection === 'merge' && (
          <MergeVersionsPage
            localeCode={selectedLocaleCode}
            onBack={openTranslations}
            page={activePage}
            project={project}
            projectId={projectId}
            projectName={project.name}
          />
        )}
        {/* Приховуємо редактор без демонтажу: введені переклади й вибрана версія залишаються на місці. */}
        <div className="editor-content" hidden={activeSection !== 'translations'}>
          {error && (
            <DismissibleMessage className="error" onClose={() => setError('')} role="alert">
              {error}
            </DismissibleMessage>
          )}
          {notice && (showMembers || showLocaleManager || importMode) && (
            <DismissibleMessage className="success" onClose={() => setNotice('')} role="status">
              {notice}
            </DismissibleMessage>
          )}
          {terminologyWarning && (
            <DismissibleMessage
              className="terminology-warning"
              onClose={() => setTerminologyWarning('')}
              role="alert"
            >
              {terminologyWarning}
            </DismissibleMessage>
          )}
          {isSwitching && (
            <span className="visually-hidden" role="status">
              Завантажуємо версію…
            </span>
          )}
          <EditorManagementPanels
            activePage={activePage}
            canManageProject={canManageProject}
            importMode={importMode}
            isLoadingMembers={isLoadingMembers}
            isSaving={isSaving}
            localeCode={localeCode}
            membersData={membersData}
            onAddLocale={handleAddLocale}
            onAddMember={handleAddMember}
            onCloseImport={() => setImportMode(null)}
            onDeleteLocale={handleDeleteLocale}
            onDeleteMember={handleDeleteMember}
            onImport={handlePageImport}
            onLanguageChange={selectLanguage}
            onLocaleChange={openLocale}
            onMemberLocaleChange={handleChangeMemberLocales}
            onMemberRoleChange={handleChangeMemberRole}
            onRenameLocale={handleRenameLocale}
            onToggleLocaleForm={() => setShowLocaleForm((value) => !value)}
            project={project}
            selectedLocaleCode={selectedLocaleCode}
            showLocaleForm={showLocaleForm}
            showLocaleManager={showLocaleManager}
            showMembers={showMembers}
            targetLocales={targetLocales}
            utilitySection={utilitySection}
          />

          <div hidden={Boolean(importMode || showLocaleManager || showMembers || utilitySection)}>
            <TranslationWorkspace
              activePage={activePage}
              activeVersion={activeVersion}
              canEditTranslations={canEditTranslations}
              canReviewTranslations={canReviewTranslations}
              glossary={glossary}
              glossaryError={glossaryError}
              isReviewing={isReviewing}
              isSwitching={isSwitching}
              onApproveTranslation={handleApproveTranslation}
              onExport={handleExport}
              onGlossary={onGlossary}
              onLocaleChange={openLocale}
              onProposalClose={() => setQuickProposal(null)}
              onProposalSaved={(entry) => {
                setGlossary((current) => [entry, ...current])
                setQuickProposal(null)
              }}
              onQueryChange={setQuery}
              onReturnTranslation={handleReturnTranslation}
              onReviewReasonChange={setReviewReasonDraft}
              onSaveTranslation={handleSaveTranslation}
              onSelectKey={setSelectedKeyId}
              onStartProposal={setQuickProposal}
              onStatusFilterChange={setStatusFilter}
              project={project}
              projectId={projectId}
              query={query}
              quickProposal={quickProposal}
              reviewReasonDraft={reviewReasonDraft}
              selectedKey={selectedKey}
              selectedLocaleCode={selectedLocaleCode}
              selectedTranslation={selectedTranslation}
              statusCounts={statusCounts}
              statusFilter={statusFilter}
              targetLocales={targetLocales}
              visibleKeys={visibleKeys}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

export default ProjectEditorPage
