import { CheckCircle2, EllipsisVertical } from 'lucide-react'

function StatusBadge({ status }) {
  if (!status) return null

  return <mark className={status.toLowerCase()}>{status}</mark>
}

export default function MergePresenceTable({ changes, incomingVersion, targetVersion }) {
  return (
    <div className="merge-presence-table" role="table">
      <div className="merge-presence-table-head" role="row">
        <span role="columnheader">Ключ / версія</span>
        <span role="columnheader">Оригінал (EN)</span>
        <span role="columnheader">Переклад (UK)</span>
        <span role="columnheader">Статус / Примітка</span>
      </div>

      {changes.map((change) => {
        const isAdded = change.added
        const source = isAdded ? change.incomingSource : change.targetSource
        const translation = isAdded ? change.incoming : change.target
        const status = isAdded ? change.incomingStatus : change.targetStatus

        return (
          <div className="merge-presence-table-row" role="row" key={change.id}>
            <div className="merge-presence-key" role="cell">
              <strong>{change.key}</strong>
              <small>
                {isAdded
                  ? `Новий ключ із версії ${incomingVersion}`
                  : `Ключ є у ${targetVersion}, але відсутній у ${incomingVersion}`}
              </small>
            </div>
            <div className="merge-presence-cell" data-label="Оригінал (EN)" role="cell">
              {source}
            </div>
            <div className="merge-presence-cell" data-label="Переклад (UK)" role="cell">
              {translation}
            </div>
            <div className="merge-presence-status" data-label="Статус / Примітка" role="cell">
              <StatusBadge status={status} />
              {isAdded && (
                <span>
                  <CheckCircle2 size={17} />
                  Додані до {incomingVersion}
                </span>
              )}
              <button aria-label={`Інші дії для ${change.key}`} type="button">
                <EllipsisVertical size={22} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
