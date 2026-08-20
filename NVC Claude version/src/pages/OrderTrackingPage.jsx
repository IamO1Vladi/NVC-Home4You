import React from 'react'
import { useParams } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext.jsx'
import SEO from '../components/SEO.jsx'
import '../style/OrderTracking.css'

// What the customer sees at /order/{reference} (ROADMAP #27).
//
// The code in the URL is the only credential, so this page is built to be worth exactly
// that much: a timeline, two expected dates, the model, and whatever the carrier last
// said. No price, no balance, no name, no address — the server does not send them, so a
// change here can never start leaking them.
//
// NOINDEX, and not only for tidiness: a tracking URL that reaches a search index is a
// tracking URL that reaches everyone.
//
// The dates are labelled as EXPECTED everywhere they appear. A date presented as certain
// and then missed costs more trust than no date at all, and this page exists to build trust.
//
// WHY IT LOOKS LIKE THIS. Staff move these statuses by hand (owner, 2026-08-20 — there is
// no carrier feed and there is not going to be one), which means a customer who opens this
// link is often opening it INSTEAD of ringing the office. So the page answers the question
// they came with — "where is my house?" — in one sentence at the top, in their own
// language, before any table or timeline. Everything below is the evidence for that
// sentence. It also renders inside the site's own header and footer, so it has to belong to
// the brand rather than look like an internal tool that escaped.

const CONTACT_EMAIL = 'contact@nvc-home4you.eu'
const CONTACT_PHONE = '+359 87 935 5269'
const CONTACT_PHONE_HREF = '+359879355269'

// How old the carrier's note may be before the page says so out loud. Staff type these by
// hand between other work, so a note going quiet is normal rather than exceptional — and a
// customer reading a fortnight-old "left Singapore" as today's position is the specific
// disappointment this page exists to avoid. A guess, worth tuning once there is a routine
// to measure it against.
const CARRIER_NOTE_STALE_DAYS = 10

const TEXT = {
  bg: {
    eyebrow: 'Проследяване на поръчка',
    title: 'Проследяване на поръчка',
    loading: 'Зареждаме поръчката…',
    notFoundTitle: 'Няма такава поръчка',
    notFound: 'Линкът е грешен или вече не е активен. Проверете дали сте го копирали цял, или се свържете с нас — ще намерим поръчката ви.',
    order: 'Поръчка',
    reference: 'Номер',
    copy: 'Копирай',
    copied: 'Копирано',
    ordered: 'Поръчана на',
    stepOf: (n, total) => `Стъпка ${n} от ${total}`,
    timeline: 'Докъде е стигнала',
    dates: 'Очаквани дати',
    expectedAtHarbor: 'Очаквано пристигане на пристанище',
    expectedReady: 'Очаквана готовност за доставка',
    estimate: 'приблизително',
    carrier: 'Превозвач',
    asOf: 'информация към',
    stale: 'Тази информация е отпреди повече от седмица. Пишете ни, ако имате нужда от по-точна.',
    updated: 'Последна промяна',
    contactTitle: 'Въпрос по поръчката?',
    contactBody: 'Пишете или се обадете — отговаряме на един и същи номер и адрес, на който сте ни намерили.',
    writeUs: 'Пишете ни',
    callUs: 'Обадете се',
    // What is happening right now, in one line. This is the answer the customer came for.
    now: {
      placed: { head: 'Поръчката е приета', note: 'Записахме я и подготвяме производството.' },
      fabricating: { head: 'Къщата ви се изработва', note: 'Във фабриката, по вашата спецификация.' },
      scheduled: { head: 'Насрочена за товарене', note: 'Готова е и чака своя кораб.' },
      travelling: { head: 'На път към вас', note: 'Пътува по море. Обновяваме страницата, щом научим ново.' },
      'at-harbor': { head: 'Пристигна на пристанище', note: 'Минава митническа обработка.' },
      ready: { head: 'Готова за доставка', note: 'Остава да уговорим деня на доставката с вас.' },
      delivered: { head: 'Доставена', note: 'Пожелаваме ви приятно нанасяне.' },
      cancelled: { head: 'Поръчката е отказана', note: 'Ако това е грешка, свържете се с нас.' },
    },
    statuses: {
      placed: 'Приета', fabricating: 'В производство', scheduled: 'Насрочена за товарене',
      travelling: 'Пътува', 'at-harbor': 'На пристанище', ready: 'Готова за доставка',
      delivered: 'Доставена', cancelled: 'Отказана',
    },
  },
  el: {
    eyebrow: 'Παρακολούθηση παραγγελίας',
    title: 'Παρακολούθηση παραγγελίας',
    loading: 'Φορτώνουμε την παραγγελία…',
    notFoundTitle: 'Δεν βρέθηκε η παραγγελία',
    notFound: 'Ο σύνδεσμος είναι λανθασμένος ή δεν ισχύει πλέον. Ελέγξτε αν τον αντιγράψατε ολόκληρο ή επικοινωνήστε μαζί μας — θα βρούμε την παραγγελία σας.',
    order: 'Παραγγελία',
    reference: 'Κωδικός',
    copy: 'Αντιγραφή',
    copied: 'Αντιγράφηκε',
    ordered: 'Ημερομηνία παραγγελίας',
    stepOf: (n, total) => `Βήμα ${n} από ${total}`,
    timeline: 'Πού βρίσκεται',
    dates: 'Εκτιμώμενες ημερομηνίες',
    expectedAtHarbor: 'Εκτιμώμενη άφιξη στο λιμάνι',
    expectedReady: 'Εκτιμώμενη ετοιμότητα για παράδοση',
    estimate: 'κατά προσέγγιση',
    carrier: 'Μεταφορέας',
    asOf: 'στοιχεία της',
    stale: 'Τα στοιχεία είναι παλαιότερα της μίας εβδομάδας. Γράψτε μας αν χρειάζεστε πιο πρόσφατα.',
    updated: 'Τελευταία ενημέρωση',
    contactTitle: 'Ερώτηση για την παραγγελία;',
    contactBody: 'Γράψτε ή τηλεφωνήστε — απαντάμε στο ίδιο τηλέφωνο και email με το οποίο μας βρήκατε.',
    writeUs: 'Γράψτε μας',
    callUs: 'Τηλεφωνήστε',
    now: {
      placed: { head: 'Η παραγγελία καταχωρήθηκε', note: 'Την καταγράψαμε και ετοιμάζουμε την παραγωγή.' },
      fabricating: { head: 'Το σπίτι σας κατασκευάζεται', note: 'Στο εργοστάσιο, σύμφωνα με τις προδιαγραφές σας.' },
      scheduled: { head: 'Προγραμματισμένη για φόρτωση', note: 'Είναι έτοιμη και περιμένει το πλοίο της.' },
      travelling: { head: 'Στον δρόμο προς εσάς', note: 'Ταξιδεύει στη θάλασσα. Ενημερώνουμε τη σελίδα μόλις μάθουμε νεότερα.' },
      'at-harbor': { head: 'Έφτασε στο λιμάνι', note: 'Περνά από τελωνειακό έλεγχο.' },
      ready: { head: 'Έτοιμη για παράδοση', note: 'Μένει να συμφωνήσουμε μαζί σας την ημέρα παράδοσης.' },
      delivered: { head: 'Παραδόθηκε', note: 'Καλή απόλαυση στο νέο σας σπίτι.' },
      cancelled: { head: 'Η παραγγελία ακυρώθηκε', note: 'Αν πρόκειται για λάθος, επικοινωνήστε μαζί μας.' },
    },
    statuses: {
      placed: 'Καταχωρήθηκε', fabricating: 'Σε παραγωγή', scheduled: 'Προγραμματισμένη φόρτωση',
      travelling: 'Ταξιδεύει', 'at-harbor': 'Στο λιμάνι', ready: 'Έτοιμη για παράδοση',
      delivered: 'Παραδόθηκε', cancelled: 'Ακυρώθηκε',
    },
  },
  en: {
    eyebrow: 'Order tracking',
    title: 'Order tracking',
    loading: 'Loading your order…',
    notFoundTitle: 'No such order',
    notFound: 'The link is wrong or no longer active. Check you copied all of it, or get in touch — we will find your order.',
    order: 'Order',
    reference: 'Reference',
    copy: 'Copy',
    copied: 'Copied',
    ordered: 'Ordered on',
    stepOf: (n, total) => `Step ${n} of ${total}`,
    timeline: 'Where it has got to',
    dates: 'Expected dates',
    expectedAtHarbor: 'Expected at the harbour',
    expectedReady: 'Expected ready for delivery',
    estimate: 'approximate',
    carrier: 'Carrier',
    asOf: 'as of',
    stale: 'This is more than a week old. Write to us if you need something more recent.',
    updated: 'Last updated',
    contactTitle: 'A question about your order?',
    contactBody: 'Write or call — the same address and number you reached us on.',
    writeUs: 'Write to us',
    callUs: 'Call us',
    now: {
      placed: { head: 'Order placed', note: 'It is recorded, and production is being prepared.' },
      fabricating: { head: 'Your house is being built', note: 'At the factory, to your specification.' },
      scheduled: { head: 'Scheduled for shipment', note: 'Built, and booked onto a sailing.' },
      travelling: { head: 'On its way to you', note: 'At sea. We update this page as soon as we hear.' },
      'at-harbor': { head: 'Arrived at the harbour', note: 'Going through customs clearance.' },
      ready: { head: 'Ready for delivery', note: 'All that is left is agreeing the delivery day with you.' },
      delivered: { head: 'Delivered', note: 'Enjoy your new home.' },
      cancelled: { head: 'This order was cancelled', note: 'If that is a mistake, please get in touch.' },
    },
    statuses: {
      placed: 'Placed', fabricating: 'In production', scheduled: 'Scheduled for shipment',
      travelling: 'Travelling', 'at-harbor': 'At the harbour', ready: 'Ready for delivery',
      delivered: 'Delivered', cancelled: 'Cancelled',
    },
  },
}

const LOCALES = { bg: 'bg-BG', el: 'el-GR', en: 'en-GB' }

const langKeyOf = (lang) => {
  const l = String(lang || '').toLowerCase()
  if (l.startsWith('bg')) return 'bg'
  if (l.startsWith('el')) return 'el'
  return 'en'
}

// Dates arrive as plain days ("2026-09-15") or as round-trip instants; both render as a day,
// because an hour on an estimate implies a precision nobody has.
//
// A plain day is built as a LOCAL date rather than parsed: "2026-09-15" parses as UTC
// midnight, which renders as the 14th for every customer west of Greenwich. The date the
// office typed is the date the customer must read, wherever they open the link.
const formatDate = (value, locale) => {
  if (!value) return null
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dayOnly
    ? new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

const daysSince = (value) => {
  if (!value) return null
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((Date.now() - then.getTime()) / 86400000)
}

export default function OrderTrackingPage() {
  const { reference } = useParams()
  const { lang } = useI18n()
  const key = langKeyOf(lang)
  const t = TEXT[key]
  const locale = LOCALES[key]

  const [state, setState] = React.useState('loading')
  const [order, setOrder] = React.useState(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    fetch(`/api/order/${encodeURIComponent(reference)}`, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data) => { if (alive) { setOrder(data); setState('ready') } })
      // Unknown, revoked and broken all land here together — the server does not
      // distinguish them, and neither should the page.
      .catch(() => { if (alive) setState('notfound') })
    return () => { alive = false }
  }, [reference])

  const label = (statusKey) => t.statuses[statusKey] ?? statusKey

  // When each step actually happened, from the recorded history. A step with no entry
  // simply shows no date: orders that predate the history table have none, and inventing
  // one from "last updated" would put a date on this page that nobody observed.
  const dateOfStep = React.useMemo(() => {
    const map = new Map()
    for (const entry of order?.history ?? []) {
      if (entry?.status && entry?.at) map.set(entry.status, entry.at)
    }
    return map
  }, [order])

  const copyReference = async () => {
    try {
      await navigator.clipboard?.writeText(order.reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // A browser that refuses the clipboard is not an error worth showing: the code is on
      // screen and selectable, which is what the button was a shortcut for.
    }
  }

  const contact = (
    <div className="ot-contact">
      <h2>{t.contactTitle}</h2>
      <p className="ot-muted">{t.contactBody}</p>
      <div className="ot-contact-actions">
        <a className="ot-btn ot-btn-primary" href={`mailto:${CONTACT_EMAIL}`}>
          {t.writeUs} <span className="ot-btn-detail">{CONTACT_EMAIL}</span>
        </a>
        <a className="ot-btn" href={`tel:${CONTACT_PHONE_HREF}`}>
          {t.callUs} <span className="ot-btn-detail">{CONTACT_PHONE}</span>
        </a>
      </div>
    </div>
  )

  if (state === 'loading') {
    return (
      <main className="order-track">
        <SEO title={t.title} noindex />
        <div className="ot-wrap">
          {/* A skeleton rather than the word "loading": the shape that appears is the shape
              that fills in, so the page does not jump when the answer arrives. */}
          <div className="ot-skeleton" role="status" aria-live="polite" aria-label={t.loading}>
            <div className="ot-skel ot-skel-hero" />
            <div className="ot-skel-row">
              <div className="ot-skel ot-skel-panel" />
              <div className="ot-skel ot-skel-side" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (state === 'notfound') {
    return (
      <main className="order-track">
        <SEO title={t.title} noindex />
        <div className="ot-wrap">
          <div className="ot-panel ot-notfound">
            <h1>{t.notFoundTitle}</h1>
            <p className="ot-muted">{t.notFound}</p>
            {contact}
          </div>
        </div>
      </main>
    )
  }

  const cancelled = order.status === 'cancelled'
  const timeline = order.timeline ?? []
  const step = typeof order.step === 'number' ? order.step : -1
  const now = t.now[order.status] ?? { head: label(order.status), note: '' }

  // The rail fills to the CENTRE of the current step's dot rather than past it: the step is
  // in progress, and a bar drawn beyond it would claim the step is finished.
  const percent = timeline.length > 1 && step >= 0
    ? Math.round((step / (timeline.length - 1)) * 100)
    : 0

  const carrierAge = daysSince(order.carrierCheckedAt)
  const carrierIsStale = carrierAge !== null && carrierAge > CARRIER_NOTE_STALE_DAYS

  return (
    <main className="order-track">
      <SEO title={t.title} noindex />

      <div className="ot-wrap">
        {/* A <section>, not a <header>: index.css styles the bare `header` type for the
            site nav — sticky, z-index 50, backdrop-filtered — so an in-page banner using
            that tag becomes a stacking context equal to the nav and paints over its
            dropdown. The comment under that rule records the last hero this caught. */}
        <section className={`ot-hero${order.imageUrl ? ' has-photo' : ''}${cancelled ? ' is-cancelled' : ''}`}>
          {order.imageUrl ? (
            <div className="ot-hero-photo">
              <img src={order.imageUrl} alt={order.model || ''} loading="eager" />
            </div>
          ) : null}

          <div className="ot-hero-body">
            <p className="ot-eyebrow">{t.eyebrow}</p>

            {/* The answer first, in words, in the customer's language. Everything under it
                is the evidence. */}
            <h1 className="ot-headline">{now.head}</h1>
            {now.note ? <p className="ot-lede">{now.note}</p> : null}

            {order.model ? <p className="ot-model">{order.model}</p> : null}

            {!cancelled && timeline.length ? (
              <div className="ot-progress">
                {/* The list below carries the meaning for assistive tech; this is decoration
                    for the eye, and says so. */}
                <div className="ot-rail" aria-hidden="true">
                  <span className="ot-rail-fill" style={{ width: `${percent}%` }} />
                </div>
                <p className="ot-progress-label">
                  {t.stepOf(Math.max(step + 1, 1), timeline.length)}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <div className="ot-grid">
          <section className="ot-panel">
            <h2 className="ot-panel-title">{cancelled ? t.order : t.timeline}</h2>

            {/* Cancelled is not a step on the timeline — see OrderStatuses — so it gets its
                own plain statement rather than a progress bar frozen somewhere odd. */}
            {cancelled ? (
              <p className="order-track-cancelled">{t.now.cancelled.note}</p>
            ) : (
              <ol className="order-track-steps">
                {timeline.map((statusKey, i) => {
                  const done = i < step
                  const current = i === step
                  const at = formatDate(dateOfStep.get(statusKey), locale)
                  return (
                    <li
                      key={statusKey}
                      className={current ? 'is-current' : done ? 'is-done' : ''}
                      aria-current={current ? 'step' : undefined}
                    >
                      <span className="order-track-dot" aria-hidden="true" />
                      <span className="ot-step-body">
                        <span className="ot-step-name">{label(statusKey)}</span>
                        {at ? <span className="ot-step-date">{at}</span> : null}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <aside className="ot-side">
            {!cancelled && (order.expectedAtHarbor || order.expectedReadyAt) ? (
              <section className="ot-panel">
                <h2 className="ot-panel-title">{t.dates}</h2>
                <dl className="order-track-dates">
                  {order.expectedAtHarbor ? (
                    <div className="ot-date">
                      <dt>{t.expectedAtHarbor}</dt>
                      <dd>
                        {formatDate(order.expectedAtHarbor, locale) ?? order.expectedAtHarbor}
                        <span className="ot-tag">{t.estimate}</span>
                      </dd>
                    </div>
                  ) : null}
                  {order.expectedReadyAt ? (
                    <div className="ot-date">
                      <dt>{t.expectedReady}</dt>
                      <dd>
                        {formatDate(order.expectedReadyAt, locale) ?? order.expectedReadyAt}
                        <span className="ot-tag">{t.estimate}</span>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {/* Only while it is on the water — the server withholds it otherwise. The "as of"
                date is the point: it lets a three-week-old note read as old. */}
            {order.carrierNote || order.carrierName ? (
              <section className={`ot-panel ot-carrier${carrierIsStale ? ' is-stale' : ''}`}>
                <h2 className="ot-panel-title">
                  {t.carrier}{order.carrierName ? `: ${order.carrierName}` : ''}
                </h2>
                {order.carrierNote ? <p className="ot-carrier-note">{order.carrierNote}</p> : null}
                {order.carrierCheckedAt ? (
                  <p className="ot-muted ot-small">
                    {t.asOf} {formatDate(order.carrierCheckedAt, locale)}
                  </p>
                ) : null}
                {carrierIsStale ? <p className="ot-stale">{t.stale}</p> : null}
              </section>
            ) : null}

            <section className="ot-panel">{contact}</section>
          </aside>
        </div>

        {/* A <div>, not a <footer>: index.css styles the bare `footer` type for the site
            footer (top border, centred, muted), which would quietly restyle this strip. */}
        <div className="ot-meta">
          <span className="ot-meta-item">
            <span className="ot-muted">{t.reference}</span>
            <code className="ot-code">{order.reference}</code>
            <button type="button" className="ot-copy" onClick={copyReference}>
              {copied ? t.copied : t.copy}
            </button>
          </span>
          {order.orderedAt ? (
            <span className="ot-meta-item">
              <span className="ot-muted">{t.ordered}</span> {formatDate(order.orderedAt, locale)}
            </span>
          ) : null}
          {order.updatedAt ? (
            <span className="ot-meta-item">
              <span className="ot-muted">{t.updated}</span> {formatDate(order.updatedAt, locale)}
            </span>
          ) : null}
        </div>
      </div>
    </main>
  )
}
