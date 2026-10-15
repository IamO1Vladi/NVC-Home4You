// The delivery calculator's arithmetic and the enquiry text, with no React, so the tests can
// pin both without rendering. Every figure comes from deliveryRates.js; every word from the
// page's content.calculator (see the key list at the top of DeliveryCalculator.jsx).
//
// THE ARITHMETIC SHOWN IS THE ARITHMETIC BILLED. The one-way road km is rounded first and the
// billable km is exactly twice that, so "174 км × 2 = 348 км" and "348 × 1 € = 348 €" can be
// checked by the visitor with a pencil. The old estimator printed 176,57 km one way beside
// 353,15 km billable.

import { DELIVERY_RATES } from '../../content/shared/deliveryRates.js'
import { distanceFor, displayName, displayRegion } from '../../lib/deliveryPlaces.js'
import { euro } from '../../lib/euro.js'

export const PRODUCTS = Object.freeze(['container', 'box', 'project'])

const NUMBER_LOCALES = { bg: 'bg-BG', en: 'en-GB', el: 'el-GR' }

/** "{a} and {b}" → values; a placeholder with no value is left as written, so a gap shows in review. */
export function fill(template, values = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (m, k) => (values[k] == null ? m : String(values[k])))
}

/** "1 234 км" in the page's own digits grouping. */
export function formatKm(km, locale, unit) {
  const n = new Intl.NumberFormat(NUMBER_LOCALES[locale] || 'en-GB', { maximumFractionDigits: 0 }).format(km)
  return `${n} ${unit}`
}

// The Box house's transport is an estimate, so it is shown in tens: "около 700 €", not 696.
const toTens = (n) => Math.round(n / 10) * 10

/**
 * What delivery to one place costs for one product.
 * @returns {{
 *   product: string, status: 'priced'|'quote'|'onRequest', base: string|null,
 *   oneWayKm: number|null, billableKm: number|null,
 *   transport?: number, crane?: number, total?: number, travelMax?: number, nights?: string,
 * }}
 *   status 'priced' carries the money; 'quote' (a custom house) nothing: no base and no km,
 *   because the owner quotes that delivery with the project and bills nothing per km;
 *   'onRequest' none (an island the road network cannot reach, or a place with no route at all).
 */
export function quoteFor(product, place) {
  const rates = DELIVERY_RATES.products
  if (product === 'project') return { product, status: 'quote', base: null, oneWayKm: null, billableKm: null }
  const { km, base } = distanceFor(place, product)
  if (km == null) return { product, status: 'onRequest', base: null, oneWayKm: null, billableKm: null }
  const oneWayKm = Math.round(km)
  const billableKm = oneWayKm * 2
  if (product === 'box') {
    const transport = toTens(billableKm * rates.box.perKm)
    const crane = rates.box.crane.about
    return { product, status: 'priced', base, oneWayKm, billableKm, transport, crane, total: transport + crane }
  }
  const c = rates.container
  return {
    product: 'container',
    status: 'priced',
    base,
    oneWayKm,
    billableKm,
    // A fixed rate: whole euros, exact.
    transport: Math.round(billableKm * c.perKm),
    crane: c.crane.about,
    travelMax: c.noCrane.travelMax,
    nights: c.noCrane.nights,
  }
}

/** A coarse distance band for analytics. The place itself is never recorded. */
export function kmBand(oneWayKm) {
  if (oneWayKm == null) return 'on-request'
  if (oneWayKm < 100) return '0-99'
  if (oneWayKm < 200) return '100-199'
  if (oneWayKm < 400) return '200-399'
  return '400+'
}

// The country a page's readers live in: its places need no country after them.
const HOME_COUNTRY = { bg: 'BG', el: 'GR' }

/** The region as the page words it: "обл. Бургас", "Burgas Province", "Π.Ε. Θεσσαλονίκης". */
export function regionText(place, locale, s) {
  const region = displayRegion(place, locale)
  return region ? fill(s.region?.[place.country] || '{region}', { region }) : ''
}

/**
 * The grey line beside a suggestion: the region, and the country when it is not the reader's
 * own ("обл. Бургас"; "Π.Ε. Καβάλας, Гърция" on the Bulgarian page; always on the English one).
 */
export function regionLine(place, locale, s) {
  const country = place.country === HOME_COUNTRY[locale] ? '' : s.countries?.[place.country] || place.country
  return [regionText(place, locale, s), country].filter(Boolean).join(', ')
}

/** The money and km, formatted for one locale, that both the card and the enquiry text print. */
export function formatQuote(q, locale, s) {
  const money = (v) => euro(v, locale)
  return {
    km: q.oneWayKm == null ? '' : formatKm(q.oneWayKm, locale, s.km),
    billable: q.billableKm == null ? '' : formatKm(q.billableKm, locale, s.km),
    from: q.base ? s.fromBase?.[q.base] || '' : '',
    rate: money(DELIVERY_RATES.products[q.product]?.perKm ?? 0),
    transport: q.transport == null ? '' : money(q.transport),
    crane: q.crane == null ? '' : money(q.crane),
    total: q.total == null ? '' : money(q.total),
    travel: q.travelMax == null ? '' : money(q.travelMax),
    nights: q.nights || '',
  }
}

/**
 * The enquiry's message: product, place, region, country, km one way and billable, and the
 * figures, marked approximate and without VAT. A salesperson reads it in the lead as it is.
 * `query` is what the visitor typed when no place matched (they are sending it themselves).
 */
export function buildOfferText({ product, place, quote, query = '', locale, s }) {
  const o = s.offer || {}
  const productLabel = s.products?.[product] || product
  const lines = [o.heading, '']
  lines.push(`${o.product}: ${productLabel}`)
  if (!place) {
    lines.push(`${o.place}: ${query.trim()}`)
    lines.push(o.outside)
    return lines.join('\n')
  }
  const name = displayName(place, locale)
  const country = s.countries?.[place.country] || place.country
  lines.push(`${o.place}: ${[name, regionText(place, locale, s), country].filter(Boolean).join(', ')}`)
  if (quote.status === 'onRequest') {
    lines.push(`${o.distance}: ${o.onRequest}`)
  } else if (quote.status === 'quote') {
    // A custom house: no distance and nothing per km, only that the project quote carries it.
    lines.push(o.project)
  } else {
    const f = formatQuote(quote, locale, s)
    lines.push(`${o.distance}: ${fill(o.distanceValue, f)}`)
    if (quote.product === 'container') {
      lines.push(`${o.transport}: ${f.transport} (${fill(s.container.transportMath, f)})`)
      lines.push(`${o.crane}: ${fill(o.craneOptional, f)}`)
      lines.push(fill(o.noCraneTravel, f))
    } else if (quote.product === 'box') {
      // No "около 0 €" line for a place at the base's door (Varna): the card leaves it out too.
      if (quote.transport > 0) lines.push(`${o.transport}: ${fill(s.box.about, { amount: f.transport })} (${fill(s.box.transportMath, f)})`)
      lines.push(`${o.crane}: ${fill(s.box.about, { amount: f.crane })}`)
      lines.push(`${o.total}: ${fill(s.box.about, { amount: f.total })}`)
    }
  }
  // "All amounts excl. VAT" only under amounts.
  if (quote.status === 'priced') lines.push('', o.footer)
  return lines.join('\n')
}

/** The shorter line the "ask a question" form opens with. */
export function buildQuestionText({ product, place, quote, query = '', locale, s }) {
  const o = s.offer || {}
  const productLabel = s.products?.[product] || product
  if (!place) return fill(o.questionOutside, { product: productLabel, place: query.trim() })
  const values = { product: productLabel, place: displayName(place, locale) }
  if (quote.oneWayKm == null) return fill(o.questionOnRequest, values)
  return fill(o.question, { ...values, km: formatQuote(quote, locale, s).km })
}
