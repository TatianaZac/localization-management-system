// Цей файл містить усі HTTP-запити клієнта до API керування локалізаціями.

//import.meta.env.VITE_API_URL — налаштування адреси через Vite
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'
const SESSION_TOKEN_KEY = 'localeflow_session_token'

export function saveSessionToken(token) {
  localStorage.setItem(SESSION_TOKEN_KEY, token)
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_TOKEN_KEY)
}

function getSessionToken() {
  return localStorage.getItem(SESSION_TOKEN_KEY)
}

// Виконує типовий JSON-запит і перетворює неуспішну відповідь на помилку.
async function request(path, options = {}) {
  const token = getSessionToken()
  const response = await fetch(API_URL + path, {
    ...options, //Копіює передані налаштування в об’єкт запиту.
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? 'Не вдалося виконати запит')
  }

  return body
}

// Створює перший або наступний обліковий запис і повертає його сесію.
export function registerUser(credentials) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

// Відкриває нову серверну сесію за email і паролем.
export function loginUser(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export function getCurrentUser() {
  return request('/auth/me')
}

export function logoutUser() {
  return request('/auth/logout', { method: 'POST' })
}

// Отримує список усіх локалізаційних проєктів.
export function getProjects() { // Просить сервер повернути всі проєкти
  return request('/projects') // Надішли запит на адресу і поверни результат.
}

// Отримує повні дані одного проєкту за його ідентифікатором.
export function getProject(projectId, selection = {}) {
  return request('/projects/' + projectId + selectionQuery(selection))
}

// ID версії завжди передається разом зі сторінкою, до якої вона належить.
function selectionQuery(selection) {
  const params = new URLSearchParams()
  if (selection.pageId) params.set('pageId', selection.pageId)
  if (selection.versionId) params.set('versionId', selection.versionId)
  return params.size ? '?' + params.toString() : ''
}

// Створює новий проєкт із вихідною локаллю.
export function createProject(project) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

// Оновлює назву й опис наявного проєкту.
export function updateProject(projectId, project) {
  return request('/projects/' + projectId, {
    method: 'PATCH',
    body: JSON.stringify(project),
  })
}

// Видаляє проєкт разом із пов'язаними даними після підтвердження в інтерфейсі.
export function deleteProject(projectId) {
  return request('/projects/' + projectId, {
    method: 'DELETE',
  })
}

// Отримує власника та запрошених учасників проєкту.
export function getProjectMembers(projectId) {
  return request('/projects/' + projectId + '/members')
}

// Додає вже зареєстрованого користувача за email.
export function addProjectMember(projectId, member) {
  return request('/projects/' + projectId + '/members', {
    method: 'POST',
    body: JSON.stringify(member),
  })
}

export function updateProjectMember(projectId, memberId, role) {
  return request('/projects/' + projectId + '/members/' + memberId, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function deleteProjectMember(projectId, memberId) {
  return request('/projects/' + projectId + '/members/' + memberId, {
    method: 'DELETE',
  })
}

// Додає до проєкту нову цільову локаль.
export function createLocale(projectId, locale) {
  return request('/projects/' + projectId + '/locales', {
    method: 'POST',
    body: JSON.stringify(locale),
  })
}

// Перейменовує цільову мову, не змінюючи її коду.
export function updateLocale(projectId, localeId, name) {
  return request('/projects/' + projectId + '/locales/' + localeId, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

// Видаляє цільову мову разом із перекладами цією мовою.
export function deleteLocale(projectId, localeId) {
  return request('/projects/' + projectId + '/locales/' + localeId, {
    method: 'DELETE',
  })
}

// Імпортує JSON із текстами вихідної локалі проєкту.
export function importSourceFile(projectId, content, options = {}) {
  return request('/projects/' + projectId + '/import', {
    method: 'POST',
    body: JSON.stringify({ content, ...options }),
  })
}

// Приховує версію, залишаючи її історію в базі даних.
export function deletePageVersion(projectId, versionId) {
  return request('/projects/' + projectId + '/versions/' + versionId, { method: 'DELETE' })
}

// Зберігає значення та статус окремого перекладу.
export function updateTranslation(projectId, translationId, value, status, reviewReason) {
  return request('/projects/' + projectId + '/translations/' + translationId, {
    method: 'PATCH',
    body: JSON.stringify({ value, status, reviewReason }),
  })
}

// Зберігає коментар до окремого перекладу.
export function updateTranslationComment(projectId, translationId, comment) {
  return request('/projects/' + projectId + '/translations/' + translationId + '/comment', {
    method: 'PATCH',
    body: JSON.stringify({ comment }),
  })
}

// Читає спільний словник лише в межах доступного проєкту.
export function getGlossary(projectId) {
  return request('/projects/' + projectId + '/glossary')
}

// Зміна терміна також є новою пропозицією, яку має погодити рецензент.
export function saveGlossaryEntry(projectId, entryId, entry) {
  return request('/projects/' + projectId + '/glossary', {
    method: 'POST', body: JSON.stringify(entry),
  })
}

// Надсилає рішення разом із версією запису для захисту від одночасних змін.
export function reviewGlossaryEntry(projectId, entryId, decision) {
  return request('/projects/' + projectId + '/glossary/' + entryId + '/review', { method: 'PATCH', body: JSON.stringify(decision) })
}

// Оновлює спільне для всіх мов визначення поняття.
export function updateGlossaryConcept(projectId, conceptId, definition) {
  return request('/projects/' + projectId + '/glossary-concepts/' + conceptId, { method: 'PATCH', body: JSON.stringify({ definition }) })
}

// Завантажує сформований JSON перекладу через тимчасове браузерне посилання.
export async function downloadLocaleFile(projectId, localeCode, selection = {}, fileName = localeCode + '.json') {
  const token = getSessionToken()
  const response = await fetch(API_URL + '/projects/' + projectId + '/export/' + localeCode + selectionQuery(selection), {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? 'Не вдалося експортувати файл')
  }

  const blob = await response.blob()
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName
  link.click()
  URL.revokeObjectURL(downloadUrl)
}
