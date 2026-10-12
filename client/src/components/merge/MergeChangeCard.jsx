import { Check, Circle, Copy } from 'lucide-react'

function TranslationOption({ active, author, label, onSelect, source, status, value, version }) {
  return (
    <button
      className={`merge-translation-option${active ? ' selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <div className="merge-option-heading">
        <strong>
          {label}
          <em>{version}</em>
        </strong>
        {active ? <Check size={18} /> : <Circle size={18} />}
      </div>
      <dl>
        <div>
          <dt>Оригінал</dt>
          <dd>{source || 'Відсутній'}</dd>
        </div>
        <div>
          <dt>Переклад</dt>
          <dd>{value || 'Відсутній'}</dd>
        </div>
      </dl>
      <footer>
        <span>{author || 'Автор не вказаний'}</span>
        {status && <mark className={status.toLowerCase()}>{status}</mark>}
      </footer>
    </button>
  )
}

export default function MergeChangeCard({
  change,
  decision,
  incomingVersion,
  onDecision,
  targetVersion
}) {
  return (
    <article className={`merge-change-card${change.sourceChanged ? ' source-changed' : ''}`}>
      <header className="merge-key-summary">
        <div>
          <strong>{change.key}</strong>
          <button aria-label="Копіювати ключ" type="button">
            <Copy size={14} />
          </button>
        </div>
        <div className="merge-change-tags">
          {change.translationChanged && <span>Переклад відрізняється</span>}
          {change.sourceChanged && <span className="source">Оригінал змінено</span>}
          {change.added && <span className="added">Додано</span>}
          {change.removed && <span className="removed">Видалено</span>}
          {change.unchanged && <span className="unchanged">Без змін</span>}
        </div>
      </header>
      <div className="merge-option-grid">
        <TranslationOption
          active={decision?.choice === 'target'}
          author={change.targetAuthor}
          label="Версія"
          onSelect={() => onDecision(change.id, 'target', change.target)}
          source={change.targetSource}
          status={change.targetStatus}
          value={change.target}
          version={targetVersion}
        />
        <TranslationOption
          active={decision?.choice === 'incoming'}
          author={change.incomingAuthor}
          label="Версія"
          onSelect={() => onDecision(change.id, 'incoming', change.incoming)}
          source={change.incomingSource}
          status={change.sourceChanged ? 'OUTDATED' : change.incomingStatus}
          value={change.incoming}
          version={incomingVersion}
        />
      </div>
    </article>
  )
}
