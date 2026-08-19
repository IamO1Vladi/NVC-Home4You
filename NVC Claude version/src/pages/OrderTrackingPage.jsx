import React from 'react'
import { useParams } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext.jsx'
import SEO from '../components/SEO.jsx'
import '../style/OrderTracking.css'

// What the customer sees at /order/{reference} (ROADMAP #27).
//
// The code in the URL is the only credential, so this page is built to be worth exactly
// that much: a timeline, two expected dates, the model name, and whatever the carrier last
// said. No price, no balance, no name, no address — the server does not send them, so a
// change here can never start leaking them.
//
// NOINDEX, and not only for tidiness: a tracking URL that reaches a search index is a
// tracking URL that reaches everyone.
//
// The dates are labelled as EXPECTED everywhere they appear. A date presented as certain
// and then missed costs more trust than no date at all, and this page exists to build trust.

const TEXT = {
  bg: {
    title: 'Проследяване на поръчка',
    loading: 'Зареждане…',
    notFoundTitle: 'Няма такава поръчка',
    notFound: 'Линкът е грешен или вече не е активен. Проверете дали сте го копирали цял, или се свържете с нас.',
    order: 'Поръчка',
    ordered: 'Поръчана на',
    expectedAtHarbor: 'Очаквано пристигане на пристанище',
    expectedReady: 'Очаквана готовност за доставка',
    estimate: 'приблизително',
    carrier: 'Превозвач',
    asOf: 'информация към',
    contact: 'Въпрос по поръчката? Пишете ни на',
    statuses: {
      placed: 'Приета', fabricating: 'В производство', scheduled: 'Насрочена за товарене',
      travelling: 'Пътува', 'at-harbor': 'На пристанище', ready: 'Готова за доставка',
      delivered: 'Доставена', cancelled: 'Отказана',
    },
    cancelled: 'Тази поръчка е отказана. Ако това е грешка, свържете се с нас.',
  },
  en: {
    title: 'Order tracking',
    loading: 'Loading…',
    notFoundTitle: 'No such order',
    notFound: 'The link is wrong or no longer active. Check you copied all of it, or get in touch.',
    order: 'Order',
    ordered: 'Ordered on',
    expectedAtHarbor: 'Expected at the harbour',
    expectedReady: 'Expected ready for delivery',
    estimate: 'approximate',
    carrier: 'Carrier',
    asOf: 'as of',
    contact: 'A question about your order? Write to us at',
    statuses: {
      placed: 'Placed', fabricating: 'In production', scheduled: 'Scheduled for shipment',
      travelling: 'Travelling', 'at-harbor': 'At the harbour', ready: 'Ready for delivery',
      delivered: 'Delivered', cancelled: 'Cancelled',
    },
    cancelled: 'This order was cancelled. If that is a mistake, please get in touch.',
  },
}

const CONTACT_EMAIL = 'info@nvc-home4you.eu'

export default function OrderTrackingPage() {
  const { reference } = useParams()
  const { lang } = useI18n()
  const t = TEXT[String(lang).toLowerCase().startsWith('bg') ? 'bg' : 'en'] ?? TEXT.en

  const [state, setState] = React.useState('loading')
  const [order, setOrder] = React.useState(null)

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

  const label = (key) => t.statuses[key] ?? key

  return (
    <main className="order-track">
      <SEO title={t.title} noindex />

      {state === 'loading' ? <p className="order-track-muted">{t.loading}</p> : null}

      {state === 'notfound' ? (
        <div className="order-track-card">
          <h1>{t.notFoundTitle}</h1>
          <p>{t.notFound}</p>
          <p className="order-track-muted">
            {t.contact} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      ) : null}

      {state === 'ready' && order ? (
        <div className="order-track-card">
          <h1>{t.title}</h1>
          <p className="order-track-muted">
            {t.order} <strong>{order.reference}</strong>
            {order.model ? <> · {order.model}</> : null}
            {order.orderedAt ? <> · {t.ordered} {order.orderedAt}</> : null}
          </p>

          {/* Cancelled is not a step on the timeline — see OrderStatuses — so it gets its
              own plain statement rather than a progress bar frozen somewhere odd. */}
          {order.status === 'cancelled' ? (
            <p className="order-track-cancelled">{t.cancelled}</p>
          ) : (
            <ol className="order-track-steps">
              {order.timeline.map((key, i) => {
                const done = i < order.step
                const current = i === order.step
                return (
                  <li
                    key={key}
                    className={current ? 'is-current' : done ? 'is-done' : ''}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className="order-track-dot" aria-hidden="true" />
                    <span>{label(key)}</span>
                  </li>
                )
              })}
            </ol>
          )}

          {order.expectedAtHarbor || order.expectedReadyAt ? (
            <dl className="order-track-dates">
              {order.expectedAtHarbor ? (
                <>
                  <dt>{t.expectedAtHarbor}</dt>
                  <dd>{order.expectedAtHarbor} <span className="order-track-muted">({t.estimate})</span></dd>
                </>
              ) : null}
              {order.expectedReadyAt ? (
                <>
                  <dt>{t.expectedReady}</dt>
                  <dd>{order.expectedReadyAt} <span className="order-track-muted">({t.estimate})</span></dd>
                </>
              ) : null}
            </dl>
          ) : null}

          {/* Only while it is on the water — the server withholds it otherwise. The "as of"
              date is the point: it lets a three-week-old note read as old. */}
          {order.carrierNote || order.carrierName ? (
            <div className="order-track-carrier">
              <h2>{t.carrier}{order.carrierName ? `: ${order.carrierName}` : ''}</h2>
              {order.carrierNote ? <p>{order.carrierNote}</p> : null}
              {order.carrierCheckedAt ? (
                <p className="order-track-muted">
                  {t.asOf} {new Date(order.carrierCheckedAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="order-track-muted">
            {t.contact} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      ) : null}
    </main>
  )
}
