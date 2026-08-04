import React from 'react'
import '../style/Admin.css'

// Staff-facing review moderation. Replaces the approve/reject workflow that used to
// happen inside Quickbase's own UI.
//
// Not a localized route like the marketing pages: it's an internal tool, so it lives at a
// single /admin path with its own BG/EN toggle rather than three SEO'd URLs. The choice is
// remembered per browser.

const TEXT = {
  bg: {
    title: 'Отзиви за одобрение',
    subtitle: 'Прегледайте новите отзиви и решете кои да се публикуват на сайта.',
    pending: 'Чакащи',
    approved: 'Одобрени',
    rejected: 'Отхвърлени',
    all: 'Всички',
    approve: 'Одобри',
    reject: 'Отхвърли',
    restore: 'Върни в чакащи',
    empty: 'Няма отзиви в тази категория.',
    loading: 'Зареждане…',
    signedInAs: 'Влезли сте като',
    signIn: 'Вход',
    error: 'Грешка при зареждане. Опитайте отново.',
    unauthorized: 'Нямате достъп. Влезте с служебния си акаунт.',
    retry: 'Опитай отново',
    rating: 'Оценка',
    noComment: '(без коментар)',
    savingError: 'Промяната не беше запазена.',
    published: 'Публикуван на сайта',
  },
  en: {
    title: 'Reviews awaiting moderation',
    subtitle: 'Review new submissions and decide which appear on the site.',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    all: 'All',
    approve: 'Approve',
    reject: 'Reject',
    restore: 'Move back to pending',
    empty: 'No reviews in this category.',
    loading: 'Loading…',
    signedInAs: 'Signed in as',
    signIn: 'Sign in',
    error: 'Could not load reviews. Try again.',
    unauthorized: 'You are not signed in. Use your work account to continue.',
    retry: 'Retry',
    rating: 'Rating',
    noComment: '(no comment)',
    savingError: 'That change was not saved.',
    published: 'Live on the site',
  },
}

const LANG_KEY = 'nvc_admin_lang_v1'
const STATUSES = ['pending', 'approved', 'rejected', 'all']

function Stars({ value }) {
  const full = Math.round(value || 0)
  return (
    <span className="adm-stars" aria-label={`${full}/5`}>
      {'★★★★★'.slice(0, full)}
      <span className="adm-stars-dim">{'★★★★★'.slice(full)}</span>
    </span>
  )
}

export default function AdminReviewsPage() {
  const [lang, setLang] = React.useState(() => {
    if (typeof window === 'undefined') return 'bg'
    try { return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'bg' } catch { return 'bg' }
  })
  const t = TEXT[lang]

  const [status, setStatus] = React.useState('pending')
  const [items, setItems] = React.useState([])
  const [counts, setCounts] = React.useState({})
  const [state, setState] = React.useState('loading') // loading | ready | error | unauthorized
  const [me, setMe] = React.useState(null)
  // Ids currently being acted on, so their buttons disable without freezing the list.
  const [busy, setBusy] = React.useState(() => new Set())
  const [actionError, setActionError] = React.useState('')

  React.useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang) } catch { /* private mode */ }
  }, [lang])

  const load = React.useCallback(async (which) => {
    setState('loading')
    setActionError('')
    try {
      const [listRes, countRes, meRes] = await Promise.all([
        fetch(`/api/admin/reviews?status=${encodeURIComponent(which)}`),
        fetch('/api/admin/reviews/counts'),
        fetch('/api/admin/me'),
      ])
      // 401 means the Entra session is missing or expired — a different problem from a
      // server error, and it needs a sign-in prompt rather than a retry button.
      if (listRes.status === 401 || countRes.status === 401) { setState('unauthorized'); return }
      if (!listRes.ok || !countRes.ok) { setState('error'); return }

      setItems(await listRes.json())
      setCounts(await countRes.json())
      if (meRes.ok) setMe(await meRes.json())
      setState('ready')
    } catch {
      setState('error')
    }
  }, [])

  React.useEffect(() => { load(status) }, [load, status])

  async function act(id, action) {
    setBusy((prev) => new Set(prev).add(id))
    setActionError('')
    try {
      const res = await fetch(`/api/admin/reviews/${id}/${action}`, { method: 'POST' })
      if (res.status === 401) { setState('unauthorized'); return }
      if (!res.ok) { setActionError(t.savingError); return }
      // Reload rather than patching locally: counts change too, and the row usually
      // leaves the current filter entirely.
      await load(status)
    } catch {
      setActionError(t.savingError)
    } finally {
      setBusy((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  if (state === 'unauthorized') {
    return (
      <main className="adm-page adm-center">
        <div className="adm-card adm-signin">
          <h1>{t.title}</h1>
          <p>{t.unauthorized}</p>
          {/* Hitting a protected endpoint triggers the Entra redirect. */}
          <a className="btn" href="/api/admin/reviews">{t.signIn}</a>
        </div>
      </main>
    )
  }

  return (
    <main className="adm-page">
      <header className="adm-head">
        <div>
          <h1>{t.title}</h1>
          <p className="adm-sub">{t.subtitle}</p>
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
          {me?.email ? <div className="adm-me">{t.signedInAs} <b>{me.email}</b></div> : null}
        </div>
      </header>

      <nav className="adm-tabs" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={status === s ? 'is-active' : ''}
            onClick={() => setStatus(s)}
          >
            {t[s]}
            {s !== 'all' && counts[s] ? <span className="adm-count">{counts[s]}</span> : null}
          </button>
        ))}
      </nav>

      {actionError ? <div className="adm-alert">{actionError}</div> : null}

      {state === 'loading' ? <div className="adm-muted">{t.loading}</div> : null}

      {state === 'error' ? (
        <div className="adm-card adm-center">
          <p>{t.error}</p>
          <button className="btn" type="button" onClick={() => load(status)}>{t.retry}</button>
        </div>
      ) : null}

      {state === 'ready' && items.length === 0 ? <div className="adm-muted">{t.empty}</div> : null}

      {state === 'ready' && items.length > 0 ? (
        <ul className="adm-list">
          {items.map((r) => (
            <li key={r.id} className={`adm-card adm-review adm-status-${r.status}`}>
              <div className="adm-review-top">
                <div>
                  <span className="adm-name">{r.name || '—'}</span>
                  {r.company ? <span className="adm-muted"> · {r.company}</span> : null}
                  {r.location ? <span className="adm-muted"> · {r.location}</span> : null}
                </div>
                <div className="adm-review-meta">
                  <Stars value={r.rating} />
                  <span className={`adm-badge adm-badge-${r.status}`}>{t[r.status] || r.status}</span>
                </div>
              </div>

              <p className="adm-comment">{r.comment || <em className="adm-muted">{t.noComment}</em>}</p>

              <div className="adm-review-foot">
                <div className="adm-muted adm-small">
                  {r.email ? <span>{r.email} · </span> : null}
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB') : ''}
                  {r.product ? <span> · {r.product}</span> : null}
                </div>
                <div className="adm-actions">
                  {r.status !== 'approved' ? (
                    <button className="btn" type="button" disabled={busy.has(r.id)} onClick={() => act(r.id, 'approve')}>
                      {t.approve}
                    </button>
                  ) : (
                    <span className="adm-live">{t.published}</span>
                  )}
                  {r.status !== 'rejected' ? (
                    <button className="btn ghost" type="button" disabled={busy.has(r.id)} onClick={() => act(r.id, 'reject')}>
                      {t.reject}
                    </button>
                  ) : null}
                  {r.status !== 'pending' ? (
                    <button className="btn ghost" type="button" disabled={busy.has(r.id)} onClick={() => act(r.id, 'pending')}>
                      {t.restore}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}
