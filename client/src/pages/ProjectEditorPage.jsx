// Цей файл реалізує сторінку редагування мов, оригіналів і перекладів проєкту.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addProjectMember,
  createLocale,
  deleteLocale,
  deletePageVersion,
  deleteProjectMember,
  downloadLocaleFile,
  getProject,
  getGlossary,
  getProjectMembers,
  importSourceFile,
  updateLocale,
  updateProjectMember,
  updateTranslation,
  updateTranslationComment,
} from '../api/localizationApi'
import LocaleManager from '../components/projects/LocaleManager'
import ProjectMembers, { ROLE_LABELS } from '../components/projects/ProjectMembers'
import TranslationTable from '../components/projects/TranslationTable'
import GlossaryProposal from '../components/projects/GlossaryProposal'
import PageImport from '../components/projects/PageImport'
import VersionDeleteDialog from '../components/projects/VersionDeleteDialog'
import GlossaryPage from './GlossaryPage'
import '../styles/ProjectEditorPage.css'
import '../styles/Glossary.css'
import { matchesGlossaryTerm } from '../utils/glossary'

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Усі рядки' },
  { value: 'NEW', label: 'Не перекладено' },
  { value: 'TRANSLATED', label: 'Перекладено' },
  { value: 'OUTDATED', label: 'Потребує уваги' },
  { value: 'NEEDS_REVISION', label: 'На доопрацюванні' },
  { value: 'REVIEWED', label: 'Перевірено' },
]

// Знаходить переклад ключа для вибраного коду локалі.
function getTranslation(translationKey, localeCode) {
  return translationKey.translations.find(
    (translation) => translation.locale.code === localeCode,
  )
}

// Форматує дату для компактного показу в інформаційній панелі.
function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

// Назва дії залежить від збереженого статусу, а не від поточного стану перекладу.
function historyAction(status) {
  return ({ TRANSLATED: 'Збережено переклад', REVIEWED: 'Затверджено',
    NEEDS_REVISION: 'Повернуто на доопрацювання', NEW: 'Очищено переклад' })[status] ?? status
}

// Координує завантаження проєкту, фільтри, імпорт, експорт і збереження перекладів.
function ProjectEditorPage({ onBack, onGlossary, onTranslations, onLogout, projectId, user, activeSection = 'translations', glossarySeed }) {
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
  const [showLocaleForm, setShowLocaleForm] = useState(false)
  const [showLocaleManager, setShowLocaleManager] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [membersData, setMembersData] = useState(null)
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [localeCode, setLocaleCode] = useState('uk')
  const [localeName, setLocaleName] = useState('Українська')
  const [notice, setNotice] = useState('')
  const [versionToDelete, setVersionToDelete] = useState(null)
  const [isDeletingVersion, setIsDeletingVersion] = useState(false)
  const [deleteVersionError, setDeleteVersionError] = useState('')
  const [error, setError] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [isSavingComment, setIsSavingComment] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewReasonDraft, setReviewReasonDraft] = useState('')
  const [importMode, setImportMode] = useState(null)
  const [isSwitching, setIsSwitching] = useState(false)
  const selectionRef = useRef({})
  const requestSequence = useRef(0)

  // Завантажує проєкт і зберігає або обирає першу доступну цільову локаль.
  async function loadProject(selection = selectionRef.current) {
    const sequence = ++requestSequence.current
    const data = await getProject(projectId, selection)
    // Повільна відповідь на попередній вибір не повинна підмінити нову сторінку.
    if (sequence !== requestSequence.current) return
    selectionRef.current = { pageId: data.selectedPageId, versionId: data.selectedVersionId }
    setProject(data)

    const targetLocales = data.locales.filter((locale) => !locale.isSource)
    setSelectedLocaleCode((currentCode) => {
      const stillExists = targetLocales.some((locale) => locale.code === currentCode)
      return stillExists ? currentCode : (targetLocales[0]?.code ?? '')
    })
  }

  useEffect(() => {
    let active = true
    // Оновлюємо підказки після повернення з іншої вкладки, де могли змінити словник.
    function refreshGlossary() {
      getGlossary(projectId).then((entries) => {
        if (active) { setGlossary(entries); setGlossaryError('') }
      }).catch(() => { if (active) setGlossaryError('Не вдалося завантажити глосарій.') })
    }
    refreshGlossary()
    window.addEventListener('focus', refreshGlossary)
    return () => { active = false; window.removeEventListener('focus', refreshGlossary) }
  }, [projectId, activeSection])

  useEffect(() => {
    setIsLoading(true)
    selectionRef.current = {}
    loadProject({})
      .catch((requestError) => setError(requestError.message))
      .finally(() => setIsLoading(false))
  }, [projectId])

  useEffect(() => {
    // Роль могла змінитися в іншій вкладці. Після повернення одразу отримуємо актуальні права.
    function refreshProjectAccess() {
      loadProject().catch((requestError) => setError(requestError.message))
    }

    window.addEventListener('focus', refreshProjectAccess)
    return () => window.removeEventListener('focus', refreshProjectAccess)
  }, [projectId])

  const targetLocales = project?.locales.filter((locale) => !locale.isSource) ?? []

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
      const matchesQuery = !normalizedQuery || [
        translationKey.key,
        translationKey.sourceTexts[0]?.value,
        translation?.value,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))

      return matchesStatus && matchesQuery
    })
  }, [project, query, selectedLocaleCode, statusFilter])

  const selectedKey = project?.translationKeys.find((item) => item.id === selectedKeyId)
    ?? visibleKeys[0]
    ?? null
  const selectedTranslation = selectedKey
    ? getTranslation(selectedKey, selectedLocaleCode)
    : null

  useEffect(() => {
    setCommentDraft(selectedTranslation?.comment ?? '')
  }, [selectedTranslation?.id, selectedTranslation?.comment])

  useEffect(() => {
    // Не переносимо причину з одного рядка на інший.
    setReviewReasonDraft('')
  }, [selectedTranslation?.id])

  // Замінює один оновлений переклад у локальному стані без повторного запиту проєкту.
  function replaceTranslation(updatedTranslation) {
    setProject((currentProject) => ({
      ...currentProject,
      translationKeys: currentProject.translationKeys.map((translationKey) => ({
        ...translationKey,
        translations: translationKey.translations.map((translation) => (
                          translation.id === updatedTranslation.id ? { ...translation, ...updatedTranslation } : translation
        )),
      })),
    }))
  }

  // Надсилає змінений переклад до API та показує результат користувачу.
  async function handleSaveTranslation(translationId, value, status, reviewReason) {
    setError('')
    setNotice('')

    try {
      const updated = await updateTranslation(projectId, translationId, value, status, reviewReason)
      replaceTranslation(updated)
      setNotice(status === 'NEEDS_REVISION' ? 'Переклад повернуто на доопрацювання.' : (status === 'REVIEWED' ? 'Переклад перевірено.' : 'Переклад збережено.'))
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    }
  }

  // Рецензент затверджує збережений переклад вибраного рядка, не змінюючи текст.
  async function handleApproveTranslation() {
    if (project?.currentUserRole !== 'REVIEWER' || !selectedTranslation?.value?.trim()
      || selectedTranslation.status === 'REVIEWED' || isReviewing) return

    // Фіксуємо рядок до запиту: перемикання вибору не змінить об'єкт затвердження.
    const translation = selectedTranslation
    setIsReviewing(true)
    try {
      await handleSaveTranslation(translation.id, translation.value, 'REVIEWED')
    } finally {
      setIsReviewing(false)
    }
  }

  // Повертає збережений текст редактору з обов'язковим поясненням рецензента.
  async function handleReturnTranslation() {
    if (project?.currentUserRole !== 'REVIEWER' || !selectedTranslation?.value?.trim()
      || !reviewReasonDraft.trim() || isReviewing) return

    // Фіксуємо обраний переклад до початку асинхронного запиту.
    const translation = selectedTranslation
    setIsReviewing(true)
    try {
      await handleSaveTranslation(translation.id, translation.value, 'NEEDS_REVISION', reviewReasonDraft.trim())
    } finally {
      setIsReviewing(false)
    }
  }

  // Зберігає примітку для вибраного рядка та оновлює його в локальному стані.
  async function handleSaveComment() {
    if (!selectedTranslation) return

    setError('')
    setNotice('')
    setIsSavingComment(true)

    try {
      const updated = await updateTranslationComment(
        projectId,
        selectedTranslation.id,
        commentDraft,
      )
      replaceTranslation(updated)
      setNotice(commentDraft.trim() ? 'Коментар збережено.' : 'Коментар видалено.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSavingComment(false)
    }
  }

  // Створює нову цільову локаль і перезавантажує дані проєкту.
  async function handleAddLocale(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const locale = await createLocale(projectId, { code: localeCode, name: localeName })
      await loadProject()
      setSelectedLocaleCode(locale.code)
      setShowLocaleForm(false)
      setNotice('Мову перекладу додано.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Перейменовує цільову мову й синхронізує її назву в усіх вкладених перекладах React-стану.
  async function handleRenameLocale(localeId, name) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const updatedLocale = await updateLocale(projectId, localeId, name)

      // Назва локалі зберігається і в project.locales, і всередині кожного перекладу.
      // Оновлюємо обидва місця, щоб інтерфейс одразу показав однакові дані без нового HTTP-запиту.
      setProject((currentProject) => ({
        ...currentProject,
        locales: currentProject.locales.map((locale) => (
          locale.id === updatedLocale.id ? updatedLocale : locale
        )),
        translationKeys: currentProject.translationKeys.map((translationKey) => ({
          ...translationKey,
          translations: translationKey.translations.map((translation) => (
            translation.locale.code === updatedLocale.code
              ? { ...translation, locale: { ...translation.locale, name: updatedLocale.name } }
              : translation
          )),
        })),
      }))

      setNotice('Назву мови оновлено.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Видаляє підтверджену цільову мову та повторно завантажує узгоджені дані проєкту.
  async function handleDeleteLocale(localeId) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await deleteLocale(projectId, localeId)
      // Сервер каскадно видаляє багато перекладів, тому надійніше отримати проєкт заново,
      // ніж вручну прибирати локаль із кожного вкладеного масиву.
      await loadProject()
      setNotice('Мову та пов’язані з нею переклади видалено.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Відкриває панель команди та завантажує персональні дані лише за запитом власника.
  async function handleToggleMembers() {
    if (showMembers) {
      setShowMembers(false)
      return
    }

    setShowMembers(true)
    setError('')
    setIsLoadingMembers(true)

    try {
      setMembersData(await getProjectMembers(projectId))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoadingMembers(false)
    }
  }

  // Додає зареєстрованого користувача й одразу показує його у списку команди.
  async function handleAddMember(memberData) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const member = await addProjectMember(projectId, memberData)
      setMembersData((currentData) => ({
        ...currentData,
        members: [...currentData.members, member],
      }))
      setNotice('Учасника додано до проєкту.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Замінює один запис учасника, не перезавантажуючи весь проєкт.
  async function handleChangeMemberRole(memberId, role) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const updatedMember = await updateProjectMember(projectId, memberId, role)
      setMembersData((currentData) => ({
        ...currentData,
        members: currentData.members.map((member) => (
          member.id === updatedMember.id ? updatedMember : member
        )),
      }))
      setNotice('Роль учасника змінено.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Відкликає доступ до проєкту, але не видаляє сам акаунт користувача.
  async function handleDeleteMember(memberId) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await deleteProjectMember(projectId, memberId)
      setMembersData((currentData) => ({
        ...currentData,
        members: currentData.members.filter((member) => member.id !== memberId),
      }))
      setNotice('Доступ учасника відкликано.')
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Перемикання сторінки без versionId автоматично відкриває її останню версію.
  function openTranslations() {
    setImportMode(null); setShowLocaleManager(false); setShowLocaleForm(false); setShowMembers(false)
    onTranslations()
  }

  // Форма імпорту — окремий екран, а порівняння завжди з останньою версією сторінки.
  async function openImport(mode) {
    openTranslations()
    if (mode === 'version') {
      setIsSwitching(true)
      try { await loadProject({ pageId: project.selectedPageId }) }
      catch (err) { setError(err.message); return }
      finally { setIsSwitching(false) }
    }
    setError(''); setNotice(''); setImportMode(mode)
  }

  async function selectVersion(pageId, versionId) {
    setShowLocaleManager(false); setShowLocaleForm(false); setShowMembers(false)
    setIsSwitching(true)
    setError(''); setNotice(''); setImportMode(null)
    try {
      await loadProject({ pageId, versionId })
      if (activeSection === 'glossary') onTranslations()
      setSelectedKeyId(null); setQuery(''); setStatusFilter('ALL'); setQuickProposal(null)
    } catch (err) { setError(err.message) }
    finally { setIsSwitching(false) }
  }

  // Після підтвердження імпорту відкриваємо саме новостворений знімок.
  async function handlePageImport(content, options) {
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const summary = await importSourceFile(projectId, content, options)
      await loadProject({ pageId: summary.pageId, versionId: summary.versionId })
      setImportMode(null); setSelectedKeyId(null); setQuery(''); setStatusFilter('ALL')
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
      setNotice(`Файл ${fileName} сформовано.`)
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
      const selection = project.selectedVersionId === versionToDelete.id
        ? { pageId: result.pageId, versionId: result.versionId }
        : selectionRef.current
      selectionRef.current = selection
      setVersionToDelete(null)
      setImportMode(null)
      // Видалення вже виконано: помилка оновлення не повинна пропонувати повторний DELETE.
      try { await loadProject(selection); setNotice('Версію видалено.') }
      catch (requestError) { setError(`Версію видалено. Не вдалося оновити список: ${requestError.message}. Оновіть сторінку.`) }
    } catch (requestError) {
      setDeleteVersionError(requestError.message)
    } finally { setIsDeletingVersion(false) }
  }

  if (isLoading) {
    return <main className="editor-loading">Відкриваємо проєкт…</main>
  }

  if (!project) {
    return (
      <main className="editor-loading">
        <p>Проєкт не вдалося відкрити.</p>
        <button className="button primary" onClick={onBack} type="button">До проєктів</button>
      </main>
    )
  }

  const canManageProject = project.currentUserRole === 'OWNER'
  const activePage = project.pages?.find(page => page.id === project.selectedPageId)
  const activeVersion = activePage?.versions.find(version => version.id === project.selectedVersionId)
  // Переклади кожної доступної версії підтримуються незалежно; права визначає роль.
  const canEditTranslations = project.currentUserRole === 'EDITOR' && !isSwitching
  const canReviewTranslations = project.currentUserRole === 'REVIEWER' && !isSwitching
  const canComment = ['EDITOR', 'REVIEWER'].includes(project.currentUserRole) && !isSwitching

  return (
    <main className="editor-shell">
      {versionToDelete && <VersionDeleteDialog version={versionToDelete}
        isLatest={activePage?.versions[0]?.id === versionToDelete.id}
        busy={isDeletingVersion} error={deleteVersionError}
        onCancel={() => setVersionToDelete(null)} onConfirm={handleDeleteVersion} />}
      <aside className="editor-sidebar">
        <div className="editor-brand"><span>L</span><strong>LocaleFlow</strong></div>
        <button className="sidebar-back" onClick={onBack} type="button">← Мої проєкти</button>
        <nav>
          <button className={activeSection === 'translations' && !importMode && !showLocaleManager && !showMembers ? 'active' : ''} onClick={openTranslations} type="button">Рядки локалізації</button>
          <button className={activeSection === 'glossary' ? 'active' : ''} onClick={() => { setImportMode(null); setShowLocaleManager(false); setShowMembers(false); onGlossary() }} type="button">Глосарій</button>
          {canManageProject && <button className={showLocaleManager && activeSection !== 'glossary' ? 'active' : ''} onClick={() => { openTranslations(); setShowLocaleManager(true) }} type="button">Мови проєкту</button>}
          {canManageProject && <button className={showMembers && activeSection !== 'glossary' ? 'active' : ''} onClick={() => { openTranslations(); if (!showMembers) handleToggleMembers(); else setShowMembers(true) }} type="button">Учасники</button>}
        </nav>
        <section className="sidebar-section" aria-label="Сторінки">
          <h2>Сторінки</h2>
          <nav>{project.pages?.map(page => <button key={page.id} type="button"
            className={page.id === project.selectedPageId ? 'active' : ''}
            aria-pressed={page.id === project.selectedPageId} disabled={isSwitching || isSaving}
            onClick={() => selectVersion(page.id)}>{page.name}</button>)}</nav>
          {!project.pages?.length && <small>Сторінок ще немає</small>}
          {canManageProject && <button className="sidebar-add" disabled={isSaving || isSwitching} onClick={() => openImport('new')}>+ Додати сторінку</button>}
        </section>
        <section className="sidebar-section" aria-label="Версії">
          <h2>Версії</h2>
          <nav>{activePage?.versions.map((version, index) => <div className="sidebar-version-row" key={version.id}><button type="button"
            className={version.id === project.selectedVersionId ? 'active' : ''}
            aria-pressed={version.id === project.selectedVersionId} disabled={isSwitching || isSaving}
            onClick={() => selectVersion(activePage.id, version.id)}>
            {version.name || `Версія ${version.number}`}{index === 0 ? ' · остання' : ''}
          </button>
            {canManageProject && <button type="button" className="version-delete"
              aria-label={`Видалити ${version.name || `версію ${version.number}`}`}
              title={activePage.versions.length === 1 ? 'Не можна видалити єдину версію' : 'Видалити версію'}
              disabled={activePage.versions.length === 1 || isSwitching || isSaving || isDeletingVersion}
              onClick={() => { setDeleteVersionError(''); setVersionToDelete(version) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></svg>
            </button>}
          </div>)}</nav>
          {!activePage && <small>Спочатку додай сторінку</small>}
          {canManageProject && activePage && <button className="sidebar-add" disabled={isSaving || isSwitching} onClick={() => openImport('version')}>+ Додати версію</button>}
        </section>
        <div className="sidebar-project">
          <small>Поточний проєкт</small>
          <strong>{project.name}</strong>
          <span>{project.translationKeys.length} ключів</span>
        </div>
      </aside>

      <section className="editor-workspace">
        <header className="editor-topbar">
          <div className="breadcrumbs">
            <button onClick={onBack} type="button">Проєкти</button>
            <span>›</span><strong>{project.name}</strong><span>›</span><span>{activePage?.name ?? 'Сторінки'}{activeVersion ? ` · ${activeVersion.name || `Версія ${activeVersion.number}`}` : ''}</span>
            {activeSection === 'glossary' && <span>› Глосарій</span>}
          </div>
          <div className="editor-user">
            <span>{user.name.slice(0, 2).toUpperCase()}</span>
            <small>{user.name} · {ROLE_LABELS[project.currentUserRole]}</small>
            <button onClick={onLogout} type="button">Вийти</button>
          </div>
        </header>

        {activeSection === 'glossary' && <GlossaryPage projectId={projectId} project={project} seed={glossarySeed} />}
        {/* Приховуємо редактор без демонтажу: введені переклади й вибрана версія залишаються на місці. */}
        <div className="editor-content" hidden={activeSection === 'glossary'}>
          {error && <div className="message error" role="alert">{error}</div>}
          {notice && <div className="message success">{notice}</div>}
          {isSwitching && <p role="status">Завантажуємо версію…</p>}
          {importMode && <PageImport key={`${importMode}-${project.selectedPageId}`} page={importMode === 'version' ? activePage : null}
            keys={importMode === 'version' ? project.translationKeys : []} busy={isSaving} onImport={handlePageImport} onClose={() => setImportMode(null)} />}

          {showMembers && (
            isLoadingMembers || !membersData ? (
              <div className="panel-loading">Завантажуємо учасників…</div>
            ) : (
              <ProjectMembers
                data={membersData}
                isSaving={isSaving}
                onAdd={handleAddMember}
                onClose={() => setShowMembers(false)}
                onDelete={handleDeleteMember}
                onRoleChange={handleChangeMemberRole}
              />
            )
          )}

          {showLocaleManager && (
            <section className="language-screen">
            <div className="project-title-row"><h1>Мови проєкту</h1><button className="button primary" onClick={() => setShowLocaleForm(value => !value)} type="button">+ Додати мову</button></div>
            <LocaleManager
              isSaving={isSaving}
              locales={project.locales}
              onClose={openTranslations}
              onDelete={handleDeleteLocale}
              onRename={handleRenameLocale}
            />
            </section>
          )}

          {canManageProject && showLocaleManager && showLocaleForm && (
            <form className="locale-create-bar" onSubmit={handleAddLocale}>
              <div><strong>Нова мова перекладу</strong><small>Наприклад, uk — Українська</small></div>
              <input value={localeCode} onChange={(event) => setLocaleCode(event.target.value)} placeholder="uk" required />
              <input value={localeName} onChange={(event) => setLocaleName(event.target.value)} placeholder="Українська" required />
              <button className="button primary" disabled={isSaving} type="submit">Додати</button>
            </form>
          )}

          {/* Керування й імпорт замінюють робочу область, не зсувають таблицю вниз. */}
          <div hidden={Boolean(importMode || showLocaleManager || showMembers)}>
          <section className="project-title-row">
            <div><p className="eyebrow">Файл оригіналу</p><h1>{activePage?.name ?? project.name}</h1><p>{project.description || 'Редагування та перевірка локалізаційних рядків.'}</p></div>
            <button className="button primary" disabled={!selectedLocaleCode || !activeVersion || isSwitching} onClick={handleExport} type="button">Експорт {selectedLocaleCode || 'JSON'}</button>
          </section>
          <div className="status-tabs">
            {STATUS_FILTERS.map((filter) => (
              <button
                className={statusFilter === filter.value ? 'active' : ''}
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                type="button"
              >
                {filter.label} <span>{statusCounts[filter.value]}</span>
              </button>
            ))}
          </div>

          <section className="editor-toolbar">
            <label className="search-box">
              <span>⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Пошук ключа або тексту…" />
            </label>
            <label>
              Мова
              <select value={selectedLocaleCode} onChange={(event) => setSelectedLocaleCode(event.target.value)}>
                {targetLocales.length === 0 && <option value="">Спочатку додай мову</option>}
                {targetLocales.map((locale) => <option key={locale.id} value={locale.code}>{locale.name} ({locale.code})</option>)}
              </select>
            </label>
            <label>
              Оригінал
              <select disabled><option>{project.sourceLocaleCode.toUpperCase()}</option></select>
            </label>
          </section>

          <div className="translation-workarea">
            <TranslationTable
              canEdit={canEditTranslations}
              onSaveTranslation={handleSaveTranslation}
              onSelectKey={setSelectedKeyId}
              selectedKeyId={selectedKey?.id}
              targetLocaleCode={selectedLocaleCode}
              translationKeys={visibleKeys}
            />

            <aside className="key-details">
              {selectedKey ? (
                <>
                  <div className="detail-heading">
                    <div><code>{selectedKey.key}</code><small>Контекст рядка</small></div>
                  </div>
                  {canReviewTranslations && (
                    <section className="review-actions">
                      <small>ДІЇ РЕЦЕНЗЕНТА</small>
                      <button
                        className="button primary"
                        disabled={isReviewing || !selectedTranslation?.value?.trim() || selectedTranslation.status === 'REVIEWED'}
                        onClick={handleApproveTranslation}
                        type="button"
                      >
                        {isReviewing ? 'Затверджуємо…' : (selectedTranslation?.status === 'REVIEWED' ? 'Переклад затверджено' : 'Затвердити переклад')}
                      </button>
                      <label className="review-reason-label" htmlFor="review-reason">Причина повернення</label>
                      <textarea id="review-reason" disabled={isReviewing || !selectedTranslation?.value?.trim()} maxLength={2000}
                        onChange={(event) => setReviewReasonDraft(event.target.value)} placeholder="Поясни, що потрібно виправити…" rows={3} value={reviewReasonDraft} />
                      <button className="button secondary" disabled={isReviewing || !selectedTranslation?.value?.trim() || !reviewReasonDraft.trim()}
                        onClick={handleReturnTranslation} type="button">Повернути на доопрацювання</button>
                    </section>
                  )}
                  {selectedTranslation?.reviewReason && (
                    <section className="revision-feedback">
                      <small>ЗАУВАЖЕННЯ РЕЦЕНЗЕНТА</small>
                      <p>{selectedTranslation.reviewReason}</p>
                      {canEditTranslations && <p>Виправ переклад і натисни Enter, щоб знову подати його на перевірку.</p>}
                    </section>
                  )}
                  <section className="glossary-suggestions">
                    <small>ГЛОСАРІЙ</small>
                    {glossaryError ? <p>{glossaryError}</p> : (() => {
                      const matches = glossary.filter((entry) => entry.status === 'APPROVED' && entry.locale.code === selectedLocaleCode
                        && matchesGlossaryTerm(selectedKey.sourceTexts[0]?.value, entry.term))
                      return matches.length ? <ul>{matches.map((entry) => <li key={entry.id}>
                        <strong>{entry.term} → {entry.translation}</strong>
                        {entry.definition && <p>{entry.definition}</p>}
                        {entry.example && <p>{entry.example}</p>}
                      </li>)}</ul> : <p>Для цього рядка термінів немає.</p>
                    })()}
                    <button className="button secondary" onClick={() => onGlossary()} type="button">Відкрити глосарій</button>
                    <button className="button secondary" disabled={!selectedLocaleCode || Boolean(quickProposal)} onClick={() => setQuickProposal({ localeCode: selectedLocaleCode, example: selectedKey.sourceTexts[0]?.value ?? '' })} type="button">Запропонувати термін</button>
                    {quickProposal && <GlossaryProposal projectId={projectId} {...quickProposal}
                      onClose={() => setQuickProposal(null)} onSaved={(entry) => {
                        setGlossary((current) => [entry, ...current]); setQuickProposal(null); setNotice('Термін надіслано на погодження рецензенту.')
                      }} />}
                  </section>
                  <section className="version-summary">
                    <small>АКТУАЛЬНІСТЬ</small>
                    <div className={
                      selectedTranslation?.status === 'OUTDATED'
                        ? 'version-alert outdated'
                        : (selectedTranslation?.value ? 'version-alert' : 'version-alert empty')
                    }>
                      <strong>
                        {selectedTranslation?.status === 'OUTDATED'
                          ? 'Оригінал змінився'
                          : (selectedTranslation?.value
                            ? 'Переклад відповідає оригіналу'
                            : 'Перекладу ще немає')}
                      </strong>
                      <span>
                        Редакція тексту: {selectedTranslation?.sourceVersion ?? '—'} · актуальна: {selectedKey.sourceTexts[0]?.version ?? '—'}
                      </span>
                    </div>
                    <dl>
                      <dt>Оновлено переклад</dt>
                      <dd>{formatDate(selectedTranslation?.updatedAt)}</dd>
                    </dl>
                  </section>
                  <section className="version-history">
                    <small>ІСТОРІЯ ОРИГІНАЛУ</small>
                    <ol>
                      {selectedKey.sourceTexts.map((sourceText) => (
                        <li key={sourceText.id}>
                          <div>
                            <strong>Редакція тексту {sourceText.version}</strong>
                            {sourceText.isCurrent && <span>Поточна</span>}
                            <time>{formatDate(sourceText.createdAt)}</time>
                          </div>
                          <p>{sourceText.value}</p>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <section className="translation-history">
                    <small>ІСТОРІЯ ЗМІН ПЕРЕКЛАДУ · ОСТАННІ 50 ДІЙ</small>
                    {selectedTranslation?.history?.length ? (
                      <ol>
                        {selectedTranslation.history.map((entry) => (
                          <li key={entry.id}>
                            <strong>{historyAction(entry.status)}</strong>
                            <span>{entry.actorName} · {entry.actorRole === 'EDITOR' ? 'Редактор' : 'Рецензент'}</span>
                            <time>{formatDate(entry.createdAt)}</time>
                            <details>
                              <summary>Текст на момент дії</summary>
                              <p>{entry.value ?? 'Порожній переклад'}</p>
                              <span>Редакція тексту оригіналу: {entry.sourceVersion ?? '—'}</span>
                              {entry.reviewReason && <p>Причина: {entry.reviewReason}</p>}
                            </details>
                          </li>
                        ))}
                      </ol>
                    ) : <p>{selectedTranslation?.copiedFromTranslationId ? 'Переклад перенесено з попередньої версії. Попередні дії доступні в її історії.' : 'Історія з’явиться після наступної зміни перекладу.'}</p>}
                  </section>
                  <section className="comment-editor">
                    <small>КОМЕНТАР</small>
                    {selectedTranslation ? (
                      <>
                        <textarea
                          disabled={!canComment}
                          maxLength="2000"
                          onChange={(event) => setCommentDraft(event.target.value)}
                          placeholder={canComment ? 'Залиш примітку для цього перекладу…' : 'Лише перегляд'}
                          rows="4"
                          value={commentDraft}
                        />
                        <div>
                          <small>{commentDraft.length}/2000</small>
                          <button
                            className="button secondary"
                            disabled={!canComment || isSavingComment || commentDraft.trim() === (selectedTranslation.comment ?? '')}
                            onClick={handleSaveComment}
                            type="button"
                          >
                            {isSavingComment ? 'Зберігаємо…' : 'Зберегти коментар'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="muted-detail">Спочатку додай мову перекладу.</p>
                    )}
                  </section>
                </>
              ) : (
                <p className="muted-detail">Обери рядок, щоб побачити його деталі.</p>
              )}
            </aside>
          </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default ProjectEditorPage
