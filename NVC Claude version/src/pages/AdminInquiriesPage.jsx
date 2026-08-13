import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminSend, UnauthorizedError } from '../admin/adminApi.js'

// The inquiry queue — quote requests and questions from the site in one list, which is how
// sales actually thinks about them: "who has not been called back?" is the same question
// for both.
//
// This replaces a Quickbase workflow rather than adding a report, so it is built to be
// worked from daily: the outstanding queue is the default view, the oldest inquiry is at
// the top because that is the one going cold, and ticking a box is one click with no dialog.
//
// An INQUIRY is not a LEAD, and the panel now says so. An inquiry is an immutable event —
// somebody filled in a form on a particular day. A lead is the relationship that may grow
// out of it, and lives in the next section along. Everything on this page is about moving
// the first into the second and then getting it out of the way.
//
// The API still calls this /api/admin/leads: it was named before the distinction was, and
// renaming a route is churn with nothing in it for the people using the panel.

const TEXT = {
  bg: {
    title: 'Запитвания',
    subtitle: 'Оферти и въпроси от сайта. Отметнете, когато се свържете с клиента.',
    tabs: { open: 'За обработка', done: 'Обработени', all: 'Всички', archived: 'Архив' },
    reachedOut: 'Свързахме се',
    createLead: 'Създай лийд',
    write: 'Пиши на клиента',
    writeHint: 'Създава лийд и отваря разговора — отговорът се изпраща оттам.',
    onlyNoLead: 'Скрий тези с лийд',
    noLeadNone: 'Всяко запитване тук вече има лийд.',
    openLead: 'Отвори лийда',
    creating: 'Създавам…',
    archive: 'Архивирай',
    archiveHint: 'Скрива запитването от списъка. Не се изтрива нищо.',
    archived: 'Архивирано.',
    restore: 'Върни',
    undo: 'Отмени',
    archivedOn: 'Архивирано на',
    offer: 'Оферта',
    question: 'Въпрос',
    search: 'Търсене по име, имейл или текст',
    searchLabel: 'Търсене',
    emptyOpen: 'Няма запитвания за обработка. Всичко е поето.',
    emptyDone: 'Все още няма обработени запитвания.',
    emptyAll: 'Все още няма запитвания.',
    emptyArchived: 'Архивът е празен.',
    emptySearch: 'Няма съвпадения за това търсене.',
    savingError: 'Промяната не беше запазена.',
    waiting: 'чака',
    days: 'дни',
    today: 'днес',
    yesterday: 'вчера',
    model: 'Модел',
    noMessage: '(без съобщение)',
    showAll: 'Покажи цялото съобщение',
    showLess: 'Скрий',
    count: 'запитвания',
  },
  en: {
    title: 'Inquiries',
    subtitle: 'Quote requests and questions from the site. Tick one once you have contacted them.',
    tabs: { open: 'To handle', done: 'Handled', all: 'All', archived: 'Archive' },
    reachedOut: 'Reached out',
    createLead: 'Create lead',
    write: 'Write to them',
    writeHint: 'Creates the lead and opens the conversation — the reply is sent from there.',
    onlyNoLead: 'Hide ones with a lead',
    noLeadNone: 'Every inquiry here already has a lead.',
    openLead: 'Open lead',
    creating: 'Creating…',
    archive: 'Archive',
    archiveHint: 'Takes the inquiry out of the list. Nothing is deleted.',
    archived: 'Archived.',
    restore: 'Restore',
    undo: 'Undo',
    archivedOn: 'Archived on',
    offer: 'Offer',
    question: 'Question',
    search: 'Search by name, email or text',
    searchLabel: 'Search',
    emptyOpen: 'Nothing waiting. Every inquiry has been picked up.',
    emptyDone: 'No handled inquiries yet.',
    emptyAll: 'No inquiries yet.',
    emptyArchived: 'The archive is empty.',
    emptySearch: 'Nothing matches that search.',
    savingError: 'That change was not saved.',
    waiting: 'waiting',
    days: 'days',
    today: 'today',
    yesterday: 'yesterday',
    model: 'Model',
    noMessage: '(no message)',
    showAll: 'Show full message',
    showLess: 'Show less',
    count: 'inquiries',
  },
}

const TABS = [
  { key: 'open', reached: 'false' },
  { key: 'done', reached: 'true' },
  { key: 'all', reached: 'all' },
  // Everything that has been put away. Last, because it is the one tab nobody opens
  // daily — and separate from the three above, which all show the working queue.
  { key: 'archived', reached: 'archived' },
]

// How old an inquiry is, in the words someone would actually use. The outstanding queue
// lives or dies on this being obvious at a glance.
function age(iso, t) {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (days <= 0) return t.today
  if (days === 1) return t.yesterday
  return `${days} ${t.days}`
}

function formatDate(iso, lang) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Long configurator summaries are the common case for offers, so the message is clamped
// and opened on demand rather than pushing every other inquiry off the screen.
const MESSAGE_CLAMP = 220

function Message({ text, t }) {
  const [open, setOpen] = React.useState(false)
  if (!text) return <p className="adm-lead-msg adm-muted"><em>{t.noMessage}</em></p>

  const long = text.length > MESSAGE_CLAMP
  const shown = open || !long ? text : `${text.slice(0, MESSAGE_CLAMP).trimEnd()}…`

  return (
    <div className="adm-lead-msg">
      <p>{shown}</p>
      {long ? (
        <button type="button" className="adm-linkbtn" onClick={() => setOpen((v) => !v)}>
          {open ? t.showLess : t.showAll}
        </button>
      ) : null}
    </div>
  )
}

export default function AdminInquiriesPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg
  const navigate = useNavigate()

  const [tab, setTab] = React.useState('open')
  const [items, setItems] = React.useState([])
  const [counts, setCounts] = React.useState({})
  const [state, setState] = React.useState('loading') // loading | ready | error | unauthorized
  const [query, setQuery] = React.useState('')
  // Off by default. Hiding rows on first load makes the queue look emptier than it is,
  // and the count on the label already answers "how many still need doing?" without
  // anyone having to click anything.
  const [onlyNoLead, setOnlyNoLead] = React.useState(false)
  // Keyed by kind+id so the two id sequences cannot collide and disable the wrong row.
  const [busy, setBusy] = React.useState(() => new Set())
  const [actionError, setActionError] = React.useState('')
  // What was just archived, so it can be put straight back. An undo beats an "are you
  // sure?": archiving is reversible and frequent, and a dialog in front of a frequent
  // reversible action is a dialog people learn to dismiss without reading.
  const [undoable, setUndoable] = React.useState(null)

  const load = React.useCallback(async (which) => {
    setState('loading')
    setActionError('')
    const reached = TABS.find((x) => x.key === which)?.reached ?? 'false'
    try {
      const [list, countRes] = await Promise.all([
        adminGet(`/api/admin/leads?reached=${reached}`),
        adminGet('/api/admin/leads/counts'),
      ])
      setItems(list ?? [])
      setCounts(countRes ?? {})
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [])

  React.useEffect(() => { load(tab) }, [load, tab])

  // Switching tabs is a new context; an undo banner for a row you can no longer see is
  // just clutter.
  React.useEffect(() => { setUndoable(null) }, [tab])

  async function setFlag(lead, field, value) {
    const key = `${lead.kind}-${lead.id}`
    setBusy((prev) => new Set(prev).add(key))
    setActionError('')

    // Optimistic, because a checkbox that waits for a round trip before moving feels
    // broken. The reload below is what makes it true.
    setItems((prev) => prev.map((x) =>
      x.kind === lead.kind && x.id === lead.id ? { ...x, [field]: value } : x))

    try {
      await adminSend(`/api/admin/leads/${lead.kind}/${lead.id}`, 'POST', { [field]: value })
      // Reload rather than patch: counts move, and on the outstanding tab the row leaves
      // the list entirely.
      await load(tab)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setActionError(t.savingError)
      // Put the checkbox back where it was, so the screen never disagrees with the server.
      setItems((prev) => prev.map((x) =>
        x.kind === lead.kind && x.id === lead.id ? { ...x, [field]: !value } : x))
    } finally {
      setBusy((prev) => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  // One click creates the lead and lands in its conversation. Promoting is never the goal
  // in itself — the person clicking this wants to reply, and making them find the lead
  // afterwards is a step that exists only because the two pages are separate.
  async function writeTo(lead) {
    if (lead.dealId) { navigate(`/admin/pipeline?lead=${lead.dealId}`); return }

    const key = `${lead.kind}-${lead.id}`
    setBusy((prev) => new Set(prev).add(key))
    setActionError('')
    try {
      const result = await adminSend('/api/admin/pipeline/promote', 'POST', {
        kind: lead.kind, id: lead.id,
      })
      if (result?.id) navigate(`/admin/pipeline?lead=${result.id}`)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setActionError(t.savingError)
    } finally {
      setBusy((prev) => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  async function setArchived(lead, archived) {
    const key = `${lead.kind}-${lead.id}`
    setBusy((prev) => new Set(prev).add(key))
    setActionError('')
    try {
      await adminSend(`/api/admin/leads/${lead.kind}/${lead.id}/archive`, 'POST', { archived })
      setUndoable(archived ? { kind: lead.kind, id: lead.id, name: lead.name } : null)
      await load(tab)
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setActionError(t.savingError)
    } finally {
      setBusy((prev) => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  const needle = query.trim().toLowerCase()
  const searched = needle
    ? items.filter((l) => [l.name, l.email, l.phone, l.message]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(needle)))
    : items

  // "Which of these still need me to do something?" — the question this page is opened
  // to answer once replying moved into the leads view.
  const needsLead = items.filter((l) => !l.dealId).length
  const visible = onlyNoLead ? searched.filter((l) => !l.dealId) : searched

  const emptyText = onlyNoLead && !needle
    ? t.noLeadNone
    : needle
    ? t.emptySearch
    : tab === 'open' ? t.emptyOpen
    : tab === 'done' ? t.emptyDone
    : tab === 'archived' ? t.emptyArchived
    : t.emptyAll

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="leads"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => load(tab)}
    >
      <nav className="adm-tabs" aria-label={t.title}>
        {TABS.map(({ key }) => {
          const badge = key === 'open' ? counts.notReachedOut
            : key === 'done' ? counts.reachedOut
            : key === 'archived' ? counts.archived
            : null
          return (
            <button
              key={key}
              type="button"
              className={tab === key ? 'is-active' : ''}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {t.tabs[key]}
              {badge ? <span className="adm-count">{badge}</span> : null}
            </button>
          )
        })}
      </nav>

      <div className="adm-lead-toolbar">
        <label className="visually-hidden" htmlFor="leadSearch">{t.searchLabel}</label>
        <input
          id="leadSearch"
          type="search"
          className="adm-search"
          placeholder={t.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="adm-check adm-filter-check">
          <input
            type="checkbox"
            checked={onlyNoLead}
            onChange={(e) => setOnlyNoLead(e.target.checked)}
          />
          <span>{t.onlyNoLead}</span>
          {needsLead > 0 ? <span className="adm-count">{needsLead}</span> : null}
        </label>
        <span className="adm-muted adm-small">{visible.length} {t.count}</span>
      </div>

      {actionError ? <div className="adm-alert">{actionError}</div> : null}

      {undoable ? (
        <div className="adm-undo" role="status">
          <span>{t.archived} {undoable.name ? <strong>{undoable.name}</strong> : null}</span>
          <button
            type="button"
            className="adm-linkbtn"
            onClick={() => setArchived(undoable, false)}
          >
            {t.undo}
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="adm-empty"><p>{emptyText}</p></div>
      ) : (
        <ul className="adm-list">
          {visible.map((l) => {
            const key = `${l.kind}-${l.id}`
            const isBusy = busy.has(key)
            return (
              <li key={key} className={`adm-card adm-lead${l.reachedOut || l.archivedAt ? '' : ' is-open'}`}>
                <div className="adm-lead-top">
                  <div className="adm-lead-who">
                    <span className="adm-name">{l.name || '—'}</span>
                    <span className={`adm-badge adm-badge-${l.kind}`}>
                      {l.kind === 'offer' ? t.offer : t.question}
                    </span>
                    {l.locale ? <span className="adm-muted adm-small">{l.locale.toUpperCase()}</span> : null}
                  </div>
                  <div className="adm-lead-when adm-small">
                    <span className="adm-muted">{formatDate(l.createdAt, lang)}</span>
                    {!l.reachedOut && !l.archivedAt
                      ? <span className="adm-age">{age(l.createdAt, t)} {t.waiting}</span>
                      : null}
                  </div>
                </div>

                <div className="adm-lead-contact adm-small">
                  {/* The address is a BUTTON, not a mailto. A mail client opens a reply
                      that lands in somebody's personal Sent items and never reaches the
                      thread — the one place the next person to pick this up will look.
                      Clicking here creates the lead and opens the conversation instead. */}
                  {l.email ? (
                    <button
                      type="button"
                      className="adm-linkbtn adm-write"
                      title={t.writeHint}
                      disabled={isBusy}
                      onClick={() => writeTo(l)}
                    >
                      <svg viewBox="0 0 24 24" className="adm-write-ico" fill="none" stroke="currentColor"
                           strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2.5" />
                        <path d="m3.8 6.6 8.2 6 8.2-6" />
                      </svg>
                      <span>{l.email}</span>
                    </button>
                  ) : null}
                  {l.phone ? <a href={`tel:${l.phone.replace(/\s+/g, '')}`}>{l.phone}</a> : null}
                  {l.modelId ? <span className="adm-muted">{t.model}: {l.modelId}</span> : null}
                  {l.archivedAt ? (
                    <span className="adm-muted">{t.archivedOn} {formatDate(l.archivedAt, lang)}</span>
                  ) : null}
                </div>

                <Message text={l.message} t={t} />

                <div className="adm-lead-flags">
                  <label className="adm-check">
                    <input
                      type="checkbox"
                      checked={!!l.reachedOut}
                      disabled={isBusy}
                      onChange={(e) => setFlag(l, 'reachedOut', e.target.checked)}
                    />
                    <span>{t.reachedOut}</span>
                  </label>
                  {/* Was a hand-ticked "Lead created" checkbox inherited from Quickbase,
                      which only ever recorded that someone had done the work elsewhere.
                      Now it does the work: one click creates the lead and its thread. Once
                      one exists the control becomes a link, so the same inquiry cannot be
                      promoted twice by someone who forgot they already had. */}
                  {l.dealId ? (
                    <Link className="adm-linkbtn" to={`/admin/pipeline?lead=${l.dealId}`}>
                      {t.openLead}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost adm-btn-sm"
                      disabled={isBusy}
                      onClick={() => writeTo(l)}
                    >
                      {isBusy ? t.creating : t.createLead}
                    </button>
                  )}

                  {/* Archiving is what finishes an inquiry: contacted, lead created, out
                      of the queue. Offered on every row rather than only the finished
                      ones, because the other common case is a test submission or a
                      duplicate — and nothing here is ever deleted. */}
                  {l.archivedAt ? (
                    <button
                      type="button"
                      className="adm-linkbtn"
                      disabled={isBusy}
                      onClick={() => setArchived(l, false)}
                    >
                      {t.restore}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="adm-linkbtn adm-archive"
                      title={t.archiveHint}
                      disabled={isBusy}
                      onClick={() => setArchived(l, true)}
                    >
                      {t.archive}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </AdminShell>
  )
}
