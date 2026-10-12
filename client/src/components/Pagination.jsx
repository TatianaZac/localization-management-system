// Цей компонент однаково показує перемикання сторінок у таблицях перекладу та глосарію.

import '../styles/Pagination.css'

const PAGE_SIZE_OPTIONS = [10, 25, 50]

// Показує сусідні сторінки, а довгі проміжки стискає в багатокрапку.
function pageItems(currentPage, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  const pages = new Set([1, pageCount, currentPage - 1, currentPage, currentPage + 1])
  const valid = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b)
  const items = []
  valid.forEach((page, index) => {
    if (index && page - valid[index - 1] > 1) items.push(`gap-${page}`)
    items.push(page)
  })
  return items
}

export default function Pagination({
  currentPage,
  onPageChange,
  onPageSizeChange,
  pageSize,
  totalItems,
  itemLabel = 'записів'
}) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(currentPage, 1), pageCount)
  const start = totalItems ? (safePage - 1) * pageSize + 1 : 0
  const end = Math.min(safePage * pageSize, totalItems)

  return (
    <nav className="pagination" aria-label="Пагінація">
      <span className="pagination-summary">
        {start}–{end} із {totalItems} {itemLabel}
      </span>
      <label className="pagination-size">
        На сторінці
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <div className="pagination-pages">
        <button
          aria-label="Попередня сторінка"
          disabled={safePage === 1}
          onClick={() => onPageChange(safePage - 1)}
          type="button"
        >
          ‹
        </button>
        {pageItems(safePage, pageCount).map((item) =>
          typeof item === 'number' ? (
            <button
              aria-current={item === safePage ? 'page' : undefined}
              className={item === safePage ? 'active' : ''}
              key={item}
              onClick={() => onPageChange(item)}
              type="button"
            >
              {item}
            </button>
          ) : (
            <span aria-hidden="true" key={item}>
              …
            </span>
          )
        )}
        <button
          aria-label="Наступна сторінка"
          disabled={safePage === pageCount}
          onClick={() => onPageChange(safePage + 1)}
          type="button"
        >
          ›
        </button>
      </div>
    </nav>
  )
}
