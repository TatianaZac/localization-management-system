// Цей файл показує команду проєкту та дає власнику керувати ролями учасників.

import { useState } from 'react'

const ROLE_LABELS = {
  OWNER: 'Власник',
  EDITOR: 'Редактор',
  REVIEWER: 'Рецензент',
}

function UserIdentity({ user }) {
  return (
    <div className="member-identity">
      <span>{user.name.slice(0, 2).toUpperCase()}</span>
      <div><strong>{user.name}</strong><small>{user.email}</small></div>
    </div>
  )
}

// Один рядок дозволяє змінити роль або відкликати доступ із додатковим підтвердженням.
function MemberRow({ isSaving, member, onDelete, onRoleChange }) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

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
      {isConfirmingDelete ? (
        <div className="member-confirm">
          <button disabled={isSaving} onClick={() => setIsConfirmingDelete(false)} type="button">Ні</button>
          <button className="danger" disabled={isSaving} onClick={handleDelete} type="button">Відкликати</button>
        </div>
      ) : (
        <button className="member-remove" disabled={isSaving} onClick={() => setIsConfirmingDelete(true)} type="button">Прибрати</button>
      )}
    </li>
  )
}

// Форма додає учасника за email, тому акаунт має бути зареєстрований заздалегідь.
function ProjectMembers({ data, isSaving, onAdd, onClose, onDelete, onRoleChange }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('EDITOR')

  async function handleSubmit(event) {
    event.preventDefault()
    const wasAdded = await onAdd({ email, role })
    if (wasAdded) setEmail('')
  }

  return (
    <section className="members-manager">
      <div className="members-heading">
        <div><strong>Учасники проєкту</strong><small>Додай користувача за email та признач йому роль.</small></div>
        <button aria-label="Закрити учасників" onClick={onClose} type="button">×</button>
      </div>

      <form className="member-invite" onSubmit={handleSubmit}>
        <label>Email зареєстрованого користувача<input onChange={(event) => setEmail(event.target.value)} placeholder="translator@example.com" required type="email" value={email} /></label>
        <label>Роль<select onChange={(event) => setRole(event.target.value)} value={role}><option value="EDITOR">Редактор</option><option value="REVIEWER">Рецензент</option></select></label>
        <button className="button primary" disabled={isSaving} type="submit">Додати</button>
      </form>

      <ul className="members-list">
        <li className="member-row owner-row">
          <UserIdentity user={data.owner} />
          <span className="member-role owner">{ROLE_LABELS.OWNER}</span>
          <small>Керування проєктом</small>
        </li>
        {data.members.map((member) => (
          <MemberRow
            isSaving={isSaving}
            key={member.id}
            member={member}
            onDelete={onDelete}
            onRoleChange={onRoleChange}
          />
        ))}
      </ul>
    </section>
  )
}

export { ROLE_LABELS }
export default ProjectMembers
