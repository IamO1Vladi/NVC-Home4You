// The questions four pages answer (delivery, partner, internal doors, interiors), filled with
// their figures exactly as each page prints them, so the FAQ hub can GATHER them instead of
// keeping copies of its own. Each answer is written once, in its page's content file
// (content/{bg,en,el}/{delivery,partner,internalDoors,interiors}.js, `faq.items`), with a
// stable ASCII `id` that is the same in all three languages: the page and the hub both render
// it as <details id="q-{id}">, so /bg/chesto-zadavani-vyprosi#q-delivery-crane and
// /bg/dostavka-do-vratata#q-delivery-crane open the same answer.
//
// LIGHT ON PURPOSE. Only the figure modules (deliveryRates.js, partnerTerms.js, warranty.js) and
// euro(): no page component and no configurator catalogue, so the partner page and the FAQ hub
// can import it without the delivery calculator, the 3D house or the catalogue coming along.
// The delivery page's "assembly from" figure needs the catalogue (prices.js), so the page adds
// it itself (DeliveryPage.jsx figures()); no delivery question names it, and
// questions.test.js fails if a gathered answer is left with a {placeholder}.
//
// FAQPage markup: one question, marked up on one URL per language. A page marks up its own
// questions, except an item whose `markup` names another page that answers it too, so this
// page shows it and does not mark it up: the partner page's warranty and customs questions are
// the hub's (`markup: 'faq'`) and its lead time is the delivery page's (`markup: 'delivery'`).
// questions.test.js holds every id, and every question's wording, to one marked-up copy per
// language.
import { euro } from './euro.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { PARTNER_MIN_UNITS } from '../content/shared/partnerTerms.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'

const CONTAINER = DELIVERY_RATES.products.container
const BOX = DELIVERY_RATES.products.box

/** The pages whose questions the hub gathers, in the hub's order. */
export const GATHERED_PAGES = ['delivery', 'partner', 'doors', 'interiors']

/** "{name}" -> values.name; a name with no value is left as it is, so a test can see it. */
export const fill = (pattern, values = {}) => String(pattern ?? '').replace(
  /\{(\w+)\}/g,
  (m, key) => (values[key] == null ? m : String(values[key])),
)

/** What a page may show: everything not waiting for the owner's answer. */
export const shown = (list) => (list || []).filter((item) => item && !item.pending)

/**
 * The delivery page's figures, formatted for one locale: the rates, the crane, the workers'
 * nights and travel, the lead times (deliveryRates.js). The page adds `assembly`.
 */
export function deliveryFigures(locale) {
  const money = (value) => euro(value, locale)
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
  }
}

/** The partner page's figures: the thresholds, the delivery figures and the warranty's years. */
export function partnerFigures(locale) {
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

const FIGURES = { delivery: deliveryFigures, partner: partnerFigures }

/**
 * A page's questions as the page prints them: [{ id, question, answer, markup }], in the
 * content's order, without anything `pending` or missing its words. `markup` is true where
 * this page publishes the question as FAQPage markup.
 *
 * @param page     'delivery' | 'partner' | 'doors' | 'interiors'
 * @param content  that page's content for the locale (the object with `faq.items`)
 */
export function pageQuestions(page, content, locale = 'en') {
  const values = FIGURES[page] ? FIGURES[page](locale) : {}
  return shown(content?.faq?.items)
    .filter((item) => item.q && item.a)
    .map((item) => ({
      id: item.id,
      question: item.q,
      answer: fill(item.a, values),
      markup: !item.markup || item.markup === page,
    }))
}

/** The questions FAQJSONLD publishes: the marked-up ones, as { question, answer }. */
export const markedUp = (questions) => (questions || [])
  .filter((item) => item.markup)
  .map(({ question, answer }) => ({ question, answer }))

/** "#q-delivery-crane" -> "delivery-crane"; anything else -> null. */
export function questionFromHash(hash) {
  const match = /^#q-([a-z0-9][a-z0-9-]*)$/.exec(String(hash || ''))
  return match ? match[1] : null
}
