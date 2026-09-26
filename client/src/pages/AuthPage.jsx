// Цей файл показує форми входу та реєстрації користувача LocaleFlow.

import { useState } from 'react'
import { loginUser, registerUser } from '../api/localizationApi'
import '../styles/AuthPage.css'

// Перемикає режими входу й реєстрації та передає успішну сесію кореневому компоненту.
function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const session = mode === 'register'
        ? await registerUser({ name, email, password })
        : await loginUser({ email, password })
      onAuthenticated(session)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Очищає пароль і стару помилку, щоб дані одного режиму не залишалися в іншому.
  function switchMode(nextMode) {
    setMode(nextMode)
    setPassword('')
    setError('')
  }

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="auth-brand"><span>L</span><strong>LocaleFlow</strong></div>
        <div>
          <p className="eyebrow">Localization workspace</p>
          <h1>Керуй перекладами в одному місці</h1>
          <p>Створюй проєкти, відстежуй актуальність текстів і експортуй готові локалізації.</p>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-tabs" role="tablist">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">Вхід</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Реєстрація</button>
        </div>
        <div className="auth-heading">
          <h2>{mode === 'login' ? 'З поверненням' : 'Створи обліковий запис'}</h2>
          <p>{mode === 'login' ? 'Увійди, щоб відкрити свої проєкти.' : 'Новий акаунт матиме власний робочий простір.'}</p>
        </div>

        {error && <div className="message error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              Ім’я
              <input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="Андрій" required value={name} />
            </label>
          )}
          <label>
            Email
            <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required type="email" value={email} />
          </label>
          <label>
            Пароль
            <input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength="8" onChange={(event) => setPassword(event.target.value)} placeholder="Щонайменше 8 символів" required type="password" value={password} />
          </label>
          <button className="button primary full-width" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Зачекай…' : (mode === 'login' ? 'Увійти' : 'Зареєструватися')}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AuthPage
