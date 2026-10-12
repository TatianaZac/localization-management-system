export default function MergeFilters({ activeFilter, counts, filters, onChange }) {
  return (
    <nav className="merge-filters" aria-label="Фільтри змін">
      {filters.map((filter) => (
        <button
          className={activeFilter === filter.value ? 'active' : ''}
          key={filter.value}
          onClick={() => onChange(filter.value)}
          type="button"
        >
          {filter.label}
          <span>{counts[filter.value]}</span>
        </button>
      ))}
    </nav>
  )
}
