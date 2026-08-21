import React from 'react'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminDelete, UnauthorizedError } from '../admin/adminApi.js'
import { adminSave, keepsTheEditorOpen } from '../admin/adminSave.js'

// Orders: where staff move an order along, and the report the owner asked for — customer,
// model, deposit, final price, left to pay, factory — in one row each (ROADMAP #27).
//
// ONE SCREEN FOR BOTH JOBS on purpose. A report nobody works from goes stale, and a status
// board with no money on it gets cross-checked against a spreadsheet. The same row answers
// "where is it?" and "what do they still owe?", so neither can drift from the other.
//
// The money here is READ-ONLY: deposits and prices are edited on the customer's own sheet,
// where the invoices live. What this screen writes is the order's progress — status, the
// two expected dates, and what the carrier last said.
//
// THERE IS NO CARRIER API, and there is not going to be one (owner, 2026-08-20). A person
// moves every order along from this board, which changes what the screen has to be: the
// common move has to cost one click, and the board has to say out loud when nobody has
// touched an order in weeks. A hand-worked board does not fail by showing a wrong status,
// it fails by showing an old one that nobody has questioned.

const TEXT = {
  bg: {
    title: 'Поръчки',
    subtitle: 'Докъде е стигнала всяка поръчка, и какво остава да се плати.',
    all: 'Всички',
    empty: 'Няма поръчки за този филтър.',
    emptyHint: 'Поръчките се създават като продажби при клиента.',
    customer: 'Клиент', model: 'Модел', factory: 'Фабрика',
    deposit: 'Капаро', finalPrice: 'Крайна цена', leftToPay: 'Остава',
    qty: 'бр.',
    status: 'Статус',
    expectedAtHarbor: 'Очаквано на пристанище', expectedReady: 'Очаквана готовност',
    carrier: 'Превозвач', trackingRef: 'Номер за проследяване',
    carrierNote: 'Последно от превозвача', carrierAsOf: 'към',
    carrierHint: 'Въвежда се на ръка. Датата се записва автоматично, когато промените текста.',
    track: 'Проследяване', trackLink: 'Линк за клиента',
    createLink: 'Създай линк', revokeLink: 'Премахни линка', copy: 'Копирай',
    copied: 'Копирано',
    noLink: 'Още няма линк за този клиент.',
    linkHint: 'Само този линк отваря страницата. Тя показва статус и дати — никога цени или данни на клиента.',
    edit: 'Редактирай', save: 'Запази', saving: 'Запазване…', cancel: 'Откажи', close: 'Затвори',
    editTitle: 'Поръчка',
    confirmRevoke: 'Да премахна ли линка? Клиентът повече няма да вижда страницата.',
    saveError: 'Промяната не беше запазена.',
    updated: 'Запазено',
    moveTo: 'Премести на',
    moved: (name, status) => `Преместена: ${name} → ${status}`,
    moveError: 'Поръчката не беше преместена. Статусът е върнат както беше.',
    controlsError: 'Списъкът със статуси не се зареди, затова бутоните за преместване и филтрите липсват. Презаредете страницата.',
    lastMoved: 'Последно движение',
    neverMoved: 'Няма записано движение',
    stale: 'Без движение',
    days: 'дни',
    system: 'Системата',
    history: 'История на движенията',
    historyLoading: 'Зарежда се…',
    historyError: 'Историята не се зареди.',
    historyEmpty: 'Още няма записано движение по тази поръчка.',
    historyHint: 'Записва се само когато статусът наистина се смени. Поръчки отпреди дневника нямат история.',
    statuses: {
      placed: 'Приета', fabricating: 'В производство', scheduled: 'Насрочена за товарене',
      travelling: 'Пътува', 'at-harbor': 'На пристанище', ready: 'Готова за доставка',
      delivered: 'Доставена', cancelled: 'Отказана',
    },
  },
  en: {
    title: 'Orders',
    subtitle: 'How far each order has got, and what is still owed.',
    all: 'All',
    empty: 'No orders for this filter.',
    emptyHint: 'Orders are created as purchases on a customer.',
    customer: 'Customer', model: 'Model', factory: 'Factory',
    deposit: 'Deposit', finalPrice: 'Final price', leftToPay: 'Left to pay',
    qty: 'pcs',
    status: 'Status',
    expectedAtHarbor: 'Expected at harbour', expectedReady: 'Expected ready',
    carrier: 'Carrier', trackingRef: 'Tracking number',
    carrierNote: 'Carrier’s last word', carrierAsOf: 'as of',
    carrierHint: 'Entered by hand. The date stamps itself whenever you change the text.',
    track: 'Tracking', trackLink: 'Customer link',
    createLink: 'Create link', revokeLink: 'Revoke link', copy: 'Copy',
    copied: 'Copied',
    noLink: 'No link for this customer yet.',
    linkHint: 'Only this link opens the page. It shows status and dates — never prices or customer data.',
    edit: 'Edit', save: 'Save', saving: 'Saving…', cancel: 'Cancel', close: 'Close',
    editTitle: 'Order',
    confirmRevoke: 'Revoke the link? The customer will stop seeing the page.',
    saveError: 'That change was not saved.',
    updated: 'Saved',
    moveTo: 'Move to',
    moved: (name, status) => `Moved: ${name} → ${status}`,
    moveError: 'The order was not moved. The status has been put back.',
    controlsError: 'The status list did not load, so the move buttons and the filters are missing. Reload the page.',
    lastMoved: 'Last moved',
    neverMoved: 'No move on file',
    stale: 'Not moving',
    days: 'days',
    system: 'System',
    history: 'Move history',
    historyLoading: 'Loading…',
    historyError: 'The history did not load.',
    historyEmpty: 'Nothing recorded against this order yet.',
    historyHint: 'Recorded only when the status actually changes. Orders from before the log have none.',
    statuses: {
      placed: 'Placed', fabricating: 'In production', scheduled: 'Scheduled for shipment',
      travelling: 'Travelling', 'at-harbor': 'At harbour', ready: 'Ready for delivery',
      delivered: 'Delivered', cancelled: 'Cancelled',
    },
  },
}

// How long an order that is supposed to be moving may sit silent before the board says so.
//
// A GUESS, not a rule. Nobody has worked this board for a season yet, so fourteen days is a
// starting point chosen to be argued with: raise it the first time it nags about a factory
// that always takes three weeks, lower it the first time a customer notices a delay before
// we do. It is one number in one place precisely so that argument is cheap to settle.
const STALE_AFTER_DAYS = 14

// The statuses where silence is a problem, i.e. where something out in the world is
// supposed to be happening. Exactly three are left out, each for its own reason: 'placed' is
// waiting on US rather than on the world, which is a different conversation on a different
// screen, and 'delivered' and 'cancelled' are finished, where a year without movement is not
// news. Everything else is in.
//
// 'ready' included, and that one is worth saying out loud: the goods are in the country and
// cleared, and the only thing left is a person booking a delivery. An order that sits there
// unbooked for eighty days is precisely the rot this marker exists to catch, on the step the
// customer is least patient about.
const MOVING_STATUSES = new Set(['fabricating', 'scheduled', 'travelling', 'at-harbor', 'ready'])

// How long a move stays deaf to a second click after it lands.
//
// The button re-labels itself the moment the row updates, so the second half of a
// double-click would arrive at a button that now says something else and take the order TWO
// steps. Every click here is permanent — the history table is append-only, so a correction
// afterwards writes a third row and the customer's timeline keeps all three dates.
const SETTLE_MS = 800

const money = (n, currency = 'EUR') => {
  if (n === null || n === undefined) return '—'
  const s = Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return currency === 'EUR' ? `€${s}` : `${s} ${currency}`
}

// Date and actor in the same shape the audit trail uses. Staff read both screens in the same
// afternoon, and a timestamp that changes format between them reads as two systems.
function when(iso, lang) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// "maria@nvc-home4you.eu" is a lot of pixels to say Maria on a row that already carries a
// name, a model and three amounts. The full address stays in the title attribute.
function who(upn, t) {
  if (!upn) return t.system
  const at = upn.indexOf('@')
  return at > 0 ? upn.slice(0, at) : upn
}

function daysSince(iso) {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((Date.now() - then.getTime()) / 86400000)
}

// How long this order has been silent, or null if that is not a fair question to ask of it.
//
// Silence means NOBODY HAS BEEN NEAR IT, which is not the same as "the status has not
// changed". An order sails for six weeks in one status by design, and the person minding it
// is ringing the carrier and writing down what they said, not pressing a button. Measuring
// from lastTouchedAt — the newer of the last move and the last carrier check, see
// OrderRowDto — is what keeps the badge off the best-kept order on the screen while leaving
// it on the forgotten one.
//
// An order with nothing on file is NOT called stale. There is no date to have been silent
// since — orders that predate the history table have none, and neither does one recorded ten
// minutes ago — and colouring a row against a date nobody observed is exactly the invention
// the rest of this feature refuses to make.
function stalledFor(row) {
  if (!MOVING_STATUSES.has(row.status)) return null
  const days = daysSince(row.lastTouchedAt)
  return days !== null && days > STALE_AFTER_DAYS ? days : null
}

// The step after this one, or null when there is no such thing: -1 is 'cancelled' (off the
// timeline by design) and the last index is 'delivered'. A button that walks an order off
// the end of the timeline is worse than no button.
function nextStatus(status, timeline) {
  const i = timeline.indexOf(status)
  return i >= 0 && i < timeline.length - 1 ? timeline[i + 1] : null
}

// The whole order shape every time, never just the field that changed. UpdateOrderAsync
// writes the carrier fields from whatever it is handed, so a body that leaves them out
// clears them — and a one-click advance that quietly erased a tracking number would be a
// worse bug than the friction it removed.
//
// STATUS is the one exception, and only save() makes it: an omitted status means "this save
// is not about where the order is", which the writer reads as no move and no history row.
// See save() for why a note-only save must say that rather than repeat itself.
const orderBody = (o) => ({
  status: o.status,
  expectedAtHarbor: o.expectedAtHarbor || null,
  expectedReadyAt: o.expectedReadyAt || null,
  carrierName: o.carrierName || null,
  trackingReference: o.trackingReference || null,
  carrierNote: o.carrierNote || null,
})

const ordersUrl = (status) => `/api/admin/orders${status ? `?status=${status}` : ''}`

export default function AdminOrdersPage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [state, setState] = React.useState('loading')
  const [rows, setRows] = React.useState([])
  const [statuses, setStatuses] = React.useState([])
  const [timeline, setTimeline] = React.useState([])
  const [filter, setFilter] = React.useState('')
  const [editing, setEditing] = React.useState(null)
  // The status the editor was OPENED on, kept beside the copy being edited. The modal can sit
  // open for minutes while somebody types what the factory said down the phone, and in that
  // time the order can be moved from another board — so a save has to be able to tell "I
  // chose this status" from "this is what it said when I opened it".
  const [openedStatus, setOpenedStatus] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  // The move in flight, as { purchaseId, to }. The target is carried rather than re-derived
  // from the row, because the row's status is updated optimistically and re-deriving it
  // relabels the button under the cursor to the step AFTER the one being saved.
  const [moving, setMoving] = React.useState(null)
  // When the last move finished, so a click arriving inside SETTLE_MS of it is ignored.
  const settled = React.useRef({ purchaseId: 0, at: 0 })
  const [history, setHistory] = React.useState([])
  const [historyState, setHistoryState] = React.useState('idle')
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  const load = React.useCallback(async (status = filter) => {
    setState('loading')
    try {
      const [orders, keys] = await Promise.all([
        adminGet(ordersUrl(status)),
        adminGet('/api/admin/orders/statuses').catch(() => null),
      ])
      setRows(Array.isArray(orders) ? orders : [])
      if (keys?.all) setStatuses(keys.all)
      // The sequence comes from the server rather than from a copy kept here, because the
      // one-click advance is only ever as correct as the order it walks, and a second copy
      // of that order in the SPA is a copy that can disagree with the one the customer's
      // timeline is drawn from.
      if (Array.isArray(keys?.timeline)) setTimeline(keys.timeline)
      // Losing this call is not cosmetic any more. It used to feed only the filter chips;
      // now every advance button is derived from the sequence it carries, so a failure takes
      // the day's one control off the screen while the board still renders perfectly — rows,
      // money, statuses, staleness and no way to move anything. Said out loud rather than
      // patched over with a hard-coded sequence, which would be the second copy of the order
      // the comment above refuses to keep.
      setError(keys ? '' : t.controlsError)
      setState('ready')
    } catch (err) {
      setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error')
    }
  }, [filter, t])

  React.useEffect(() => { load('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilter = (status) => { setFilter(status); load(status) }

  // Which chips are lit RIGHT NOW. A reload can be handed to a save that lands half a
  // minute later, by which time the filter it was written against may not be the one on
  // screen — and repopulating the board with the previous filter's rows under the current
  // filter's chips is a board that is quietly lying.
  const showingFilter = React.useRef('')
  React.useEffect(() => { showingFilter.current = filter }, [filter])

  // Re-reads the board WITHOUT dropping it back to the spinner. After a one-click move the
  // only things that changed are one row's status and its last-moved stamp; blanking the
  // whole screen to collect them loses the reader's place on a list they were scanning —
  // and, for a save that lands late, takes the open editor down with it.
  const refresh = React.useCallback(async () => {
    const orders = await adminGet(ordersUrl(showingFilter.current))
    setRows(Array.isArray(orders) ? orders : [])
  }, [])

  // Every move this order has made, fetched when the editor opens rather than with the
  // board: it answers one question ("when did it actually leave?") that gets asked about one
  // order at a time, usually with the customer already on the phone.
  const openId = editing?.purchaseId ?? null
  React.useEffect(() => {
    if (openId === null) { setHistory([]); setHistoryState('idle'); return undefined }

    let live = true
    setHistoryState('loading')
    adminGet(`/api/admin/orders/${openId}/history`)
      .then((items) => {
        if (!live) return
        setHistory(Array.isArray(items) ? items : [])
        setHistoryState('ready')
      })
      .catch((err) => {
        if (!live) return
        if (err instanceof UnauthorizedError) setState('unauthorized')
        setHistoryState('error')
      })
    return () => { live = false }
  }, [openId])

  // The order writer, which is deliberately NOT the customer's purchase writer: money and
  // invoices are edited on the customer's own sheet, where the documents that justify them
  // live, and this endpoint cannot reach a price even if somebody posts one. That separation
  // is what makes "the money on this screen is read-only" a fact about the API rather than a
  // habit of this component.
  //
  // It used to PUT to /api/admin/customers/{id}/purchases/{id}, a route that has never
  // existed — purchases are edited nested inside the customer PUT — so every save from this
  // board 404'd and the board has never actually worked. The test pins the URL now.
  async function save() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = orderBody(editing)

      // A note-only save carries NO status. The alternative is what this used to do: post the
      // status the editor was opened on, which the writer compares against whatever the row
      // holds now — so a colleague's move made while the modal was open gets silently undone,
      // and the customer's timeline gains a backwards step dated today. Nobody on the board
      // can see that happened without opening the history.
      if (editing.status === openedStatus) delete body.status

      const answer = await adminSave({
        url: `/api/admin/orders/${editing.purchaseId}`,
        method: 'PUT',
        body,
        lang,
        subject: editing.customerName,
        // The board is a report as much as a queue, so a save that landed late still has to
        // show up on it without anybody thinking to reload. The QUIET reload, because a late
        // one arrives while somebody is working: load() drops the page back to the spinner,
        // and the shell renders nothing at all until it is ready — which would destroy and
        // rebuild whichever editor happens to be open, mid-sentence.
        onLateSuccess: refresh,
      })

      // Refused, or lost with no way to ask again safely. The editor stays exactly as it
      // was, carrying the reason.
      if (keepsTheEditorOpen(answer)) { setError(answer.message || t.saveError); return }

      setEditing(null)
      if (answer.outcome === 'saved') await load()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    } finally {
      setBusy(false)
    }
  }

  // Closing the editor, from the ✕, Escape, the backdrop or Откажи — all four end here.
  //
  // REFUSED WHILE A SAVE IS RUNNING, because `editing` is the only copy of what was typed.
  // Throwing it away mid-request means the 400 that comes back a second later has no form
  // left to land in: the carrier's words, read off a phone call nobody will make twice, are
  // gone and the reason for the refusal is on the board instead.
  //
  // And it clears the error, because the alert it leaves behind is about an edit that no
  // longer exists — the board would carry "Датата не е валидна." with nothing to fix.
  const closeEditor = () => {
    if (busy) return
    setEditing(null)
    setError('')
  }

  // The daily routine, in one click: this order reached the next step.
  //
  // Optimistic, because the alternative is a board where every move waits on the network,
  // and a board that feels slow is a board people batch up "to do later" — which is the
  // staleness this screen exists to prevent, arriving by the other door.
  async function advance(row) {
    const next = nextStatus(row.status, timeline)
    if (!next || moving) return

    // The second half of a double-click, arriving after the first move has landed and the
    // button has re-labelled itself. Without this it PUTs a different, further status and the
    // order goes two steps — see SETTLE_MS.
    if (settled.current.purchaseId === row.purchaseId
      && Date.now() - settled.current.at < SETTLE_MS) return

    const before = {
      status: row.status,
      lastMovedAt: row.lastMovedAt,
      lastMovedBy: row.lastMovedBy,
      lastTouchedAt: row.lastTouchedAt,
    }
    const now = new Date().toISOString()

    setError('')
    setNotice('')
    setMoving({ purchaseId: row.purchaseId, to: next })
    // The move goes into the optimistic patch WITH its timestamps, not just its status. The
    // staleness marker is computed from those, so setting one without the others leaves the
    // row warning that nobody has touched an order that was touched two seconds ago — and on
    // the one screen whose job is to notice silence, that is the failure that teaches people
    // to ignore it. The NAME is dropped rather than guessed; the re-read below fills it in,
    // and until it does the row says when without claiming who.
    setRows((list) => list.map((r) => (r.purchaseId === row.purchaseId
      ? { ...r, status: next, lastMovedAt: now, lastMovedBy: null, lastTouchedAt: now }
      : r)))

    try {
      await adminSend(`/api/admin/orders/${row.purchaseId}`, 'PUT', orderBody({ ...row, status: next }))
      setNotice(t.moved(row.customerName, label(next)))
      // A failed re-read is not worth an error: the move itself landed, and the row on
      // screen already says so. The next load collects the rest.
      try { await refresh() } catch { /* the board catches up on the next load */ }
    } catch (err) {
      // Putting the old values back is only half of it. A row that silently snaps back reads
      // as a misclick, so the failure has to be said out loud as well.
      setRows((list) => list.map((r) => (r.purchaseId === row.purchaseId ? { ...r, ...before } : r)))
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.moveError)
      // The likeliest failure is 409 — somebody else moved this order first — and the answer
      // to that is to show what they did rather than what this click wanted.
      try { await refresh() } catch { /* the message stands on its own */ }
    } finally {
      settled.current = { purchaseId: row.purchaseId, at: Date.now() }
      setMoving(null)
    }
  }

  async function createLink(row) {
    setError('')
    try {
      const result = await adminSend(`/api/admin/orders/${row.purchaseId}/reference`, 'POST')
      if (result?.reference) {
        setNotice(t.updated)
        await load()
        setEditing((e) => (e && e.purchaseId === row.purchaseId
          ? { ...e, publicReference: result.reference } : e))
      }
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  async function revokeLink(row) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.confirmRevoke)) return
    setError('')
    try {
      await adminDelete(`/api/admin/orders/${row.purchaseId}/reference`)
      await load()
      setEditing((e) => (e && e.purchaseId === row.purchaseId ? { ...e, publicReference: null } : e))
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || t.saveError)
    }
  }

  const set = (field) => (e) => setEditing((f) => ({ ...f, [field]: e.target.value }))

  const label = (key) => t.statuses[key] ?? key
  const linkFor = (ref) => `${window.location.origin}/order/${ref}`

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="orders"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => load()}
    >
      {/* A refused save keeps the editor open on top of this line, so the editor shows its
          own copy and the board reports only what happened out here — a failed move, a
          link that could not be made. */}
      {error && editing === null ? <div className="adm-alert">{error}</div> : null}
      {notice ? <div className="adm-note">{notice}</div> : null}

      {/* Status filter */}
      <section className="adm-card">
        <div className="adm-lead-toolbar">
          <button
            type="button"
            className={filter === '' ? 'adm-chip is-active' : 'adm-chip'}
            onClick={() => applyFilter('')}
          >
            {t.all}
          </button>
          {statuses.map((key) => (
            <button
              key={key}
              type="button"
              className={filter === key ? 'adm-chip is-active' : 'adm-chip'}
              onClick={() => applyFilter(key)}
            >
              {label(key)}
            </button>
          ))}
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="adm-card adm-center adm-errbox" style={{ marginTop: '1rem' }}>
          <p><strong>{t.empty}</strong></p>
          <p className="adm-muted adm-small">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="adm-list" style={{ marginTop: '1rem' }}>
          {rows.map((row) => {
            const stalled = stalledFor(row)
            // While a move is in flight the button keeps naming THAT move. The row's status
            // has already been updated optimistically, so deriving the label from it would
            // advertise the step after the one being saved — and would make the button vanish
            // entirely on the way to 'delivered', which has no next.
            const inFlight = moving?.purchaseId === row.purchaseId ? moving.to : null
            const next = inFlight ?? nextStatus(row.status, timeline)
            return (
              <li key={row.purchaseId} className="adm-row">
                <div className="adm-row-main">
                  <strong>{row.customerName}</strong>
                  {/* The report line, in the owner's own order: model, deposit, final,
                      left to pay, factory. */}
                  <span className="adm-small adm-muted">
                    {row.model || '—'}
                    {row.quantity > 1 ? ` × ${row.quantity} ${t.qty}` : ''}
                    {' · '}{t.deposit}: {money(row.depositPaid, row.currency)}
                    {' · '}{t.finalPrice}: {money(row.finalPrice, row.currency)}
                    {' · '}{t.leftToPay}: <strong>{money(row.leftToPay, row.currency)}</strong>
                    {row.factoryName ? <> · {t.factory}: {row.factoryName}</> : null}
                  </span>
                  <span className="adm-small">
                    <span className="adm-badge adm-stage-open">{label(row.status)}</span>
                    {/* The same warn colour the inquiries queue uses for "nobody has picked
                        this up", because it means the same thing here. */}
                    {stalled !== null
                      ? <> <span className="adm-badge adm-badge-pending">{t.stale}</span></>
                      : null}
                    {row.expectedReadyAt ? <> · {t.expectedReady}: {row.expectedReadyAt}</> : null}
                    {row.publicReference ? <> · <span className="adm-ok">{t.trackLink} ✓</span></> : null}
                  </span>
                  {/* Who last touched it and when — the question a hand-worked board
                      actually gets wrong, which is never the status but its age. */}
                  <span className="adm-small adm-muted">
                    {row.lastMovedAt ? (
                      <>
                        {t.lastMoved}: <time dateTime={row.lastMovedAt}>{when(row.lastMovedAt, lang)}</time>
                        {/* No name, no claim about one. A move that has just been made
                            optimistically has not been told who made it yet, and "Системата"
                            would be a wrong answer rather than a missing one. */}
                        {row.lastMovedBy
                          ? <> · <span title={row.lastMovedBy}>{who(row.lastMovedBy, t)}</span></>
                          : null}
                        {stalled !== null
                          ? <> · <span className="adm-age">{stalled} {t.days}</span></>
                          : null}
                      </>
                    ) : t.neverMoved}
                  </span>
                </div>
                <div className="adm-row-actions">
                  {next ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      // Every advance button, not just this row's: one move at a time keeps
                      // the reload that follows it from landing on top of another one, and a
                      // button that looks pressable while it is being ignored is worse than
                      // one that is plainly waiting.
                      disabled={moving !== null}
                      title={`${t.moveTo}: ${label(next)}`}
                      aria-label={`${t.moveTo}: ${label(next)}`}
                      onClick={() => advance(row)}
                    >
                      → {label(next)}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="adm-linkbtn"
                    onClick={() => { setEditing({ ...row }); setOpenedStatus(row.status); setError('') }}
                  >
                    {t.edit}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AdminModal
        open={editing !== null}
        title={t.editTitle}
        subtitle={editing ? `${editing.customerName}${editing.model ? ` · ${editing.model}` : ''}` : ''}
        closeLabel={t.close}
        onClose={closeEditor}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={closeEditor} disabled={busy}>{t.cancel}</button>
            <button type="button" className="btn" onClick={save} disabled={busy}>
              {busy ? t.saving : t.save}
            </button>
          </>
        )}
      >
        {editing ? (
          <div className="adm-sheet">
            {error ? <div className="adm-alert" role="alert">{error}</div> : null}
            <section>
              <h3>{t.status}</h3>
              <div className="adm-newdeal-grid">
                <label>
                  <span className="adm-small">{t.status}</span>
                  <select value={editing.status} onChange={set('status')}>
                    {statuses.map((key) => <option key={key} value={key}>{label(key)}</option>)}
                  </select>
                </label>
                <label>
                  <span className="adm-small">{t.expectedAtHarbor}</span>
                  <input type="date" value={editing.expectedAtHarbor ?? ''} onChange={set('expectedAtHarbor')} />
                </label>
                <label>
                  <span className="adm-small">{t.expectedReady}</span>
                  <input type="date" value={editing.expectedReadyAt ?? ''} onChange={set('expectedReadyAt')} />
                </label>
              </div>
            </section>

            <section>
              <h3>{t.carrier}</h3>
              <div className="adm-newdeal-grid">
                <label>
                  <span className="adm-small">{t.carrier}</span>
                  <input type="text" value={editing.carrierName ?? ''} onChange={set('carrierName')} />
                </label>
                <label>
                  <span className="adm-small">{t.trackingRef}</span>
                  <input type="text" value={editing.trackingReference ?? ''} onChange={set('trackingReference')} />
                </label>
              </div>
              <label className="adm-sheet-notes">
                <span className="adm-small">{t.carrierNote}</span>
                <textarea rows={2} value={editing.carrierNote ?? ''} onChange={set('carrierNote')} />
                <span className="adm-small adm-muted">
                  {t.carrierHint}
                  {editing.carrierCheckedAt
                    ? ` (${t.carrierAsOf} ${new Date(editing.carrierCheckedAt).toLocaleDateString()})`
                    : ''}
                </span>
              </label>
            </section>

            {/* Newest first, the way somebody reads it: the last thing that happened is the
                thing being asked about. The audit trail's own row shape, because this is the
                same kind of reading and a second look for it would be a second thing to
                learn. */}
            <section>
              <h3>{t.history}</h3>
              {historyState === 'loading'
                ? <p className="adm-small adm-muted">{t.historyLoading}</p> : null}
              {historyState === 'error'
                ? <p className="adm-small adm-muted">{t.historyError}</p> : null}
              {historyState === 'ready' && history.length === 0
                ? <p className="adm-small adm-muted">{t.historyEmpty}</p> : null}
              {history.length > 0 ? (
                <ul className="adm-audit-list">
                  {history.map((h, i) => (
                    <li key={`${h.changedAt}-${i}`} className="adm-audit-entry adm-audit-updated">
                      <div className="adm-audit-head">
                        <span className="adm-audit-who" title={h.changedByUpn || t.system}>
                          {who(h.changedByUpn, t)}
                        </span>
                        <span className="adm-badge adm-stage-open">{label(h.status)}</span>
                        <time className="adm-small adm-muted" dateTime={h.changedAt}>
                          {when(h.changedAt, lang)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="adm-small adm-muted">{t.historyHint}</p>
            </section>

            <section>
              <h3>{t.track}</h3>
              {editing.publicReference ? (
                <>
                  <p className="adm-small">
                    <code>{linkFor(editing.publicReference)}</code>
                  </p>
                  <div className="adm-form-actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        navigator.clipboard?.writeText(linkFor(editing.publicReference))
                        setNotice(t.copied)
                      }}
                    >
                      {t.copy}
                    </button>
                    <button
                      type="button"
                      className="adm-linkbtn adm-danger"
                      onClick={() => revokeLink(editing)}
                    >
                      {t.revokeLink}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="adm-muted adm-small">{t.noLink}</p>
                  <div className="adm-form-actions">
                    <button type="button" className="btn" onClick={() => createLink(editing)}>
                      {t.createLink}
                    </button>
                  </div>
                </>
              )}
              <p className="adm-small adm-muted">{t.linkHint}</p>
            </section>
          </div>
        ) : null}
      </AdminModal>
    </AdminShell>
  )
}
