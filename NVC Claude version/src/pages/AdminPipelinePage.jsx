import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminShell, { useAdminLang } from '../admin/AdminShell.jsx'
import AdminModal from '../admin/AdminModal.jsx'
import RichTextEditor from '../admin/RichTextEditor.jsx'
import { adminGet, adminSend, adminSendForm, adminUpload, UnauthorizedError } from '../admin/adminApi.js'
import { adminSave, keepsTheEditorOpen } from '../admin/adminSave.js'
import { resolveModel, modelsFor, WITH_GALLERY_MODELS_FALLBACK } from '../admin/modelPicker.js'
import {
  sanitizeRichText, isRichTextEmpty, escapeHtml, plainTextToRichHtml, richTextToPlain,
} from '../lib/sanitizeRichText.js'

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
    // Names the person, because the whole point is that this is NOT a statement about
    // everyone — see the empty-state block for what it replaced.
    ownerEmpty: (owner) => `Няма просрочени лийдове за ${owner}. Останалите не са проверени.`,
    dueSubtitle: 'Лийдове с дата за следващ контакт днес или по-рано.',
    nextContact: 'Следващ контакт',
    nextContactHint: 'Кога сте обещали да се обадите. Появява се в справката, ако датата мине.',
    noDate: 'без дата',
    dueToday: 'днес',
    overdue: (n) => `${n} ${n === 1 ? 'ден' : 'дни'} закъснение`,
    // The other kind of urgent, and it sits beside the first: an overdue date is a promise
    // WE broke, this is a message left unanswered, and one lead can be both at once.
    awaiting: 'Чака отговор',
    awaitingHint: 'Последното в разговора е от клиента — топката е в нашето поле.',
    sendReport: 'Изпрати справка',
    reportTitle: 'Изпрати справка за връзка',
    reportHint: 'Справката съдържа само имената и връзки към панела — без съдържанието на разговорите.',
    reportTo: 'До (имейл, разделени със запетая)',
    reportSend: 'Изпрати',
    reportSent: (n) => `Изпратено: ${n} ${n === 1 ? 'лийд' : 'лийда'}.`,
    reportNothing: 'Няма просрочени лийдове — нищо не беше изпратено.',
    reportError: 'Справката не беше изпратена.',
    close: 'Затвори',
    category: 'Категория',
    noCategory: '— не е избрана —',
    model: 'Какво търси',
    modelHint: 'Изберете модел от списъка или напишете свободно.',
    modelHintFree: 'Каталогът няма модели в тази категория — опишете какво търси клиентът.',
    modelLinked: (title) => `свързан модел: ${title}`,
    modelFree: 'свободен текст — без връзка с модел от галерията',
    modelNoCatalogue: 'свободен текст — каталогът няма модели в тази категория',
    categories: {
      prefab: 'Сглобяема къща', wagon: 'Фургон', modular: 'Модулна къща', garage: 'Гараж',
    },
    newDeal: 'Нов лийд',
    newDealHint: 'За клиенти, които не са писали през сайта — обаждане, изложение, препоръка.',
    fName: 'Име', fEmail: 'Имейл', fPhone: 'Телефон', fModel: 'Какво търси',
    details: 'Детайли',
    sheet: 'Детайли и разговор',
    nextTitle: 'Какво следва',
    nextStepPlaceholder: 'Напр. „Да изпратя оферта до петък“',
    notesPlaceholder: 'Какво знаем за клиента — предпочитано време за обаждане, кой решава…',
    dProject: 'Проект', dCountry: 'Държава', dAddress: 'Адрес на клиента',
    dBuild: 'Място на строеж', dNext: 'Следваща стъпка', dNotes: 'Бележки',
    saved: 'Запазено',
    backToList: '← Лийдове',
    create: 'Създай', creating: 'Създаване…', cancel: 'Откажи', nameRequired: 'Името е задължително.',
    pick: 'Изберете лийд отляво.',
    status: {
      new: 'Нова', contacted: 'Свързахме се', quoted: 'Оферта',
      negotiating: 'Преговори', won: 'Спечелена', lost: 'Загубена',
    },
    owner: 'Отговорник', unassigned: 'Никой', takeIt: 'Поеми',
    makeCustomer: 'Направи клиент',
    makeCustomerHint: 'Създава клиент от този лийд и отваря картона му, където се добавя покупката.',
    nextStep: 'Следваща стъпка', save: 'Запази', saving: 'Запазване…',
    thread: 'Разговор', noThread: 'Още няма съобщения.',
    them: 'Клиент', us: 'Ние',
    reply: 'Отговор', replyPlaceholder: 'Напишете отговора си…',
    send: 'Изпрати', sending: 'Изпращане…',
    logAs: 'Запиши като',
    logHint: 'Записва текста и файловете в разговора, без да ги изпраща на клиента.',
    logNeedsWords: 'Опишете какво се случи — обаждане или среща се записва с текст.',
    attach: 'Прикачи файл',
    // Named by the action, not by the button's caption: that caption is now whichever kind
    // is chosen, so a hint that said „+ Бележка“ sent people looking for a button that is
    // not on screen — and mailing the file instead, which is the size limit the hint exists
    // to steer them around.
    attachHint: 'Файловете тръгват с отговора. По-големите ги запишете в разговора.',
    removeFile: 'Премахни',
    attaching: 'Качване…',
    archivedEmpty: 'Няма архивирани лийдове.', note: 'Бележка', call: 'Обаждане', meeting: 'Среща',
    draft: 'Чернова с AI', drafting: 'Пиша чернова…',
    draftHint: 'Черновата е предложение — прочетете и редактирайте, преди да изпратите.',
    quiet: 'без активност', days: 'дни', today: 'днес', yesterday: 'вчера',
    sendError: 'Отговорът не беше изпратен.',
    draftError: 'Не успях да напиша чернова.',
    draftOff: 'AI черновите не са включени.',
    saveError: 'Промяната не беше запазена.',
    filterStatus: 'Статус',
    filterModified: 'Активност',
    filterOwner: 'Отговорник',
    filterOwnerAll: '— на всички —',
    filterAny: '— всички —',
    modified: {
      today: 'днес', week: 'последните 7 дни', month: 'последните 30 дни',
      stale: 'без активност от 30+ дни',
    },
    filteredEmpty: 'Няма лийдове, отговарящи на филтрите.',
    clearFilters: 'Изчисти филтрите',
  },
  en: {
    title: 'Leads',
    subtitle: 'Every customer with their conversation. Replies land here automatically.',
    tabs: { due: 'Due', open: 'Active', mine: 'Mine', all: 'All', archived: 'Archived' },
    empty: 'No leads in this view.',
    dueEmpty: 'Nothing overdue. Everything is on schedule.',
    ownerEmpty: (owner) => `Nothing overdue for ${owner}. Nobody else was checked.`,
    dueSubtitle: 'Leads whose next contact was due today or earlier.',
    nextContact: 'Next contact',
    nextContactHint: 'When you promised to get back to them. Shows up in the report once the date passes.',
    noDate: 'no date',
    dueToday: 'today',
    overdue: (n) => `${n} ${n === 1 ? 'day' : 'days'} late`,
    awaiting: 'Awaiting reply',
    awaitingHint: 'The customer wrote last — the ball is in our court.',
    sendReport: 'Send report',
    reportTitle: 'Send the follow-up report',
    reportHint: 'The report carries names and links back to the panel — never the contents of a conversation.',
    reportTo: 'To (email addresses, comma separated)',
    reportSend: 'Send',
    reportSent: (n) => `Sent: ${n} ${n === 1 ? 'lead' : 'leads'}.`,
    reportNothing: 'Nothing is overdue — no report was sent.',
    reportError: 'The report was not sent.',
    close: 'Close',
    category: 'Category',
    noCategory: '— none chosen —',
    model: 'What they want',
    modelHint: 'Pick a model from the list, or write it out.',
    modelHintFree: 'The catalogue has no models in this category — write out what they want.',
    modelLinked: (title) => `linked model: ${title}`,
    modelFree: 'free text — not linked to a gallery model',
    modelNoCatalogue: 'free text — the catalogue has no models in this category',
    categories: {
      prefab: 'Prefab house', wagon: 'Wagon / site cabin', modular: 'Modular house', garage: 'Garage',
    },
    newDeal: 'New lead',
    newDealHint: 'For customers who did not come through the site — a call, a trade fair, a referral.',
    fName: 'Name', fEmail: 'Email', fPhone: 'Phone', fModel: 'What they want',
    details: 'Details',
    sheet: 'Details & conversation',
    nextTitle: 'What happens next',
    nextStepPlaceholder: 'e.g. “Send the revised quote by Friday”',
    notesPlaceholder: 'What we know about them — best time to call, who actually decides…',
    dProject: 'Project', dCountry: 'Country', dAddress: 'Customer address',
    dBuild: 'Build location', dNext: 'Next step', dNotes: 'Notes',
    saved: 'Saved',
    backToList: '← Leads',
    create: 'Create', creating: 'Creating…', cancel: 'Cancel', nameRequired: 'A name is required.',
    pick: 'Pick a lead on the left.',
    status: {
      new: 'New', contacted: 'Contacted', quoted: 'Quoted',
      negotiating: 'Negotiating', won: 'Won', lost: 'Lost',
    },
    owner: 'Owner', unassigned: 'Nobody', takeIt: 'Take it',
    makeCustomer: 'Make customer',
    makeCustomerHint: 'Creates a customer from this lead and opens their card, where the purchase is added.',
    nextStep: 'Next step', save: 'Save', saving: 'Saving…',
    thread: 'Conversation', noThread: 'No messages yet.',
    them: 'Customer', us: 'Us',
    reply: 'Reply', replyPlaceholder: 'Write your reply…',
    send: 'Send', sending: 'Sending…',
    logAs: 'Log as',
    logHint: 'Saves the text and files to the conversation without emailing the customer.',
    logNeedsWords: 'Write what happened — a call or a meeting is logged with words.',
    attach: 'Attach a file',
    attachHint: 'Files go out with the reply. Keep bigger ones by logging them to the conversation.',
    removeFile: 'Remove',
    attaching: 'Uploading…',
    archivedEmpty: 'Nothing archived yet.', note: 'Note', call: 'Call', meeting: 'Meeting',
    draft: 'Draft with AI', drafting: 'Drafting…',
    draftHint: 'A draft is a suggestion — read it and edit before sending.',
    quiet: 'quiet for', days: 'days', today: 'today', yesterday: 'yesterday',
    sendError: 'The reply was not sent.',
    draftError: 'Could not write a draft.',
    draftOff: 'AI drafting is not switched on.',
    saveError: 'That change was not saved.',
    filterStatus: 'Status',
    filterModified: 'Activity',
    filterOwner: 'Owner',
    filterOwnerAll: '— everyone —',
    filterAny: '— any —',
    modified: {
      today: 'today', week: 'last 7 days', month: 'last 30 days',
      stale: 'quiet for 30+ days',
    },
    filteredEmpty: 'No leads match the filters.',
    clearFilters: 'Clear filters',
  },
}

// The activity windows the board can be narrowed to, as predicates over "days since the
// last activity". Declarative so the dropdown and the filtering cannot disagree about what
// a key means. "stale" answers the opposite question from the rest — who has been
// FORGOTTEN — and includes leads with no activity at all, which are the most forgotten.
const MODIFIED_WINDOWS = {
  today: (days) => days !== null && days <= 0,
  week: (days) => days !== null && days <= 7,
  month: (days) => days !== null && days <= 30,
  stale: (days) => days === null || days > 30,
}

// Whole days since the timestamp, or null when there is none to measure from.
function daysSince(iso) {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((Date.now() - then.getTime()) / 86400000)
}

// The office number, shared by every signature. The name and email are the signed-in
// user's; this is the one line that is the same for everyone (owner, 2026-08-17).
const SIGNATURE_PHONE = '024 371 650'

// The signature the composer starts with, in the language the CUSTOMER reads — it goes to
// them, so the lead's locale decides, not the panel's UI language.
function signatureHtml(me, locale) {
  if (!me?.name && !me?.email) return ''

  const [greeting, tel] =
    locale === 'bg' ? ['Поздрави', 'тел'] : locale === 'el' ? ['Με εκτίμηση', 'τηλ'] : ['Best regards', 'tel']

  const lines = [
    `${greeting},`,
    me.name ? `<strong>${escapeHtml(me.name)}</strong>` : '',
    'NVC Home4You',
    `${tel}. ${SIGNATURE_PHONE}`,
    me.email ? `<a href="mailto:${escapeHtml(me.email)}">${escapeHtml(me.email)}</a>` : '',
  ].filter(Boolean)

  // The leading empty paragraph is where the message gets typed — the caret lands above
  // the signature, exactly where a mail client would put it.
  return sanitizeRichText(`<p><br/></p><p>${lines.join('<br/>')}</p>`)
}

const STAGES = ['new', 'contacted', 'quoted', 'negotiating', 'won', 'lost']

// What a person can file by hand, in the order the composer offers it. A note comes first
// because it is the common case and nobody should have to choose to jot something down.
//
// ONE list for two jobs — the options in the composer and the label an entry wears in the
// thread — because they are the same words about the same thing, and two copies would let
// someone log a "Среща" that the thread then calls nothing at all. That is exactly what was
// here before: the composer only ever posted a note, and the thread knew how to label a call
// and a note but had never heard of a meeting.
//
// The keys are the server's LeadActivityTypes, and the endpoint takes precisely these three
// plus email_out (LeadActivityTypes.ManuallyLoggable) — email_out belongs to Send, which
// actually sends something, so it is not on offer here.
const LOG_TYPES = ['note', 'call', 'meeting']

// The four categories the gallery filters on, and the only ones that can lead to a list of
// models. Kept in step with galleryUtils.FILTER_IDS and HouseCategories on the server.
//
// A lead's category is NOT limited to these: "Контейнер", "Logistics" and "Interiors" are
// real enquiries that the gallery has no filter for. That is precisely why this list is
// separate from whatever a lead happens to hold — it answers "can we offer models for
// this?", which is a different question from "what did they ask about?".
//
// And a third question again: which of the four the gallery actually HOLDS models under.
// That one changes when the catalogue does rather than when this file does, so the server
// answers it and the panel only carries a fallback — WITH_GALLERY_MODELS_FALLBACK, in
// modelPicker.js beside the function that takes it, so the two admin screens cannot end up
// disagreeing about the same catalogue.
const GALLERY_CATEGORIES = ['prefab', 'wagon', 'modular', 'garage']

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


// Are these two the same person? A UPN is an email address, and an email address does not
// change identity with its capitals — which is also the judgement the server already made
// when it merged the configured allow-list with the owners on existing leads and deduplicated
// them OrdinalIgnoreCase. Deciding it differently here is how the same person ends up in one
// dropdown twice.
function sameUser(a, b) {
  return typeof a === 'string' && typeof b === 'string'
    && a.trim().toLowerCase() === b.trim().toLowerCase()
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
          {/* Only the hand-filed kinds are named. An email needs no label — the thread is
              a mail conversation, so email_in and email_out are what a bubble already
              means, and saying so on every one of them would bury the three entries that
              are genuinely something else. */}
          {LOG_TYPES.includes(activity.type)
            ? <span className="adm-muted"> · {t[activity.type]}</span>
            : null}
          <time dateTime={activity.occurredAt}>{formatWhen(activity.occurredAt, lang)}</time>
        </div>
        {activity.subject ? <div className="adm-bubble-subject">{activity.subject}</div> : null}
        {/* Two rules, split by who wrote it. The CUSTOMER's side renders as text, never
            markup — inbound HTML is flattened before it is stored, and rendering whatever
            arrives would execute whatever a customer chose to send us. OUR side is the
            rich-text composer's output, so it renders as HTML — through the same
            sanitizer the composer and the public site use, which also turns the legacy
            plain-text bodies' newlines into <br/>. */}
        {mine
          ? (
            <div
              className="adm-bubble-body"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(activity.body) }}
            />
          )
          : <p className="adm-bubble-body">{activity.body}</p>}
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

  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // The emailed report links to ?view=due, so the tab has to be readable from the URL —
  // otherwise every link in that mail lands on the default board and the person has to
  // find the report again by hand.
  const [tab, setTab] = React.useState(() =>
    TABS.some((x) => x.key === params.get('view')) ? params.get('view') : 'open')
  const [creating, setCreating] = React.useState(false)
  // Phones get one pane at a time. Stacking the board above a conversation means
  // scrolling past every other deal to reach the message you opened, which is the whole
  // screen working against you on the device most of the team actually uses.
  const [mobilePane, setMobilePane] = React.useState('list')
  const [fields, setFields] = React.useState(null)
  const [savedAt, setSavedAt] = React.useState(0)
  const [draftLead, setDraftLead] = React.useState(emptyDeal)
  const [board, setBoard] = React.useState([])
  // Narrowing WITHIN the current tab, client-side. The tabs answer workflow questions
  // (due, mine, archived); these answer "show me just the quoted ones" or "who has gone
  // quiet" — cross-cutting questions that would otherwise mean five more tabs. Client-side
  // because the board is already capped at 1000 rows and re-fetching to narrow a list the
  // browser is holding would make every filter click a network round trip.
  const [statusFilter, setStatusFilter] = React.useState('')
  const [modifiedFilter, setModifiedFilter] = React.useState('')
  // Narrowing the DUE view to one person's promises. Unlike the two above this one asks the
  // server, because the two filters are not equivalent: the due query takes the thousand
  // most overdue leads and stops, so narrowing in the browser would search one owner's
  // promises only among the rows that survived that cap — and the person most likely to
  // reach for this filter is the one whose team is furthest behind. Sent as owner= beside
  // due=true, which the list endpoint has always taken.
  const [dueOwner, setDueOwner] = React.useState('')
  const [selectedId, setSelectedId] = React.useState(null)
  const [lead, setLead] = React.useState(null)
  const [state, setState] = React.useState('loading')
  // The catalogue, for the model dropdown. Fetched once for the page rather than per
  // lead: it is the same list every time and changes about as often as the price list.
  const [houses, setHouses] = React.useState([])
  // Who a lead can be assigned to. Also fetched once — the team does not change mid-shift.
  const [users, setUsers] = React.useState([])
  // Which categories the catalogue actually has models for; see the fallback constant.
  const [withGalleryModels, setWithGalleryModels] = React.useState(WITH_GALLERY_MODELS_FALLBACK)
  // Who is signed in, for the signature. Null until /api/admin/me answers.
  const [me, setMe] = React.useState(null)

  // Sanitised rich-text HTML — the composer is a RichTextEditor, and what is in here is
  // what the customer's mail client renders.
  const [reply, setReply] = React.useState('')
  // The last signature this page prefilled, so "the box holds only the signature" is
  // answerable — that state disables Send, and it is what the box returns to after one.
  const prefill = React.useRef('')
  // What the log button files. Deliberately NOT reset between leads: someone working
  // through a call list files call after call, and making them pick "Обаждане" again on
  // every customer is the kind of friction that ends with everything logged as a note.
  const [logType, setLogType] = React.useState('note')
  // Picked but not yet sent. Held here rather than uploaded on selection, so a file can be
  // removed before it becomes part of the record — and so the reply and its attachments
  // succeed or fail as one thing.
  const [files, setFiles] = React.useState([])
  const [busy, setBusy] = React.useState('')      // '' | 'send' | 'draft' | 'save' | 'report'
  const [error, setError] = React.useState('')

  // What the error screen's Retry moves, so the load runs again through the ONE path that
  // reports what happened. Retry used to be handed loadBoard directly, which reports
  // nothing: AdminShell renders the page only while state is 'ready', so a retry that
  // succeeded left the error screen exactly where it was, and one that met an expired
  // session surfaced as an unhandled rejection — the button could be pressed all afternoon
  // without ever being told to sign in again.
  const [retryAt, setRetryAt] = React.useState(0)

  // The lead sheet — details, next step and the conversation on one screen — and the
  // send-report dialog.
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [reporting, setReporting] = React.useState(false)
  const [reportTo, setReportTo] = React.useState('')
  const [reportNote, setReportNote] = React.useState('')

  const threadEnd = React.useRef(null)
  const filePicker = React.useRef(null)

  // What the list actually shows: the tab's rows, narrowed by the filters. The selection
  // is deliberately left alone when filtering hides it — the thread on the right keeps
  // working, and a filter that closed the conversation you were reading would be worse
  // than one that merely trims the list beside it.
  const visibleBoard = React.useMemo(() => board.filter((row) =>
    (!statusFilter || row.status === statusFilter)
    && (!modifiedFilter || MODIFIED_WINDOWS[modifiedFilter]?.(daysSince(row.lastActivityAt)))
  ), [board, statusFilter, modifiedFilter])

  // The two kinds of narrowing are counted separately because the empty list cannot be read
  // the same way for both. These two hide rows the browser is still holding, so "the filters
  // hid everything" is provable — board still has the rows.
  const narrowedHere = statusFilter !== '' || modifiedFilter !== ''
  // The owner filter narrows at the SERVER, so a person with nothing overdue comes back as
  // an empty board rather than as a board filtered down to nothing. Testing board.length
  // would therefore report the whole team as up to date, which is the one sentence this
  // screen must never say wrongly.
  const narrowedToOwner = tab === 'due' && dueOwner !== ''
  const filtering = narrowedHere || narrowedToOwner

  // Every narrowing this page offers, undone together. Leaving one on while the button
  // claims to have cleared them is the same fault in a smaller place.
  const clearFilters = () => { setStatusFilter(''); setModifiedFilter(''); setDueOwner('') }

  // What the model box is, for the category currently chosen: a picker over the catalogue,
  // or a plain box to write in. It follows the CATEGORY rather than whether any models
  // happen to have loaded — a wagon whose picker is empty because the gallery request
  // failed is a visible fault, while the same wagon silently demoted to a text box is one
  // more lead typed in by hand that should have been linked to a model.
  const canPickModel = withGalleryModels.includes(fields?.categoryKey)
  // "A category is chosen and the catalogue has nothing filed under it" — a different state
  // from "no category chosen yet", and the two must not share a sentence. A lead arriving by
  // phone or off a trade-fair list has no category, and telling that person the catalogue is
  // empty answers a question nobody asked: the line sits permanently under an empty box,
  // never changes whatever is typed into it, and the one instruction they actually need —
  // choose a category first — is never given.
  const noCatalogue = Boolean(fields?.categoryKey) && !canPickModel
  // Filtered through the same rule, so a stray catalogue row filed under a category that
  // does not offer a picker can never be linked to by the box that is not showing it.
  const leadModels = modelsFor(houses, fields?.categoryKey, withGalleryModels)

  const loadBoard = React.useCallback(async (which) => {
    // The owner narrowing rides on every load of this tab rather than on the one the
    // dropdown triggers, because the board is re-fetched after every save, reply and note.
    // Built here, once, so a filter that is on screen cannot be missing from the request
    // that answers it — which would quietly widen the list back out under someone.
    const query = [
      TABS.find((x) => x.key === which)?.query ?? '',
      which === 'due' && dueOwner ? `owner=${encodeURIComponent(dueOwner)}` : '',
    ].filter(Boolean).join('&')

    const rows = await adminGet(`/api/admin/pipeline${query ? `?${query}` : ''}`)
    setBoard(rows ?? [])
    return rows ?? []
  }, [dueOwner])

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
  }, [loadBoard, tab, params, retryAt])

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
      // The customer's own details. Correctable here because this is the only place they
      // can be: the enquiry behind a lead is an immutable event and has to keep saying
      // what the form said, so a name misheard over the phone or an email with a typo in
      // it was, until now, wrong for good.
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      projectName: lead.projectName || '',
      country: lead.country || '',
      customerAddress: lead.customerAddress || '',
      buildLocation: lead.buildLocation || '',
      nextStep: lead.nextStep || '',
      nextContactAt: dateInputValue(lead.nextContactAt),
      categoryKey: lead.categoryKey || '',
      houseId: lead.houseId || 0,
      customModel: lead.customModel || '',
      // What the merged box shows. The linked model wins when there is one, because it is
      // the more precise of the two and the one the box can link straight back up on save.
      modelText: lead.houseTitle || lead.customModel || '',
      notes: lead.notes || '',
    })
  }, [lead?.id])

  // The follow-up date is the one field the SERVER also writes: logging a call, a meeting or
  // a note schedules the next contact for three days out, silently, because a promise made
  // is a promise someone has to be reminded of. The header line picks that up on its own —
  // it reads the reloaded lead — but the sheet took its copy above, once, when the lead was
  // opened. So without this the two disagree the moment anything is logged, and the sheet is
  // the half with a Save button under it: the stale date would be written straight back over
  // the one the server had just set, undoing the reminder without a word.
  //
  // Keyed on the server's value alone. A date somebody is halfway through typing into the
  // sheet changes `fields` and not `lead`, so it can never trigger this and be overwritten
  // by its own edit.
  React.useEffect(() => {
    const scheduled = dateInputValue(lead?.nextContactAt)
    setFields((f) => (f && f.nextContactAt !== scheduled ? { ...f, nextContactAt: scheduled } : f))
  }, [lead?.id, lead?.nextContactAt])

  // Moving to another lead closes the sheet. It is a way of working on ONE customer, and
  // keeping it open across a selection change would show lead A's header over lead B's
  // fields — with a Save button under them.
  React.useEffect(() => { setSheetOpen(false) }, [selectedId])

  // What the screen is showing RIGHT NOW, for the one caller that runs after a delay. A save
  // handed to the background retries lands up to half a minute later, by which time the
  // person has usually moved on — and loadLead sets the pane unconditionally, so refreshing
  // the lead they WERE on would drag the screen back to it mid-sentence.
  const showing = React.useRef({ leadId: null, tab })
  React.useEffect(() => { showing.current = { leadId: selectedId, tab } }, [selectedId, tab])

  // Tolerates failure on purpose: without the catalogue the model dropdown falls back to
  // the free-text box, which is worse than having it and far better than a page that will
  // not load because the gallery endpoint hiccuped.
  React.useEffect(() => {
    let alive = true
    adminGet('/api/admin/gallery')
      .then((rows) => { if (alive) setHouses(Array.isArray(rows) ? rows : []) })
      .catch(() => { /* the free-text field still works */ })
    return () => { alive = false }
  }, [])

  // Same tolerance: without the list the owner control still shows the current owner and
  // "Take it" still works, which is most of what assignment is used for day to day.
  React.useEffect(() => {
    let alive = true
    adminGet('/api/admin/pipeline/users')
      .then((rows) => { if (alive) setUsers(Array.isArray(rows) ? rows : []) })
      .catch(() => { /* the take-it path still works */ })
    adminGet('/api/admin/me')
      .then((who) => { if (alive && who) setMe(who) })
      .catch(() => { /* no signature; the composer still works */ })
    // Which categories carry catalogue models, from the list that already serves the
    // customer purchases screen — the two screens ask the same question of the same
    // catalogue, and a second copy of the answer in here is one that drifts silently.
    adminGet('/api/admin/customers/categories')
      .then((res) => {
        if (alive && Array.isArray(res?.withGalleryModels)) setWithGalleryModels(res.withGalleryModels)
      })
      .catch(() => { /* WITH_GALLERY_MODELS_FALLBACK */ })
    return () => { alive = false }
  }, [])

  // A fresh composer starts as the signature. Refilled when the lead changes (the locale
  // may differ) — but never over something someone has typed: only an empty box or one
  // still holding the previous prefill is replaced.
  React.useEffect(() => {
    if (!lead) return
    const sig = signatureHtml(me, lead.locale)
    setReply((current) => {
      const untouched = isRichTextEmpty(current) || current === prefill.current
      prefill.current = sig
      return untouched ? sig : current
    })
  }, [lead?.id, lead?.locale, me])

  // What of the reply is actually message, signature aside. Send and Note key off this:
  // a box holding only the signature has nothing to say.
  const composed = React.useMemo(
    () => richTextToPlain(reply.replace(prefill.current, '')),
    [reply],
  )

  // What the log button may do with what is in the composer.
  //
  // A NOTE CAN BE A FILE ON ITS OWN: the upload endpoint files an attachment as a note, so
  // the record exists either way and always has. A CALL OR A MEETING CANNOT. It is written
  // as its own entry, the endpoint refuses an empty one, and letting the click through would
  // store the drawing as a note and lose the call entirely — the exact silent loss the kinds
  // were added to stop. Refusing the click and saying why is the honest half of that rule.
  const canLog = logType === 'note' ? Boolean(composed) || files.length > 0 : Boolean(composed)
  const logNeedsWords = !canLog && files.length > 0

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
    if (!composed) return
    // The signature travels with the reply — that is the point of it being in the box:
    // what you see is exactly what the customer's mail client renders.
    const body = sanitizeRichText(reply)

    // Multipart even with nothing attached, so there is one send path rather than two —
    // the one that carries files being the one nobody exercises until it matters.
    const form = new FormData()
    form.append('body', body)
    for (const file of files) form.append('files', file, file.name)

    await adminSendForm(`/api/admin/pipeline/${selectedId}/reply`, form)
    // Reset only after the server confirms — back to the bare signature, ready for the
    // next message. Resetting optimistically loses what someone typed if the send fails,
    // and retyping a reply is the least forgivable data loss in a tool like this.
    setReply(prefill.current)
    setFiles([])
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.sendError)

  const draft = () => run('draft', async () => {
    const result = await adminSend(`/api/admin/pipeline/${selectedId}/draft`, 'POST', {
      // The steer is what was typed, as prose — the signature is not an instruction, and
      // the model reads text, not markup.
      instruction: composed || null,
    })
    // The draft replaces whatever was in the box, because what was there was the steer
    // for it — and the signature is appended back, since the draft comes as bare prose.
    // Nothing is sent and nothing is stored until someone presses Send.
    if (result?.text) setReply(plainTextToRichHtml(result.text) + prefill.current)
  }, t.draftError)

  const setStatus = (status) => run('save', async () => {
    await adminSend(`/api/admin/pipeline/${selectedId}/status`, 'POST', { status })
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const takeIt = () => run('save', async () => {
    await adminSend(`/api/admin/pipeline/${selectedId}/owner`, 'POST', { ownerUpn: 'me' })
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const assignTo = (upn) => run('save', async () => {
    // Empty string is the "Nobody" option; the server takes null as "unassign", and an
    // unassigned lead is a real state — it is the one nobody has picked up.
    await adminSend(`/api/admin/pipeline/${selectedId}/owner`, 'POST', { ownerUpn: upn || null })
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const makeCustomer = () => run('save', async () => {
    const result = await adminSend(`/api/admin/pipeline/${selectedId}/convert`, 'POST')
    // Straight into the customer's card — identity is created, the purchase is added
    // there. Also where a SECOND click lands: the server answers with the existing
    // customer rather than a namesake, so this doubles as "open their customer card".
    if (result?.customerId) navigate(`/admin/customers?customer=${result.customerId}`)
  }, t.saveError)

  const logActivity = () => run('save', async () => {
    // WITHOUT the signature. Nothing filed here is sent anywhere — it is sales talking to
    // sales — and signing it like customer mail would just be noise in the thread.
    const body = sanitizeRichText(reply.replace(prefill.current, ''))
    if (isRichTextEmpty(body) && files.length === 0) return

    // A file cannot carry a kind: the upload endpoint files every attachment as a note, and
    // it is right to — an attachment and the words that came with it belong together, which
    // is why the typed text captions the first one and the rest carry their own name. So a
    // note with files stays exactly one write per file, as it has always been.
    //
    // A CALL or a MEETING with files is two writes instead, because the alternative is to
    // let the kind fall away silently: the person picks "Обаждане", attaches the drawing
    // they were sent afterwards, and the thread shows a note. The entry says what happened
    // and the uploads carry the documents under their own names — one caption on two rows
    // would print the same sentence twice.
    const separately = files.length > 0 && logType !== 'note'

    // Once the kind is not a note it is ALWAYS written down, never skipped for want of a
    // body — skipping is how "log a call" ends as a note about a file, which is the failure
    // the kinds were added to fix. The composer refuses the click when a call or a meeting
    // has nothing typed (see canLog), so what arrives here has words; if it somehow does
    // not, the endpoint says no and the person reads why.
    if (files.length === 0 || separately) {
      await adminSend(`/api/admin/pipeline/${selectedId}/activities`, 'POST', { type: logType, body })
    }

    // This is also the way to keep a file that is too big to email — the note path stores up
    // to the full 20 MB, the reply path is capped by what Graph will send.
    //
    // The caption is plain text — it labels a file, it is not a document.
    for (const [index, file] of files.entries()) {
      await adminUpload(
        `/api/admin/pipeline/${selectedId}/attachments`,
        file,
        !separately && index === 0 && composed ? { caption: composed } : {},
      )
    }

    setReply(prefill.current)
    setFiles([])
    await Promise.all([loadLead(selectedId), loadBoard(tab)])
  }, t.saveError)

  const saveFields = () => run('save', async () => {
    // Retracted before the attempt, not after it. The chip means "this save just
    // succeeded", and a refusal leaves the sheet open — so without this the footer answers
    // a blanked name with a green "Запазено" sitting beside the red alert that says the
    // opposite, and the chip is the half people read.
    setSavedAt(0)

    // modelText is what the merged box displays; houseId and customModel are what the
    // server stores. Stripped rather than sent and ignored, so the request says what it
    // means.
    //
    // The name goes out as typed, blank included, rather than being caught here first. The
    // endpoint refuses an empty one with a reason, and duplicating that rule in the panel
    // would give the field two definitions of "required" that have to agree forever — and
    // it is the panel's copy that would be quietly wrong the day the server's changes. The
    // new-lead dialog guards its own name because there is nothing stored yet to keep; here
    // there is, and the refusal lands in the sheet's alert with the edits still on screen.
    const { modelText, ...body } = fields
    const leadId = selectedId
    const answer = await adminSave({
      url: `/api/admin/pipeline/${leadId}/fields`,
      body,
      lang,
      subject: body.name,
      // A POST that is really an update: it writes these fields onto a lead that already
      // exists, so sending it twice lands on the same row rather than making a second lead.
      // Said out loud because the default reads the method and would guess otherwise.
      repeatable: true,
      onLateSuccess: () => {
        // The board is always worth refreshing; the conversation only if it is still the
        // one on screen. See `showing`.
        loadBoard(showing.current.tab).catch(() => { /* the next load collects it */ })
        if (showing.current.leadId === leadId) loadLead(leadId).catch(() => {})
      },
    })

    // The refusal the server owns — a blanked name, chiefly. The sheet keeps every edit and
    // wears the reason; nothing is retried, because re-sending it would only be told no
    // again, four more times.
    if (keepsTheEditorOpen(answer)) { setError(answer.message || t.saveError); return }

    // A successful save closes the sheet — pressing Save means "I am done here", and
    // making people close it by hand after every edit was the feedback that led to this.
    // A save that fell back to the retries closes it too: the typing is safe inside the
    // request by then, and the banner is what reports on it from here.
    setSheetOpen(false)
    if (answer.outcome !== 'saved') return

    setSavedAt(Date.now())
    await Promise.all([loadLead(leadId), loadBoard(tab)])
  }, t.saveError)

  const createDeal = () => run('save', async () => {
    const name = draftLead.name.trim()
    if (!name) { setError(t.nameRequired); return }
    // No onLateSuccess and no background: a create is never handed to the retries, so this
    // dialog either closes on an answer or stays open on one. See adminSave's `repeatable`.
    const answer = await adminSave({ url: '/api/admin/pipeline', body: { ...draftLead, name }, lang, subject: name })

    // Refused, or sent into silence: either way the dialog keeps the phone number and the
    // notes that were typed into it. A create is the one save the retries may NOT have,
    // because a lead written twice is two people to ring about the same house.
    if (keepsTheEditorOpen(answer)) { setError(answer.message || t.saveError); return }

    setCreating(false)
    setDraftLead(emptyDeal())
    await loadBoard(tab)
    // Straight into the new thread — the point of creating it was to talk to someone.
    if (answer.result?.id) setParams({ lead: String(answer.result.id) })
  }, t.saveError)

  const sendReport = () => run('report', async () => {
    const result = await adminSend('/api/admin/pipeline/due/report', 'POST', {
      to: reportTo.trim() || null,
      // The narrowing travels with the report, because the button sits two controls from
      // the filter and the invariant above it is that the report is of the view it reports
      // on. Without this a manager reads one salesperson's twelve overdue rows, presses
      // Send report to forward exactly those, and mails the team's three hundred — the
      // first hint being a confirmation whose number matches nothing on screen.
      owner: dueOwner || null,
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
      onRetry={() => setRetryAt(Date.now())}
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
        {/* The error is the page's, and this dialog renders it. Opening without clearing it
            would put a failed reply's sentence above an empty form, where it reads as
            though creating a lead had already gone wrong — the sheet's opener below has
            cleared it for the same reason since the day it started showing one. */}
        <button type="button" className="btn" onClick={() => { setError(''); setCreating(true) }}>
          + {t.newDeal}
        </button>
        {/* The report goes with the view it reports on. On the other tabs it would be a
            button whose result has nothing to do with what is on screen. */}
        {tab === 'due' ? (
          <button type="button" className="btn ghost" onClick={() => setReporting(true)}>
            {t.sendReport}
          </button>
        ) : null}
        {/* Whose promises. On this tab only, because the other views already answer the
            ownership question their own way — "Mine" is a tab, and the board is read by
            everyone as everyone's. A blank value is everyone rather than "nobody", since
            that is what the server reads an absent owner= as; an unassigned overdue lead
            is therefore always in view, which is the right way round for the one thing
            nobody has picked up. The list is the assignment dropdown's, unchanged: a
            second idea of who can own a lead is a second list to keep in step. */}
        {tab === 'due' ? (
          <label className="adm-filter">
            <span className="adm-small adm-muted">{t.filterOwner}</span>
            <select value={dueOwner} onChange={(e) => setDueOwner(e.target.value)}>
              <option value="">{t.filterOwnerAll}</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
        ) : null}
        <label className="adm-filter">
          <span className="adm-small adm-muted">{t.filterStatus}</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t.filterAny}</option>
            {STAGES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
          </select>
        </label>
        <label className="adm-filter">
          <span className="adm-small adm-muted">{t.filterModified}</span>
          <select value={modifiedFilter} onChange={(e) => setModifiedFilter(e.target.value)}>
            <option value="">{t.filterAny}</option>
            {Object.keys(MODIFIED_WINDOWS).map((key) => (
              <option key={key} value={key}>{t.modified[key]}</option>
            ))}
          </select>
        </label>
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
              {busy === 'save' ? t.creating : t.create}
            </button>
          </>
        )}
      >
        {/* The page's own alert is behind this dialog. A refusal keeps the dialog open with
            everything typed still in it, so the reason has to be inside it or the Create
            button reads as one that does nothing. */}
        {error ? <div className="adm-alert" role="alert">{error}</div> : null}

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
          {visibleBoard.length === 0
            ? (
              <li className="adm-empty">
                {/* "The filters hid everything" and "this view is empty" are different
                    situations with different fixes, and the first needs its one-click way
                    back — an empty list with active filters otherwise reads as data loss.

                    The owner narrowing gets a third case rather than sharing the second,
                    because it is the server that dropped the rows: the board comes back
                    EMPTY instead of being filtered down to nothing, so board.length — the
                    test the second case turns on — cannot see it. Which is why the sentence
                    it used to fall through to was "nothing overdue, everything is on
                    schedule": a claim about the whole team, made while one person was
                    selected, with only a dropdown three controls away saying otherwise.

                    Ordered by which narrowing actually emptied the list. An owner with rows
                    on the board that the status filter then hid is the SECOND case, not
                    this one — the owner is not why there is nothing to look at. */}
                {narrowedToOwner && board.length === 0 ? (
                  <>
                    <p>{t.ownerEmpty(dueOwner)}</p>
                    <button type="button" className="adm-linkbtn" onClick={clearFilters}>
                      {t.clearFilters}
                    </button>
                  </>
                ) : narrowedHere && board.length > 0 ? (
                  <>
                    <p>{t.filteredEmpty}</p>
                    <button type="button" className="adm-linkbtn" onClick={clearFilters}>
                      {t.clearFilters}
                    </button>
                  </>
                ) : (
                  <p>{tab === 'archived' ? t.archivedEmpty : tab === 'due' ? t.dueEmpty : t.empty}</p>
                )}
              </li>
            )
            : null}
          {visibleBoard.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`adm-pipeline-item${row.id === selectedId ? ' is-active' : ''}`}
                aria-current={row.id === selectedId ? 'true' : undefined}
                onClick={() => { setSelectedId(row.id); setMobilePane('thread') }}
              >
                <span className="adm-name">{row.name || '—'}</span>
                <span className={`adm-badge adm-stage-${row.status}`}>{t.status[row.status] ?? row.status}</span>
                {/* "They wrote last." It reads as a badge because it is a state of the lead
                    like the stage above it, and it says its own name rather than relying on
                    the colour — the two things this board shouts about are different kinds
                    of urgent and a lead is regularly both, so "we are late" and "they are
                    waiting" must never come down to telling two tints apart. */}
                {row.awaitingReply ? (
                  <span className="adm-badge adm-badge-awaiting" title={t.awaitingHint}>
                    {t.awaiting}
                  </span>
                ) : null}
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

                  {/* Assignment. The current owner is always an option even when the
                      users list does not carry them (someone who left still owns their
                      history) — a dropdown that cannot express the stored value would
                      silently reassign it the moment anyone touches the control. */}
                  <label className="adm-filter adm-small adm-muted">
                    <span>{t.owner}:</span>
                    <select
                      value={lead.ownerUpn || ''}
                      disabled={busy === 'save'}
                      onChange={(e) => assignTo(e.target.value)}
                    >
                      <option value="">{t.unassigned}</option>
                      {/* Case-insensitively, because that is how the server decided what
                          counted as a duplicate when it merged ADMIN_ALLOWED_USERS with the
                          owners already on leads. Comparing exactly here would readmit the
                          very duplicate that merge removed: an owner stored as
                          Vvladimirov@… against a list carrying vvladimirov@… reads as
                          missing, gets prepended, and the same person appears twice. */}
                      {(!lead.ownerUpn || users.some((u) => sameUser(u, lead.ownerUpn))
                        ? users
                        : [lead.ownerUpn, ...users])
                        .map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                  {!lead.ownerUpn ? (
                    <button type="button" className="adm-linkbtn" onClick={takeIt} disabled={busy === 'save'}>
                      {t.takeIt}
                    </button>
                  ) : null}

                  {/* ONE button, and a real one rather than a link.
                      It used to be two link-sized controls sitting apart: a "Details"
                      toggle that unfolded a form in a half-width pane, and an "Open full
                      screen" that could only read. Which meant the two things people
                      actually do here — read what was said, then write down what happens
                      next — were on opposite sides of the screen and neither was easy to
                      spot. Same screen now, and it is the one thing on this header you
                      cannot miss. */}
                  <button
                    type="button"
                    className="btn ghost"
                    title={t.makeCustomerHint}
                    onClick={makeCustomer}
                    disabled={busy !== ''}
                  >
                    {t.makeCustomer}
                  </button>

                  <button
                    type="button"
                    className="btn adm-open-sheet"
                    // Both stale answers are cleared on open, for the same reason and with
                    // opposite signs. An error about the LAST failed action, shown inside a
                    // sheet someone has only just opened, reads as "this sheet is broken";
                    // a "Saved" chip in the footer of a sheet nobody has touched reads as
                    // "your edits are safe", which is worse, because it is the thing people
                    // scan for and it is answering about a save from ten minutes ago.
                    onClick={() => { setError(''); setSavedAt(0); setSheetOpen(true) }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 8.4V5.2a1.2 1.2 0 0 1 1.2-1.2h3.2M20 8.4V5.2A1.2 1.2 0 0 0 18.8 4h-3.2M4 15.6v3.2A1.2 1.2 0 0 0 5.2 20h3.2M20 15.6v3.2a1.2 1.2 0 0 1-1.2 1.2h-3.2" />
                    </svg>
                    <span>{t.sheet}</span>
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

              <Thread activities={lead.activities} t={t} lang={lang} endRef={threadEnd} />

              {/* The lead sheet: everything about this customer on one screen, editable.
                  What happens next comes FIRST — it is the field people open this to
                  write, and burying it under six address boxes is how a follow-up date
                  ends up never being set. The conversation sits below it, because
                  deciding the next step is usually a matter of rereading the last
                  message. Replying still happens in the pane behind, where the
                  draft/attach machinery lives. */}
              <AdminModal
                open={sheetOpen && fields !== null}
                title={lead.name || '—'}
                subtitle={[
                  lead.houseTitle || lead.customModel || '',
                  t.status[lead.status] ?? lead.status,
                ].filter(Boolean).join(' · ')}
                closeLabel={t.close}
                onClose={() => setSheetOpen(false)}
                footer={(
                  <>
                    {savedAt ? <span className="adm-small adm-saved">{t.saved}</span> : null}
                    <button type="button" className="btn ghost" onClick={() => setSheetOpen(false)}>
                      {t.close}
                    </button>
                    <button type="button" className="btn" onClick={saveFields} disabled={busy !== ''}>
                      {busy === 'save' ? t.saving : t.save}
                    </button>
                  </>
                )}
              >
                {fields ? (
                  <div className="adm-sheet">
                    {/* The page's error banner renders BEHIND this modal, so without this a
                        failed save looks like a Save button that does nothing — the sheet
                        stays open (deliberately, see saveFields) and nothing says why. */}
                    {error ? <div className="adm-alert" role="alert">{error}</div> : null}
                    <section className="adm-sheet-next">
                      <h3 className="adm-sheet-head">{t.nextTitle}</h3>
                      <div className="adm-sheet-next-grid">
                        <label>
                          <span className="adm-small">{t.dNext}</span>
                          <input
                            type="text"
                            placeholder={t.nextStepPlaceholder}
                            value={fields.nextStep}
                            onChange={(e) => setFields((f) => ({ ...f, nextStep: e.target.value }))}
                          />
                        </label>
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
                    </section>

                    <section>
                      <h3 className="adm-sheet-head">{t.details}</h3>
                      {/* The customer first, then the job. Same order as the new-lead
                          dialog, and the same three boxes — a name, an email and a phone
                          number are what somebody comes here to correct, and having them
                          readable in the header but only typeable in a dialog that creates
                          a SECOND lead is how the panel used to answer that. */}
                      <div className="adm-newdeal-grid">
                        {[
                          ['name', t.fName, 'text'], ['email', t.fEmail, 'email'],
                          ['phone', t.fPhone, 'tel'],
                          ['projectName', t.dProject], ['country', t.dCountry],
                          ['customerAddress', t.dAddress], ['buildLocation', t.dBuild],
                        ].map(([field, label, type = 'text']) => (
                          <label key={field}>
                            <span className="adm-small">{label}{field === 'name' ? ' *' : ''}</span>
                            <input
                              type={type}
                              value={fields[field]}
                              onChange={(e) => setFields((f) => ({ ...f, [field]: e.target.value }))}
                            />
                          </label>
                        ))}

                        {/* The category the lead already carries is always an option, even
                            when it is not one of the gallery's four — it came from the
                            customer, and a dropdown that silently drops the current value
                            rewrites the record the moment anyone saves. */}
                        <label>
                          <span className="adm-small">{t.category}</span>
                          <select
                            value={fields.categoryKey}
                            onChange={(e) => setFields((f) => ({
                              ...f,
                              categoryKey: e.target.value,
                              // A model belongs to a category, so the text is re-resolved
                              // against the new one. A title that is a real model in both
                              // stays linked; anything else drops to free text rather than
                              // lingering as a mismatch nobody notices.
                              //
                              // WHAT WAS TYPED ALWAYS SURVIVES THE SWITCH — only the link
                              // to a catalogue row can fall away. Moving a lead from
                              // modular to garage leaves "Nova 60" sitting in the box that
                              // has just become free text, and the line underneath changes
                              // from "linked model" to "free text", so the one thing that
                              // did change is the one thing that gets said out loud.
                              // Emptying the box instead would throw away a sentence
                              // somebody typed to fix a dropdown they got wrong, and
                              // keeping the old foreign key would leave a garage lead
                              // pointing at a modular house that no screen would ever show
                              // them again.
                              ...resolveModel(
                                f.modelText, e.target.value,
                                modelsFor(houses, e.target.value, withGalleryModels),
                              ),
                            }))}
                          >
                            <option value="">{t.noCategory}</option>
                            {GALLERY_CATEGORIES.map((key) => (
                              <option key={key} value={key}>{t.categories[key] ?? key}</option>
                            ))}
                            {fields.categoryKey && !GALLERY_CATEGORIES.includes(fields.categoryKey)
                              ? <option value={fields.categoryKey}>{fields.categoryKey}</option>
                              : null}
                          </select>
                        </label>

                        {/* One box, and what it offers follows the category.

                            Where the catalogue has models — wagons and modular houses, as
                            the server's list reads today — it is a <datalist> combobox, so
                            the answer can be picked and the lead comes out LINKED to a real
                            row rather than to a title somebody spelled their own way. A
                            <select> would be the stricter control and the wrong one: even
                            in those categories the answer is sometimes "two wagons joined",
                            and a dropdown cannot hold that.

                            Where it has none — prefab and garage today, and every imported
                            category the gallery never had a filter for — it is a plain text
                            box. Not a cosmetic difference: a combobox whose list is empty
                            has an arrow that opens onto nothing, which reads as a catalogue
                            that failed to load rather than as a category with nothing to
                            offer, and the second reading is the one that gets reported as a
                            bug. */}
                        <label className="adm-span-2">
                          <span className="adm-small">{t.model}</span>
                          <input
                            type="text"
                            // Undefined rather than '' when there is no list to point at: an
                            // <input> carrying a list attribute IS a combobox to a browser
                            // and to a screen reader, so naming a datalist that is not
                            // rendered promises a dropdown that never opens.
                            list={canPickModel ? 'leadModelOptions' : undefined}
                            title={noCatalogue ? t.modelHintFree : t.modelHint}
                            value={fields.modelText}
                            onChange={(e) => setFields((f) => ({
                              ...f,
                              ...resolveModel(e.target.value, f.categoryKey, leadModels),
                            }))}
                          />
                          {canPickModel ? (
                            <datalist id="leadModelOptions">
                              {leadModels.map((h) => <option key={h.id} value={h.title} />)}
                            </datalist>
                          ) : null}

                          {/* Which of the two things just happened, said out loud. The
                              linking is the one part of this control a person cannot see,
                              and an invisible foreign key is how a lead ends up attached to
                              a house nobody meant to attach it to.

                              An EMPTY box is the first test, ahead of the catalogue one,
                              because nothing has happened yet to describe. A caption under
                              a box nobody has typed in is a permanent line about a state
                              the person never asked to be in — and on a lead with no
                              category chosen yet, which is the ordinary state of a phone
                              lead and of a good share of the imported ones, it blamed the
                              catalogue for holding nothing before anybody had asked it for
                              anything. It never went away whatever was typed, and it never
                              gave the instruction that would have helped: choose a
                              category first. */}
                          <span className="adm-small adm-muted adm-model-state">
                            {fields.houseId > 0
                              ? `✓ ${t.modelLinked(fields.modelText)}`
                              : !fields.modelText.trim()
                                ? ' '
                                : (noCatalogue ? t.modelNoCatalogue : t.modelFree)}
                          </span>
                        </label>
                      </div>

                      <label className="adm-sheet-notes">
                        <span className="adm-small">{t.dNotes}</span>
                        <textarea
                          rows={4}
                          placeholder={t.notesPlaceholder}
                          value={fields.notes}
                          onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))}
                        />
                      </label>
                    </section>

                    <section>
                      <h3 className="adm-sheet-head">{t.thread}</h3>
                      <Thread activities={lead.activities} t={t} lang={lang} />
                    </section>
                  </div>
                ) : null}
              </AdminModal>

              {error ? <div className="adm-alert">{error}</div> : null}

              <div className="adm-composer">
                {/* Rich text (owner, 2026-08-17): hyperlinks in a quote are the concrete
                    ask, and the signature below the caret is the other half. The editor
                    emits sanitized HTML through the same helper the thread renders with,
                    and the mail goes out as HTML already (LeadMailService sends
                    contentType HTML) — so what is in this box is what the customer sees. */}
                <RichTextEditor
                  id="replyBox"
                  value={reply}
                  onChange={setReply}
                  lang={lang}
                  placeholder={t.replyPlaceholder}
                  ariaLabel={t.reply}
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
                  <button type="button" className="btn" onClick={send} disabled={!composed || busy !== ''}>
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
                  {/* What happened, then the button that files it — in that order, because
                      the button's own label is the answer to the dropdown beside it and
                      reading "Запиши като: Обаждане" then "+ Обаждане" is how someone
                      confirms the kind without opening the thread afterwards. */}
                  <label className="adm-filter adm-small adm-muted">
                    <span>{t.logAs}</span>
                    <select
                      value={logType}
                      disabled={busy !== ''}
                      onChange={(e) => setLogType(e.target.value)}
                    >
                      {LOG_TYPES.map((key) => <option key={key} value={key}>{t[key]}</option>)}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn ghost"
                    title={t.logHint}
                    onClick={logActivity}
                    disabled={!canLog || busy !== ''}
                  >
                    + {t[logType]}
                  </button>
                </div>
                {/* Said out loud rather than left to the button's title: a browser shows no
                    tooltip on a disabled control, so the one moment the sentence is needed
                    is the one moment nobody could read it. */}
                {logNeedsWords ? (
                  <p className="adm-small adm-muted" role="status">{t.logNeedsWords}</p>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </AdminShell>
  )
}
