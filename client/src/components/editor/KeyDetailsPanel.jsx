// Права панель збирає всі дії та історію лише для вибраного рядка перекладу.

import { useEffect, useState } from 'react'
import GlossaryProposal from '../projects/GlossaryProposal'
import { matchesGlossaryTerm } from '../../utils/glossary'
import {
  BookOpen,
  Check,
  CircleCheckBig,
  Clock3,
  History,
  Lightbulb,
  MessageSquare,
  Plus,
  Undo2,
  UsersRound
} from 'lucide-react'

function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function translationStatusLabel(status) {
  return (
    {
      NEW: 'Не перекладено',
      TRANSLATED: 'Очікує перевірки',
      REVIEWED: 'Затверджено',
      OUTDATED: 'Застаріло',
      NEEDS_REVISION: 'На доопрацюванні'
    }[status] ?? status
  )
}

const PANEL_ICONS = {
  key: Lightbulb,
  review: CircleCheckBig,
  glossary: BookOpen,
  current: Clock3,
  source: History,
  people: UsersRound,
  comment: MessageSquare
}

// Всі значки панелі беремо з однієї бібліотеки, щоб вони виглядали однаково.
function PanelIcon({ name }) {
  const Icon = PANEL_ICONS[name]
  return <Icon aria-hidden="true" className="detail-card-icon" strokeWidth={1.8} />
}

function DetailCardTitle({ icon, children }) {
  return (
    <header className="detail-card-title">
      <PanelIcon name={icon} />
      <strong>{children}</strong>
    </header>
  )
}

export default function KeyDetailsPanel({
  canReviewTranslations,
  glossary,
  glossaryError,
  isReviewing,
  onApproveTranslation,
  onGlossary,
  onProposalClose,
  onProposalSaved,
  onReturnTranslation,
  onReviewReasonChange,
  onStartProposal,
  projectId,
  quickProposal,
  reviewReasonDraft,
  selectedKey,
  selectedLocaleCode,
  selectedTranslation
}) {
  const versions = selectedTranslation?.versions ?? []
  const [reviewVersionNumber, setReviewVersionNumber] = useState(null)

  useEffect(() => {
    setReviewVersionNumber(selectedTranslation?.currentVersion ?? versions[0]?.number ?? null)
  }, [selectedTranslation?.id, selectedTranslation?.currentVersion, versions[0]?.number])

  if (!selectedKey) {
    return (
      <aside className="key-details">
        <p className="muted-detail">Обери рядок, щоб побачити його деталі.</p>
      </aside>
    )
  }

  const glossaryMatches = glossary.filter(
    (entry) =>
      entry.status === 'APPROVED' &&
      entry.locale.code === selectedLocaleCode &&
      (matchesGlossaryTerm(selectedKey.sourceTexts[0]?.value, entry.term) ||
        matchesGlossaryTerm(selectedKey.key, entry.term))
  )
  const reviewVersion = versions.find((version) => version.number === reviewVersionNumber)
  const currentSourceVersion = selectedKey.sourceTexts[0]?.version
  const reviewVersionIsOutdated =
    reviewVersion?.sourceVersion !== undefined &&
    reviewVersion?.sourceVersion !== null &&
    reviewVersion.sourceVersion !== currentSourceVersion

  return (
    <aside className="key-details">
      <div className="detail-card detail-heading">
        <DetailCardTitle icon="key">Деталі ключа</DetailCardTitle>
        <div className="key-summary-box">
          <div>
            <code>{selectedKey.key}</code>
            <small>Контекст рядка</small>
          </div>
        </div>
      </div>
      {canReviewTranslations && (
        <section className="detail-card review-actions">
          <DetailCardTitle icon="review">Дії рецензента</DetailCardTitle>
          <div className="detail-card-body">
            <p className="review-version-hint">
              Обери потрібну картку в блоці «Версії перекладу» нижче.
            </p>
            {reviewVersionIsOutdated && (
              <p className="review-version-warning">
                Цю версію створено для старої редакції оригіналу. Її можна переглянути або
                повернути, але не затвердити як актуальну.
              </p>
            )}
            <button
              className="button primary"
              disabled={
                isReviewing ||
                !reviewVersion?.value?.trim() ||
                reviewVersionIsOutdated ||
                (selectedTranslation.currentVersion === reviewVersion?.number &&
                  selectedTranslation.status === 'REVIEWED')
              }
              onClick={() => onApproveTranslation(reviewVersionNumber)}
              type="button"
            >
              <Check aria-hidden="true" size={16} strokeWidth={2} />
              {isReviewing
                ? 'Затверджуємо…'
                : selectedTranslation?.currentVersion === reviewVersion?.number &&
                    selectedTranslation?.status === 'REVIEWED'
                  ? 'Переклад затверджено'
                  : `Затвердити v${reviewVersion?.number ?? ''}`}
            </button>
            <label className="review-reason-label" htmlFor="review-reason">
              <PanelIcon name="comment" />
              Причина повернення
            </label>
            <textarea
              id="review-reason"
              disabled={isReviewing || !reviewVersion?.value?.trim()}
              maxLength={2000}
              onChange={(event) => onReviewReasonChange(event.target.value)}
              placeholder="Поясни, що потрібно виправити…"
              rows={3}
              value={reviewReasonDraft}
            />
            <button
              className="button secondary"
              disabled={isReviewing || !reviewVersion?.value?.trim() || !reviewReasonDraft.trim()}
              onClick={() => onReturnTranslation(reviewVersionNumber)}
              type="button"
            >
              <Undo2 aria-hidden="true" size={15} strokeWidth={2} />
              Повернути на доопрацювання
            </button>
          </div>
        </section>
      )}
      {/* Рецензент уже бачить цю причину у своєму полі вище, тому не дублюємо її. */}
      {selectedTranslation?.reviewReason && !canReviewTranslations && (
        <section className="revision-feedback">
          <small>ЗАУВАЖЕННЯ РЕЦЕНЗЕНТА</small>
          <p>{selectedTranslation.reviewReason}</p>
        </section>
      )}
      <section className="detail-card glossary-suggestions">
        <DetailCardTitle icon="glossary">Глосарій</DetailCardTitle>
        <div className="detail-card-body">
          {glossaryError ? (
            <p>{glossaryError}</p>
          ) : glossaryMatches.length ? (
            <ul>
              {glossaryMatches.map((entry) => (
                <li key={entry.id}>
                  <strong>
                    {entry.term} → {entry.translation}
                  </strong>
                  {entry.definition && <p>{entry.definition}</p>}
                  {entry.example && <p>{entry.example}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p>Для цього рядка термінів немає.</p>
          )}
          <div className="glossary-panel-actions">
            <button className="button secondary" onClick={onGlossary} type="button">
              <BookOpen aria-hidden="true" size={16} strokeWidth={1.8} />
              Відкрити глосарій
            </button>
            <button
              className="button secondary"
              disabled={!selectedLocaleCode || Boolean(quickProposal)}
              onClick={() =>
                onStartProposal({
                  localeCode: selectedLocaleCode,
                  example: selectedKey.sourceTexts[0]?.value ?? ''
                })
              }
              type="button"
            >
              <Plus aria-hidden="true" size={17} strokeWidth={1.8} />
              {canReviewTranslations ? 'Додати термін' : 'Запропонувати термін'}
            </button>
          </div>
          {quickProposal && (
            <GlossaryProposal
              projectId={projectId}
              {...quickProposal}
              isReviewer={canReviewTranslations}
              onClose={onProposalClose}
              onSaved={onProposalSaved}
            />
          )}
        </div>
      </section>
      <section className="detail-card version-summary">
        <DetailCardTitle icon="current">Актуальність</DetailCardTitle>
        <div className="detail-card-body">
          <div
            className={
              selectedTranslation?.status === 'OUTDATED'
                ? 'version-alert outdated'
                : selectedTranslation?.value
                  ? 'version-alert'
                  : 'version-alert empty'
            }
          >
            <strong>
              {selectedTranslation?.status === 'OUTDATED'
                ? 'Оригінал змінився'
                : selectedTranslation?.value
                  ? 'Переклад відповідає оригіналу'
                  : 'Перекладу ще немає'}
            </strong>
            <span>
              {!selectedTranslation?.value
                ? `Поточна редакція оригіналу: v${selectedKey.sourceTexts[0]?.version ?? '—'}.`
                : selectedTranslation.status === 'OUTDATED'
                  ? `Переклад v${selectedTranslation.currentVersion ?? '—'} створено для редакції оригіналу v${selectedTranslation.sourceVersion ?? '—'}. Зараз поточна редакція оригіналу — v${selectedKey.sourceTexts[0]?.version ?? '—'}.`
                  : `Переклад v${selectedTranslation.currentVersion ?? '—'} створено для поточної редакції оригіналу v${selectedTranslation.sourceVersion ?? '—'}.`}
            </span>
          </div>
          <dl>
            <dt>Оновлено переклад</dt>
            <dd>{formatDate(selectedTranslation?.updatedAt)}</dd>
          </dl>
        </div>
      </section>
      <section className="detail-card version-history">
        <DetailCardTitle icon="source">Історія оригіналу</DetailCardTitle>
        <div className="detail-card-body">
          <ol>
            {selectedKey.sourceTexts.map((sourceText) => (
              <li key={sourceText.id}>
                <div>
                  <strong>Редакція оригіналу v{sourceText.version}</strong>
                  {sourceText.isCurrent && <span>Поточна</span>}
                  <time>{formatDate(sourceText.createdAt)}</time>
                </div>
                <p>{sourceText.value}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="detail-card translation-history">
        <DetailCardTitle icon="people">Версії перекладу</DetailCardTitle>
        <div className="detail-card-body">
          <small>УСІ ВАРІАНТИ ТЕКСТУ</small>
          {versions.length ? (
            <ol className={`translation-version-list${versions.length > 2 ? ' scrollable' : ''}`}>
              {versions.map((version) => (
                <li
                  aria-pressed={
                    canReviewTranslations ? reviewVersionNumber === version.number : undefined
                  }
                  className={[
                    selectedTranslation.currentVersion === version.number ? 'current' : '',
                    canReviewTranslations && reviewVersionNumber === version.number
                      ? 'selected-for-review'
                      : '',
                    canReviewTranslations ? 'selectable' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={version.id}
                  onClick={() => {
                    if (canReviewTranslations && !isReviewing)
                      setReviewVersionNumber(version.number)
                  }}
                  onKeyDown={(event) => {
                    if (
                      canReviewTranslations &&
                      !isReviewing &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault()
                      setReviewVersionNumber(version.number)
                    }
                  }}
                  role={canReviewTranslations ? 'button' : undefined}
                  tabIndex={canReviewTranslations ? 0 : undefined}
                >
                  <div className="translation-version-heading">
                    <strong>v{version.number}</strong>
                    {selectedTranslation.currentVersion === version.number && <span>Поточна</span>}
                    <time dateTime={version.createdAt}>{formatDate(version.createdAt)}</time>
                  </div>
                  <p>{version.value}</p>
                  <span>
                    {version.authorName} · оригінал v{version.sourceVersion ?? '—'}
                  </span>
                  <span>{translationStatusLabel(version.status)}</span>
                  {version.reviewerName && (
                    <span>
                      Рецензент: {version.reviewerName} · {formatDate(version.reviewedAt)}
                    </span>
                  )}
                  {version.reviewReason && <p>Причина: {version.reviewReason}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p>Версія з’явиться після першого збереження перекладу.</p>
          )}
        </div>
      </section>
    </aside>
  )
}
