// The configurator's front door, on the home page: three models, three finished prices.
//
// A LIVE ENTRY POINT, not a link. Each card is a real model with its photograph and its
// finished price, and tapping one lands inside the configurator with that model already
// chosen (?model=<key>, read by BoxHouseConfiguratorPage). The first decision is made
// before the tool even loads.
//
// Prices come from the same getPriceRows() the prices page renders, but the cards quote the
// house alone, VAT included and assembly NOT added (the owner's call, 2026-10-12), and the
// caption under each figure says so. That is the base price the configurator opens on, so
// the number a visitor taps here is the number they land on; the prices page then adds the
// assembly in its own column. The title's "from" figure is the lowest card beneath it. The photo is the admin's model slot when one is set (served
// by /api/img, so it gets the resizer), else the static catalogue render under /public.
//
// Copy lives in home.strip of the three content files so the Greek audit scans it.
import React from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../routes/paths.js'
import { euro, getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import { getPriceRows } from '../content/shared/prices.js'
import { brochureUrl } from '../lib/brochure.js'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'

const fill = (pattern, values) => Object.entries(values).reduce(
  (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
  String(pattern || ''),
)

function Doc() {
  return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
}

export default function ConfiguratorStrip({ locale = 'en', content, photos = {} }) {
  if (!content) return null

  const rows = getPriceRows(locale)
  const { models } = getBoxConfiguratorCatalog(locale)

  const configuratorPath = paths.boxConfigurator[locale] || paths.boxConfigurator.en
  const plannerPath = paths.planner[locale] || paths.planner.en
  const pricesPath = paths.prices[locale] || paths.prices.en

  const base = import.meta.env.BASE_URL || '/'
  const cardFallback = `${base}modular-builds/card.svg`

  const minPrice = Math.min(...rows.map((row) => row.standard.house))
  const title = fill(content.titlePattern, { count: rows.length, price: euro(minPrice, locale) })

  return (
    <section className="hp-strip" id="prices" aria-labelledby="hp-strip-title">
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <span className="hp-eyebrow">{content.kicker}</span>
            <h2 id="hp-strip-title">{title}</h2>
            <p className="hp-sub">{content.lead}</p>
          </div>
          <div className="hp-head-links">
            <Link to={pricesPath}>{content.all}</Link>
            {content.gallery ? <Link to={paths.gallery[locale] || paths.gallery.en}>{content.gallery}</Link> : null}
            {/* On phones too since 2026-10-15: the redesigned planner page works there (the 3D
                unfold, the layouts, send for an offer); only its editor needs a 900px screen. */}
            <Link to={plannerPath}>{content.planner}</Link>
          </div>
        </div>

        <div className="hp-models">
          {rows.map((row) => {
            const model = models.find((m) => m.key === row.key)
            const staticSrc = `${base}box-config/${model?.standardHeroImage || model?.heroImage}`
            const apiSrc = photos?.[row.key] || null
            const src = apiSrc || staticSrc
            return (
              <Link
                key={row.key}
                className="hp-card hp-model"
                to={`${configuratorPath}?model=${row.key}`}
                data-model={row.key}
              >
                <img
                  src={cdnImage(src, { width: 640 })}
                  srcSet={cdnSrcSet(src, [480, 640, 800, 1200])}
                  sizes="(max-width: 639px) 120px, (max-width: 1199px) 33vw, 384px"
                  alt={row.label}
                  loading="lazy"
                  decoding="async"
                  width="1200"
                  height="900"
                  onError={imageFallback(apiSrc ? staticSrc : null, cardFallback)}
                />
                <span className="hp-model-body">
                  <span className="hp-model-size">{row.label}</span>
                  <span className="hp-model-price"><small>{content.from}</small> {euro(row.standard.house, locale)}</span>
                  <span className="hp-model-incl">{content.incl}</span>
                  <span className="hp-model-go">{content.cta}</span>
                </span>
              </Link>
            )
          })}
        </div>

        {/* The box-house brochure, not the general catalogue: this line sits under the
            box-house prices, and the general catalogue's page 3 still prints the template
            placeholder "Link or button". The other five are one tap away in #catalogues. */}
        <p className="hp-paper">
          <span>{content.paperPrefix}</span>
          <a href={brochureUrl('box-house', 1, locale)} target="_blank" rel="noopener noreferrer"><Doc />{content.paperLink}</a>
          <span>{content.paperOr} <a href="#catalogues">{content.paperAll}</a>.</span>
        </p>
      </div>
    </section>
  )
}
