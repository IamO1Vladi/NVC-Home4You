// The FAQ hub (/bg/chesto-zadavani-vyprosi, /en/faq, /el/syxnes-erotiseis): its topics, its own
// questions filled with their figures, and the questions it GATHERS from the delivery, partner,
// internal doors and interiors pages (lib/questions.js) and from the three product pages
// (lib/productQuestions.js), each answer written once.
//
// The hub's own questions are content/{bg,en,el}/faq.js `items`: each has an `id` (the same in
// all three languages), a `topic` (a key of HUB_TOPICS) and words with {placeholders} that
// hubFigures() fills from the modules: the cheapest Box house assembly from prices.js, the
// payment terms and the financing from company.js (as is the company's year, homes and VAT
// number), the roof insulation from insulation.js, the warranty's years from warranty.js, the
// opening hours from the home content's contact band (the footer's source), the foundation tip
// from pricesCopy.js and the partner thresholds from partnerTerms.js. Nothing is typed.
//
// Only the hub's own questions are its FAQPage markup (markup: true, which FAQPage.jsx passes
// through markedUp()); a gathered question is shown
// here and marked up on its own page. Where a page already answers a question (the delivery
// page's crane and lead time, the containers page's kitchen), the hub shows that page's answer
// rather than a copy of its own, and an id the hub answers itself (the warranty) is not gathered
// a second time.
import { euro } from './euro.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { PARTNER_MIN_UNITS } from '../content/shared/partnerTerms.js'
import { COMPANY, FINANCING, PAYMENT_TERMS } from '../content/shared/company.js'
import { INSULATION } from '../content/shared/insulation.js'
import { boxAssemblyFromNet } from '../content/shared/prices.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'
import { getHomeContent } from '../content/home/index.js'
import { paths } from '../routes/paths.js'
import { GATHERED_PAGES, fill, pageQuestions } from './questions.js'
import { PRODUCT_PAGES, productQuestions } from './productQuestions.js'

/**
 * The hub's topics, in order: the page each one ends with a link to (a key of paths.js, and
 * the section on it), the page whose questions it gathers, and gathered questions it shows
 * although they belong to another page (the doors page's "can a container buyer choose these
 * doors?" sits with the containers; the doors topic does not repeat it), and gathered questions
 * it leaves out because another topic already answers them for everyone (`omit`). Labels and
 * link words are faq.js `topics[key]`.
 */
export const HUB_TOPICS = [
  { key: 'buying', page: 'prices' },
  { key: 'containers', page: 'modularBuilds', gather: 'modularBuilds', also: ['doors-for-containers'] },
  { key: 'box', page: 'modularHouses', gather: 'modularHouses' },
  { key: 'steel', page: 'steelHouses', gather: 'steelHouses' },
  { key: 'delivery', page: 'delivery', gather: 'delivery' },
  { key: 'warranty', page: 'about', hash: 'in-writing' },
  { key: 'company', page: 'about', hash: 'who' },
  // Not the partner page's lead time and customs: the same facts as the delivery page's lead time
  // and the hub's customs answer, a few lines above.
  { key: 'partners', page: 'partner', gather: 'partner', omit: ['partner-lead-time', 'partner-customs'] },
  { key: 'doors', page: 'doors', gather: 'doors' },
  { key: 'renovations', page: 'interiors', gather: 'interiors' },
]

/** paths.js key (+ section) -> this locale's path. */
export function hubPath(locale, pathKey, hash) {
  const path = paths[pathKey]?.[locale] || paths[pathKey]?.en
  if (!path) return null
  return hash ? `${path}#${hash}` : path
}

/** Every figure the hub's own answers and its sibling cards name, formatted for one locale. */
export function hubFigures(locale = 'en') {
  const money = (value) => euro(value, locale)
  const home = getHomeContent(locale)?.home || {}
  return {
    // The cheapest assembly of any Box house, without VAT (the 37 m² one's); the capsule has none.
    boxAssembly: money(boxAssemblyFromNet()),
    atOrder: PAYMENT_TERMS.atOrderPercent,
    afterDelivery: PAYMENT_TERMS.afterDeliveryPercent,
    financing: money(FINANCING.upToEuro),
    bank: FINANCING.bank[locale] || FINANCING.bank.en,
    boxRoofMm: INSULATION.boxRoofRockWoolMm,
    structureYears: WARRANTY_YEARS.structure,
    panelYears: WARRANTY_YEARS.panels,
    joineryYears: WARRANTY_YEARS.joinery,
    sanitaryYears: WARRANTY_YEARS.sanitary,
    hours: String(home.band?.hours || '').trim() || null,
    homes: COMPANY.homesDelivered,
    vat: COMPANY.vatID,
    founded: COMPANY.foundingYear,
    foundationNote: getPricesCopy(locale).foundationNote,
    containerMin: PARTNER_MIN_UNITS.container,
    boxMin: PARTNER_MIN_UNITS.box,
  }
}

/** The hub's own questions, filled: [{ id, topic, question, answer, link, markup: true }]. */
export function hubQuestions(content, locale = 'en') {
  const v = hubFigures(locale)
  return (content?.items || [])
    .filter((item) => item && item.id && item.q && item.a)
    .map((item) => ({
      id: item.id,
      topic: item.topic,
      question: item.q,
      answer: fill(item.a, v),
      link: item.link ? { to: hubPath(locale, item.link.pathKey, item.link.hash), label: item.link.label } : null,
      markup: true,
    }))
}

/** The pages the hub gathers from, in its order: the four (questions.js), then the products. */
export const HUB_PAGES = [...GATHERED_PAGES, ...PRODUCT_PAGES]

/**
 * The questions the hub gathers from the seven pages, each filled as its page fills it, minus
 * any id the hub answers itself. Never marked up here. A product page's item that is another
 * page's question (the containers page's doors question, `ref`) is gathered from that page.
 *
 * @param pages  { delivery, partner, doors, interiors, modularBuilds, modularHouses,
 *               steelHouses }: those pages' content for the locale
 */
export function gatheredQuestions(locale, pages = {}, ownIds = new Set()) {
  const questionsOf = (page) => (PRODUCT_PAGES.includes(page)
    ? productQuestions(page, pages[page], locale).filter((item) => !item.ref)
    : pageQuestions(page, pages[page], locale))
  return Object.fromEntries(HUB_PAGES.map((page) => [
    page,
    questionsOf(page)
      .filter((item) => item.id && !ownIds.has(item.id))
      .map((item) => ({ ...item, markup: false, from: page })),
  ]))
}

/**
 * The hub as it is drawn: one section per topic that has a question, in HUB_TOPICS' order:
 * [{ key, label, link: { to, label }, items }]. A topic that gathers a page lists that page's
 * questions first (the containers page's, then the doors page's container question; the delivery
 * page's six, then the hub's own on customs, the foundation, unloading and insurance); questions
 * borrowed with `also` come after the topic's own.
 */
export function hubSections(locale, content, pages = {}) {
  const own = hubQuestions(content, locale)
  const gathered = gatheredQuestions(locale, pages, new Set(own.map((item) => item.id)))
  const byId = new Map(Object.values(gathered).flat().map((item) => [item.id, item]))
  const borrowed = new Set(HUB_TOPICS.flatMap((topic) => topic.also || []))

  return HUB_TOPICS.map((topic) => {
    const words = content?.topics?.[topic.key] || {}
    const omitted = new Set(topic.omit || [])
    const fromPage = topic.gather ? gathered[topic.gather].filter((item) => !borrowed.has(item.id) && !omitted.has(item.id)) : []
    const also = (topic.also || []).map((id) => byId.get(id)).filter(Boolean)
    const to = hubPath(locale, topic.page, topic.hash)
    return {
      key: topic.key,
      label: words.label || topic.key,
      link: to && words.link ? { to, label: words.link } : null,
      items: [...fromPage, ...own.filter((item) => item.topic === topic.key), ...also],
    }
  }).filter((section) => section.items.length)
}
