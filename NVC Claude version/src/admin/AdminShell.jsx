import React from 'react'
import { Link } from 'react-router-dom'
import { adminGet } from './adminApi.js'
import '../style/Admin.css'

// Shared chrome for the admin pages: navigation, language toggle, who is signed in, and the
// loading / unauthorized / forbidden / error states every page needs to handle identically.
//
// Not a localized route like the marketing pages — this is an internal tool, so it lives at
// a single /admin path with its own BG/EN toggle rather than three SEO'd URLs. The choice is
// remembered per browser, using the same key the reviews page has always used.
//
// The navigation is a sidebar on desktop and a bottom tab bar on phones. That is deliberate:
// the people using this are not developers, and a bottom bar is the one navigation pattern
// every phone app has already taught them. It also leaves room for the sections still to
// come without the tab strip overflowing off-screen the way the old one did.
//
// TWO WORDS THAT USED TO BE ONE. An "inquiry" (запитване) is the form somebody filled in on
// the site; a "lead" is the person we are now talking to. The panel called the first one
// "leads" and the second one "deals", which meant every conversation about the panel needed
// a translation step first. The nav keys below are still `leads` and `pipeline` because that
// is what the API routes are called — renaming those is a separate change with nothing in it
// for the people using this.
//
// TWO PANELS, ONE SHELL (ROADMAP #38). A representative signs in through the same Entra
// flow as staff and lands in a panel that is this chrome around one section: his own
// leads. The `area` prop picks which panel this is. 'admin' is everything above; 'rep' is
// the one section, /api/rep/me for who is signed in, and no badges — the two counts are
// admin endpoints, and a representative has no queue to count. The sign-in card, the
// sign-in and sign-out links, the language and the theme are the same in both, because
// they are the same thing.

const LANG_KEY = 'nvc_admin_lang_v1'
const THEME_KEY = 'nvc_admin_theme_v1'

const TEXT = {
  bg: {
    brand: 'Администрация',
    brandRep: 'Представител',
    nav: {
      home: 'Начало', leads: 'Запитвания', pipeline: 'Лийдове', customers: 'Клиенти',
      factories: 'Фабрики', orders: 'Поръчки',
      reviews: 'Отзиви', gallery: 'Галерия', cases: 'Проекти', documents: 'Брошури',
      factorySheets: 'Фабрични поръчки', audit: 'Одит',
      // The representatives' panel's one section (#38).
      myLeads: 'Моите лийдове',
    },
    loading: 'Зареждане…',
    error: 'Нещо се обърка при зареждането.',
    errorHint: 'Проверете интернет връзката си и опитайте отново.',
    retry: 'Опитай отново',
    unauthorized: 'За да продължите, влезте със служебния си акаунт.',
    unauthorizedTitle: 'Необходим е вход',
    // Signed in and refused (403): the wrong panel, not a broken one. See the card below.
    forbiddenTitle: 'Няма достъп',
    forbiddenRep: 'Този панел е за представители.',
    forbiddenRepHint: 'Ако сте служител, използвайте Администрация.',
    forbiddenAdmin: 'Нямате достъп до този панел.',
    signIn: 'Вход с Microsoft',
    signOut: 'Изход',
    menu: 'Меню',
    language: 'Език',
    theme: 'Тема',
    themes: { auto: 'Авто', light: 'Светла', dark: 'Тъмна' },
  },
  en: {
    brand: 'Admin',
    brandRep: 'Representative',
    nav: {
      home: 'Home', leads: 'Inquiries', pipeline: 'Leads', customers: 'Customers',
      factories: 'Factories', orders: 'Orders',
      reviews: 'Reviews', gallery: 'Gallery', cases: 'Cases', documents: 'Brochures',
      factorySheets: 'Factory orders', audit: 'Audit',
      myLeads: 'My leads',
    },
    loading: 'Loading…',
    error: 'Something went wrong while loading.',
    errorHint: 'Check your internet connection and try again.',
    retry: 'Try again',
    unauthorized: 'Sign in with your work account to continue.',
    unauthorizedTitle: 'Sign-in required',
    forbiddenTitle: 'No access',
    forbiddenRep: 'This panel is for representatives.',
    forbiddenRepHint: 'If you are a member of staff, use the Admin panel.',
    forbiddenAdmin: 'You do not have access to this panel.',
    signIn: 'Sign in with Microsoft',
    signOut: 'Sign out',
    menu: 'Menu',
    language: 'Language',
    theme: 'Theme',
    themes: { auto: 'Auto', light: 'Light', dark: 'Dark' },
  },
}

export function useAdminTheme() {
  const [theme, setTheme] = React.useState(() => {
    if (typeof window === 'undefined') return 'auto'
    try {
      const saved = localStorage.getItem(THEME_KEY)
      return saved === 'light' || saved === 'dark' ? saved : 'auto'
    } catch { return 'auto' }
  })

  React.useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* private mode */ }
    if (typeof document === 'undefined') return
    // 'auto' removes the attribute entirely rather than setting a value, so the
    // prefers-color-scheme media query is what decides — which is the whole point of
    // auto, and what a data-adm-theme="auto" would have quietly broken.
    if (theme === 'auto') delete document.documentElement.dataset.admTheme
    else document.documentElement.dataset.admTheme = theme
  }, [theme])

  return [theme, setTheme]
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
  // People, not another speech bubble: a customer has finished talking to us. Two figures
  // because it sits directly under the single-conversation pipeline icon and has to read
  // as a different thing at tab-bar size.
  customers: (
    <>
      <circle cx="9.2" cy="8.4" r="3.4" />
      <path d="M2.8 20.2a6.4 6.4 0 0 1 12.8 0" />
      <path d="M16.4 5.4a3.4 3.4 0 0 1 0 6.6M17.6 14.6a6.4 6.4 0 0 1 3.6 5.6" />
    </>
  ),
  // A building with a chimney. Deliberately not a box or a house outline — those are the
  // product, and this is who made it.
  factories: (
    <>
      <path d="M3 20.4V10.6l5.4 3.2V10.6l5.4 3.2V10.6l5.4 3.2v6.6z" />
      <path d="M19.2 13.8V4.6h-2.8v7.6M3 20.4h18" />
    </>
  ),
  // A parcel with a route arrow: the thing itself, and the fact that it is moving.
  orders: (
    <>
      <path d="M12 3.4 20.2 7.6v8.8L12 20.6 3.8 16.4V7.6z" />
      <path d="M3.8 7.6 12 11.8l8.2-4.2M12 11.8v8.8" />
    </>
  ),
  // An open booklet, spine down the middle. The brochures are the one document section a
  // CUSTOMER reads, which is what separates this from the factory sheet's single page
  // below — that one is a form we fill in, this one is a thing people leaf through.
  documents: (
    <>
      <path d="M12 6.2c-1.5-1.3-3.6-2-6.2-2-1 0-1.9.1-2.6.3v14.2c.7-.2 1.6-.3 2.6-.3 2.6 0 4.7.7 6.2 2 1.5-1.3 3.6-2 6.2-2 1 0 1.9.1 2.6.3V4.5c-.7-.2-1.6-.3-2.6-.3-2.6 0-4.7.7-6.2 2z" />
      <path d="M12 6.2v14.2" />
    </>
  ),
  // A sheet of paper with a fold. It is a DOCUMENT we hand the factory, which is what
  // separates it from the factory directory sitting above it in the nav.
  factorySheets: (
    <>
      <path d="M14.2 3.4H6.8A1.8 1.8 0 0 0 5 5.2v13.6a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V8.2z" />
      <path d="M14.2 3.4v4.8H19M8.4 12.4h7.2M8.4 15.8h7.2" />
    </>
  ),
  // A stack of coins: money leaving in small amounts, which is what opex is.
  // A bullseye. The one section that is about where the numbers SHOULD land.
  // A gauge: the one screen that is a reading, not a list.
  // A wallet, for the phone tab that gathers the six money screens into one press.
  // A clock wound backwards. Not a list or a document: every other section here IS a list,
  // and what makes this one different is that it looks at the past.
  audit: (
    <>
      <path d="M12 7.4V12l3 1.8" />
      <path d="M3.6 12a8.4 8.4 0 1 0 2.5-6" />
      <path d="M3.4 4.2v4.2h4.2" />
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
  // Inquiries sit directly after Home: it is the one section with work waiting in it, and
  // the only one someone opens every morning.
  { key: 'leads', to: '/admin/inquiries' },
  // Straight after the enquiry queue, because that is the journey: an inquiry arrives, it
  // becomes a lead, and the conversation that follows it lives here.
  { key: 'pipeline', to: '/admin/pipeline' },
  // The rest of the same journey: a lead that buys becomes a customer, and the factory
  // that built what they bought is the reference table the purchase points at. Factories
  // last of the two because it is a directory somebody sets up once and then mostly reads.
  { key: 'customers', to: '/admin/customers' },
  { key: 'factories', to: '/admin/factories' },
  // Orders, next to the customers they belong to: the same row answers "where is it?" and
  // "what do they still owe?".
  { key: 'orders', to: '/admin/orders' },
  { key: 'reviews', to: '/admin/reviews' },
  { key: 'gallery', to: '/admin/gallery' },
  { key: 'cases', to: '/admin/cases' },
  // With the other content sections: the brochures are marketing the public site serves,
  // not an operational record.
  { key: 'documents', to: '/admin/documents' },
  // The order sheets sit with the other operational records, after the content
  // sections. Beside Factories would read nicely too, but the directory and the
  // documents are different kinds of thing.
  { key: 'factorySheets', to: '/admin/factory-sheets' },
  // Last, and deliberately so: it is the section nobody opens daily and everybody wants
  // immediately when a number looks wrong.
  { key: 'audit', to: '/admin/audit' },
]

// The representatives' panel (#38): one section, and no Home — with a single screen, a menu
// page would be a door that opens onto the same room. The icon is the pipeline's, because
// this IS the pipeline, seen by one person.
const REP_SECTIONS = [
  { key: 'myLeads', to: '/rep/leads', icon: 'pipeline' },
]

// Everything that differs between the two panels this shell renders, looked up once from
// the `area` prop so nothing below has to ask which panel it is in. `brand` names the TEXT
// key for the word beside the mark; `home` is where that mark links. `forbidden` is what
// the 403 card says (TEXT keys) and, when there is one, the other panel's door it offers.
const AREAS = {
  admin: {
    home: '/admin', brand: 'brand', me: '/api/admin/me', sections: SECTIONS, counts: true,
    // No door: the representatives' panel is unlisted, and a card on /admin is not where
    // to advertise it. Whoever lands here is offered the way out, nothing else.
    forbidden: { lines: ['forbiddenAdmin'], door: null },
  },
  // No counts: the two badges read admin endpoints a representative cannot call, and the
  // one section he has carries nothing to count anyway.
  rep: {
    home: '/rep/leads', brand: 'brandRep', me: '/api/rep/me', sections: REP_SECTIONS, counts: false,
    // A member of staff who followed a representative's link by mistake is the likely
    // visitor; the admin panel is where they meant to go.
    forbidden: { lines: ['forbiddenRep', 'forbiddenRepHint'], door: '/admin' },
  },
}

// `me` and the pending-review count are chrome, not page data, so the shell fetches them
// once instead of every page repeating the call. Counts refresh whenever a page finishes
// loading, which is what makes the badge drop as soon as a review is approved.
function useAdminChrome(state, area) {
  const [me, setMe] = React.useState(null)
  const [pending, setPending] = React.useState(0)
  const [outstandingLeads, setOutstandingLeads] = React.useState(0)

  React.useEffect(() => {
    let alive = true
    adminGet(area.me)
      .then((who) => { if (alive) setMe(who) })
      .catch(() => { /* the page's own state already covers 401 and errors */ })
    return () => { alive = false }
  }, [area])

  React.useEffect(() => {
    if (state !== 'ready' || !area.counts) return undefined
    let alive = true
    adminGet('/api/admin/reviews/counts')
      .then((counts) => { if (alive) setPending(Number(counts?.pending) || 0) })
      .catch(() => { /* a missing badge is better than a broken page */ })
    adminGet('/api/admin/leads/counts')
      .then((counts) => { if (alive) setOutstandingLeads(Number(counts?.notReachedOut) || 0) })
      .catch(() => { /* same */ })
    return () => { alive = false }
  }, [state, area])

  return { me, pending, outstandingLeads }
}

export default function AdminShell({
  lang, setLang, active, title, subtitle, state, onRetry, actions, children, area: areaKey = 'admin',
}) {
  const t = TEXT[lang] ?? TEXT.bg
  const area = AREAS[areaKey] ?? AREAS.admin
  const [theme, setTheme] = useAdminTheme()
  const { me, pending, outstandingLeads } = useAdminChrome(state, area)
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

  if (state === 'forbidden') {
    // Signed in, and refused: the API answered 403 (adminApi's ForbiddenError). Neither of
    // the two cards above fits it. The error card's Retry would be refused the same way
    // for ever, and the sign-in card would send a perfectly good session round through
    // Microsoft and back to this screen. What the person is, is in the wrong panel (#38):
    // staff on /rep/leads, or a representative — or anyone else with an Entra account —
    // on /admin. Said plainly, with the other panel's door where there is one to offer,
    // and the way out in both. No chrome around it, for the same reason as the sign-in
    // card: every section in the nav would be refused the same way.
    const { lines, door } = area.forbidden
    return (
      <main className="adm-page adm-center">
        <div className="adm-card adm-signin">
          <div className="adm-signin-mark" aria-hidden="true">NVC</div>
          <h1>{t.forbiddenTitle}</h1>
          {lines.map((key) => <p key={key} className="adm-muted">{t[key]}</p>)}
          {door ? <Link className="btn adm-btn-lg" to={door}>{t.brand}</Link> : null}
          <a className={`btn adm-btn-lg${door ? ' btn-ghost' : ''}`} href="/admin/signout">{t.signOut}</a>
        </div>
      </main>
    )
  }

  const navLink = ({ key, to, icon }, onClick) => (
    <Link
      key={key}
      to={to}
      className={active === key ? 'is-active' : ''}
      aria-current={active === key ? 'page' : undefined}
      onClick={onClick}
    >
      <NavIcon name={icon ?? key} />
      <span className="adm-nav-label">{t.nav[key]}</span>
      {key === 'reviews' && pending > 0
        ? <span className="adm-dot" aria-label={`${pending}`}>{pending}</span>
        : null}
      {key === 'leads' && outstandingLeads > 0
        ? <span className="adm-dot" aria-label={`${outstandingLeads}`}>{outstandingLeads}</span>
        : null}
    </Link>
  )

  // The sidebar shows every section of the area; there is room, and hiding screens behind
  // a press on a desktop would be friction for nothing.
  const nav = area.sections.map((s) => navLink(s))

  // The phone tab bar shows the same sections. It briefly folded the money screens into a
  // "Финанси" tab, because sixteen tabs in an equal-width grid left every icon a sliver;
  // archiving the buy side (2026-08-19) took the count back to eleven, so the fold is gone
  // and the strip is flat again. The minmax + scroll in Admin.css stays as the backstop.
  const tabbarNav = nav

  return (
    <div className="adm-app">
      {/* One bar across the top on every size. The identity, language and sign-out controls
          exist once in the DOM: the sidebar is hidden on phones, so anything living only
          inside it would be unreachable there. */}
      <div className="adm-topbar">
        <Link to={area.home} className="adm-brand">
          <span className="adm-brand-mark" aria-hidden="true">NVC</span>
          <span className="adm-brand-text">{t[area.brand]}</span>
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

          {/* Auto follows the operating system, which is the right default and was the
              only behaviour until now — but someone on a dark laptop who wants a light
              panel had no way to say so. */}
          <div className="adm-lang adm-theme" role="group" aria-label={t.theme}>
            {['auto', 'light', 'dark'].map((mode) => (
              <button
                key={mode}
                type="button"
                className={theme === mode ? 'is-active' : ''}
                aria-pressed={theme === mode}
                title={t.themes[mode]}
                onClick={() => setTheme(mode)}
              >
                {t.themes[mode]}
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

      <nav className="adm-tabbar" aria-label={t.menu}>{tabbarNav}</nav>
    </div>
  )
}

function initials(me) {
  const source = (me?.name || me?.email || '').trim()
  if (!source) return '?'
  const parts = source.split(/[\s.@]+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase()
}

// Always a panel path — /admin, or /rep for the representatives' panel (#38), which signs in
// through the same /admin/signin endpoint. Anything else would hand the sign-in redirect an
// arbitrary destination, and there is no legitimate reason to come back from Entra to a
// marketing page.
function currentPath() {
  if (typeof window === 'undefined') return '/admin'
  const path = window.location.pathname || ''
  return path.startsWith('/admin') || path === '/rep' || path.startsWith('/rep/') ? path : '/admin'
}
