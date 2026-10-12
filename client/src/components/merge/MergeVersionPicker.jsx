import { ArrowLeftRight, CalendarDays, GitMerge, Layers3 } from 'lucide-react'

function VersionSelect({ value, versions, onChange }) {
  const version = versions.find((item) => item.id === value)
  return (
    <section className="merge-version-select">
      <strong>
        <Layers3 size={16} />
        Версія {version?.label ?? '—'}
      </strong>
      <label>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {versions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <small>
        <CalendarDays size={13} />
        {version?.date}
        <i>•</i>
        {version?.keys} ключів
      </small>
    </section>
  )
}

export default function MergeVersionPicker({
  canMerge,
  incomingVersion,
  isComparing,
  isMerging,
  locale,
  onIncomingChange,
  onMerge,
  onSwap,
  onTargetChange,
  targetVersion,
  versions
}) {
  return (
    <div className="merge-picker-card">
      <div
        className="merge-locale-indicator"
        aria-label={`Мова об’єднання: ${locale.name}`}
        title={`Мова об’єднання: ${locale.name}`}
      >
        {locale.code === 'uk' ? 'UA' : locale.code.toUpperCase()}
      </div>
      <VersionSelect value={targetVersion} versions={versions} onChange={onTargetChange} />
      <button
        className="merge-swap"
        aria-label="Поміняти версії місцями"
        onClick={onSwap}
        type="button"
      >
        <ArrowLeftRight size={18} />
      </button>
      <VersionSelect value={incomingVersion} versions={versions} onChange={onIncomingChange} />
      <button
        className="button primary merge-compare"
        disabled={
          isComparing ||
          isMerging ||
          !canMerge ||
          targetVersion === incomingVersion ||
          versions.length < 2
        }
        onClick={onMerge}
        type="button"
      >
        <GitMerge size={17} />
        {isMerging ? 'Створюємо версію…' : isComparing ? 'Порівнюємо…' : 'Злити версії'}
      </button>
    </div>
  )
}
