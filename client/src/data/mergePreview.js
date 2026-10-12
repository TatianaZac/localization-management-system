export const MERGE_FILTERS = [
  { value: 'all', label: 'Усі зміни' },
  { value: 'translation', label: 'Відмінності перекладів' },
  { value: 'source', label: 'Змінені оригінали' },
  { value: 'added', label: 'Додані' },
  { value: 'removed', label: 'Видалені' },
  { value: 'unchanged', label: 'Без змін' }
]

export const MERGE_GROUPS = {
  all: {
    title: 'Усі зміни',
    description:
      'Унікальні ключі, в яких відрізняється оригінал, переклад або наявність у версіях.',
    tone: 'neutral'
  },
  translation: {
    title: 'Відмінності перекладів',
    description: 'Порівняй переклади у двох версіях і вибери потрібний варіант.',
    tone: 'danger'
  },
  source: {
    title: 'Змінені оригінали',
    description: 'Оригінал у версіях відрізняється, тому переклад отримує статус OUTDATED.',
    tone: 'warning'
  },
  added: {
    title: 'Додані',
    description: 'Ключі, які є лише в новішій версії та будуть додані до результату.',
    tone: 'success'
  },
  removed: {
    title: 'Видалені',
    description: 'Ключі, які є в одній версії, але відсутні в іншій.',
    tone: 'neutral'
  },
  unchanged: {
    title: 'Без змін',
    description: 'Оригінал і переклад однакові в обох версіях.',
    tone: 'calm'
  }
}

export const MERGE_LOCALE = { code: 'uk', region: 'ua', name: 'Українська', flag: '🇺🇦' }

export const MERGE_VERSIONS = [
  {
    id: 'v12',
    label: 'v12',
    name: 'Settings (Налаштування)',
    date: '12 бер. 2025, 14:23',
    keys: 124,
    author: 'Олександра Іваненко'
  },
  {
    id: 'v15',
    label: 'v15',
    name: 'Settings (Налаштування)',
    date: '25 бер. 2025, 10:17',
    keys: 138,
    author: 'Марія Коваль'
  },
  {
    id: 'v11',
    label: 'v11',
    name: 'Settings (Налаштування)',
    date: '04 бер. 2025, 09:08',
    keys: 119,
    author: 'Олег Бондар'
  }
]

export const MERGE_PREVIEW = [
  {
    id: 'auto-save',
    key: 'settings.autoSave',
    targetSource: 'Auto save',
    incomingSource: 'Auto save',
    target: 'Автозбереження',
    incoming: 'Автоматичне збереження',
    translationChanged: true,
    sourceChanged: false,
    targetStatus: 'REVIEWED',
    incomingStatus: 'TRANSLATED',
    targetAuthor: 'Олександра Іваненко',
    incomingAuthor: 'Марія Коваль'
  },
  {
    id: 'notifications',
    key: 'settings.notifications',
    targetSource: 'Notifications',
    incomingSource: 'Notifications',
    target: 'Сповіщення',
    incoming: 'Повідомлення',
    translationChanged: true,
    sourceChanged: false,
    targetStatus: 'TRANSLATED',
    incomingStatus: 'TRANSLATED',
    targetAuthor: 'Олександра Іваненко',
    incomingAuthor: 'Марія Коваль'
  },
  {
    id: 'backup',
    key: 'settings.backup',
    targetSource: 'Backup',
    incomingSource: 'Backup settings',
    target: 'Резервна копія',
    incoming: 'Резервне копіювання',
    translationChanged: true,
    sourceChanged: true,
    targetStatus: 'TRANSLATED',
    incomingStatus: 'OUTDATED',
    targetAuthor: 'Олександра Іваненко',
    incomingAuthor: 'Марія Коваль'
  },
  {
    id: 'save',
    key: 'auth.save',
    targetSource: 'Save',
    incomingSource: 'Save changes',
    target: 'Зберегти',
    incoming: 'Зберегти',
    translationChanged: false,
    sourceChanged: true,
    targetStatus: 'REVIEWED',
    incomingStatus: 'OUTDATED',
    targetAuthor: 'Олександра Іваненко',
    incomingAuthor: 'Марія Коваль'
  },
  {
    id: 'delete-account',
    key: 'account.delete',
    targetSource: 'Delete',
    incomingSource: 'Delete account',
    target: 'Видалити',
    incoming: 'Видалити',
    translationChanged: false,
    sourceChanged: true,
    targetStatus: 'TRANSLATED',
    incomingStatus: 'OUTDATED',
    targetAuthor: 'Олександра Іваненко',
    incomingAuthor: 'Марія Коваль'
  },
  {
    id: 'backup-frequency',
    key: 'settings.backup.frequency',
    targetSource: '',
    incomingSource: 'Backup frequency',
    target: '',
    incoming: 'Частота резервного копіювання',
    added: true,
    translationChanged: false,
    sourceChanged: false,
    incomingStatus: 'TRANSLATED',
    incomingAuthor: 'Марія Коваль'
  },
  {
    id: 'compact-mode',
    key: 'settings.compactMode',
    targetSource: '',
    incomingSource: 'Compact mode',
    target: '',
    incoming: 'Компактний режим',
    added: true,
    translationChanged: false,
    sourceChanged: false,
    incomingStatus: 'REVIEWED',
    incomingAuthor: 'Марія Коваль'
  },
  {
    id: 'legacy-help',
    key: 'settings.legacyHelp',
    targetSource: 'Legacy help',
    incomingSource: '',
    target: 'Допомога старої версії',
    incoming: '',
    removed: true,
    translationChanged: false,
    sourceChanged: false,
    targetStatus: 'REVIEWED',
    targetAuthor: 'Олександра Іваненко'
  },
  {
    id: 'privacy',
    key: 'settings.privacy',
    targetSource: 'Privacy',
    incomingSource: 'Privacy',
    target: 'Конфіденційність',
    incoming: 'Конфіденційність',
    unchanged: true,
    translationChanged: false,
    sourceChanged: false,
    targetStatus: 'REVIEWED',
    incomingStatus: 'REVIEWED',
    targetAuthor: 'Олександра Іваненко',
    incomingAuthor: 'Марія Коваль'
  }
]

export function matchesMergeFilter(change, filter) {
  if (filter === 'all') return !change.unchanged
  if (filter === 'translation') return change.translationChanged
  if (filter === 'source') return change.sourceChanged
  return Boolean(change[filter])
}
