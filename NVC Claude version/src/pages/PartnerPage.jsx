// /bg/stani-partnjor, „Партньори": one job, turning a company that wants more than one unit
// into an enquiry sales can recognise and call back. Two audiences, the owner's own words:
// resellers, and buyers of several units for a site of their own.
//
// It replaces the old ppr- page (a 1.67 MB hero PNG, four gallery tiles, a scroll-animated road
// that was invisible until the script ran, "6+ контейнера = специални цени" and process promises
// nobody had made). Built from the product and delivery pages' parts (hp-/pp- classes inside
// <main class="hp pp ptn">), so it looks like the page the visitor came from.
//
// EVERY CLAIM IS THE OWNER'S AND EVERY FIGURE IS READ. The thresholds come from
// partnerTerms.js, the rates, crane and lead times from deliveryRates.js, the warranty's years
// from warranty.js (containers and Box houses only), the "from" prices from the gallery rows
// (useProductRows); the content files hold words with {placeholders} and figures() below is
// the one place they are filled. A row or question marked `pending` waits for the owner's
// answer and is never drawn, nor sent to Google as FAQ markup.
//
// Sections, in order: the hero; the two doors (resell / buy for your own site); „Накратко";
// what you can order (the product pages, with their live prices); how we work (four steps,
// every step and photo in the markup); who takes care of what; real deliveries (the published
// Paralia Kariani case, the reviews; the steps already show the delivery photos, so the
// delivery page's clips are not repeated); the enquiry form at #zapitvane; the
// questions (also FAQ JSON-LD); the route map, loaded only near the screen (on a phone, only
// after a tap); the closing card. The breadcrumbs and Service markup are the route's.
//
// On mount the page writes a prefill (configPrefill.js), so the header's offer and question
// forms opened here are tagged as a partner's enquiry, as the delivery calculator tags its own.
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/ProductSteel.css'
import '../style/Delivery.css'
import '../style/Partner.css'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import ProcessSteps from '../components/product/ProcessSteps.jsx'
import FinalCta from '../components/FinalCta.jsx'
import PartnerEnquiry from '../components/partner/PartnerEnquiry.jsx'
import { FAQJSONLD } from '../components/StructuredData.jsx'
import { useModalActions } from '../context/ModalActions.jsx'
import { getHomeContent } from '../content/home/index.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { PARTNER_MIN_UNITS } from '../content/shared/partnerTerms.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { usePublishedCase, langOf } from '../lib/usePublishedCase.js'
import { useProductRows, lowest } from '../lib/productRows.js'
import { writeConfiguratorPrefill } from '../lib/configPrefill.js'
import { euro } from '../lib/euro.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { PAGE_PHOTO_DEFAULTS, usePagePhoto } from '../lib/homePhotos.js'
import { paths } from '../routes/paths.js'

// Leaflet and its tiles are fetched only when the map is about to be seen.
const LogisticsWorld = lazy(() => import('../components/LogisticsWorld.jsx'))

const CONTAINER = DELIVERY_RATES.products.container
const BOX = DELIVERY_RATES.products.box

// The default hero photo, the delivery page's crane lift, in its 800 and 1500 wide crops
// (scripts/delivery/clips.mjs). The admin's page-partner slot replaces it.
const BASE = import.meta.env.BASE_URL || '/'
const CRANE = { wide: PAGE_PHOTO_DEFAULTS.partner || PAGE_PHOTO_DEFAULTS.delivery, small: `${BASE}delivery/crane-lift-800.webp` }

// How far ahead of the screen the map starts loading on a wide screen.
const MAP_MARGIN = '400px 0px'
const PHONE_QUERY = '(max-width: 767px)'

export const fill = (pattern, values = {}) => String(pattern ?? '').replace(
  /\{(\w+)\}/g,
  (m, key) => (values[key] == null ? m : String(values[key])),
)

/** Every figure the page's copy names, formatted for one locale. */
export function figures(locale) {
  const money = (value) => euro(value, locale)
  return {
    containerMin: PARTNER_MIN_UNITS.container,
    boxMin: PARTNER_MIN_UNITS.box,
    containerRate: money(CONTAINER.perKm),
    boxRate: money(BOX.perKm),
    boxCrane: money(BOX.crane.about),
    nights: CONTAINER.noCrane.nights,
    travel: money(CONTAINER.noCrane.travelMax),
    days: LEAD_TIMES.containerInStockDays,
    production: LEAD_TIMES.boxProductionDays,
    months: LEAD_TIMES.boxToAddressMonths,
    structureYears: WARRANTY_YEARS.structure,
    panelYears: WARRANTY_YEARS.panels,
    joineryYears: WARRANTY_YEARS.joinery,
    sanitaryYears: WARRANTY_YEARS.sanitary,
  }
}

/** What the page may show: everything not waiting for the owner's answer. */
export const shown = (list) => (list || []).filter((item) => item && !item.pending)

/** The questions as the page prints them and as the FAQ markup publishes them: one list. */
export function faqItems(c, v) {
  return shown(c.faq.items).map((item) => ({ question: item.q, answer: fill(item.a, v) }))
}

function Tick() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
}

function HeroPhoto({ admin, locale, c }) {
  // The photo is the hero's right column on a wide screen and sits above the heading on a
  // phone (ProductPage.css), so it is the largest thing in the first screen either way: eager.
  if (admin) {
    return (
      <img
        src={cdnImage(admin.url, { width: 800 })}
        srcSet={cdnSrcSet(admin.url, [480, 640, 800, 1200, 1600])}
        sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 600px"
        alt={(locale === 'bg' && admin.alt) || c.hero.adminAlt}
        width="1200"
        height="900"
        loading="eager"
        decoding="async"
        fetchpriority="high"
      />
    )
  }
  return (
    <img
      src={CRANE.small}
      srcSet={`${CRANE.small} 800w, ${CRANE.wide.url} ${CRANE.wide.width}w`}
      sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 600px"
      alt={c.hero.photoAlt}
      width={CRANE.wide.width}
      height={CRANE.wide.height}
      loading="eager"
      decoding="async"
      fetchpriority="high"
    />
  )
}

// A failed map chunk (offline, a stale deploy) must not take the page and its form down,
// as UnfoldHouse's CanvasBoundary keeps the planner: the fallback stands in its place.
class MapBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

/**
 * The route map, mounted only when wanted: on a wide screen once its section comes within
 * MAP_MARGIN of the screen, on a phone only after a tap (a phone that never opens it never
 * downloads Leaflet or a tile). Until then the button stands in its place.
 */
function RouteMap({ content, c }) {
  const boxRef = useRef(null)
  const [wanted, setWanted] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (wanted || !box || typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') return undefined
    if (window.matchMedia?.(PHONE_QUERY).matches) return undefined
    const near = new window.IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setWanted(true)
        near.disconnect()
      }
    }, { rootMargin: MAP_MARGIN })
    near.observe(box)
    return () => near.disconnect()
  }, [wanted])

  return (
    <div className="ptn-map" ref={boxRef}>
      {wanted ? (
        <MapBoundary fallback={<p className="ptn-map-wait" role="status">{c.cargo.unavailable}</p>}>
          <Suspense fallback={<p className="ptn-map-wait" role="status">{c.cargo.loading}</p>}>
            <LogisticsWorld content={content} />
          </Suspense>
        </MapBoundary>
      ) : (
        <button type="button" className="hp-btn ghost ptn-map-show" onClick={() => setWanted(true)}>
          {c.cargo.show}
        </button>
      )}
    </div>
  )
}

export default function PartnerPage({ locale = 'bg', content }) {
  const { openQuestion } = useModalActions()
  const location = useLocation()
  const adminPhoto = usePagePhoto('partner')
  const { box, wagon } = useProductRows(locale)
  const c = content
  const published = usePublishedCase(c?.proof?.case?.id)
  const [preset, setPreset] = useState(null)
  const formHeadingRef = useRef(null)

  // The header's offer and question forms, opened on this page, carry the partner line.
  const tagPage = useCallback(() => {
    if (!c?.prefill) return
    writeConfiguratorPrefill({
      source: 'partner-page',
      sourcePath: location.pathname,
      modelLabel: '',
      knownTotal: 0,
      offerText: c.prefill.offer,
      questionText: c.prefill.offer,
      updatedAt: Date.now(),
    })
  }, [c, location.pathname])
  useEffect(() => { tagPage() }, [tagPage])

  // A link to #zapitvane (the product and delivery pages' "more than one unit?") lands on the
  // form, and again once the published case has drawn itself above it and pushed it down.
  const hasCase = Boolean(published)
  useEffect(() => {
    if (location.hash !== '#zapitvane') return
    document.getElementById('zapitvane')?.scrollIntoView?.({ block: 'start' })
  }, [location.hash, hasCase])

  if (!c) return null

  const v = figures(locale)
  const telephone = getHomeContent(locale)?.home?.localBusiness?.telephone || ''
  const callHref = telephone ? `tel:${telephone}` : undefined
  const pathOf = (key) => paths[key]?.[locale] || paths[key]?.en

  // A door's button: the form, set to that door's role. The hero's: the form as it is.
  const openForm = (role) => {
    if (role) setPreset({ role, n: Date.now() })
    const target = document.getElementById('zapitvane')
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    target?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    formHeadingRef.current?.focus?.({ preventScroll: true })
  }

  // The map's question: tagged as cargo for this one opening (App reads the prefill as the
  // form opens), then the page's own tag again for whatever is opened next.
  const askCargo = () => {
    writeConfiguratorPrefill({
      source: 'partner-cargo',
      sourcePath: location.pathname,
      modelLabel: '',
      knownTotal: 0,
      offerText: c.prefill.offer,
      questionText: c.prefill.cargo,
      updatedAt: Date.now(),
    })
    openQuestion()
    tagPage()
  }

  const facts = c.hero.facts.map((fact) => fill(fact, v))
  const terms = shown(c.terms.rows)
  const faq = faqItems(c, v)

  const priceLine = (value, basis) => (value == null ? undefined : `${c.products.from} ${euro(value, locale)} ${basis}`)
  const products = [
    { to: pathOf('modularBuilds'), label: c.products.containers.label, desc: c.products.containers.desc, price: priceLine(lowest(wagon), c.products.containers.basis) },
    { to: pathOf('modularHouses'), label: c.products.houses.label, desc: c.products.houses.desc, price: priceLine(lowest(box, (row) => row.house), c.products.houses.basis) },
    { to: pathOf('steelHouses'), label: c.products.steel.label, desc: c.products.steel.desc },
  ]

  const steps = c.process.steps.map((step) => ({ ...step, text: fill(step.text, v) }))

  const casePhoto = published && (published.images || []).includes(c.proof.photo.url) ? c.proof.photo : null
  const quote = String(published?.quote || '').trim()
  const quoteLang = quote ? langOf(quote) : null
  const rating = Number(published?.rating) || 0

  return (
    <main className="hp pp ptn">
      {/* The product pages' hero (ProductHero's markup and classes), with the photo written
          here so the default can carry its 800px crop in a srcset. */}
      <section className="pp-hero" aria-labelledby="ptn-hero-title">
        <div className="hp-container pp-hero-grid">
          <div className="pp-hero-copy">
            <span className="hp-eyebrow">{c.hero.eyebrow}</span>
            <h1 id="ptn-hero-title" className="pp-title">{c.hero.h1}</h1>
            <p className="hp-lead">{c.hero.lead}</p>
            <div className="hp-cta-row">
              <a className="hp-btn" href="#zapitvane" onClick={(e) => { e.preventDefault(); openForm(null) }}>{c.hero.primary}</a>
              {callHref ? <a className="hp-btn ghost" href={callHref}>{c.hero.call}</a> : null}
            </div>
            <ul className="hp-facts">
              {facts.map((fact) => <li key={fact}><Tick />{fact}</li>)}
            </ul>
          </div>
          <figure className="pp-hero-media">
            {/* undefined while the first photo answer is on its way: the default shows. */}
            <HeroPhoto admin={adminPhoto} locale={locale} c={c} />
          </figure>
        </div>
      </section>

      <section className="pp-band" id="ptn-doors" aria-labelledby="ptn-doors-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ptn-doors-title">{c.doors.heading}</h2>
            </div>
          </div>
          <ul className="pp-pair ptn-doors">
            <li className="hp-card ptn-door">
              <h3>{c.doors.resell.title}</h3>
              <p>{c.doors.resell.text}</p>
              <button type="button" className="hp-btn" onClick={() => openForm('reseller')}>{c.doors.resell.button}</button>
            </li>
            <li className="hp-card ptn-door">
              <h3>{c.doors.own.title}</h3>
              <p>{c.doors.own.text}</p>
              <p className="ptn-chips-label" id="ptn-chips-label">{c.doors.own.chipsLabel}</p>
              <ul className="ptn-chips" aria-labelledby="ptn-chips-label">
                {c.doors.own.chips.map((chip) => (
                  <li key={chip.key}><Link to={pathOf(chip.pathKey)}>{chip.label}</Link></li>
                ))}
              </ul>
              <button type="button" className="hp-btn" onClick={() => openForm('ownSite')}>{c.doors.own.button}</button>
            </li>
          </ul>
        </div>
      </section>

      <section id="ptn-terms" aria-labelledby="ptn-terms-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ptn-terms-title">{c.terms.heading}</h2>
            </div>
          </div>
          <dl className="pp-terms ptn-terms" aria-labelledby="ptn-terms-title">
            {terms.map((row) => (
              <div key={row.key} data-term={row.key}>
                <dt>{row.label}</dt>
                <dd>
                  {fill(row.text, v)}
                  {row.link ? <> <Link to={pathOf(row.link.pathKey)}>{row.link.label}</Link></> : null}
                </dd>
              </div>
            ))}
          </dl>
          <p className="pp-note">{c.terms.note}</p>
        </div>
      </section>

      <SiblingLinks id="ptn-products" heading={c.products.heading} lead={c.products.sub} go={c.products.go} items={products} />

      {/* The steel page's step styles are scoped under .pp-steel (ProductSteel.css); this
          wrapper borrows them for the steps alone, nothing else of that page applies here. */}
      <div className="pp-steel ptn-process">
        <ProcessSteps id="ptn-process" heading={c.process.heading} steps={steps} />
      </div>

      <section className="pp-band" id="ptn-split" aria-labelledby="ptn-split-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ptn-split-title">{c.split.heading}</h2>
            </div>
          </div>
          <div className="pp-pair ptn-split">
            {['we', 'you'].map((side) => (
              <div key={side} className="hp-card ptn-side">
                <h3 id={`ptn-split-${side}`}>{c.split[side].title}</h3>
                <ul aria-labelledby={`ptn-split-${side}`}>
                  {c.split[side].items.map((item) => <li key={item}>{fill(item, v)}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="ptn-proof" aria-labelledby="ptn-proof-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ptn-proof-title">{c.proof.heading}</h2>
              <p className="hp-sub">{c.proof.sub}</p>
            </div>
          </div>

          {published ? (
            <div className="pp-split ptn-case">
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
                <p className="pp-links"><Link to={pathOf('cases')}>{c.proof.more}</Link></p>
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
          ) : null}

          <p className="pp-links"><Link to={pathOf('cases')}>{c.proof.reviews}</Link></p>
        </div>
      </section>

      <PartnerEnquiry locale={locale} content={c.form} preset={preset} headingRef={formHeadingRef} />

      <section id="ptn-faq" aria-labelledby="ptn-faq-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ptn-faq-title">{c.faq.heading}</h2>
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

      <section className="pp-band" id="ptn-cargo" aria-labelledby="ptn-cargo-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              <h2 id="ptn-cargo-title">{c.cargo.heading}</h2>
              <p className="hp-sub">{c.cargo.text}</p>
            </div>
            <button type="button" className="hp-btn ghost" onClick={askCargo}>{c.cargo.ask}</button>
          </div>
          <RouteMap content={c.logisticsWorld} c={c} />
        </div>
      </section>

      <FinalCta locale={locale} title={c.finalTitle} />
    </main>
  )
}
