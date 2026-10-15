// /bg/dostavka-do-vratata, "Доставка и монтаж": what delivery and the crane cost to the
// visitor's place for the product they are buying, what is and is not included, how the house
// arrives, what to prepare, and a prefilled enquiry. It replaces the old delivery page (a
// stock night-port photo, an autoplaying process strip and one rate for everything) and the
// retired logistics page.
//
// EVERY FIGURE IS READ, NONE IS TYPED. The rates, the crane, the workers' nights and travel and
// the lead times come from deliveryRates.js (the owner's answers of 2026-10-15), the Box
// assembly "from" from prices.js, the truck sizes and weights from the configurator catalogue,
// and the example km from deliveryPlaces/examples.json, priced with the calculator's own
// quoteFor so the table and the calculator agree. The content files hold words with
// {placeholders}; figures() below is the one place they are filled.
//
// Delivery and crane figures are WITHOUT VAT and every line that prints one says so.
//
// Sections, in order: the hero with the calculator; what the price includes, per product;
// example prices; from the port to the plot (four clips, the lead times, the Box house
// unfolding and its size on the truck); what to prepare; the published Paralia Kariani case;
// the delivery questions (also FAQ JSON-LD); the product pages; the closing card, whose offer
// button carries the calculator's estimate once one is made (App.jsx reads the prefill by
// pathname). The breadcrumbs and Service markup are the route's.
import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/Delivery.css'
import ProductHero from '../components/product/ProductHero.jsx'
import SpecTable from '../components/product/SpecTable.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import FinalCta from '../components/FinalCta.jsx'
import DeliveryCalculator from '../components/delivery/DeliveryCalculator.jsx'
import JourneyClips from '../components/delivery/JourneyClips.jsx'
import { usePublishedCase, langOf } from '../lib/usePublishedCase.js'
import { quoteFor, formatKm } from '../components/delivery/deliveryQuote.js'
import UnfoldHouse from '../components/planner/UnfoldHouse.jsx'
import { FAQJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { getHomeContent } from '../content/home/index.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { getPriceRows } from '../content/shared/prices.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'
import EXAMPLES from '../content/shared/deliveryPlaces/examples.json'
import { euro } from '../lib/euro.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { PAGE_PHOTO_DEFAULTS, usePagePhoto } from '../lib/homePhotos.js'
import { paths } from '../routes/paths.js'

const CONTAINER = DELIVERY_RATES.products.container
const BOX = DELIVERY_RATES.products.box
const PRODUCTS = ['container', 'box', 'project']
const NUMBER_LOCALES = { bg: 'bg-BG', en: 'en-GB', el: 'el-GR' }

// The default "what to prepare" photo in its crops (scripts/delivery/clips.mjs): 4:3 at 800
// and 1500 wide, and a 4:5 portrait for phones. The admin's page-delivery slot replaces it.
const BASE = import.meta.env.BASE_URL || '/'
const CRANE = {
  wide: PAGE_PHOTO_DEFAULTS.delivery,
  small: `${BASE}delivery/crane-lift-800.webp`,
  portrait: `${BASE}delivery/crane-lift-portrait.webp`,
}

export const fill = (pattern, values = {}) => String(pattern ?? '').replace(
  /\{(\w+)\}/g,
  (m, key) => (values[key] == null ? m : String(values[key])),
)

/** Every figure the page's copy names, formatted for one locale. */
export function figures(locale) {
  const money = (value) => euro(value, locale)
  // The cheapest Box house assembly, quoted without VAT as prices.js keeps it.
  const assemblyFrom = Math.min(...getPriceRows(locale).map((row) => row.standard.assemblyNet))
  return {
    containerRate: money(CONTAINER.perKm),
    boxRate: money(BOX.perKm),
    containerCrane: money(CONTAINER.crane.about),
    boxCrane: money(BOX.crane.about),
    nights: CONTAINER.noCrane.nights,
    travel: money(CONTAINER.noCrane.travelMax),
    days: LEAD_TIMES.containerInStockDays,
    production: LEAD_TIMES.boxProductionDays,
    months: LEAD_TIMES.boxToAddressMonths,
    assembly: money(assemblyFrom),
  }
}

/**
 * The example table's rows: only the places with road km, each priced exactly as the
 * calculator prices it (a Box house from the closer base).
 */
export function exampleRows(locale, c, rows = EXAMPLES.rows) {
  const money = (value) => euro(value, locale)
  const km = (value) => formatKm(value, locale, c.calculator.km)
  return (rows || [])
    .filter((row) => Number.isFinite(row?.km) && row?.names?.[locale])
    .map((row) => {
      const place = { km: { marikostinovo: row.km, varna: Number.isFinite(row.kmV) ? row.kmV : null } }
      const container = quoteFor('container', place)
      const box = quoteFor('box', place)
      // The km beside the name rather than in a column of their own, so a phone stacks two
      // figures per place instead of three.
      return {
        label: `${row.names[locale]} · ${km(container.oneWayKm)}`,
        values: [
          money(container.transport),
          <>
            {box.transport > 0
              ? fill(c.examples.box, { transport: money(box.transport), crane: money(box.crane) })
              : fill(c.examples.boxCraneOnly, { crane: money(box.crane) })}
            {/* Only where there is a truck leg to explain: Varna itself is the crane alone. */}
            {box.base === 'varna' && box.transport > 0 ? (
              <span className="dl-cell-note">{fill(c.examples.fromVarna, { km: km(box.oneWayKm) })}</span>
            ) : null}
          </>,
        ],
      }
    })
}

/** The three Box sizes as they travel: folded length × width × height, and weight. */
function truckRows(locale, c) {
  const nf = new Intl.NumberFormat(NUMBER_LOCALES[locale] || 'en-GB', { maximumFractionDigits: 2 })
  return getBoxConfiguratorCatalog(locale).models.map((model) => {
    const [l, w, h] = String(model.dimensionsFolded || '').split('x').map((mm) => nf.format(Number(mm) / 1000))
    return {
      label: model.label,
      values: [fill(c.journey.truck.dims, { l, w, h }), fill(c.journey.truck.weight, { kg: nf.format(model.weight) })],
    }
  })
}

function PreparePhoto({ admin, locale, c }) {
  if (admin) {
    return (
      <img
        className="dl-prep-img"
        src={cdnImage(admin.url, { width: 800 })}
        srcSet={cdnSrcSet(admin.url, [480, 800, 1200, 1600])}
        sizes="(max-width: 899px) 100vw, 560px"
        alt={(locale === 'bg' && admin.alt) || c.prepare.adminAlt}
        width="1200"
        height="900"
        loading="lazy"
        decoding="async"
      />
    )
  }
  // The default: the 4:5 crop on a phone, the 4:3 one from 600px.
  return (
    <picture>
      <source media="(max-width: 599px)" srcSet={CRANE.portrait} width="800" height="1000" />
      <img
        className="dl-prep-img"
        src={CRANE.small}
        srcSet={`${CRANE.small} 800w, ${CRANE.wide.url} ${CRANE.wide.width}w`}
        sizes="(max-width: 899px) 100vw, 560px"
        alt={c.prepare.photoAlt}
        width={CRANE.wide.width}
        height={CRANE.wide.height}
        loading="lazy"
        decoding="async"
      />
    </picture>
  )
}

export default function DeliveryPage({ locale = 'bg', content }) {
  const { openQuestion } = useModalActions()
  const [params] = useSearchParams()
  const adminPhoto = usePagePhoto('delivery')
  const c = content
  const published = usePublishedCase(c?.proof?.case?.id)
  if (!c) return null

  const asked = params.get('product')
  const initialProduct = PRODUCTS.includes(asked) ? asked : 'container'

  const v = figures(locale)
  const pricesCopy = getPricesCopy(locale)
  const telephone = getHomeContent(locale)?.home?.localBusiness?.telephone || ''
  const callHref = telephone ? `tel:${telephone}` : undefined
  const pricesPath = paths.prices[locale] || paths.prices.en

  const facts = PRODUCTS.map((key) => fill(c.hero.facts[key], v))
  const examples = exampleRows(locale, c)
  const faq = c.faq.items.map((item) => ({ question: item.q, answer: fill(item.a, v) }))

  const casePhoto = published && (published.images || []).includes(c.proof.photo.url) ? c.proof.photo : null
  const quote = String(published?.quote || '').trim()
  const quoteLang = quote ? langOf(quote) : null
  const rating = Number(published?.rating) || 0

  const siblings = [
    { to: paths.modularBuilds[locale], ...c.siblings.containers },
    { to: paths.modularHouses[locale], ...c.siblings.houses },
    { to: paths.steelHouses[locale], ...c.siblings.steel },
    { to: pricesPath, ...c.siblings.prices },
  ]

  return (
    <main className="hp pp dl">
      <ProductHero
        titleId="dl-hero-title"
        eyebrow={c.hero.eyebrow}
        title={c.hero.h1}
        lead={c.hero.lead}
        secondary={{ label: c.hero.ask, onClick: openQuestion }}
        facts={facts}
      >
        <DeliveryCalculator locale={locale} content={c.calculator} initialProduct={initialProduct} />
      </ProductHero>

      <section className="pp-band" id="included" aria-labelledby="dl-included-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="dl-included-title">{c.included.heading}</h2>
              <p className="hp-sub">{c.included.sub}</p>
            </div>
          </div>

          {/* One card per product, each a description list of its terms, as the containers
              page prints its assembly terms. */}
          <ul className="dl-cards">
            {PRODUCTS.map((key) => {
              const card = c.included.cards[key]
              return (
                <li key={key} className="hp-card dl-card">
                  <h3 id={`dl-card-${key}`}>{card.title}</h3>
                  <dl className="pp-terms" aria-labelledby={`dl-card-${key}`}>
                    {card.lines.map((line) => (
                      <div key={line.label}>
                        <dt>{line.label}</dt>
                        <dd>{fill(line.text, v)}</dd>
                      </div>
                    ))}
                  </dl>
                  {card.pricesLink ? (
                    <p className="pp-links"><Link to={pricesPath}>{card.pricesLink}</Link></p>
                  ) : null}
                </li>
              )
            })}
          </ul>

          <div className="dl-after">
            <p>
              {c.included.foundation}
              {callHref ? <> <a href={callHref}>{c.included.call}</a></> : null}
            </p>
            <p>{c.included.several}</p>
          </div>
        </div>
      </section>

      {/* Static and prerendered: it reads the six-row examples.json, never the place table. */}
      {examples.length ? (
        <section id="examples" aria-labelledby="dl-examples-title">
          <div className="hp-container">
            <div className="hp-head">
              <div>
                <h2 id="dl-examples-title">{c.examples.heading}</h2>
                <p className="hp-sub">{c.examples.sub}</p>
              </div>
            </div>
            <SpecTable labelledBy="dl-examples-title" columns={c.examples.columns} rows={examples} className="dl-examples" />
            <p className="pp-note">
              {c.examples.note} {c.calculator.notes.data} (<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">ODbL</a>)
            </p>
          </div>
        </section>
      ) : null}

      <section className="pp-band" id="journey" aria-labelledby="dl-journey-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="dl-journey-title">{c.journey.heading}</h2>
              <p className="hp-sub" id="dl-journey-sub">{c.journey.sub}</p>
            </div>
          </div>

          {/* The row is named by the line under the heading: the section already has the heading. */}
          <JourneyClips clips={c.journey.clips} labelledBy="dl-journey-sub" />

          <div className="dl-lead-times">
            <h3>{c.journey.leadTimesHeading}</h3>
            <ul>
              <li>{fill(c.journey.leadTimes.container, v)}</li>
              <li>{fill(c.journey.leadTimes.box, v)}</li>
            </ul>
          </div>

          {/* The house as wide as the page: its caption and switches sit over the picture,
              and in a half-width column they covered the house. */}
          <div className="dl-unfold">
            <h3>{c.journey.unfoldHeading}</h3>
            <p>{c.journey.unfoldText}</p>
            <div className="dl-unfold-grid">
              <UnfoldHouse locale={locale} showVariantSwitch={false} posterLoading="lazy" className="dl-unfold-house" />
              {/* A heading, not a <caption>: Chrome draws a rounded table's border around its
                  caption too, and the top corners came out cut off. */}
              <div className="dl-unfold-truck">
                <h4 id="dl-truck-title" className="dl-truck-title">{c.journey.truck.heading}</h4>
                <SpecTable labelledBy="dl-truck-title" columns={c.journey.truck.columns} rows={truckRows(locale, c)} />
                <p className="pp-note">{c.journey.truck.note}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="prepare" aria-labelledby="dl-prepare-title">
        <div className="hp-container pp-split dl-prepare">
          <div>
            <h2 id="dl-prepare-title">{c.prepare.heading}</h2>
            <dl className="pp-terms">
              {c.prepare.terms.map((term) => (
                <div key={term.label}>
                  <dt>{term.label}</dt>
                  <dd>
                    {fill(term.text, v)}
                    {term.foundationNote ? ` ${pricesCopy.foundationNote}` : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="dl-prep-photo">
            {/* undefined while the first photo answer is on its way: the default shows. */}
            <PreparePhoto admin={adminPhoto} locale={locale} c={c} />
          </figure>
        </div>
      </section>

      {published ? (
        <section className="pp-band" id="proof" aria-labelledby="dl-proof-title">
          <div className="hp-container">
            <div className="hp-head">
              <div>
                <h2 id="dl-proof-title">{c.proof.heading}</h2>
                <p className="hp-sub">{c.proof.sub}</p>
              </div>
            </div>
            <div className="pp-split">
              <article className="cs-review-card">
                <h3>{c.proof.case.line}</h3>
                <p className="cs-muted">{c.proof.case.result}</p>
                {quote ? (
                  <p className="hp-lead" lang={quoteLang !== locale ? quoteLang : undefined}>“{quote}”</p>
                ) : null}
                <p className="cs-review-name">{c.proof.case.name}</p>
                {rating ? (
                  <p className="hp-agg">
                    <span className="hp-agg-star" aria-hidden="true">★</span>
                    {fill(c.proof.stars, { rating })}
                  </p>
                ) : null}
                <p className="pp-links"><Link to={paths.cases[locale]}>{c.proof.more}</Link></p>
              </article>
              {casePhoto ? (
                <img
                  className="dl-proof-img"
                  src={cdnImage(casePhoto.url, { width: 800 })}
                  srcSet={cdnSrcSet(casePhoto.url, [480, 640, 800, 1200])}
                  sizes="(max-width: 899px) 100vw, 520px"
                  alt={casePhoto.alt}
                  width="1200"
                  height="900"
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section id="faq" aria-labelledby="dl-faq-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="dl-faq-title">{c.faq.heading}</h2>
            </div>
          </div>
          <div className="dl-faq">
            {faq.map((item) => (
              <details key={item.question} className="dl-faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
          <FAQJSONLD questions={faq} />
        </div>
      </section>

      <SiblingLinks id="dl-siblings" heading={c.siblings.heading} go={c.siblings.go} items={siblings} />

      <FinalCta locale={locale} title={c.finalTitle} />
    </main>
  )
}
