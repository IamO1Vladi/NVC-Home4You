import React from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../routes/paths.js'
import { euro, getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import { getPriceRows } from '../content/shared/prices.js'

// The configurator's front door, on the home page.
//
// A LIVE ENTRY POINT, not a link. Each card is a real model with its real photograph and
// finished price, and tapping one lands inside the configurator with that model already
// chosen (?model=<key>, read by BoxHouseConfiguratorPage). The first decision is made
// before the tool even loads, which is the difference between "here is a tool" and
// "here is your house, adjust it".
//
// Prices come from the same getPriceRows() the prices page renders — house price inc VAT
// plus assembly grossed up — so the number a visitor taps on here is exactly the number
// the prices page and the configurator will show them next. Three surfaces, one source.
//
// Static content, so it prerenders into the crawlable HTML like everything else on the
// home page — which also quietly gives the home page model names and prices in text form.

const STRIP_COPY = {
  bg: {
    kicker: 'Конфигуратор',
    title: 'Сглобете своята къща онлайн',
    lead: 'Изберете модел и вижте цената на всяка стъпка — план, дограма, баня, кухня.',
    from: 'от',
    cta: 'Конфигурирай',
    all: 'Всички цени',
    planner: 'Планирай разпределението',
  },
  en: {
    kicker: 'Configurator',
    title: 'Build your house online',
    lead: 'Pick a model and see the price at every step — plan, windows, bathroom, kitchen.',
    from: 'from',
    cta: 'Configure',
    all: 'All prices',
    planner: 'Plan the layout',
  },
  el: {
    kicker: 'Διαμορφωτής',
    title: 'Φτιάξτε το σπίτι σας online',
    lead: 'Διαλέξτε μοντέλο και δείτε την τιμή σε κάθε βήμα — κάτοψη, κουφώματα, μπάνιο, κουζίνα.',
    from: 'από',
    cta: 'Διαμορφώστε',
    all: 'Όλες οι τιμές',
    planner: 'Σχεδιάστε την κάτοψη',
  },
}

export default function ConfiguratorStrip({ locale = 'en' }) {
  const t = STRIP_COPY[locale] || STRIP_COPY.en
  const rows = getPriceRows(locale)
  const { models } = getBoxConfiguratorCatalog(locale)

  const configuratorPath = paths.boxConfigurator[locale] || paths.boxConfigurator.en
  const plannerPath = paths.planner[locale] || paths.planner.en
  const pricesPath = paths.prices[locale] || paths.prices.en

  const base = import.meta.env.BASE_URL || '/'

  return (
    <section className="cfg-strip">
      <div className="container">
        <div className="cfg-strip-head">
          <div>
            <p className="cfg-strip-kicker">{t.kicker}</p>
            <h2 className="cfg-strip-title">{t.title}</h2>
            <p className="cfg-strip-lead">{t.lead}</p>
          </div>
          {/* "Price it yourself": the from-price next to the tool that computes the rest.
              A number beside a button that explains the number is the natural next click. */}
          <Link className="cfg-strip-all" to={pricesPath}>{t.all} →</Link>
        </div>

        <div className="cfg-strip-cards">
          {rows.map((row) => {
            const model = models.find((m) => m.key === row.key)
            return (
              <Link
                key={row.key}
                className="cfg-strip-card"
                to={`${configuratorPath}?model=${row.key}`}
              >
                <img
                  src={`${base}box-config/${model?.standardHeroImage || model?.heroImage}`}
                  alt={row.label}
                  loading="lazy"
                  decoding="async"
                  width="480"
                  height="300"
                />
                <span className="cfg-strip-card-body">
                  <span className="cfg-strip-card-name">{row.label}</span>
                  <span className="cfg-strip-card-price">
                    {t.from} <strong>{euro(row.standard.total, locale)}</strong>
                  </span>
                  <span className="cfg-strip-card-cta">{t.cta} →</span>
                </span>
              </Link>
            )
          })}
        </div>

        <p className="cfg-strip-planner">
          <Link to={plannerPath}>{t.planner} →</Link>
        </p>
      </div>
    </section>
  )
}
