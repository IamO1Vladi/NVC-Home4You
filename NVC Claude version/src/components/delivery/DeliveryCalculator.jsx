// The delivery calculator: pick the product, type the town, read what the truck (and the crane)
// costs. It replaces the old DeliveryEstimator, which asked a demo routing server for every
// quote, charged one rate for everything and let "Бургас" become Burgos in Spain.
//
// HOW IT WORKS
//   - The places and their road km come from our own table (src/lib/deliveryPlaces.js), routed
//     offline from Marikostinovo and Varna. Nothing the visitor types leaves the browser:
//     no Nominatim, no OSRM at runtime. The table loads on the field's first focus or
//     keystroke (or when the map opens), never with the page.
//   - The rates, the crane and the workers' figures come from deliveryRates.js; every word from
//     `content` (one locale's strings, keys below). The arithmetic is in deliveryQuote.js.
//   - The estimate on screen is kept in the offer form's prefill as it changes (as the floor
//     planner does), so every offer or question button on the page opens with the estimate
//     shown, never an older one; clearing the field takes it out. The enquiry button only
//     opens the form. The place never goes into a URL or into analytics.
//   - Prerender-safe: nothing touches window or document at import or in the first render.
//
// PROPS
//   locale          'bg' | 'en' | 'el'
//   content         content.calculator for that locale
//   initialProduct  'container' | 'box' | 'project' (the page passes ?product=); default container
//
// content KEYS (src/content/{bg,en,el}/delivery.js `calculator` has the full set;
// {name} is filled by the calculator, figures always from deliveryRates.js):
//   title, productLegend, products.{container,box,project},
//   placeLabel, placeholder, placeHint, loading, loadError, retry,
//   suggestionsLabel, suggestionsCount.{one,many{count}}, noMatch,
//   countries.{BG,GR}, region.{BG,GR}{region}, bases.{marikostinovo,varna},
//   fromBase.{marikostinovo,varna}, km, vat, resultLabel,
//   distance{km,from}, billable{km,billable}, boxBase{from},
//   container.{transportLabel, transportMath{billable,rate}, fixed, assembly, craneTitle,
//              crane{crane}, noCraneTitle, noCrane{nights,travel}},
//   box.{transportLabel, transportMath{billable,rate}, craneLabel, craneNote, totalLabel,
//        about{amount}, noCrane, included, assembly, assemblyLink},
//   project.text, onRequest, notes.{approx,several,foundation,data}, enquiry, enquiryPlain,
//   map.{show, hide, loading, label, hint, nothingNear, line{km}, zoomIn, zoomOut,
//        attributionTitle, baseMarker{base}, placeMarker{place}},
//   offer.{heading, product, place, distance, distanceValue{km,from,billable}, transport, crane,
//          total, craneOptional{crane}, noCraneTravel{travel}, onRequest, project, outside,
//          footer, question{product,place,km}, questionOnRequest{product,place},
//          questionOutside{product,place}}
import React, { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './DeliveryCalculator.css'

import { DELIVERY_BASES } from '../../content/shared/deliveryRates.js'
import { displayName, loadPlaces, nearestPlace, search } from '../../lib/deliveryPlaces.js'
import { CONFIG_PREFILL_KEY, readConfiguratorPrefill, writeConfiguratorPrefill } from '../../lib/configPrefill.js'
import { trackEvent } from '../../lib/analytics.js'
import { useModalActions } from '../../context/ModalActions.jsx'
import { paths } from '../../routes/paths.js'
import {
  PRODUCTS,
  buildOfferText,
  buildQuestionText,
  fill,
  formatQuote,
  kmBand,
  quoteFor,
  regionLine,
} from './deliveryQuote.js'

const DeliveryMap = React.lazy(() => import('./DeliveryMap.jsx'))

// A tap on the map further than this from every town picks nothing.
const MAP_PICK_KM = 15
// Fewer letters than this match half the country; the list waits for one more.
const MIN_QUERY = 2
// The licence the place table's OpenStreetMap names and road km are under, credited beside them.
const ODBL_URL = 'https://www.openstreetmap.org/copyright'

// Brings the result into view below the sticky site header after a pick, when it is not
// already on screen (on a phone the keyboard closing, or a tap on the map below, leaves it
// out of sight). The header is measured: it wraps on narrow screens, so it has no fixed height.
function revealBelowHeader(el) {
  if (!el || typeof window === 'undefined' || typeof document === 'undefined') return
  const rect = el.getBoundingClientRect()
  if (!rect.height) return
  const header = document.querySelector('.site-header')
  const top = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0
  const visible = rect.top >= top + 4 && rect.top + Math.min(rect.height, 160) <= window.innerHeight
  if (visible) return
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo?.({ top: window.scrollY + rect.top - top - 12, behavior: reduced ? 'auto' : 'smooth' })
}

function Money({ children }) {
  return <span className="dc-money">{children}</span>
}

export default function DeliveryCalculator({ locale = 'bg', content, initialProduct = 'container' }) {
  const s = content || {}
  const { openOffer } = useModalActions()
  const uid = useId()
  const ids = {
    title: `${uid}-title`,
    input: `${uid}-place`,
    list: `${uid}-list`,
    hint: `${uid}-hint`,
    map: `${uid}-map`,
    option: (i) => `${uid}-opt-${i}`,
  }

  const valid = (p) => (PRODUCTS.includes(p) ? p : 'container')
  const [product, setProduct] = useState(() => valid(initialProduct))
  useEffect(() => setProduct(valid(initialProduct)), [initialProduct])

  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [places, setPlaces] = useState(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [picked, setPicked] = useState(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [mapNote, setMapNote] = useState('')
  const [pickCount, setPickCount] = useState(0)
  const resultRef = useRef(null)
  const loadingRef = useRef(false)
  // A tap on the map while the place table is still loading, applied once it arrives.
  const pendingTapRef = useRef(null)

  const ensureLoaded = useCallback(() => {
    if (loadingRef.current || places) return
    loadingRef.current = true
    setStatus('loading')
    loadPlaces()
      .then((list) => {
        setPlaces(list)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
      .finally(() => {
        loadingRef.current = false
      })
  }, [places])

  const trimmed = query.trim()
  const suggestions = useMemo(
    () => (places && !picked && trimmed.length >= MIN_QUERY ? search(trimmed, places, { limit: 8, locale }) : []),
    [places, picked, trimmed, locale],
  )
  const listShown = open && suggestions.length > 0
  const noMatch = status === 'ready' && !picked && trimmed.length >= MIN_QUERY && suggestions.length === 0

  const quote = useMemo(() => (picked ? quoteFor(product, picked) : null), [picked, product])
  const f = quote ? formatQuote(quote, locale, s) : null

  // One estimate event per place or product shown: the product and a distance band, never the place.
  useEffect(() => {
    if (quote) trackEvent('delivery_estimate', { product: quote.product, kmBand: kmBand(quote.oneWayKm) })
  }, [quote])

  useEffect(() => {
    if (!pickCount) return
    const raf = typeof window !== 'undefined' && window.requestAnimationFrame
    if (raf) raf(() => revealBelowHeader(resultRef.current))
  }, [pickCount])

  const pick = useCallback(
    (place) => {
      setPicked(place)
      setQuery(displayName(place, locale))
      setOpen(false)
      setActive(-1)
      setMapNote('')
      setPickCount((n) => n + 1)
    },
    [locale],
  )

  const onChange = (e) => {
    ensureLoaded()
    setQuery(e.target.value)
    setPicked(null)
    setOpen(true)
    setActive(-1)
  }

  const onKeyDown = (e) => {
    const n = suggestions.length
    if (e.key === 'ArrowDown') {
      ensureLoaded()
      if (!n) return
      e.preventDefault()
      setOpen(true)
      setActive((i) => (listShown ? (i + 1) % n : 0))
    } else if (e.key === 'ArrowUp') {
      if (!n) return
      e.preventDefault()
      setOpen(true)
      setActive((i) => (listShown ? (i <= 0 ? n - 1 : i - 1) : n - 1))
    } else if (e.key === 'Enter') {
      if (!n || picked) return
      e.preventDefault()
      pick(suggestions[active >= 0 && active < n ? active : 0].place)
    } else if (e.key === 'Escape') {
      if (listShown) {
        e.preventDefault()
        setOpen(false)
        setActive(-1)
      } else if (query) {
        e.preventDefault()
        setQuery('')
        setPicked(null)
      }
    }
  }

  // Leaving the field with exactly one exact match (someone typed "София" and tapped away)
  // takes it; anything less certain waits for a choice.
  const onBlur = () => {
    setOpen(false)
    setActive(-1)
    const exact = suggestions.filter((x) => x.tier === 3)
    if (!picked && exact.length === 1) pick(exact[0].place)
  }

  const onMapPick = useCallback(
    (lat, lon) => {
      if (!places) {
        pendingTapRef.current = [lat, lon]
        setMapNote(s.loading || '')
        return
      }
      const hit = nearestPlace(lat, lon, places, { maxKm: MAP_PICK_KM })
      if (hit) pick(hit.place)
      else setMapNote(s.map?.nothingNear || '')
    },
    [places, pick, s.map, s.loading],
  )

  useEffect(() => {
    if (!places || !pendingTapRef.current) return
    const [lat, lon] = pendingTapRef.current
    pendingTapRef.current = null
    onMapPick(lat, lon)
  }, [places, onMapPick])

  const toggleMap = () => {
    ensureLoaded()
    setMapOpen((v) => !v)
  }

  // The prefill follows what the card shows: App.jsx reads it for every offer and question
  // button on this page (the header's, the hero's, the closing card's), not only ours.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const path = window.location.pathname
    if (quote || noMatch) {
      const args = { product, place: picked, quote, query, locale, s }
      writeConfiguratorPrefill({
        source: 'delivery-calculator',
        sourcePath: path,
        modelLabel: s.products?.[product] || product,
        knownTotal: 0,
        offerText: buildOfferText(args),
        questionText: buildQuestionText(args),
        updatedAt: Date.now(),
      })
    } else if (readConfiguratorPrefill(path)?.source === 'delivery-calculator') {
      try {
        window.sessionStorage.removeItem(CONFIG_PREFILL_KEY)
      } catch {
        // storage unavailable: nothing was kept to remove
      }
    }
  }, [product, picked, quote, noMatch, query, locale, s])

  const sendEnquiry = () => {
    trackEvent('delivery_enquiry', { product, kmBand: picked ? kmBand(quote.oneWayKm) : 'outside' })
    openOffer?.()
  }

  // The map's pins: the base the price is counted from and the place; before a pick, the
  // product's base(s).
  const mapPins = useMemo(() => {
    const base = (key) => ({ ...DELIVERY_BASES[key], kind: 'base', label: fill(s.map?.baseMarker, { base: s.bases?.[key] }) })
    if (!picked) return product === 'box' ? [base('marikostinovo'), base('varna')] : [base('marikostinovo')]
    const place = { lat: picked.lat, lon: picked.lon, kind: 'place', label: fill(s.map?.placeMarker, { place: displayName(picked, locale) }) }
    return quote?.base ? [base(quote.base), place] : [place]
  }, [picked, product, quote, locale, s])
  const mapLine =
    picked && quote?.base
      ? {
          from: [DELIVERY_BASES[quote.base].lat, DELIVERY_BASES[quote.base].lon],
          to: [picked.lat, picked.lon],
          label: fill(s.map?.line, { km: f.km }),
        }
      : null

  const pricesPath = paths.prices?.[locale] || paths.prices?.bg

  const countText = listShown
    ? suggestions.length === 1
      ? s.suggestionsCount?.one
      : fill(s.suggestionsCount?.many, { count: suggestions.length })
    : ''

  return (
    <section className="dc" aria-labelledby={ids.title}>
      <h2 id={ids.title} className="dc-title">{s.title}</h2>

      <fieldset className="dc-products">
        <legend className="dc-label">{s.productLegend}</legend>
        <div className="dc-chips">
          {PRODUCTS.map((p) => (
            <label key={p} className="dc-chip">
              <input
                type="radio"
                name={`${uid}-product`}
                value={p}
                checked={product === p}
                onChange={() => setProduct(p)}
              />
              <span>{s.products?.[p]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="dc-field">
        <label className="dc-label" htmlFor={ids.input}>{s.placeLabel}</label>
        <div className="dc-combo">
          <input
            id={ids.input}
            className="dc-input"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={listShown}
            aria-controls={ids.list}
            aria-activedescendant={listShown && active >= 0 ? ids.option(active) : undefined}
            aria-describedby={ids.hint}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={s.placeholder}
            value={query}
            onFocus={ensureLoaded}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
          />
          <ul id={ids.list} role="listbox" aria-label={s.suggestionsLabel} className="dc-list" hidden={!listShown}>
            {listShown
              ? suggestions.map((x, i) => (
                  <li
                    key={`${x.place.country}-${x.place.name}-${x.place.lat}-${x.place.lon}`}
                    id={ids.option(i)}
                    role="option"
                    aria-selected={i === active}
                    className="dc-option"
                    // mousedown, not click: the input's blur would close the list first.
                    onMouseDown={(e) => {
                      e.preventDefault()
                      pick(x.place)
                    }}
                    onMouseMove={() => setActive(i)}
                  >
                    <span className="dc-option-name">{x.name}</span>
                    {/* "Бургас, обл. Бургас" to a screen reader; the comma is drawn as a dot. */}
                    <span className="dc-option-region">
                      <span className="dc-sr">, </span>
                      {regionLine(x.place, locale, s)}
                    </span>
                  </li>
                ))
              : null}
          </ul>
        </div>
        <p id={ids.hint} className="dc-hint">
          {status === 'loading' ? <span className="dc-loading">{s.loading}</span> : s.placeHint}
        </p>
        {status === 'error' ? (
          <p className="dc-error" role="alert">
            {s.loadError}{' '}
            <button type="button" className="dc-link" onClick={ensureLoaded}>{s.retry}</button>
          </p>
        ) : null}
        <span className="dc-sr" aria-live="polite">{countText}</span>
      </div>

      {/* A group, not a landmark: aria-label needs a role to name, and a region here would be a
          second landmark inside the card's own section. */}
      <div className="dc-result" ref={resultRef} role="group" aria-live="polite" aria-label={s.resultLabel}>
        {noMatch ? (
          <div className="dc-outcome">
            <p className="dc-message">{s.noMatch}</p>
            <button type="button" className="hp-btn dc-cta" onClick={sendEnquiry}>{s.enquiryPlain}</button>
          </div>
        ) : null}

        {quote ? (
          <div className="dc-outcome">
            {/* No km for a custom house: its delivery is quoted with the project. */}
            {quote.status === 'onRequest' ? (
              <p className="dc-message">{s.onRequest}</p>
            ) : quote.status === 'priced' ? (
              <div className="dc-km">
                <p>{fill(s.distance, f)}</p>
                <p className="dc-km-math">{fill(s.billable, f)}</p>
                {quote.product === 'box' ? <p className="dc-km-base">{fill(s.boxBase, f)}</p> : null}
              </div>
            ) : null}

            {quote.status === 'priced' && quote.product === 'container' ? (
              <>
                <dl className="dc-sum">
                  <div className="dc-row dc-row--total">
                    <dt>
                      {s.container?.transportLabel}
                      <small>{fill(s.container?.transportMath, f)} · {s.container?.fixed}</small>
                    </dt>
                    <dd><Money>{f.transport}</Money></dd>
                  </div>
                </dl>
                <p className="dc-ok">{s.container?.assembly}</p>
                <div className="dc-choices">
                  <div className="dc-choice">
                    <h3>{s.container?.craneTitle}</h3>
                    <p>{fill(s.container?.crane, f)}</p>
                  </div>
                  <div className="dc-choice">
                    <h3>{s.container?.noCraneTitle}</h3>
                    <p>{fill(s.container?.noCrane, f)}</p>
                  </div>
                </div>
              </>
            ) : null}

            {quote.status === 'priced' && quote.product === 'box' ? (
              <>
                <dl className="dc-sum">
                  {/* Varna itself is 1 km from its base: the truck rounds to 0 € in tens, so
                      there is no "около 0 €" row and the total is the crane (as the page's table). */}
                  {quote.transport > 0 ? (
                    <div className="dc-row">
                      <dt>
                        {s.box?.transportLabel}
                        <small>{fill(s.box?.transportMath, f)}</small>
                      </dt>
                      <dd><Money>{fill(s.box?.about, { amount: f.transport })}</Money></dd>
                    </div>
                  ) : null}
                  <div className="dc-row">
                    <dt>
                      {s.box?.craneLabel}
                      <small>{s.box?.craneNote}</small>
                    </dt>
                    <dd><Money>{fill(s.box?.about, { amount: f.crane })}</Money></dd>
                  </div>
                  <div className="dc-row dc-row--total">
                    <dt>
                      {s.box?.totalLabel}
                      <small>{s.vat}</small>
                    </dt>
                    <dd><Money>{fill(s.box?.about, { amount: f.total })}</Money></dd>
                  </div>
                </dl>
                <p className="dc-warn">{s.box?.noCrane}</p>
                <p className="dc-ok">{s.box?.included}</p>
                <p className="dc-extra">
                  {s.box?.assembly}{' '}
                  {pricesPath ? <Link to={pricesPath}>{s.box?.assemblyLink}</Link> : null}
                </p>
              </>
            ) : null}

            {quote.status === 'quote' ? <p className="dc-ok">{s.project?.text}</p> : null}

            <ul className="dc-notes">
              {/* "An estimate, by road": only where there is a figure to qualify. */}
              {quote.status === 'priced' ? <li>{s.notes?.approx}</li> : null}
              <li>{s.notes?.several}</li>
              <li>{s.notes?.foundation}</li>
            </ul>

            <button type="button" className="hp-btn dc-cta" onClick={sendEnquiry}>{s.enquiry}</button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="dc-map-toggle"
        aria-expanded={mapOpen}
        aria-controls={ids.map}
        onClick={toggleMap}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>
        {mapOpen ? s.map?.hide : s.map?.show}
      </button>
      <div id={ids.map} hidden={!mapOpen}>
        {mapOpen ? (
          <>
            <Suspense fallback={<p className="dc-hint dc-map-wait">{s.map?.loading}</p>}>
              <DeliveryMap pins={mapPins} line={mapLine} onPick={onMapPick} text={s.map} />
            </Suspense>
            <p className="dc-hint" aria-live="polite">{mapNote || s.map?.hint}</p>
          </>
        ) : null}
      </div>

      {/* ODbL: the names and km above are OpenStreetMap data, credited before any pick and
          whether or not the map (whose own attribution names OSM too) is ever opened. */}
      <p className="dc-credit">
        {s.notes?.data} (<a href={ODBL_URL} target="_blank" rel="noopener noreferrer">ODbL</a>)
      </p>
    </section>
  )
}
