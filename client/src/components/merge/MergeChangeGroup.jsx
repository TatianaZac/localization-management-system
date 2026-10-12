import { AlertTriangle, ChevronDown, CircleMinus, CirclePlus, Equal, Pencil } from 'lucide-react'
import MergeChangeCard from './MergeChangeCard'
import MergePresenceTable from './MergePresenceTable'

const ICONS = {
  all: Equal,
  translation: AlertTriangle,
  source: Pencil,
  added: CirclePlus,
  removed: CircleMinus,
  unchanged: Equal
}

export default function MergeChangeGroup({
  changes,
  decisions,
  group,
  groupType,
  incomingVersion,
  onDecision,
  targetVersion
}) {
  const Icon = ICONS[groupType] ?? Equal
  const isPresenceGroup = groupType === 'added' || groupType === 'removed'
  const isCategoryGroup =
    isPresenceGroup ||
    groupType === 'source' ||
    groupType === 'translation' ||
    groupType === 'unchanged'
  const regularChanges = changes.filter((change) => !change.added && !change.removed)
  const addedChanges = changes.filter((change) => change.added)
  const removedChanges = changes.filter((change) => change.removed)
  const descriptionsByType = {
    translation: `Переклади у ${targetVersion} та ${incomingVersion} відрізняються. Вибери потрібний варіант.`,
    source: `Оригінал у ${targetVersion} та ${incomingVersion} відрізняється, тому переклад отримує статус OUTDATED.`,
    added: `Ключі є у ${incomingVersion}, але відсутні у ${targetVersion}, і будуть додані до результату.`,
    removed: `Ключі є у ${targetVersion}, але відсутні у ${incomingVersion}.`
  }
  const description = descriptionsByType[groupType] ?? group.description

  return (
    <details
      className={`merge-change-group ${group.tone} ${groupType}${isPresenceGroup ? ' presence' : ''}${isCategoryGroup ? ' category' : ''}`}
      open
    >
      <summary>
        <span className="merge-group-icon">
          <Icon size={isCategoryGroup ? 30 : 20} />
        </span>
        <div>
          <span className="merge-group-title">
            <strong>{group.title}</strong>
            {isCategoryGroup && <mark>{changes.length}</mark>}
          </span>
          <p className="merge-group-description">{description}</p>
        </div>
        {!isCategoryGroup && <mark>{changes.length}</mark>}
        <ChevronDown className="merge-group-chevron" size={18} />
      </summary>
      <div className="merge-group-content">
        {isPresenceGroup ? (
          <MergePresenceTable
            changes={changes}
            incomingVersion={incomingVersion}
            targetVersion={targetVersion}
          />
        ) : (
          <>
            {regularChanges.map((change) => (
              <MergeChangeCard
                change={change}
                decision={decisions[change.id]}
                incomingVersion={incomingVersion}
                key={change.id}
                onDecision={onDecision}
                targetVersion={targetVersion}
              />
            ))}
            {addedChanges.length > 0 && (
              <MergePresenceTable
                changes={addedChanges}
                incomingVersion={incomingVersion}
                targetVersion={targetVersion}
              />
            )}
            {removedChanges.length > 0 && (
              <MergePresenceTable
                changes={removedChanges}
                incomingVersion={incomingVersion}
                targetVersion={targetVersion}
              />
            )}
          </>
        )}
      </div>
    </details>
  )
}
