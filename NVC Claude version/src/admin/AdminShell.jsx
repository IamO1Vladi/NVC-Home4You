import React from 'react'
import { Link } from 'react-router-dom'
import { adminGet } from './adminApi.js'
import '../style/Admin.css'

// Shared chrome for the admin pages: navigation, language toggle, who is signed in, and the
// loading / unauthorized / error states every page needs to handle identically.
//
// Not a localized route like the marketing pages — this is an internal tool, so it lives at
// a single /admin path with its own BG/EN toggle rather than three SEO'd URLs. The choice is
// remembered per browser, using the same key the reviews page has always used.
//
// The navigation is a sidebar on desktop and a bottom tab bar on phones. That is deliberate:
// the people using this are not developers, and a bottom bar is the one navigation pattern
// every phone app has already taught them. It also leaves room for the sections still to
// come (leads) without the tab strip overflowing off-screen the way the old one did.

const LANG_KEY = 'nvc_admin_lang_v1'

const TEXT = {
  bg: {
    brand: 'Администрация',
    nav: { home: 'Начало', leads: 'Запитвания', pipeline: 'Сделки', reviews: 'Отзиви', gallery: 'Галерия', cases: 'Проекти' },
    loading: 'Зареждане…',
    error: 'Нещо се обърка при зареждането.',
    errorHint: 'Проверете интернет връзката си и опитайте отново.',
    retry: 'Опитай отново',
    unauthorized: 'За да продължите, влезте със служебния си акаунт.',
    unauthorizedTitle: 'Необходим е вход',
    signIn: 'Вход с Microsoft',
    signOut: 'Изход',
    menu: 'Меню',
    language: 'Език',
  },
  en: {
    brand: 'Admin',
    nav: { home: 'Home', leads: 'Leads', pipeline: 'Deals', reviews: 'Reviews', gallery: 'Gallery', cases: 'Cases' },
    loading: 'Loading…',
    error: 'Something went wrong while loading.',
    errorHint: 'Check your internet connection and try again.',
    retry: 'Try again',
    unauthorized: 'Sign in with your work account to continue.',
    unauthorizedTitle: 'Sign-in required',
    signIn: 'Sign in with Microsoft',
    signOut: 'Sign out',
    menu: 'Menu',
    language: 'Language',
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

// Stroke icons rather than emoji: emoji render differently on every OS and at sizes nobody
// controls, which on a nav bar reads as broken rather than as decoration.
const Icon = {
  home: <path d="M3 10.2 12 3l9 7.2M5.4 8.7V20h13.2V8.7" />,
  reviews: <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" />,
  gallery: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.6" cy="10" r="1.8" />
      <path d="m3.6 17.4 4.8-4.3 4 3.4 3.2-2.6 4.4 3.6" />
    </>
  ),
  cases: (
    <>
      <rect x="2.8" y="7.4" width="18.4" height="12.6" rx="2.4" />
      <path d="M8.6 7.4V5.6a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.8M2.8 12.4h18.4" />
    </>
  ),
  // An inbox: leads arrive, get picked up, and leave the tray.
  leads: (
    <>
      <path d="M3.2 13.4h4.1l1.4 2.6h6.6l1.4-2.6h4.1" />
      <path d="M5.6 4.6h12.8l3 8.8V19a1.6 1.6 0 0 1-1.6 1.6H4.2A1.6 1.6 0 0 1 2.6 19v-5.6z" />
    </>
  ),
  // Two speech bubbles: the pipeline is where the conversation lives, and the icon has
  // to say "talking to someone" rather than repeat the inbox next to it.
  pipeline: (
    <>
      <path d="M3.4 6.2a1.8 1.8 0 0 1 1.8-1.8h9.6a1.8 1.8 0 0 1 1.8 1.8v5a1.8 1.8 0 0 1-1.8 1.8H8.2l-3.4 2.8v-2.8a1.4 1.4 0 0 1-1.4-1.4z" />
      <path d="M19 9.4a1.6 1.6 0 0 1 1.6 1.6v4.4a1.6 1.6 0 0 1-1.6 1.6v2.4l-2.8-2.4h-3.6" />
    </>
  ),
}

function NavIcon({ name }) {
  return (
    <svg className="adm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Icon[name]}
    </svg>
  )
}

const SECTIONS = [
  { key: 'home', to: '/admin' },
  // Leads sit directly after Home: it is the one section with work waiting in it, and
  // the only one someone opens every morning.
  { key: 'leads', to: '/admin/leads' },
  // Straight after the enquiry queue, because that is the journey: an enquiry arrives in
  // Leads, and the conversation that follows it lives here.
  { key: 'pipeline', to: '/admin/pipeline' },
  { key: 'reviews', to: '/admin/reviews' },
  { key: 'gallery', to: '/admin/gallery' },
  { key: 'cases', to: '/admin/cases' },
]

// `me` and the pending-review count are chrome, not page data, so the shell fetches them
// once instead of every page repeating the call. Counts refresh whenever a page finishes
// loading, which is what makes the badge drop as soon as a review is approved.
function useAdminChrome(state) {
  const [me, setMe] = React.useState(null)
  const [pending, setPending] = React.useState(0)
  const [outstandingLeads, setOutstandingLeads] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    adminGet('/api/admin/me')
      .then((who) => { if (alive) setMe(who) })
      .catch(() => { /* the page's own state already covers 401 and errors */ })
    return () => { alive = false }
  }, [])

  React.useEffect(() => {
    if (state !== 'ready') return undefined
    let alive = true
    adminGet('/api/admin/reviews/counts')
      .then((counts) => { if (alive) setPending(Number(counts?.pending) || 0) })
      .catch(() => { /* a missing badge is better than a broken page */ })
    adminGet('/api/admin/leads/counts')
      .then((counts) => { if (alive) setOutstandingLeads(Number(counts?.notReachedOut) || 0) })
      .catch(() => { /* same */ })
    return () => { alive = false }
  }, [state])

  return { me, pending, outstandingLeads }
}

export default function AdminShell({
  lang, setLang, active, title, subtitle, state, onRetry, actions, children,
}) {
  const t = TEXT[lang] ?? TEXT.bg
  const { me, pending, outstandingLeads } = useAdminChrome(state)

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
          <div className="adm-signin-mark" aria-hidden="true">NVC</div>
          <h1>{t.unauthorizedTitle}</h1>
          {authError ? <div className="adm-alert">{authError}</div> : null}
          <p className="adm-muted">{t.unauthorized}</p>
          {/* A real navigation, not fetch: the browser has to follow the redirect to
              Microsoft and back, which fetch cannot do — the login host sends no CORS
              headers, so a fetch-initiated redirect is blocked before it completes. */}
          <a className="btn adm-btn-lg" href={`/admin/signin?returnUrl=${encodeURIComponent(currentPath())}`}>
            {t.signIn}
          </a>
        </div>
      </main>
    )
  }

  const nav = SECTIONS.map(({ key, to }) => (
    <Link
      key={key}
      to={to}
      className={active === key ? 'is-active' : ''}
      aria-current={active === key ? 'page' : undefined}
    >
      <NavIcon name={key} />
      <span className="adm-nav-label">{t.nav[key]}</span>
      {key === 'reviews' && pending > 0
        ? <span className="adm-dot" aria-label={`${pending}`}>{pending}</span>
        : null}
      {key === 'leads' && outstandingLeads > 0
        ? <span className="adm-dot" aria-label={`${outstandingLeads}`}>{outstandingLeads}</span>
        : null}
    </Link>
  ))

  return (
    <div className="adm-app">
      {/* One bar across the top on every size. The identity, language and sign-out controls
          exist once in the DOM: the sidebar is hidden on phones, so anything living only
          inside it would be unreachable there. */}
      <div className="adm-topbar">
        <Link to="/admin" className="adm-brand">
          <span className="adm-brand-mark" aria-hidden="true">NVC</span>
          <span className="adm-brand-text">{t.brand}</span>
        </Link>

        <div className="adm-topbar-side">
          <div className="adm-lang" role="group" aria-label={t.language}>
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

          {me?.email ? (
            <div className="adm-who">
              <span className="adm-avatar" aria-hidden="true">{initials(me)}</span>
              <span className="adm-who-mail">{me.email}</span>
            </div>
          ) : null}

          {/* Shared office machines: leaving with the session open is the realistic risk,
              and until now there was a /admin/signout endpoint with nothing pointing at it. */}
          <a className="adm-signout" href="/admin/signout">{t.signOut}</a>
        </div>
      </div>

      <aside className="adm-side">
        <nav className="adm-side-nav" aria-label={t.menu}>{nav}</nav>
      </aside>

      <main className="adm-page">
        <header className="adm-head">
          <div className="adm-head-text">
            <h1>{title}</h1>
            {subtitle ? <p className="adm-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="adm-head-actions">{actions}</div> : null}
        </header>

        {state === 'loading' ? (
          <div className="adm-loading" role="status">
            <span className="adm-spinner" aria-hidden="true" />
            <span className="adm-muted">{t.loading}</span>
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="adm-card adm-center adm-errbox">
            <p><strong>{t.error}</strong></p>
            <p className="adm-muted adm-small">{t.errorHint}</p>
            <button type="button" className="btn" onClick={onRetry}>{t.retry}</button>
          </div>
        ) : null}

        {state === 'ready' ? children : null}
      </main>

      <nav className="adm-tabbar" aria-label={t.menu}>{nav}</nav>
    </div>
  )
}

function initials(me) {
  const source = (me?.name || me?.email || '').trim()
  if (!source) return '?'
  const parts = source.split(/[\s.@]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase()
}

// Always an /admin path. Anything else would hand the sign-in redirect an arbitrary
// destination, and there is no legitimate reason to come back from Entra to a marketing page.
function currentPath() {
  if (typeof window === 'undefined') return '/admin'
  const path = window.location.pathname || ''
  return path.startsWith('/admin') ? path : '/admin'
}
