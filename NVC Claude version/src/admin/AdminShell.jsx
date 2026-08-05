import React from 'react'
import { Link } from 'react-router-dom'
import '../style/Admin.css'

// Shared chrome for the admin pages: language toggle, section nav, and the loading /
// unauthorized / error states every page needs to handle identically.
//
// Not a localized route like the marketing pages — this is an internal tool, so it lives at
// a single /admin path with its own BG/EN toggle rather than three SEO'd URLs. The choice is
// remembered per browser, using the same key the reviews page has always used.

const LANG_KEY = 'nvc_admin_lang_v1'

const TEXT = {
  bg: {
    nav: { reviews: 'Отзиви', gallery: 'Галерия', cases: 'Проекти' },
    loading: 'Зареждане…',
    error: 'Грешка при зареждане. Опитайте отново.',
    retry: 'Опитай отново',
    unauthorized: 'Нямате достъп. Влезте с служебния си акаунт.',
    signIn: 'Вход',
    signedInAs: 'Влезли сте като',
  },
  en: {
    nav: { reviews: 'Reviews', gallery: 'Gallery', cases: 'Cases' },
    loading: 'Loading…',
    error: 'Could not load. Try again.',
    retry: 'Retry',
    unauthorized: 'You are not signed in. Use your work account to continue.',
    signIn: 'Sign in',
    signedInAs: 'Signed in as',
  },
}

export function useAdminLang() {
  const [lang, setLang] = React.useState(() => {
    if (typeof window === 'undefined') return 'bg'
    try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'bg' } catch { return 'bg' }
  })

  React.useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang) } catch { /* private mode */ }
  }, [lang])

  return [lang, setLang]
}

export default function AdminShell({
  lang, setLang, active, title, subtitle, state, onRetry, me, actions, children,
}) {
  const t = TEXT[lang] ?? TEXT.bg

  if (state === 'unauthorized') {
    // The server redirects here with ?authError=... when the Entra callback fails, rather
    // than leaving a bare 500 on /signin-oidc. Surfacing it means a broken sign-in says why
    // instead of silently looping back to this screen.
    const authError = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('authError')
      : null

    return (
      <main className="adm-page adm-center">
        <div className="adm-card adm-signin">
          <h1>{title}</h1>
          {authError ? <div className="adm-alert">{authError}</div> : null}
          <p>{t.unauthorized}</p>
          {/* A real navigation, not fetch: the browser has to follow the redirect to
              Microsoft and back, which fetch cannot do — the login host sends no CORS
              headers, so a fetch-initiated redirect is blocked before it completes. */}
          <a className="btn" href={`/admin/signin?returnUrl=${encodeURIComponent(currentPath())}`}>
            {t.signIn}
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="adm-page">
      <header className="adm-head">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="adm-sub">{subtitle}</p> : null}
        </div>
        <div className="adm-head-side">
          <div className="adm-lang" role="group" aria-label="Language">
            {['bg', 'en'].map((code) => (
              <button
                key={code}
                type="button"
                className={lang === code ? 'is-active' : ''}
                onClick={() => setLang(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
          {me?.email ? <p className="adm-me">{t.signedInAs} <strong>{me.email}</strong></p> : null}
        </div>
      </header>

      <nav className="adm-nav" aria-label="Admin sections">
        <Link to="/admin/reviews" className={active === 'reviews' ? 'is-active' : ''}>{t.nav.reviews}</Link>
        <Link to="/admin/gallery" className={active === 'gallery' ? 'is-active' : ''}>{t.nav.gallery}</Link>
        <Link to="/admin/cases" className={active === 'cases' ? 'is-active' : ''}>{t.nav.cases}</Link>
      </nav>

      {actions ? <div className="adm-actions-bar">{actions}</div> : null}

      {state === 'loading' ? <p className="adm-muted">{t.loading}</p> : null}

      {state === 'error' ? (
        <div className="adm-card">
          <p>{t.error}</p>
          <button type="button" className="btn" onClick={onRetry}>{t.retry}</button>
        </div>
      ) : null}

      {state === 'ready' ? children : null}
    </main>
  )
}

function currentPath() {
  if (typeof window === 'undefined') return '/admin'
  return window.location.pathname || '/admin'
}
