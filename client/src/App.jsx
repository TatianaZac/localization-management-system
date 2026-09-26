// Цей файл містить кореневий React-компонент і просту маршрутизацію застосунку.

import { useEffect, useState } from 'react'
import {
  clearSessionToken,
  getCurrentUser,
  logoutUser,
  saveSessionToken,
} from './api/localizationApi'
import AuthPage from './pages/AuthPage'
import ProjectEditorPage from './pages/ProjectEditorPage'
import ProjectsPage from './pages/ProjectsPage'

// Витягує числовий ідентифікатор проєкту з адреси сторінки редактора.
function getProjectId(pathname) {
  const match = pathname.match(/^\/projects\/(\d+)(?:\/glossary)?\/?$/)
  return match ? Number(match[1]) : null
}

// Перемикає між переліком проєктів і редактором відповідно до поточної адреси.
function App() {
  const [pathname, setPathname] = useState(window.location.pathname) //Зберігання адреси. pathname - поточна адреса,  window.location.pathname — початкове значення.
  const [user, setUser] = useState(null)
  const [glossarySeed, setGlossarySeed] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    // Синхронізує React-стан після переходу кнопками браузера «назад» або «вперед».
    function handleBackOrForward() {
      setPathname(window.location.pathname)
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
  function navigate(path) { //Створюється функція для переходу між сторінками.
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

  const projectId = getProjectId(pathname) //Отримання ID проєкту
  const glossaryMatch = pathname.match(/^\/projects\/(\d+)\/glossary\/?$/)
  if (projectId) {
    // Обидва розділи мають одну оболонку: навігація не скидає сторінку, версію та чернетки перекладів.
    return <ProjectEditorPage key={projectId} activeSection={glossaryMatch ? 'glossary' : 'translations'}
      glossarySeed={glossarySeed?.projectId === projectId ? glossarySeed : null}
      onTranslations={() => { setGlossarySeed(null); navigate('/projects/' + projectId) }}
      onBack={() => navigate('/projects')} onGlossary={(seed) => { setGlossarySeed(seed ? { ...seed, projectId } : null); navigate('/projects/' + projectId + '/glossary') }} onLogout={handleLogout} projectId={projectId} user={user} />
  }

  return <ProjectsPage onLogout={handleLogout} onOpenProject={(id) => navigate('/projects/' + id)} user={user} />
}

export default App
