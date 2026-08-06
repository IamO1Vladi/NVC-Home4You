import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminSend, UnauthorizedError } from '../admin/adminApi.js'

// Staff-facing review moderation. Replaces the approve/reject workflow that used to
// happen inside Quickbase's own UI.
//
// The page used to carry its own copy of the header, language toggle and sign-in screen,
// which is why /admin had no navigation on it. All of that now comes from AdminShell.

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
    emptyPending: 'Няма нови отзиви за преглед. Всичко е одобрено.',
    rating: 'Оценка',
    noComment: '(без коментар)',
    savingError: 'Промяната не беше запазена.',
    published: 'Публикуван на сайта',
    approveHint: 'Отзивът ще се появи на сайта веднага.',
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
    emptyPending: 'Nothing new to review. Everything has been handled.',
    rating: 'Rating',
    noComment: '(no comment)',
    savingError: 'That change was not saved.',
    published: 'Live on the site',
    approveHint: 'The review appears on the site immediately.',
  },
}

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
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang]

  const [status, setStatus] = React.useState('pending')
  const [items, setItems] = React.useState([])
  const [counts, setCounts] = React.useState({})
  const [state, setState] = React.useState('loading') // loading | ready | error | unauthorized
  // Ids currently being acted on, so their buttons disable without freezing the list.
  const [busy, setBusy] = React.useState(() => new Set())
  const [actionError, setActionError] = React.useState('')

  const load = React.useCallback(async (which) => {
    setState('loading')
    setActionError('')
    try {
      const [list, countRes] = await Promise.all([
        adminGet(`/api/admin/reviews?status=${encodeURIComponent(which)}`),
        adminGet('/api/admin/reviews/counts'),
      ])
      setItems(list ?? [])
      setCounts(countRes ?? {})
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load(status) }, [load, status])

  async function act(id, action) {
    setBusy((prev) => new Set(prev).add(id))
    setActionError('')
    try {
      await adminSend(`/api/admin/reviews/${id}/${action}`, 'POST')
      // Reload rather than patching locally: counts change too, and the row usually
      // leaves the current filter entirely.
      await load(status)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setActionError(t.savingError)
    } finally {
      setBusy((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="reviews"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => load(status)}
    >
      <nav className="adm-tabs" aria-label="Status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={status === s ? 'is-active' : ''}
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
          >
            {t[s]}
            {s !== 'all' && counts[s] ? <span className="adm-count">{counts[s]}</span> : null}
          </button>
        ))}
      </nav>

      {actionError ? <div className="adm-alert">{actionError}</div> : null}

      {items.length === 0 ? (
        <div className="adm-empty">
          <p>{status === 'pending' ? t.emptyPending : t.empty}</p>
        </div>
      ) : (
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
                    <button className="btn" type="button" disabled={busy.has(r.id)}
                            title={t.approveHint} onClick={() => act(r.id, 'approve')}>
                      {t.approve}
                    </button>
                  ) : (
                    <span className="adm-live">✓ {t.published}</span>
                  )}
                  {r.status !== 'rejected' ? (
                    <button className="btn btn-ghost" type="button" disabled={busy.has(r.id)} onClick={() => act(r.id, 'reject')}>
                      {t.reject}
                    </button>
                  ) : null}
                  {r.status !== 'pending' ? (
                    <button className="btn btn-ghost" type="button" disabled={busy.has(r.id)} onClick={() => act(r.id, 'pending')}>
                      {t.restore}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  )
}
