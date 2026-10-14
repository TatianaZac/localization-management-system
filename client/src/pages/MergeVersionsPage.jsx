import { ArrowLeft, GitMerge, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeGlossaryContexts,
  getGlossary,
  getProject,
  mergePageVersions
} from '../api/localizationApi'
import MergeChangeGroup from '../components/merge/MergeChangeGroup'
import MergeFilters from '../components/merge/MergeFilters'
import MergeVersionPicker from '../components/merge/MergeVersionPicker'
import { MERGE_FILTERS, MERGE_GROUPS, matchesMergeFilter } from '../data/mergePreview'
import { buildMergeComparison, formatMergeVersions } from '../utils/mergeComparison'
import '../styles/MergeVersionsPage.css'

function defaultDecisions(changes) {
  return Object.fromEntries(
    changes.map((change) => [
      change.id,
      {
        choice: 'incoming',
        value: change.incoming
      }
    ])
  )
}

export default function MergeVersionsPage({
  initialLocaleCode = '',
  initialPageId = null,
  localeCode,
  onBack,
  onProjectMissing,
  page,
  project,
  projectId,
  projectName,
  standalone = false
}) {
  const [loadedProject, setLoadedProject] = useState(null)
  const [projectError, setProjectError] = useState('')
  const [isLoadingProject, setIsLoadingProject] = useState(!project)
  const currentProject = project ?? loadedProject
  const currentPage =
    page ??
    currentProject?.pages.find((item) => item.id === initialPageId) ??
    currentProject?.pages.find((item) => item.id === currentProject.selectedPageId) ??
    currentProject?.pages[0]
  const currentLocaleCode = localeCode || initialLocaleCode
  const versions = useMemo(() => formatMergeVersions(currentPage), [currentPage])
  const [targetVersion, setTargetVersion] = useState(() => versions[1]?.id ?? versions[0]?.id ?? '')
  const [incomingVersion, setIncomingVersion] = useState(() => versions[0]?.id ?? '')
  const [activeFilter, setActiveFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [comparison, setComparison] = useState([])
  const [decisions, setDecisions] = useState({})
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonError, setComparisonError] = useState('')
  const [isMerging, setIsMerging] = useState(false)
  const [mergeError, setMergeError] = useState('')
  const [mergeSuccess, setMergeSuccess] = useState('')
  const comparisonSequence = useRef(0)
  const locale = currentProject?.locales.find((item) => item.code === currentLocaleCode) ??
    currentProject?.locales.find((item) => !item.isSource) ?? {
      code: currentLocaleCode || '',
      name: currentLocaleCode || ''
    }
  const targetVersionLabel =
    versions.find((version) => version.id === targetVersion)?.label ?? targetVersion
  const incomingVersionLabel =
    versions.find((version) => version.id === incomingVersion)?.label ?? incomingVersion

  useEffect(() => {
    if (project) {
      setIsLoadingProject(false)
      return undefined
    }

    let active = true
    setIsLoadingProject(true)
    setProjectError('')
    getProject(projectId, initialPageId ? { pageId: initialPageId } : {})
      .then((data) => {
        if (active) setLoadedProject(data)
      })
      .catch((requestError) => {
        if (active) setProjectError(requestError.message)
      })
      .finally(() => {
        if (active) setIsLoadingProject(false)
      })

    return () => {
      active = false
    }
  }, [initialPageId, project, projectId])

  useEffect(() => {
    setTargetVersion(versions[1]?.id ?? versions[0]?.id ?? '')
    setIncomingVersion(versions[0]?.id ?? '')
  }, [currentPage?.id])

  const compare = useCallback(async () => {
    if (!currentPage?.id || !locale.code || !targetVersion || !incomingVersion) return
    if (targetVersion === incomingVersion) {
      setComparison([])
      setDecisions({})
      return
    }

    const sequence = ++comparisonSequence.current
    setIsComparing(true)
    setComparisonError('')
    try {
      const [targetProject, incomingProject, glossary] = await Promise.all([
        getProject(projectId, { pageId: currentPage.id, versionId: targetVersion }),
        getProject(projectId, { pageId: currentPage.id, versionId: incomingVersion }),
        getGlossary(projectId)
      ])
      if (sequence !== comparisonSequence.current) return
      const semanticSources = [
        ...(targetProject.translationKeys ?? []).map((key) => ({
          id: `target:${key.key}`,
          text:
            key.sourceTexts.find((sourceText) => sourceText.isCurrent)?.value ??
            key.sourceTexts[0]?.value ??
            ''
        })),
        ...(incomingProject.translationKeys ?? []).map((key) => ({
          id: `incoming:${key.key}`,
          text:
            key.sourceTexts.find((sourceText) => sourceText.isCurrent)?.value ??
            key.sourceTexts[0]?.value ??
            ''
        }))
      ].filter(({ text }) => text)
      let terminologyAnalyses = {}
      if (semanticSources.length) {
        try {
          const analyzed = await analyzeGlossaryContexts(projectId, locale.code, semanticSources)
          terminologyAnalyses = Object.fromEntries(analyzed.items.map((item) => [item.id, item]))
        } catch {
          // Порівняння залишається доступним із детермінованим аналізом без моделі.
        }
      }
      if (sequence !== comparisonSequence.current) return
      const nextComparison = buildMergeComparison(
        targetProject,
        incomingProject,
        locale.code,
        glossary,
        terminologyAnalyses
      )
      setComparison(nextComparison)
      setDecisions(defaultDecisions(nextComparison))
    } catch (requestError) {
      if (sequence !== comparisonSequence.current) return
      setComparison([])
      setDecisions({})
      setComparisonError(requestError.message)
    } finally {
      if (sequence === comparisonSequence.current) setIsComparing(false)
    }
  }, [currentPage?.id, incomingVersion, locale.code, projectId, targetVersion])

  useEffect(() => {
    void compare()
  }, [compare])

  const counts = useMemo(() => {
    const result = Object.fromEntries(MERGE_FILTERS.map((filter) => [filter.value, 0]))
    for (const filter of MERGE_FILTERS) {
      result[filter.value] = comparison.filter((change) =>
        matchesMergeFilter(change, filter.value)
      ).length
    }
    return result
  }, [comparison])

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const changesMatchingQuery = comparison.filter((change) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          change.key,
          change.targetSource,
          change.incomingSource,
          change.target,
          change.incoming
        ].some((value) => value?.toLowerCase().includes(normalizedQuery))
      return matchesQuery
    })

    const groupTypes =
      activeFilter === 'all'
        ? ['terminology', 'translation', 'source', 'added', 'removed']
        : [activeFilter]

    return groupTypes
      .map((groupType) => ({
        groupType,
        changes: changesMatchingQuery.filter((change) => matchesMergeFilter(change, groupType))
      }))
      .filter((group) => group.changes.length > 0)
  }, [activeFilter, comparison, query])

  function choose(id, choice, value) {
    setMergeSuccess('')
    setDecisions((current) => ({ ...current, [id]: { choice, value } }))
  }

  async function submitMerge() {
    setIsMerging(true)
    setMergeError('')
    setMergeSuccess('')
    try {
      const selectedDecisions = Object.fromEntries(
        comparison
          .filter((change) => !change.added && !change.removed)
          .map((change) => [change.key, decisions[change.id]?.choice ?? 'incoming'])
      )
      const result = await mergePageVersions(projectId, {
        pageId: currentPage.id,
        targetVersionId: Number(targetVersion),
        incomingVersionId: Number(incomingVersion),
        localeCode: locale.code,
        decisions: selectedDecisions
      })

      setMergeSuccess(`Створено нову версію v${result.versionNumber} — результат злиття.`)
      if (!project) {
        const refreshedProject = await getProject(projectId, {
          pageId: result.pageId,
          versionId: result.versionId
        })
        setLoadedProject(refreshedProject)
        setTargetVersion(incomingVersion)
        setIncomingVersion(String(result.versionId))
      }
    } catch (requestError) {
      setMergeError(requestError.message)
    } finally {
      setIsMerging(false)
    }
  }

  if (isLoadingProject) {
    return <main className="editor-loading">Відкриваємо дані для порівняння…</main>
  }

  if (projectError || !currentProject) {
    return (
      <main className="editor-loading">
        <p>{projectError || 'Проєкт не вдалося відкрити.'}</p>
        <button className="button primary" onClick={onProjectMissing ?? onBack} type="button">
          До проєктів
        </button>
      </main>
    )
  }

  return (
    <section className={`merge-page${standalone ? ' standalone' : ''}`}>
      <header className="merge-page-heading">
        <button aria-label="Назад" onClick={onBack} type="button">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1>Об’єднати версії сторінки</h1>
          <p>
            Проєкт: {projectName ?? currentProject.name}
            <span>›</span>Сторінка: {currentPage?.name ?? '—'}
          </p>
        </div>
      </header>

      <MergeVersionPicker
        canMerge={comparison.length > 0}
        incomingVersion={incomingVersion}
        isComparing={isComparing}
        isMerging={isMerging}
        locale={locale}
        onIncomingChange={(versionId) => {
          setComparison([])
          setDecisions({})
          setMergeError('')
          setMergeSuccess('')
          setIncomingVersion(versionId)
        }}
        onMerge={submitMerge}
        onSwap={() => {
          setComparison([])
          setTargetVersion(incomingVersion)
          setIncomingVersion(targetVersion)
          setDecisions({})
          setMergeError('')
          setMergeSuccess('')
        }}
        onTargetChange={(versionId) => {
          setComparison([])
          setDecisions({})
          setMergeError('')
          setMergeSuccess('')
          setTargetVersion(versionId)
        }}
        targetVersion={targetVersion}
        versions={versions}
      />

      {mergeSuccess && (
        <p className="merge-result-message success" aria-live="polite">
          {mergeSuccess}
        </p>
      )}

      {mergeError && (
        <p className="merge-result-message error" role="alert">
          {mergeError}
        </p>
      )}

      {comparisonError && (
        <p className="merge-comparison-error" role="alert">
          {comparisonError}
        </p>
      )}

      {isComparing ? (
        <div className="merge-empty merge-compare-empty" role="status">
          <GitMerge size={34} />
          <strong>Порівнюємо версії…</strong>
        </div>
      ) : comparison.length ? (
        <>
          <div className="merge-tools">
            <MergeFilters
              activeFilter={activeFilter}
              counts={counts}
              filters={MERGE_FILTERS}
              onChange={setActiveFilter}
            />
            <label>
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук за ключем або текстом…"
              />
            </label>
          </div>
          <div className="merge-groups">
            {visibleGroups.length ? (
              visibleGroups.map(({ changes, groupType }) => (
                <MergeChangeGroup
                  changes={changes}
                  decisions={decisions}
                  group={MERGE_GROUPS[groupType]}
                  groupType={groupType}
                  incomingVersion={incomingVersionLabel}
                  key={groupType}
                  onDecision={choose}
                  targetVersion={targetVersionLabel}
                />
              ))
            ) : (
              <div className="merge-empty">
                <GitMerge size={28} />
                <strong>Змін не знайдено</strong>
                <span>Спробуй інший фільтр або пошуковий запит.</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="merge-empty merge-compare-empty">
          <GitMerge size={34} />
          <strong>
            {versions.length < 2 ? 'Недостатньо версій' : 'Немає даних для порівняння'}
          </strong>
          <span>
            {versions.length < 2
              ? 'Для об’єднання сторінка повинна мати щонайменше дві версії.'
              : 'Вибери дві різні версії або онови порівняння.'}
          </span>
        </div>
      )}
    </section>
  )
}
