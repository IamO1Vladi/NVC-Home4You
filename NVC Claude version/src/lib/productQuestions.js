// The questions the three product pages answer (containers, Box houses with the capsule, steel-
// frame houses), filled with their figures, so each page prints its own "Въпроси" section and the
// FAQ hub GATHERS them under its product topics instead of keeping copies (Stage 2, 2026-10-17).
//
// Each answer is written once, in its page's content file (content/{bg,en,el}/{modularBuilds,
// modularHouses,steelHouses}.js, `faq.items`), with a stable ASCII `id`, the same in all three
// languages, that the page and the hub both render as <details id="q-{id}">. A question is
// FAQPage markup on its product page only; the hub shows it without markup (lib/faqHub.js).
//
// An item may also be another page's question, shown here as that page words it: `from: 'doors'`
// names the internal doors page, which answers "can a container buyer choose your doors?" and
// marks it up. The page passes that page's content as `related` (the route imports it), and the
// question is drawn here without markup, so it is still marked up once.
//
// NOT LIGHT, unlike lib/questions.js: the Box house figures come from the configurator catalogue
// and prices.js. Only the three product pages and the FAQ hub import this, and all of them load
// the catalogue already.
//
// Every figure is a {placeholder} filled from a module: deliveryRates.js (the crane, the lead
// times), prices.js (the container's assembly share, the 18 m² house's assembly, who assembles a
// Box house and how long it takes, the architectural project), the configurator catalogue (the
// bathroom and kitchen choices, the standard terrace, the layouts). Nothing is typed in the copy.
import { euro } from './euro.js'
import { fill, pageQuestions, shown } from './questions.js'
import { paths } from '../routes/paths.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import {
  ARCHITECT_PROJECT_EUR,
  BOX_ASSEMBLY_CREW,
  VAT_RATE,
  WAGON_ASSEMBLY_GROSS,
  boxAssemblyNet,
} from '../content/shared/prices.js'
import { getBoxConfiguratorCatalog } from '../content/shared/boxConfiguratorCatalog.js'

/** The product pages, in the hub's order, and the hub topic each one's questions sit under. */
export const PRODUCT_PAGES = ['modularBuilds', 'modularHouses', 'steelHouses']
export const PRODUCT_TOPIC = { modularBuilds: 'containers', modularHouses: 'box', steelHouses: 'steel' }

// The 18 m² Box house (served as 100000 + its SQL id, like every house added in the admin panel).
export const SMALL_BOX_ID = 100016

const BOX = DELIVERY_RATES.products.box
const LIST_LOCALES = { bg: 'bg', en: 'en-GB', el: 'el' }
// A small count of people, as the copy says it ("двама наши работници", "two of our workers",
// "δύο τεχνικοί μας"); any other number is printed as digits.
const PEOPLE = { bg: { 2: 'двама' }, en: { 2: 'two' }, el: { 2: 'δύο' } }

/** paths.js key (+ section) -> this locale's path. */
function pathOf(locale, pathKey, hash) {
  const path = paths[pathKey]?.[locale] || paths[pathKey]?.en
  if (!path) return null
  return hash ? `${path}#${hash}` : path
}

/** The hub's section for a product page's questions: the "Още въпроси →" link under them. */
export function hubTopicPath(page, locale = 'en') {
  return pathOf(locale, 'faq', `t-${PRODUCT_TOPIC[page]}`)
}

/** Every figure a product page's questions name, formatted for one locale. */
export function productFigures(page, locale = 'en') {
  const money = (value) => euro(value, locale)
  if (page === 'modularBuilds') {
    return {
      // Of a container's price, VAT included, this much is the assembly.
      containerAssembly: money(WAGON_ASSEMBLY_GROSS),
      days: LEAD_TIMES.containerInStockDays,
      madeToOrderMonths: LEAD_TIMES.containerMadeToOrderMonths,
    }
  }
  if (page === 'modularHouses') {
    const catalogue = getBoxConfiguratorCatalog(locale)
    const kitchens = catalogue.kitchenOptions || []
    const terrace = (catalogue.terraceOptions || []).find((option) => option.key === 'standard')
    const areas = (catalogue.models || []).map((model) => String(model.area))
    const small = boxAssemblyNet(SMALL_BOX_ID)
    const { workers, days } = BOX_ASSEMBLY_CREW
    return {
      // The catalogue's models (37, 58 and 73 m²): the ones the configurator builds.
      areas: areas.length ? new Intl.ListFormat(LIST_LOCALES[locale] || 'en-GB', { type: 'conjunction' }).format(areas) : null,
      bathrooms: (catalogue.bathroomOptions || []).length,
      kitchens: kitchens.filter((option) => !option.price).length,
      kitchensExtra: kitchens.filter((option) => option.price > 0).length,
      terrace: terrace ? (locale === 'bg' ? terrace.note.replace(/mm$/, 'мм') : terrace.note) : null,
      layouts: (catalogue.models || []).reduce((n, model) => n + (model.plans?.length || 0), 0) || null,
      boxCrane: money(BOX.crane.about),
      workers: PEOPLE[locale]?.[workers] || String(workers),
      assemblyDays: days,
      // The 18 m² house's assembly, without VAT as the owner gave it, and with it, as its card
      // prints it.
      smallAssembly: small == null ? null : money(small),
      smallAssemblyGross: small == null ? null : money(Math.round(small * (1 + VAT_RATE))),
      production: LEAD_TIMES.boxProductionDays,
      months: LEAD_TIMES.boxToAddressMonths,
    }
  }
  if (page === 'steelHouses') {
    return { projectFee: money(ARCHITECT_PROJECT_EUR) }
  }
  return {}
}

/**
 * A product page's questions as the page prints them: [{ id, question, answer, link, markup }],
 * in the content's order, without anything `pending` or missing its words. `link` is
 * { to, label } or null (the hub draws it under the answer). An item `from` another page is that
 * page's question, filled as that page fills it, with `ref` naming the page and markup false;
 * it is left out when `related` does not carry that page.
 *
 * @param page     'modularBuilds' | 'modularHouses' | 'steelHouses'
 * @param content  that page's content for the locale (the object with `faq.items`)
 * @param related  { doors }: the content of a page an item is `from`, for the locale
 */
export function productQuestions(page, content, locale = 'en', related = {}) {
  const values = productFigures(page, locale)
  return shown(content?.faq?.items).flatMap((item) => {
    if (item.from) {
      const theirs = pageQuestions(item.from, related?.[item.from], locale).find((q) => q.id === item.id)
      return theirs ? [{ ...theirs, link: null, markup: false, ref: item.from }] : []
    }
    if (!item.q || !item.a) return []
    return [{
      id: item.id,
      question: item.q,
      answer: fill(item.a, values),
      link: item.link ? { to: pathOf(locale, item.link.pathKey, item.link.hash), label: item.link.label } : null,
      markup: true,
    }]
  })
}
