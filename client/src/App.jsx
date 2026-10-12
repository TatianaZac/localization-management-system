// Цей файл містить кореневий React-компонент і просту маршрутизацію застосунку.

import { useEffect, useState } from 'react'
import {
  clearSessionToken,
  getCurrentUser,
  logoutUser,
  saveSessionToken
} from './api/localizationApi'
import AuthPage from './pages/AuthPage'
import MergeVersionsPage from './pages/MergeVersionsPage'
import ProjectEditorPage from './pages/ProjectEditorPage'
import ProjectsPage from './pages/ProjectsPage'

// Витягує числовий ідентифікатор проєкту з адреси сторінки редактора.
function getProjectId(pathname) {
  const match = pathname.match(/^\/projects\/(\d+)(?:\/(?:glossary|merge))?\/?$/)
  return match ? Number(match[1]) : null
}

// Перемикає між переліком проєктів і редактором відповідно до поточної адреси.
function App() {
  const [pathname, setPathname] = useState(window.location.pathname + window.location.search) //Зберігання адреси. pathname - поточна адреса,  window.location.pathname — початкове значення.
  const [user, setUser] = useState(null)
  const [glossarySeed, setGlossarySeed] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    // Синхронізує React-стан після переходу кнопками браузера «назад» або «вперед».
    function handleBackOrForward() {
      setPathname(window.location.pathname + window.location.search)
    }

    window.addEventListener('popstate', handleBackOrForward)
    return () => window.removeEventListener('popstate', handleBackOrForward)
  }, [])

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => clearSessionToken())
      .finally(() => setIsCheckingSession(false))
  }, [])

  // Змінює адресу без перезавантаження сторінки й оновлює показаний екран.
  function navigate(path) {
    //Створюється функція для переходу між сторінками.
    window.history.pushState({}, '', path) // pushState додає нову адресу до цієї історії без перезавантаження сторінки.
    setPathname(path) //pushState змінює адресу браузера, але сам по собі не змушує React перемалювати сторінку. Тому ми окремо записуємо нову адресу в React-стан:
  }

  // Спочатку зберігає токен, щоб усі наступні API-запити вже були авторизованими.
  function handleAuthenticated(session) {
    saveSessionToken(session.token)
    setUser(session.user)
    navigate('/projects')
  }

  // Навіть якщо сервер недоступний, локальну сесію очищаємо й повертаємо форму входу.
  async function handleLogout() {
    try {
      await logoutUser()
    } catch {
      // Сервер міг бути тимчасово недоступним; локальний токен усе одно не залишаємо в браузері.
    } finally {
      clearSessionToken()
      setUser(null)
      navigate('/projects')
    }
  }

  if (isCheckingSession) {
    return <main className="app-loading">Перевіряємо сесію…</main>
  }

  if (!user) {
    return <AuthPage onAuthenticated={handleAuthenticated} />
  }

  const [routePathname, routeSearch = ''] = pathname.split('?')
  const routeParams = new URLSearchParams(routeSearch)
  const projectId = getProjectId(routePathname) //Отримання ID проєкту
  const glossaryMatch = routePathname.match(/^\/projects\/(\d+)\/glossary\/?$/)
  const mergeMatch = routePathname.match(/^\/projects\/(\d+)\/merge\/?$/)
  if (mergeMatch) {
    const mergeProjectId = Number(mergeMatch[1])
    const requestedPageId = Number(routeParams.get('pageId')) || null
    const requestedLocaleCode = routeParams.get('locale') || ''
    return (
      <MergeVersionsPage
        initialLocaleCode={requestedLocaleCode}
        initialPageId={requestedPageId}
        onBack={() => navigate('/projects/' + mergeProjectId)}
        onProjectMissing={() => navigate('/projects')}
        projectId={mergeProjectId}
        standalone
      />
    )
  }
  if (projectId) {
    // Обидва розділи мають одну оболонку: навігація не скидає сторінку, версію та чернетки перекладів.
    return (
      <ProjectEditorPage
        key={projectId}
        activeSection={glossaryMatch ? 'glossary' : 'translations'}
        glossarySeed={glossarySeed?.projectId === projectId ? glossarySeed : null}
        onTranslations={() => {
          setGlossarySeed(null)
          navigate('/projects/' + projectId)
        }}
        onBack={() => navigate('/projects')}
        onGlossary={(seed) => {
          setGlossarySeed(seed ? { ...seed, projectId } : null)
          navigate('/projects/' + projectId + '/glossary')
        }}
        onMerge={({ localeCode, pageId }) => {
          const params = new URLSearchParams()
          if (pageId) params.set('pageId', pageId)
          if (localeCode) params.set('locale', localeCode)
          navigate('/projects/' + projectId + '/merge' + (params.size ? '?' + params : ''))
        }}
        onLogout={handleLogout}
        projectId={projectId}
        user={user}
      />
    )
  }

  return (
    <ProjectsPage
      onLogout={handleLogout}
      onOpenProject={(id) => navigate('/projects/' + id)}
      user={user}
    />
  )
}

export default App
