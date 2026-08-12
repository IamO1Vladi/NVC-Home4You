import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import { adminGet, adminSend, UnauthorizedError } from '../admin/adminApi.js'

// The leads work queue — offers and questions in one list, which is how sales actually
// thinks about them: "who has not been called back?" is the same question for both.
//
// This replaces a Quickbase workflow rather than adding a report, so it is built to be
// worked from daily: the outstanding queue is the default view, the oldest lead is at the
// top because that is the one going cold, and ticking a box is one click with no dialog.

const TEXT = {
  bg: {
    title: 'Запитвания',
    subtitle: 'Оферти и въпроси от сайта. Отметнете, когато се свържете с клиента.',
    tabs: { open: 'За обработка', done: 'Обработени', all: 'Всички' },
    reachedOut: 'Свързахме се',
    createDeal: 'Създай сделка',
    onlyNoDeal: 'Скрий тези със сделка',
    noDealNone: 'Всяко запитване тук вече има сделка.',
    openDeal: 'Отвори сделката',
    creating: 'Създавам…',
    offer: 'Оферта',
    question: 'Въпрос',
    search: 'Търсене по име, имейл или текст',
    searchLabel: 'Търсене',
    emptyOpen: 'Няма запитвания за обработка. Всичко е поето.',
    emptyDone: 'Все още няма обработени запитвания.',
    emptyAll: 'Все още няма запитвания.',
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
    title: 'Leads',
    subtitle: 'Quote requests and questions from the site. Tick one once you have contacted them.',
    tabs: { open: 'To handle', done: 'Handled', all: 'All' },
    reachedOut: 'Reached out',
    createDeal: 'Create deal',
    onlyNoDeal: 'Hide ones with a deal',
    noDealNone: 'Every enquiry here already has a deal.',
    openDeal: 'Open deal',
    creating: 'Creating…',
    offer: 'Offer',
    question: 'Question',
    search: 'Search by name, email or text',
    searchLabel: 'Search',
    emptyOpen: 'Nothing waiting. Every lead has been picked up.',
    emptyDone: 'No handled leads yet.',
    emptyAll: 'No leads yet.',
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
    count: 'leads',
  },
}

const TABS = [
  { key: 'open', reached: 'false' },
  { key: 'done', reached: 'true' },
  { key: 'all', reached: 'all' },
]

// How old a lead is, in the words someone would actually use. The outstanding queue lives
// or dies on this being obvious at a glance.
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
// and opened on demand rather than pushing every other lead off the screen.
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

export default function AdminLeadsPage() {
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
  const [onlyNoDeal, setOnlyNoDeal] = React.useState(false)
  // Keyed by kind+id so the two id sequences cannot collide and disable the wrong row.
  const [busy, setBusy] = React.useState(() => new Set())
  const [actionError, setActionError] = React.useState('')

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

  async function createDeal(lead) {
    const key = `${lead.kind}-${lead.id}`
    setBusy((prev) => new Set(prev).add(key))
    setActionError('')
    try {
      const result = await adminSend('/api/admin/pipeline/promote', 'POST', {
        kind: lead.kind, id: lead.id,
      })
      // Straight into the conversation. Promoting is never the goal in itself — the
      // person clicking this wants to reply, and making them find the deal afterwards
      // is a step that exists only because the two pages are separate.
      if (result?.id) navigate(`/admin/pipeline?deal=${result.id}`)
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
  // to answer once replying moved into the deals view.
  const needsDeal = items.filter((l) => !l.dealId).length
  const visible = onlyNoDeal ? searched.filter((l) => !l.dealId) : searched

  const emptyText = onlyNoDeal && !needle
    ? t.noDealNone
    : needle
    ? t.emptySearch
    : tab === 'open' ? t.emptyOpen : tab === 'done' ? t.emptyDone : t.emptyAll

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
          const badge = key === 'open' ? counts.notReachedOut : key === 'done' ? counts.reachedOut : null
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
            checked={onlyNoDeal}
            onChange={(e) => setOnlyNoDeal(e.target.checked)}
          />
          <span>{t.onlyNoDeal}</span>
          {needsDeal > 0 ? <span className="adm-count">{needsDeal}</span> : null}
        </label>
        <span className="adm-muted adm-small">{visible.length} {t.count}</span>
      </div>

      {actionError ? <div className="adm-alert">{actionError}</div> : null}

      {visible.length === 0 ? (
        <div className="adm-empty"><p>{emptyText}</p></div>
      ) : (
        <ul className="adm-list">
          {visible.map((l) => {
            const key = `${l.kind}-${l.id}`
            const isBusy = busy.has(key)
            return (
              <li key={key} className={`adm-card adm-lead${l.reachedOut ? '' : ' is-open'}`}>
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
                    {!l.reachedOut ? <span className="adm-age">{age(l.createdAt, t)} {t.waiting}</span> : null}
                  </div>
                </div>

                <div className="adm-lead-contact adm-small">
                  {l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : null}
                  {l.phone ? <a href={`tel:${l.phone.replace(/\s+/g, '')}`}>{l.phone}</a> : null}
                  {l.modelId ? <span className="adm-muted">{t.model}: {l.modelId}</span> : null}
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
                      Now it does the work: one click creates the deal and its thread. Once
                      one exists the control becomes a link, so the same enquiry cannot be
                      promoted twice by someone who forgot they already had. */}
                  {l.dealId ? (
                    <Link className="adm-linkbtn" to={`/admin/pipeline?deal=${l.dealId}`}>
                      {t.openDeal}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn ghost adm-btn-sm"
                      disabled={isBusy}
                      onClick={() => createDeal(l)}
                    >
                      {isBusy ? t.creating : t.createDeal}
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
