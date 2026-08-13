import React from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, adminSendForm, adminUpload, UnauthorizedError } from '../admin/adminApi.js'

// The leads pipeline: every customer we are actually talking to, with an owner, a stage
// and a conversation.
//
// This is what used to be called "deals". A lead is the relationship; the form somebody
// filled in on the site is an INQUIRY and lives in the section before this one.
//
// Built as one screen rather than a list page plus a detail page. Sales works a lead by
// reading the thread and replying, and a round trip back to a list between every reply is
// the thing that makes internal tools feel slow. On a phone the list collapses and the
// thread takes the screen, because a chat is unusable in half a viewport.

const TEXT = {
  bg: {
    title: 'Лийдове',
    subtitle: 'Всеки клиент с историята на разговора. Отговорите се записват тук автоматично.',
    tabs: { due: 'За връзка', open: 'Активни', mine: 'Мои', all: 'Всички', archived: 'Архив' },
    empty: 'Няма лийдове в този изглед.',
    dueEmpty: 'Няма просрочени лийдове. Всичко е по график.',
    dueSubtitle: 'Лийдове с дата за следващ контакт днес или по-рано.',
    nextContact: 'Следващ контакт',
    nextContactHint: 'Кога сте обещали да се обадите. Появява се в справката, ако датата мине.',
    noDate: 'без дата',
    dueToday: 'днес',
    overdue: (n) => `${n} ${n === 1 ? 'ден' : 'дни'} закъснение`,
    sendReport: 'Изпрати справка',
    reportTitle: 'Изпрати справка за връзка',
    reportHint: 'Справката съдържа само имената и връзки към панела — без съдържанието на разговорите.',
    reportTo: 'До (имейл, разделени със запетая)',
    reportSend: 'Изпрати',
    reportSent: (n) => `Изпратено: ${n} ${n === 1 ? 'лийд' : 'лийда'}.`,
    reportNothing: 'Няма просрочени лийдове — нищо не беше изпратено.',
    reportError: 'Справката не беше изпратена.',
    expand: 'Отвори на цял екран',
    close: 'Затвори',
    notesTitle: 'Бележки',
    noNotes: 'Няма бележки.',
    newDeal: 'Нов лийд',
    newDealHint: 'За клиенти, които не са писали през сайта — обаждане, изложение, препоръка.',
    fName: 'Име', fEmail: 'Имейл', fPhone: 'Телефон', fModel: 'Какво търси',
    details: 'Детайли', hideDetails: 'Скрий детайлите',
    dProject: 'Проект', dCountry: 'Държава', dAddress: 'Адрес на клиента',
    dBuild: 'Място на строеж', dNext: 'Следваща стъпка', dNotes: 'Бележки',
    saved: 'Запазено',
    backToList: '← Лийдове',
    create: 'Създай', cancel: 'Откажи', nameRequired: 'Името е задължително.',
    pick: 'Изберете лийд отляво.',
    status: {
      new: 'Нова', contacted: 'Свързахме се', quoted: 'Оферта',
      negotiating: 'Преговори', won: 'Спечелена', lost: 'Загубена',
    },
    owner: 'Отговорник', unassigned: 'Никой', takeIt: 'Поеми',
    nextStep: 'Следваща стъпка', save: 'Запази',
    thread: 'Разговор', noThread: 'Още няма съобщения.',
    them: 'Клиент', us: 'Ние',
    reply: 'Отговор', replyPlaceholder: 'Напишете отговора си…',
    send: 'Изпрати', sending: 'Изпращане…',
    logNote: '+ Бележка',
    logNoteHint: 'Записва текста и файловете в разговора, без да ги изпраща на клиента.',
    attach: 'Прикачи файл',
    attachHint: 'Файловете тръгват с отговора. По-големите запазете с „+ Бележка“.',
    removeFile: 'Премахни',
    attaching: 'Качване…',
    archivedEmpty: 'Няма архивирани лийдове.', note: 'Бележка', call: 'Обаждане',
    draft: 'Чернова с AI', drafting: 'Пиша чернова…',
    draftHint: 'Черновата е предложение — прочетете и редактирайте, преди да изпратите.',
    quiet: 'без активност', days: 'дни', today: 'днес', yesterday: 'вчера',
    sendError: 'Отговорът не беше изпратен.',
    draftError: 'Не успях да напиша чернова.',
    draftOff: 'AI черновите не са включени.',
    saveError: 'Промяната не беше запазена.',
  },
  en: {
    title: 'Leads',
    subtitle: 'Every customer with their conversation. Replies land here automatically.',
    tabs: { due: 'Due', open: 'Active', mine: 'Mine', all: 'All', archived: 'Archived' },
    empty: 'No leads in this view.',
    dueEmpty: 'Nothing overdue. Everything is on schedule.',
    dueSubtitle: 'Leads whose next contact was due today or earlier.',
    nextContact: 'Next contact',
    nextContactHint: 'When you promised to get back to them. Shows up in the report once the date passes.',
    noDate: 'no date',
    dueToday: 'today',
    overdue: (n) => `${n} ${n === 1 ? 'day' : 'days'} late`,
    sendReport: 'Send report',
    reportTitle: 'Send the follow-up report',
    reportHint: 'The report carries names and links back to the panel — never the contents of a conversation.',
    reportTo: 'To (email addresses, comma separated)',
    reportSend: 'Send',
    reportSent: (n) => `Sent: ${n} ${n === 1 ? 'lead' : 'leads'}.`,
    reportNothing: 'Nothing is overdue — no report was sent.',
    reportError: 'The report was not sent.',
    expand: 'Open full screen',
    close: 'Close',
    notesTitle: 'Notes',
    noNotes: 'No notes.',
    newDeal: 'New lead',
    newDealHint: 'For customers who did not come through the site — a call, a trade fair, a referral.',
    fName: 'Name', fEmail: 'Email', fPhone: 'Phone', fModel: 'What they want',
    details: 'Details', hideDetails: 'Hide details',
    dProject: 'Project', dCountry: 'Country', dAddress: 'Customer address',
    dBuild: 'Build location', dNext: 'Next step', dNotes: 'Notes',
    saved: 'Saved',
    backToList: '← Leads',
    create: 'Create', cancel: 'Cancel', nameRequired: 'A name is required.',
    pick: 'Pick a lead on the left.',
    status: {
      new: 'New', contacted: 'Contacted', quoted: 'Quoted',
      negotiating: 'Negotiating', won: 'Won', lost: 'Lost',
    },
    owner: 'Owner', unassigned: 'Nobody', takeIt: 'Take it',
    nextStep: 'Next step', save: 'Save',
    thread: 'Conversation', noThread: 'No messages yet.',
    them: 'Customer', us: 'Us',
    reply: 'Reply', replyPlaceholder: 'Write your reply…',
    send: 'Send', sending: 'Sending…',
    logNote: '+ Note',
    logNoteHint: 'Saves the text and files to the conversation without emailing the customer.',
    attach: 'Attach a file',
    attachHint: 'Files go out with the reply. Keep bigger ones with “+ Note”.',
    removeFile: 'Remove',
    attaching: 'Uploading…',
    archivedEmpty: 'Nothing archived yet.', note: 'Note', call: 'Call',
    draft: 'Draft with AI', drafting: 'Drafting…',
    draftHint: 'A draft is a suggestion — read it and edit before sending.',
    quiet: 'quiet for', days: 'days', today: 'today', yesterday: 'yesterday',
    sendError: 'The reply was not sent.',
    draftError: 'Could not write a draft.',
    draftOff: 'AI drafting is not switched on.',
    saveError: 'That change was not saved.',
  },
}

const STAGES = ['new', 'contacted', 'quoted', 'negotiating', 'won', 'lost']

const TABS = [
  // First, because it is the one view that answers "what did I promise?" — and the one
  // the emailed report links straight into.
  { key: 'due', query: 'due=true' },
  { key: 'open', query: 'status=open' },
  { key: 'mine', query: 'owner=mine' },
  { key: 'all', query: '' },
  // Won or lost for more than three days. Out of the way by default, never deleted.
  { key: 'archived', query: 'status=archived' },
]

// Everything a new lead can carry, in the order someone would say it out loud.
const NEW_DEAL_FIELDS = [
  ['name', 'fName'], ['email', 'fEmail'], ['phone', 'fPhone'], ['customModel', 'fModel'],
  ['projectName', 'dProject'], ['country', 'dCountry'], ['customerAddress', 'dAddress'],
  ['buildLocation', 'dBuild'], ['nextStep', 'dNext'],
]

const emptyDeal = () =>
  Object.fromEntries(NEW_DEAL_FIELDS.map(([f]) => [f, '']).concat([['notes', ''], ['nextContactAt', '']]))

// The stored date is midnight UTC, and <input type="date"> speaks "YYYY-MM-DD". Sliced
// off the ISO string rather than put through a Date, because toISOString() on a local
// Date shifts the day either side of midnight for anyone east or west of UTC — which is
// how a follow-up agreed for Tuesday shows as Monday.
function dateInputValue(iso) {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : ''
}

// Whole days between the follow-up date and today, in UTC on both sides.
function daysOverdue(iso) {
  const value = dateInputValue(iso)
  if (!value) return null
  const due = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(due)) return null
  const today = new Date()
  const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((startOfToday - due) / 86400000)
}

function formatDay(iso, lang) {
  const value = dateInputValue(iso)
  if (!value) return ''
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

// How long since anything happened, in the words someone would actually use. The board
// sorts on this, so it has to be legible at a glance or the ordering looks arbitrary.
function quietFor(iso, t) {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (days <= 0) return t.today
  if (days === 1) return t.yesterday
  return `${days} ${t.days}`
}

// Sizes people can read. "1.4 MB" tells someone whether a file will send; "1468 KB"
// makes them do the division.
function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatWhen(iso, lang) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// A status move is written into the thread by the server, so it shows up here as an
// entry too. Rendered as a thin divider rather than a bubble — it is punctuation in the
// conversation, not part of it.
function Entry({ activity, t, lang }) {
  if (activity.type === 'status') {
    return (
      <li className="adm-thread-meta">
        <span>{activity.body}</span>
        <time dateTime={activity.occurredAt}>{formatWhen(activity.occurredAt, lang)}</time>
      </li>
    )
  }

  const mine = !activity.fromCustomer
  return (
    <li className={`adm-thread-row${mine ? ' is-us' : ''}`}>
      <div className="adm-bubble">
        <div className="adm-bubble-head adm-small">
          <span className="adm-bubble-who">{mine ? t.us : t.them}</span>
          {activity.type === 'call' ? <span className="adm-muted"> · {t.call}</span> : null}
          {activity.type === 'note' ? <span className="adm-muted"> · {t.note}</span> : null}
          <time dateTime={activity.occurredAt}>{formatWhen(activity.occurredAt, lang)}</time>
        </div>
        {activity.subject ? <div className="adm-bubble-subject">{activity.subject}</div> : null}
        {/* Bodies are plain text from the server (inbound HTML is flattened before it is
            stored), so this renders as text — never dangerouslySetInnerHTML, which would
            execute whatever a customer chose to send us. */}
        <p className="adm-bubble-body">{activity.body}</p>
        {/* Files, on both sides of the conversation: the plan a customer emailed us and
            the quote we sent back. The href is the authenticated endpoint, never a blob
            URL — see AdminPipelineFilesController for why that is not an accident. */}
        {activity.attachments?.length ? (
          <ul className="adm-bubble-files">
            {activity.attachments.map((f) => (
              <li key={f.id}>
                <a href={f.downloadUrl} className="adm-file">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M13.6 3.2H7.4a2 2 0 0 0-2 2v13.6a2 2 0 0 0 2 2h9.2a2 2 0 0 0 2-2V8.2z" />
                    <path d="M13.6 3.2v5h5" />
                  </svg>
                  <span>{f.fileName}</span>
                </a>
                <span className="adm-muted adm-small"> · {formatSize(f.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  )
}

// The conversation itself, rendered the same way in the pane and in the full-screen
// reader. One component rather than two, because the version people reach for when a
// thread is long is exactly the one that must not be a simplified copy.
function Thread({ activities, t, lang, endRef }) {
  return (
    <ol className="adm-thread">
      {activities.length === 0
        ? <li className="adm-empty"><p>{t.noThread}</p></li>
        : activities.map((a) => <Entry key={a.id} activity={a} t={t} lang={lang} />)}
      {endRef ? <li ref={endRef} aria-hidden="true" /> : null}
    </ol>
  )
}

// "When did we say we would call?", said the way somebody would say it. Returns null when
// there is no date, so callers can leave the space empty rather than print "—".
function DueLabel({ iso, t, className = '' }) {
  if (!iso) return null

  const late = daysOverdue(iso)
  const text = late === null ? '' : late > 0 ? t.overdue(late) : late === 0 ? t.dueToday : ''

  return (
    <span className={`adm-due${late > 0 ? ' is-late' : ''} ${className}`.trim()}>
      {text || formatDay(iso, 'en')}
    </span>
  )
}

export default function AdminPipelinePage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [params, setParams] = useSearchParams()
  // The emailed report links to ?view=due, so the tab has to be readable from the URL —
  // otherwise every link in that mail lands on the default board and the person has to
  // find the report again by hand.
  const [tab, setTab] = React.useState(() =>
    TABS.some((x) => x.key === params.get('view')) ? params.get('view') : 'open')
  const [creating, setCreating] = React.useState(false)
  const [showDetails, setShowDetails] = React.useState(false)
  // Phones get one pane at a time. Stacking the board above a conversation means
  // scrolling past every other deal to reach the message you opened, which is the whole
  // screen working against you on the device most of the team actually uses.
  const [mobilePane, setMobilePane] = React.useState('list')
  const [fields, setFields] = React.useState(null)
  const [savedAt, setSavedAt] = React.useState(0)
  const [draftLead, setDraftLead] = React.useState(emptyDeal)
  const [board, setBoard] = React.useState([])
  const [selectedId, setSelectedId] = React.useState(null)
  const [lead, setLead] = React.useState(null)
  const [state, setState] = React.useState('loading')

  const [reply, setReply] = React.useState('')
  // Picked but not yet sent. Held here rather than uploaded on selection, so a file can be
  // removed before it becomes part of the record — and so the reply and its attachments
  // succeed or fail as one thing.
  const [files, setFiles] = React.useState([])
  const [busy, setBusy] = React.useState('')      // '' | 'send' | 'draft' | 'save' | 'report'
  const [error, setError] = React.useState('')

  // The full-screen reader, and the send-report dialog.
  const [reading, setReading] = React.useState(false)
  const [reporting, setReporting] = React.useState(false)
  const [reportTo, setReportTo] = React.useState('')
  const [reportNote, setReportNote] = React.useState('')

  const threadEnd = React.useRef(null)
  const filePicker = React.useRef(null)

  const loadBoard = React.useCallback(async (which) => {
    const query = TABS.find((x) => x.key === which)?.query ?? ''
    const rows = await adminGet(`/api/admin/pipeline${query ? `?${query}` : ''}`)
    setBoard(rows ?? [])
    return rows ?? []
  }, [])

  const loadLead = React.useCallback(async (id) => {
    if (!id) { setLead(null); return }
    setLead(await adminGet(`/api/admin/pipeline/${id}`))
  }, [])

  React.useEffect(() => {
    let alive = true
    setState('loading')
    setError('')
    loadBoard(tab)
      .then((rows) => {
        if (!alive) return
        // Opening straight into the lead that needs attention saves a click on the view
        // someone opens every morning; the board is already sorted quietest-first.
        // A ?lead= from the inquiry queue wins over both the current selection and the
        // default. A freshly promoted lead is often NOT in the current tab's rows yet,
        // so this deliberately does not check membership — otherwise clicking "create
        // lead" would land you on someone else's conversation.
        //
        // ?deal= is the same thing under its old name, still honoured because it is what
        // every link sent round the office before the rename says.
        const linked = Number(params.get('lead') || params.get('deal')) || null
        setSelectedId((current) => linked
          || (current && rows.some((r) => r.id === current) ? current : rows[0]?.id ?? null))
        setState('ready')
      })
      .catch((err) => { if (alive) setState(err instanceof UnauthorizedError ? 'unauthorized' : 'error') })
    return () => { alive = false }
  }, [loadBoard, tab, params])

  React.useEffect(() => {
    let alive = true
    loadLead(selectedId).catch((err) => {
      if (!alive) return
      if (err instanceof UnauthorizedError) setState('unauthorized')
    })
    return () => { alive = false }
  }, [loadLead, selectedId])

  React.useEffect(() => {
    if (!lead) { setFields(null); return }
    setFields({
      projectName: lead.projectName || '',
      country: lead.country || '',
      customerAddress: lead.customerAddress || '',
      buildLocation: lead.buildLocation || '',
      nextStep: lead.nextStep || '',
      nextContactAt: dateInputValue(lead.nextContactAt),
      notes: lead.notes || '',
    })
  }, [lead?.id])

  // Moving to another lead closes the reader: full-screen is a way of looking at ONE
  // conversation, and keeping it up across a selection change would show lead A's
  // header over lead B's thread for a frame.
  React.useEffect(() => { setReading(false) }, [selectedId])

  // Newest message in view when a thread opens or grows. A chat that opens at the top of
  // a six-month history shows the least useful part of it.
  React.useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: 'end' })
  }, [lead?.id, lead?.activities?.length])

  async function run(kind, fn, failMessage) {
    setBusy(kind)
    setError('')
    try {
      await fn()
    } catch (err) {
      if (err instanceof UnauthorizedError) { setState('unauthorized'); return }
      setError(err?.message || failMessage)
    } finally {
      setBusy('')
    }
  }

  const send = () => run('send', async () => {
    const body = reply.trim()
    if (!body) return

    // Multipart even with nothing attached, so there is one send path rather than two —
    // the one that carries files being the one nobody exercises until it matters.
    const form = new FormData()
    form.append('body', body)
    for (const file of files) form.append('files', file, file.name)

    await adminSendForm(`/api/admin/pipeline/${selectedId}/reply`, form)
    // Cleared only after the server confirms. Clearing optimistically loses what someone
    // typed if the send fails, and retyping a reply is the least forgivable data loss in
    // a tool like this.
    setReply('')
    setFiles([])
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.sendError)

  const draft = () => run('draft', async () => {
    const result = await adminSend(`/api/admin/pipeline/${selectedId}/draft`, 'POST', {
      instruction: reply.trim() || null,
    })
    // The draft replaces whatever was in the box, because what was there was the steer
    // for it. Nothing is sent and nothing is stored until someone presses Send.
    if (result?.text) setReply(result.text)
  }, t.draftError)

  const setStatus = (status) => run('save', async () => {
    await adminSend(`/api/admin/pipeline/${selectedId}/status`, 'POST', { status })
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const takeIt = () => run('save', async () => {
    await adminSend(`/api/admin/pipeline/${selectedId}/owner`, 'POST', { ownerUpn: 'me' })
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const logNote = () => run('save', async () => {
    const body = reply.trim()
    if (!body && files.length === 0) return

    if (files.length === 0) {
      await adminSend(`/api/admin/pipeline/${selectedId}/activities`, 'POST', { type: 'note', body })
    } else {
      // One entry per file, because that is what the upload endpoint files them as: an
      // attachment and the words that came with it belong together. The typed text
      // captions the first one; the rest carry their own name.
      //
      // This is also the way to keep a file that is too big to email — the note path
      // stores up to the full 20 MB, the reply path is capped by what Graph will send.
      for (const [index, file] of files.entries()) {
        await adminUpload(
          `/api/admin/pipeline/${selectedId}/attachments`,
          file,
          index === 0 && body ? { caption: body } : {},
        )
      }
    }

    setReply('')
    setFiles([])
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const saveFields = () => run('save', async () => {
    await adminSend(`/api/admin/pipeline/${selectedId}/fields`, 'POST', fields)
    setSavedAt(Date.now())
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const createDeal = () => run('save', async () => {
    const name = draftLead.name.trim()
    if (!name) { setError(t.nameRequired); return }
    const result = await adminSend('/api/admin/pipeline', 'POST', { ...draftLead, name })
    setCreating(false)
    setDraftLead(emptyDeal())
    await loadBoard(tab)
    // Straight into the new thread — the point of creating it was to talk to someone.
    if (result?.id) setParams({ lead: String(result.id) })
  }, t.saveError)

  const sendReport = () => run('report', async () => {
    const result = await adminSend('/api/admin/pipeline/due/report', 'POST', {
      to: reportTo.trim() || null,
    })
    setReporting(false)
    // The dialog closes either way; what happened is said on the page. "Nothing was due"
    // is a success that must not read like a failure.
    setReportNote(result?.count > 0 ? t.reportSent(result.count) : t.reportNothing)
  }, t.reportError)

  return (
    <AdminShell
      lang={lang}
      setLang={setLang}
      active="pipeline"
      title={t.title}
      subtitle={t.subtitle}
      state={state}
      onRetry={() => loadBoard(tab)}
    >
      <nav className="adm-tabs" aria-label={t.title}>
        {TABS.map(({ key }) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'is-active' : ''}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {t.tabs[key]}
          </button>
        ))}
      </nav>

      <div className="adm-pipeline-toolbar">
        <button type="button" className="btn" onClick={() => setCreating(true)}>
          + {t.newDeal}
        </button>
        {/* The report goes with the view it reports on. On the other tabs it would be a
            button whose result has nothing to do with what is on screen. */}
        {tab === 'due' ? (
          <button type="button" className="btn ghost" onClick={() => setReporting(true)}>
            {t.sendReport}
          </button>
        ) : null}
        <span className="adm-small adm-muted">
          {tab === 'due' ? t.dueSubtitle : t.newDealHint}
        </span>
        {reportNote ? <span className="adm-small adm-report-note" role="status">{reportNote}</span> : null}
      </div>

      {/* Who gets the overdue list. Empty means yourself — the server resolves the
          signed-in account — so the quick case is two clicks and no typing. */}
      <AdminModal
        open={reporting}
        title={t.reportTitle}
        subtitle={t.reportHint}
        closeLabel={t.cancel}
        onClose={() => setReporting(false)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setReporting(false)}>
              {t.cancel}
            </button>
            <button type="button" className="btn" onClick={sendReport} disabled={busy !== ''}>
              {busy === 'report' ? t.sending : t.reportSend}
            </button>
          </>
        )}
      >
        <label>
          <span className="adm-small">{t.reportTo}</span>
          <input
            type="text"
            inputMode="email"
            value={reportTo}
            placeholder="you@nvc-home4you.eu"
            onChange={(e) => setReportTo(e.target.value)}
          />
        </label>
      </AdminModal>

      <AdminModal
        open={creating}
        title={t.newDeal}
        subtitle={t.newDealHint}
        closeLabel={t.cancel}
        onClose={() => setCreating(false)}
        footer={(
          <>
            <button type="button" className="btn ghost" onClick={() => setCreating(false)}>
              {t.cancel}
            </button>
            <button
              type="button"
              className="btn"
              onClick={createDeal}
              disabled={!draftLead.name.trim() || busy !== ''}
            >
              {t.create}
            </button>
          </>
        )}
      >
        <div className="adm-newdeal-grid">
          {NEW_DEAL_FIELDS.map(([field, labelKey]) => (
            <label key={field}>
              <span className="adm-small">{t[labelKey]}{field === 'name' ? ' *' : ''}</span>
              <input
                type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                value={draftLead[field]}
                onChange={(e) => setDraftLead((d) => ({ ...d, [field]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="adm-newdeal-grid">
          <label>
            <span className="adm-small">{t.nextContact}</span>
            <input
              type="date"
              value={draftLead.nextContactAt}
              onChange={(e) => setDraftLead((d) => ({ ...d, nextContactAt: e.target.value }))}
            />
          </label>
        </div>
        <label className="adm-newdeal-notes">
          <span className="adm-small">{t.dNotes}</span>
          <textarea
            rows={3}
            value={draftLead.notes}
            onChange={(e) => setDraftLead((d) => ({ ...d, notes: e.target.value }))}
          />
        </label>
      </AdminModal>

      <div className={`adm-pipeline is-mobile-${mobilePane}`}>
        <ul className="adm-pipeline-list">
          {board.length === 0
            ? (
              <li className="adm-empty">
                <p>{tab === 'archived' ? t.archivedEmpty : tab === 'due' ? t.dueEmpty : t.empty}</p>
              </li>
            )
            : null}
          {board.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`adm-pipeline-item${row.id === selectedId ? ' is-active' : ''}`}
                aria-current={row.id === selectedId ? 'true' : undefined}
                onClick={() => { setSelectedId(row.id); setMobilePane('thread') }}
              >
                <span className="adm-name">{row.name || '—'}</span>
                <span className={`adm-badge adm-stage-${row.status}`}>{t.status[row.status] ?? row.status}</span>
                {row.modelLabel ? <span className="adm-muted adm-small">{row.modelLabel}</span> : null}
                <DueLabel iso={row.nextContactAt} t={t} className="adm-small" />
                {row.lastActivityAt ? (
                  <span className="adm-small adm-muted">{t.quiet} {quietFor(row.lastActivityAt, t)}</span>
                ) : (
                  <span className="adm-age adm-small">{t.quiet} —</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <section className="adm-pipeline-detail">
          {!lead ? (
            <div className="adm-empty"><p>{t.pick}</p></div>
          ) : (
            <>
              <button
                type="button"
                className="adm-linkbtn adm-back"
                onClick={() => setMobilePane('list')}
              >
                {t.backToList}
              </button>

              <header className="adm-deal-head">
                <div>
                  <h2>{lead.name || '—'}</h2>
                  <p className="adm-small adm-muted">
                    {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : null}
                    {lead.phone ? <> · <a href={`tel:${lead.phone.replace(/\s+/g, '')}`}>{lead.phone}</a></> : null}
                    {lead.houseTitle || lead.customModel
                      ? <> · {lead.houseTitle || lead.customModel}</>
                      : null}
                  </p>
                </div>

                <div className="adm-deal-controls">
                  <label className="visually-hidden" htmlFor="dealStatus">{t.thread}</label>
                  <select
                    id="dealStatus"
                    value={lead.status}
                    disabled={busy === 'save'}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STAGES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
                  </select>

                  <span className="adm-small adm-muted">
                    {t.owner}: {lead.ownerUpn || t.unassigned}
                  </span>
                  {!lead.ownerUpn ? (
                    <button type="button" className="adm-linkbtn" onClick={takeIt} disabled={busy === 'save'}>
                      {t.takeIt}
                    </button>
                  ) : null}

                  {/* A long thread in a half-width pane is the reason this exists; the
                      reader shows the same conversation with the whole screen to do it. */}
                  <button
                    type="button"
                    className="adm-linkbtn"
                    onClick={() => setReading(true)}
                  >
                    {t.expand}
                  </button>
                </div>
              </header>

              {lead.nextStep || lead.nextContactAt ? (
                <p className="adm-next-step">
                  <span className="adm-next-step-tag">{t.nextStep}</span>
                  {lead.nextStep ? <strong>{lead.nextStep}</strong> : null}
                  <DueLabel iso={lead.nextContactAt} t={t} />
                </p>
              ) : null}

              <button
                type="button"
                className="adm-linkbtn adm-details-toggle"
                aria-expanded={showDetails}
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? t.hideDetails : t.details}
              </button>

              {showDetails && fields ? (
                <div className="adm-deal-fields">
                  <div className="adm-newdeal-grid">
                    {[
                      ['projectName', t.dProject], ['country', t.dCountry],
                      ['customerAddress', t.dAddress], ['buildLocation', t.dBuild],
                      ['nextStep', t.dNext],
                    ].map(([field, label]) => (
                      <label key={field}>
                        <span className="adm-small">{label}</span>
                        <input
                          type="text"
                          value={fields[field]}
                          onChange={(e) => setFields((f) => ({ ...f, [field]: e.target.value }))}
                        />
                      </label>
                    ))}
                    <label>
                      <span className="adm-small">{t.nextContact}</span>
                      <input
                        type="date"
                        title={t.nextContactHint}
                        value={fields.nextContactAt}
                        onChange={(e) => setFields((f) => ({ ...f, nextContactAt: e.target.value }))}
                      />
                    </label>
                  </div>
                  <label>
                    <span className="adm-small">{t.dNotes}</span>
                    <textarea
                      rows={3}
                      value={fields.notes}
                      onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </label>
                  <div className="adm-composer-actions">
                    <button type="button" className="btn ghost adm-btn-sm" onClick={saveFields} disabled={busy !== ''}>
                      {t.save}
                    </button>
                    {savedAt ? <span className="adm-small adm-muted">{t.saved}</span> : null}
                  </div>
                </div>
              ) : null}

              <Thread activities={lead.activities} t={t} lang={lang} endRef={threadEnd} />

              {/* The whole conversation with the whole screen: the thread, then the
                  standing notes — the two things someone reads before picking a lead
                  back up. Reading only; replying happens in the pane, where the
                  composer's draft/attach machinery already lives. */}
              <AdminModal
                open={reading}
                title={lead.name || '—'}
                subtitle={[
                  lead.houseTitle || lead.customModel || '',
                  lead.nextStep || '',
                ].filter(Boolean).join(' · ')}
                closeLabel={t.close}
                onClose={() => setReading(false)}
              >
                <div className="adm-reader">
                  <Thread activities={lead.activities} t={t} lang={lang} />
                  <section className="adm-reader-notes">
                    <h3 className="adm-small">{t.notesTitle}</h3>
                    {lead.notes
                      ? <p>{lead.notes}</p>
                      : <p className="adm-muted"><em>{t.noNotes}</em></p>}
                  </section>
                </div>
              </AdminModal>

              {error ? <div className="adm-alert">{error}</div> : null}

              <div className="adm-composer">
                <label className="visually-hidden" htmlFor="replyBox">{t.reply}</label>
                <textarea
                  id="replyBox"
                  rows={5}
                  value={reply}
                  placeholder={t.replyPlaceholder}
                  disabled={busy === 'send'}
                  onChange={(e) => setReply(e.target.value)}
                />

                {/* Hidden, and opened by the button below. A bare file input renders as
                    "Choose file / no file chosen" in a different typeface on every
                    browser, and cannot say what it is for. */}
                <input
                  ref={filePicker}
                  type="file"
                  multiple
                  className="visually-hidden"
                  onChange={(e) => {
                    // Copied out BEFORE the input is reset, and before the state updater
                    // runs. React calls that updater during the next render, by which
                    // point clearing the input has emptied e.target.files — reading it
                    // from inside the closure appends nothing at all.
                    const picked = Array.from(e.target.files ?? [])
                    // Cleared so picking the same file twice in a row still fires a
                    // change event — otherwise the second attempt silently does nothing.
                    e.target.value = ''
                    setFiles((prev) => [...prev, ...picked])
                  }}
                />

                {files.length > 0 ? (
                  <ul className="adm-attach-list">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="adm-attach-chip">
                        <span className="adm-attach-name">{file.name}</span>
                        <span className="adm-muted adm-small">{formatSize(file.size)}</span>
                        <button
                          type="button"
                          className="adm-attach-x"
                          aria-label={`${t.removeFile}: ${file.name}`}
                          disabled={busy !== ''}
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <p className="adm-small adm-muted">{t.draftHint}</p>
                <div className="adm-composer-actions">
                  <button type="button" className="btn" onClick={send} disabled={!reply.trim() || busy !== ''}>
                    {busy === 'send' ? t.sending : t.send}
                  </button>
                  <button type="button" className="btn ghost" onClick={draft} disabled={busy !== ''}>
                    {busy === 'draft' ? t.drafting : t.draft}
                  </button>
                  <button
                    type="button"
                    className="btn ghost adm-attach-btn"
                    title={t.attachHint}
                    disabled={busy !== ''}
                    onClick={() => filePicker.current?.click()}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 11.4 12.3 19a4.6 4.6 0 0 1-6.5-6.5l7.9-7.9a3 3 0 0 1 4.3 4.3l-7.9 7.9a1.5 1.5 0 0 1-2.1-2.1l7.2-7.2" />
                    </svg>
                    <span>{t.attach}</span>
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    title={t.logNoteHint}
                    onClick={logNote}
                    disabled={(!reply.trim() && files.length === 0) || busy !== ''}
                  >
                    {t.logNote}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </AdminShell>
  )
}
