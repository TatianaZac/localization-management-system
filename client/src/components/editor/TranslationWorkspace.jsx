import { GitMerge } from 'lucide-react'
import KeyDetailsPanel from './KeyDetailsPanel'
import TranslationTable from '../projects/TranslationTable'

export const TRANSLATION_STATUS_FILTERS = [
  { value: 'ALL', label: 'Усі рядки' },
  { value: 'NEW', label: 'Не перекладено' },
  { value: 'TRANSLATED', label: 'Перекладено' },
  { value: 'OUTDATED', label: 'Потребує уваги' },
  { value: 'NEEDS_REVISION', label: 'На доопрацюванні' },
  { value: 'REVIEWED', label: 'Перевірено' }
]

function TranslationWorkspace({
  activePage,
  activeVersion,
  canEditTranslations,
  canReviewTranslations,
  glossary,
  glossaryError,
  isReviewing,
  isSwitching,
  onApproveTranslation,
  onExport,
  onGlossary,
  onLocaleChange,
  onProposalClose,
  onProposalSaved,
  onQueryChange,
  onReturnTranslation,
  onReviewReasonChange,
  onSelectKey,
  onStartProposal,
  onStatusFilterChange,
  onSaveTranslation,
  project,
  projectId,
  query,
  quickProposal,
  reviewReasonDraft,
  selectedKey,
  selectedLocaleCode,
  selectedTranslation,
  statusCounts,
  statusFilter,
  targetLocales,
  visibleKeys
}) {
  const mergeSource =
    activeVersion?.summary?.type === 'MERGE' ? activeVersion.summary.mergedFrom : null
  const versionLabel = (versionId, versionNumber) => {
    const version = activePage?.versions.find((item) => item.id === versionId)
    return version?.name || `v${version?.number ?? versionNumber}`
  }

  return (
    <div className="translation-layout">
      <div className="translation-main">
        <section className="project-title-row">
          <div>
            <p className="eyebrow">Файл оригіналу</p>
            <div className="project-title-line">
              <h1>{activePage?.name ?? project.name}</h1>
              {mergeSource && (
                <span className="merge-origin-note">
                  <GitMerge aria-hidden="true" size={14} />
                  Результат злиття:
                  <strong>
                    {versionLabel(mergeSource.targetVersionId, mergeSource.targetVersionNumber)} +{' '}
                    {versionLabel(mergeSource.incomingVersionId, mergeSource.incomingVersionNumber)}
                  </strong>
                </span>
              )}
            </div>
            <p>{project.description || 'Редагування та перевірка локалізаційних рядків.'}</p>
          </div>
          <button
            className="button primary"
            disabled={!selectedLocaleCode || !activeVersion || isSwitching}
            onClick={onExport}
            type="button"
          >
            Експорт {selectedLocaleCode || 'JSON'}
          </button>
        </section>
        <div className="status-tabs">
          {TRANSLATION_STATUS_FILTERS.map((filter) => (
            <button
              className={statusFilter === filter.value ? 'active' : ''}
              key={filter.value}
              onClick={() => onStatusFilterChange(filter.value)}
              type="button"
            >
              {filter.label} <span>{statusCounts[filter.value]}</span>
            </button>
          ))}
        </div>
        <section className="editor-toolbar">
          <label className="search-box">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Пошук ключа або тексту…"
            />
          </label>
          <label>
            Мова
            <select
              value={selectedLocaleCode}
              onChange={(event) => onLocaleChange(event.target.value)}
            >
              {targetLocales.length === 0 && <option value="">Спочатку додай мову</option>}
              {targetLocales.map((locale) => (
                <option key={locale.id} value={locale.code}>
                  {locale.name} ({locale.code})
                </option>
              ))}
            </select>
          </label>
          <label>
            Оригінал
            <select disabled>
              <option>{project.sourceLocaleCode.toUpperCase()}</option>
            </select>
          </label>
        </section>
        <TranslationTable
          canEdit={canEditTranslations}
          onSaveTranslation={onSaveTranslation}
          onSelectKey={onSelectKey}
          selectedKeyId={selectedKey?.id}
          targetLocaleCode={selectedLocaleCode}
          translationKeys={visibleKeys}
          paginationKey={`${project.selectedVersionId}-${selectedLocaleCode}-${statusFilter}-${query}`}
        />
      </div>
      <KeyDetailsPanel
        canReviewTranslations={canReviewTranslations}
        glossary={glossary}
        glossaryError={glossaryError}
        isReviewing={isReviewing}
        onApproveTranslation={onApproveTranslation}
        onGlossary={onGlossary}
        onProposalClose={onProposalClose}
        onProposalSaved={onProposalSaved}
        onReturnTranslation={onReturnTranslation}
        onReviewReasonChange={onReviewReasonChange}
        onStartProposal={onStartProposal}
        projectId={projectId}
        quickProposal={quickProposal}
        reviewReasonDraft={reviewReasonDraft}
        selectedKey={selectedKey}
        selectedLocaleCode={selectedLocaleCode}
        selectedTranslation={selectedTranslation}
      />
    </div>
  )
}

export default TranslationWorkspace
