// Цей файл показує команду проєкту та дає власнику керувати ролями й мовами.

import { useEffect, useMemo, useState } from 'react'
import LocaleMultiSelect from './LocaleMultiSelect'
import '../../styles/ProjectMembers.css'

const ROLE_LABELS = {
  OWNER: 'Власник',
  EDITOR: 'Редактор',
  REVIEWER: 'Рецензент'
}

function UserIdentity({ user }) {
  return (
    <div className="member-identity">
      <span>{user.name.slice(0, 2).toUpperCase()}</span>
      <div>
        <strong>{user.name}</strong>
        <small>{user.email}</small>
      </div>
    </div>
  )
}

function MemberRow({ isSaving, locales, member, onDelete, onLocaleChange, onRoleChange }) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const selectedIds = member.locales.map((locale) => locale.id)

  async function handleDelete() {
    const wasDeleted = await onDelete(member.id)
    if (!wasDeleted) setIsConfirmingDelete(false)
  }

  return (
    <li className="member-row">
      <UserIdentity user={member.user} />
      <select
        aria-label={'Роль ' + member.user.name}
        disabled={isSaving}
        onChange={(event) => onRoleChange(member.id, event.target.value)}
        value={member.role}
      >
        <option value="EDITOR">Редактор</option>
        <option value="REVIEWER">Рецензент</option>
      </select>
      <LocaleMultiSelect
        disabled={isSaving}
        label="Обрати мови"
        locales={locales}
        onChange={(localeIds) => onLocaleChange(member.id, localeIds)}
        selectedIds={selectedIds}
      />
      {isConfirmingDelete ? (
        <div className="member-confirm">
          <button disabled={isSaving} onClick={() => setIsConfirmingDelete(false)} type="button">
            Ні
          </button>
          <button className="danger" disabled={isSaving} onClick={handleDelete} type="button">
            Видалити
          </button>
        </div>
      ) : (
        <button
          aria-label={'Видалити ' + member.user.name}
          className="member-menu-button"
          disabled={isSaving}
          onClick={() => setIsConfirmingDelete(true)}
          title="Видалити учасника"
          type="button"
        >
          ⋮
        </button>
      )}
    </li>
  )
}

function ProjectMembers({
  data,
  isSaving,
  locales,
  onAdd,
  onDelete,
  onLocaleChange,
  onRoleChange
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('EDITOR')
  const [localeIds, setLocaleIds] = useState(() => locales.map((locale) => locale.id))
  const [query, setQuery] = useState('')

  useEffect(() => {
    setLocaleIds((currentIds) => {
      const validIds = currentIds.filter((id) => locales.some((locale) => locale.id === id))
      return validIds.length > 0 ? validIds : locales.map((locale) => locale.id)
    })
  }, [locales])

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('uk')
    if (!normalizedQuery) return data.members
    return data.members.filter((member) =>
      `${member.user.name} ${member.user.email}`.toLocaleLowerCase('uk').includes(normalizedQuery)
    )
  }, [data.members, query])

  async function handleSubmit(event) {
    event.preventDefault()
    const wasAdded = await onAdd({ email, role, localeIds })
    if (wasAdded) {
      setEmail('')
      setLocaleIds(locales.map((locale) => locale.id))
    }
  }

  return (
    <section className="members-page">
      <div className="members-page-heading">
        <h1>Учасники проєкту</h1>
        <p>Додавайте користувачів до проєкту та визначайте їхню роль і мови перекладу.</p>
      </div>

      <form className="member-invite-card" onSubmit={handleSubmit}>
        <h2>Додати учасника</h2>
        <div className="member-invite-grid">
          <label>
            Email користувача
            <input
              onChange={(event) => setEmail(event.target.value)}
              placeholder="translator@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Роль
            <select onChange={(event) => setRole(event.target.value)} value={role}>
              <option value="EDITOR">Редактор</option>
              <option value="REVIEWER">Рецензент</option>
            </select>
          </label>
          <label>
            Мови (цільові)
            <LocaleMultiSelect
              disabled={isSaving}
              label="Обрати мови"
              locales={locales}
              onChange={setLocaleIds}
              selectedIds={localeIds}
            />
          </label>
          <button className="button primary" disabled={isSaving} type="submit">
            Додати
          </button>
        </div>
      </form>

      <section className="members-list-card">
        <div className="members-list-heading">
          <h2>Учасники ({data.members.length + 1})</h2>
          <label className="members-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Пошук учасника"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Пошук за ім’ям або email…"
              type="search"
              value={query}
            />
          </label>
        </div>
        <div className="members-table-head" aria-hidden="true">
          <span>Користувач</span>
          <span>Роль</span>
          <span>Мови</span>
          <span>Дії</span>
        </div>
        <ul className="members-list">
          <li className="member-row owner-row">
            <UserIdentity user={data.owner} />
            <span className="member-role owner">{ROLE_LABELS.OWNER}</span>
            <span className="member-role all-locales">Всі мови</span>
            <span className="member-no-action">—</span>
          </li>
          {visibleMembers.map((member) => (
            <MemberRow
              isSaving={isSaving}
              key={member.id}
              locales={locales}
              member={member}
              onDelete={onDelete}
              onLocaleChange={onLocaleChange}
              onRoleChange={onRoleChange}
            />
          ))}
        </ul>
        {visibleMembers.length === 0 && query && (
          <p className="members-empty">За цим запитом учасників не знайдено.</p>
        )}
      </section>
    </section>
  )
}

export { ROLE_LABELS }
export default ProjectMembers
