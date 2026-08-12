import React from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import { adminGet, adminSend, UnauthorizedError } from '../admin/adminApi.js'

// The deals pipeline: every lead with an owner, a stage and a conversation.
//
// Built as one screen rather than a list page plus a detail page. Sales works a lead by
// reading the thread and replying, and a round trip back to a list between every reply is
// the thing that makes internal tools feel slow. On a phone the list collapses and the
// thread takes the screen, because a chat is unusable in half a viewport.

const TEXT = {
  bg: {
    title: 'Сделки',
    subtitle: 'Всеки клиент с историята на разговора. Отговорите се записват тук автоматично.',
    tabs: { open: 'Активни', mine: 'Мои', all: 'Всички', archived: 'Архив' },
    empty: 'Няма сделки в този изглед.',
    newDeal: 'Нова сделка',
    newDealHint: 'За клиенти, които не са писали през сайта — обаждане, изложение, препоръка.',
    fName: 'Име', fEmail: 'Имейл', fPhone: 'Телефон', fModel: 'Какво търси',
    details: 'Детайли', hideDetails: 'Скрий детайлите',
    dProject: 'Проект', dCountry: 'Държава', dAddress: 'Адрес на клиента',
    dBuild: 'Място на строеж', dNext: 'Следваща стъпка', dNotes: 'Бележки',
    saved: 'Запазено',
    backToList: '← Сделки',
    create: 'Създай', cancel: 'Откажи', nameRequired: 'Името е задължително.',
    pick: 'Изберете сделка отляво.',
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
    logNoteHint: 'Записва текста в разговора, без да го изпраща на клиента.',
    archivedEmpty: 'Няма архивирани сделки.', note: 'Бележка', call: 'Обаждане',
    draft: 'Чернова с AI', drafting: 'Пиша чернова…',
    draftHint: 'Черновата е предложение — прочетете и редактирайте, преди да изпратите.',
    quiet: 'без активност', days: 'дни', today: 'днес', yesterday: 'вчера',
    sendError: 'Отговорът не беше изпратен.',
    draftError: 'Не успях да напиша чернова.',
    draftOff: 'AI черновите не са включени.',
    saveError: 'Промяната не беше запазена.',
  },
  en: {
    title: 'Deals',
    subtitle: 'Every customer with their conversation. Replies land here automatically.',
    tabs: { open: 'Active', mine: 'Mine', all: 'All', archived: 'Archived' },
    empty: 'No deals in this view.',
    newDeal: 'New deal',
    newDealHint: 'For customers who did not come through the site — a call, a trade fair, a referral.',
    fName: 'Name', fEmail: 'Email', fPhone: 'Phone', fModel: 'What they want',
    details: 'Details', hideDetails: 'Hide details',
    dProject: 'Project', dCountry: 'Country', dAddress: 'Customer address',
    dBuild: 'Build location', dNext: 'Next step', dNotes: 'Notes',
    saved: 'Saved',
    backToList: '← Deals',
    create: 'Create', cancel: 'Cancel', nameRequired: 'A name is required.',
    pick: 'Pick a deal on the left.',
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
    logNoteHint: 'Saves the text to the conversation without emailing the customer.',
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
  { key: 'open', query: 'status=open' },
  { key: 'mine', query: 'owner=mine' },
  { key: 'all', query: '' },
  // Won or lost for more than three days. Out of the way by default, never deleted.
  { key: 'archived', query: 'status=archived' },
]

// Everything a new deal can carry, in the order someone would say it out loud.
const NEW_DEAL_FIELDS = [
  ['name', 'fName'], ['email', 'fEmail'], ['phone', 'fPhone'], ['customModel', 'fModel'],
  ['projectName', 'dProject'], ['country', 'dCountry'], ['customerAddress', 'dAddress'],
  ['buildLocation', 'dBuild'], ['nextStep', 'dNext'],
]

const emptyDeal = () =>
  Object.fromEntries(NEW_DEAL_FIELDS.map(([f]) => [f, '']).concat([['notes', '']]))

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
        {activity.attachments?.length ? (
          <ul className="adm-bubble-files">
            {activity.attachments.map((f) => (
              <li key={f.id}>
                <a href={f.downloadUrl}>{f.fileName}</a>
                <span className="adm-muted adm-small"> · {Math.round(f.sizeBytes / 1024)} KB</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  )
}

export default function AdminPipelinePage() {
  const [lang, setLang] = useAdminLang()
  const t = TEXT[lang] ?? TEXT.bg

  const [params, setParams] = useSearchParams()
  const [tab, setTab] = React.useState('open')
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
  const [busy, setBusy] = React.useState('')      // '' | 'send' | 'draft' | 'save'
  const [error, setError] = React.useState('')

  const threadEnd = React.useRef(null)

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
        // A ?deal= from the enquiry queue wins over both the current selection and the
        // default. A freshly promoted deal is often NOT in the current tab's rows yet,
        // so this deliberately does not check membership — otherwise clicking "create
        // deal" would land you on someone else's conversation.
        const linked = Number(params.get('deal')) || null
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
      notes: lead.notes || '',
    })
  }, [lead?.id])

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
    await adminSend(`/api/admin/pipeline/${selectedId}/reply`, 'POST', { body })
    // Cleared only after the server confirms. Clearing optimistically loses what someone
    // typed if the send fails, and retyping a reply is the least forgivable data loss in
    // a tool like this.
    setReply('')
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
    if (!body) return
    await adminSend(`/api/admin/pipeline/${selectedId}/activities`, 'POST', { type: 'note', body })
    setReply('')
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
    if (result?.id) setParams({ deal: String(result.id) })
  }, t.saveError)

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
        <span className="adm-small adm-muted">{t.newDealHint}</span>
      </div>

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
            ? <li className="adm-empty"><p>{tab === 'archived' ? t.archivedEmpty : t.empty}</p></li>
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
                </div>
              </header>

              {lead.nextStep ? (
                <p className="adm-next-step">
                  <span className="adm-next-step-tag">{t.nextStep}</span>
                  <strong>{lead.nextStep}</strong>
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

              <ol className="adm-thread">
                {lead.activities.length === 0
                  ? <li className="adm-empty"><p>{t.noThread}</p></li>
                  : lead.activities.map((a) => <Entry key={a.id} activity={a} t={t} lang={lang} />)}
                <li ref={threadEnd} aria-hidden="true" />
              </ol>

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
                    className="btn ghost"
                    title={t.logNoteHint}
                    onClick={logNote}
                    disabled={!reply.trim() || busy !== ''}
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
