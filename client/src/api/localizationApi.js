const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'

async function request(path, options = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error ?? 'Не вдалося виконати запит')
  }

  return body
}

export function getProjects() {
  return request('/projects')
}

export function getProject(projectId) {
  return request('/projects/' + projectId)
}

export function createProject(project) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

export function createLocale(projectId, locale) {
  return request('/projects/' + projectId + '/locales', {
    method: 'POST',
    body: JSON.stringify(locale),
  })
}

export function importSourceFile(projectId, content) {
  return request('/projects/' + projectId + '/import', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}
