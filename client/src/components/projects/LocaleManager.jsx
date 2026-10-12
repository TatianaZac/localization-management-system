// показує доступні мови проєкту та дозволяє власнику керувати цільовими мовами.

import { useEffect, useMemo, useState } from 'react'

function formatLocaleDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

function getLocaleStats(locale, translationKeys, projectStats) {
  if (projectStats) return projectStats
  if (locale.isSource) {
    return {
      completed: translationKeys.length,
      total: translationKeys.length,
      percent: 100,
      updatedAt: null
    }
  }

  const translations = translationKeys
    .map((key) => key.translations.find((translation) => translation.locale.code === locale.code))
    .filter(Boolean)
  const completed = translations.filter((translation) => translation.value?.trim()).length
  const updatedAt = translations.reduce((latest, translation) => {
    if (!translation.updatedAt) return latest
    return !latest || new Date(translation.updatedAt) > new Date(latest)
      ? translation.updatedAt
      : latest
  }, null)

  return {
    completed,
    total: translationKeys.length,
    percent: translationKeys.length ? Math.round((completed / translationKeys.length) * 100) : 0,
    updatedAt
  }
}

function LocaleRow({
  isOwner,
  isSaving,
  locale,
  pageCount,
  selected,
  stats,
  onDelete,
  onOpen,
  onRename
}) {
  const [name, setName] = useState(locale.name)
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  useEffect(() => setName(locale.name), [locale.name])

  async function saveName() {
    const wasUpdated = await onRename(locale.id, name)
    if (wasUpdated) setIsEditing(false)
    else setName(locale.name)
  }

  async function removeLocale() {
    const wasDeleted = await onDelete(locale.id)
    if (!wasDeleted) setIsConfirmingDelete(false)
  }

  return (
    <li className={'locale-card' + (selected ? ' selected' : '')}>
      <span className={'locale-code' + (locale.isSource ? ' source' : '')}>
        {locale.code.toUpperCase()}
      </span>
      <div className="locale-identity">
        {isEditing ? (
          <input
            aria-label="Назва мови"
            autoFocus
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        ) : (
          <strong>{locale.name}</strong>
        )}
        <small>
          {locale.isSource
            ? 'Базова мова проєкту'
            : selected
              ? 'Вибрана цільова мова'
              : 'Цільова мова'}
        </small>
      </div>

      {locale.isSource ? (
        <div className="locale-source-note">
          <span>Мова оригіналу</span>
          <small>Використовується як джерело текстів</small>
        </div>
      ) : (
        <div className="locale-progress">
          <div>
            <span>Прогрес перекладу</span>
            <strong>{stats.percent}%</strong>
          </div>
          <progress max="100" value={stats.percent}>
            {stats.percent}%
          </progress>
          <small>
            {stats.completed} з {stats.total} ключів перекладено
          </small>
        </div>
      )}

      <dl className="locale-metrics">
        <div>
          <dt>Ключі</dt>
          <dd>{stats.total}</dd>
        </div>
        <div>
          <dt>Файли</dt>
          <dd>{pageCount}</dd>
        </div>
        <div>
          <dt>Останнє оновлення</dt>
          <dd>{formatLocaleDate(stats.updatedAt)}</dd>
        </div>
      </dl>

      <div className="locale-card-actions">
        {!locale.isSource && (
          <button
            className={`button ${selected ? 'secondary' : 'primary'}`}
            disabled={isSaving || selected}
            onClick={() => onOpen(locale.code)}
            type="button"
          >
            {selected ? 'Вибрано' : 'Обрати'}
          </button>
        )}
        {isOwner &&
          !locale.isSource &&
          (isEditing ? (
            <>
              <button
                className="small-action"
                disabled={isSaving || !name.trim()}
                onClick={saveName}
                type="button"
              >
                Зберегти
              </button>
              <button
                className="small-action"
                disabled={isSaving}
                onClick={() => {
                  setName(locale.name)
                  setIsEditing(false)
                }}
                type="button"
              >
                Скасувати
              </button>
            </>
          ) : isConfirmingDelete ? (
            <>
              <button
                className="small-action"
                disabled={isSaving}
                onClick={() => setIsConfirmingDelete(false)}
                type="button"
              >
                Ні
              </button>
              <button
                className="small-action danger"
                disabled={isSaving}
                onClick={removeLocale}
                type="button"
              >
                Видалити
              </button>
            </>
          ) : (
            <>
              <button
                className="small-action"
                disabled={isSaving}
                onClick={() => setIsEditing(true)}
                type="button"
              >
                Редагувати
              </button>
              <button
                className="small-action danger"
                disabled={isSaving}
                onClick={() => setIsConfirmingDelete(true)}
                type="button"
              >
                Видалити
              </button>
            </>
          ))}
      </div>
    </li>
  )
}

function LocaleManager({
  isOwner,
  isSaving,
  localeStats,
  locales,
  pageCount,
  selectedLocaleCode,
  translationKeys,
  onDelete,
  onOpen,
  onRename
}) {
  const sortedLocales = useMemo(
    () =>
      [...locales].sort(
        (left, right) =>
          Number(right.isSource) - Number(left.isSource) || left.name.localeCompare(right.name)
      ),
    [locales]
  )

  return (
    <section className="locale-manager" aria-label="Мови проєкту">
      <ul>
        {sortedLocales.map((locale) => (
          <LocaleRow
            isOwner={isOwner}
            isSaving={isSaving}
            key={locale.id}
            locale={locale}
            onDelete={onDelete}
            onOpen={onOpen}
            onRename={onRename}
            pageCount={pageCount}
            selected={locale.code === selectedLocaleCode}
            stats={getLocaleStats(locale, translationKeys, localeStats?.[locale.code])}
          />
        ))}
      </ul>
      {sortedLocales.length === 1 && (
        <p className="locale-empty">
          Цільових мов поки немає. Власник проєкту може додати першу мову.
        </p>
      )}
    </section>
  )
}

export default LocaleManager
