import { describe, expect, it } from 'vitest'

import { DELIVERY_RATES, LEAD_TIMES } from './shared/deliveryRates.js'
import { euro } from '../lib/euro.js'
import { getPricesCopy } from './shared/pricesCopy.js'
import { hubSections } from '../lib/faqHub.js'

// The owner's delivery answers of 2026-10-15, held to every word the site prints. Until then
// the estimator charged 0.80 €/km for everything, the containers page promised a three-night
// build, and nothing said the crane or the delivery came without VAT, although every house
// and container price on the site includes it.

// Every content module in the three languages, tests excluded.
const MODULES = import.meta.glob(['./{bg,en,el}/*.js', '!./**/*.test.js'], { eager: true })
const LOCALES = ['bg', 'en', 'el']

/** Every [dotted path, string] in a value. */
function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

// Not i18n/translations.js: no page prints its strings (every useI18n() caller takes only
// lang and setLang, never t or dict), and the old FAQ blocks it carried, the delivery one
// among them, were deleted on 2026-10-16.
const EVERY_STRING = [
  ...Object.entries(MODULES).flatMap(([file, mod]) => strings(mod, file)),
  ...LOCALES.flatMap((locale) => strings(getPricesCopy(locale), `pricesCopy.${locale}`)),
]

const content = (locale, name) => MODULES[`./${locale}/${name}.js`].default

// The FAQ hub's questions as it shows them, filled: its own (faq.js) and the ones it gathers
// from the four pages. Since 2026-10-16 the hub's crane, crane-free and lead-time answers are
// the delivery page's own (one answer, written once), so the checks below read them here.
const PAGE_FILES = { delivery: 'delivery', partner: 'partner', doors: 'internalDoors', interiors: 'interiors' }
const hub = (locale) => hubSections(
  locale,
  content(locale, 'faq'),
  Object.fromEntries(Object.entries(PAGE_FILES).map(([page, name]) => [page, content(locale, name)])),
).flatMap((section) => section.items)
const hubAnswer = (locale, id) => hub(locale).find((item) => item.id === id)
const VAT = { bg: /без ДДС/, en: /excl\. VAT|exclude VAT/, el: /χωρίς ΦΠΑ|δεν περιλαμβάνουν ΦΠΑ/ }

describe('delivery facts across the content', () => {
  it('reads every content file in the three languages', () => {
    // A glob that silently matched nothing would make the checks below pass on nothing.
    for (const locale of LOCALES) {
      for (const name of ['delivery', 'faq', 'modularBuilds', 'modularHouses']) {
        expect(MODULES[`./${locale}/${name}.js`], `${locale}/${name}.js`).toBeDefined()
      }
    }
  })

  it('quotes the old 0.80 €/km nowhere', () => {
    const OLD_RATE = /\b0[.,]80?\s*(€|EUR|евро|ευρώ)|€\s?0[.,]80?\b/i
    expect(EVERY_STRING.filter(([, text]) => OLD_RATE.test(text))).toEqual([])
  })

  it('promises a three-night container build nowhere: the owner says 3–4 nights', () => {
    const OLD_NIGHTS = /три нощи|three nights|τρεις νύχτες|τρία βράδια/i
    expect(EVERY_STRING.filter(([, text]) => OLD_NIGHTS.test(text))).toEqual([])
    expect(DELIVERY_RATES.products.container.noCrane.nights).toBe('3–4')
  })

  it.each(LOCALES)('%s: every sentence that quotes a delivery or crane figure says it is without VAT', (locale) => {
    const faqCrane = hubAnswer(locale, 'delivery-crane')
    expect(faqCrane, 'the FAQ crane answer').toBeDefined()
    expect(faqCrane.answer).toContain(euro(DELIVERY_RATES.products.box.crane.about, locale))

    const prices = getPricesCopy(locale)
    const quoting = [
      content(locale, 'modularBuilds').assembly.crane,
      content(locale, 'modularBuilds').assembly.noCrane,
      content(locale, 'modularBuilds').assembly.delivery,
      content(locale, 'modularHouses').arrival.delivery,
      // The delivery page words its figures as {placeholders} filled from deliveryRates.js.
      content(locale, 'delivery').hero.facts.container,
      content(locale, 'delivery').hero.facts.box,
      ...content(locale, 'delivery').included.cards.container.lines.filter((l) => /\{(containerRate|containerCrane|travel)\}/.test(l.text)).map((l) => l.text),
      ...content(locale, 'delivery').included.cards.box.lines.filter((l) => /\{(boxRate|boxCrane|assembly)\}/.test(l.text)).map((l) => l.text),
      ...content(locale, 'delivery').faq.items.filter((i) => /\{(containerRate|boxRate|boxCrane|containerCrane|travel)\}/.test(i.a)).map((i) => i.a),
      content(locale, 'delivery').calculator.vat,
      faqCrane.answer,
      // The hub's own answers that name a delivery or crane figure (Box assembly's crane).
      ...content(locale, 'faq').items.filter((i) => /\{(containerRate|boxRate|boxCrane|containerCrane|travel)\}/.test(i.a)).map((i) => i.a),
      ...prices.excluded.filter((line) => line.includes('€')),
    ]
    // The crane line and the delivery line in the prices list.
    expect(prices.excluded.filter((line) => line.includes('€'))).toHaveLength(2)
    for (const text of quoting) expect(text).toMatch(VAT[locale])
  })

  it.each(LOCALES)('%s: the prices list says the crane is required for a Box house and a choice for a container', (locale) => {
    const [crane, , delivery] = getPricesCopy(locale).excluded
    const { container, box } = DELIVERY_RATES.products
    expect(crane).toContain(euro(box.crane.about, locale))
    expect(crane).toContain(euro(container.crane.about, locale))
    expect(delivery).toContain(euro(container.perKm, locale))
    expect(delivery).toContain(euro(box.perKm, locale))
    expect(crane + delivery).not.toMatch(/\{\w+\}/)
  })

  // The owner (2026-10-15): customs is ours, for everything we deliver; for a Box house the sea
  // freight and customs are already in the house price. Until 2026-10-16 the FAQ answered
  // "declarations, duties and compliance", which went beyond his words.
  it.each(LOCALES)("%s: the customs answer is the owner's, in the About page's and the delivery page's words", (locale) => {
    const EVERYTHING = { bg: 'за всичко, което доставяме', en: 'for everything we deliver', el: 'για ό,τι παραδίδουμε' }[locale]
    const IN_PRICE = { bg: 'митницата вече са в цената на къщата', en: 'customs are already in the house price', el: 'εκτελωνισμός περιλαμβάνονται ήδη στην τιμή του σπιτιού' }[locale]
    const customs = hubAnswer(locale, 'customs')
    expect(customs.markup).toBe(true)
    expect(customs.answer).toContain(EVERYTHING)
    expect(customs.answer).toContain(IN_PRICE)
    expect(content(locale, 'about').inWriting.terms.find((t) => t.key === 'customs').text).toContain(EVERYTHING)
    expect(content(locale, 'delivery').calculator.box.included).toContain(IN_PRICE)
    expect(customs.answer).not.toMatch(/декларации|такси|съответствие|declarations|duties|compliance|διασαφήσεις|δασμούς|συμμόρφωση/i)
    // The owner, 2026-10-17: customs is in the container price and in the steel-house quote too.
    const INCLUDED = {
      bg: 'Митницата е включена в цената на контейнерите и в офертата за къща със стоманена конструкция',
      en: 'Customs clearance is included in the container prices and in the quote for a steel-frame house',
      el: 'Ο εκτελωνισμός περιλαμβάνεται στην τιμή των κοντέινερ και στην προσφορά για σπίτι με μεταλλικό σκελετό',
    }[locale]
    expect(customs.answer).toContain(INCLUDED)
    // And no page says customs is paid on top.
    const EXTRA = /митниц[^.]*(отделно|не е включен|не са включен|за ваша сметка|допълнително)|customs[^.]*(extra|separately|not included|on top|at your cost)|εκτελωνισμ[^.]*(χωριστά|δεν περιλαμβάν|επιπλέον)/i
    expect(EVERY_STRING.filter(([, text]) => EXTRA.test(text))).toEqual([])
    // And no answer folds the crane into delivery.
    expect(hub(locale).map((item) => item.answer).join(' ')).not.toMatch(/as part of delivery|ως μέρος της παράδοσης|като част от доставката/i)
  })

  it.each(LOCALES)("%s: the FAQ's crane-free option costs what the containers page says, the workers' travel included", (locale) => {
    const { travelMax, nights } = DELIVERY_RATES.products.container.noCrane
    const noCrane = hubAnswer(locale, 'delivery-without-crane')
    expect(noCrane.from).toBe('delivery')
    expect(noCrane.answer).toContain(euro(travelMax, locale))
    expect(noCrane.answer).toContain(nights)
  })

  it.each(LOCALES)('%s: the FAQ gives the owner\'s lead times, and no page keeps the old ones', (locale) => {
    // Until 2026-10-15 the FAQ said "6–10 weeks" and the delivery page carried "~30–35 days"
    // chips, which were sea-transit windows. The owner's answer: a stock container within 7
    // days; a Box house made in up to 40 days and at the address in about 3–4 months.
    const { containerInStockDays, boxProductionDays, boxToAddressMonths } = LEAD_TIMES
    const faqTimeline = hubAnswer(locale, 'delivery-lead-time')
    expect(faqTimeline.from).toBe('delivery')
    expect(faqTimeline.answer).toContain(boxToAddressMonths)
    expect(faqTimeline.answer).toContain(`${containerInStockDays} `)
    expect(faqTimeline.answer).toContain(`${boxProductionDays} `)

    const OLD = /6–10|30–35|40–45|\d\s*(weeks?|седмици|εβδομάδες)/i
    const copy = [
      ...strings(content(locale, 'faq'), `${locale}/faq`),
      ...strings(content(locale, 'delivery'), `${locale}/delivery`),
    ]
    expect(copy.filter(([, text]) => OLD.test(text))).toEqual([])
  })

  it.each(LOCALES)('%s: with a crane the container is assembled in the warehouse, so no workers travel', (locale) => {
    const WAREHOUSE = /склад|warehouse|αποθήκη/
    expect(content(locale, 'modularBuilds').assembly.crane).toMatch(WAREHOUSE)
    // The hero's short form too: until 2026-10-16 it offered the crane as a way to assemble
    // the container on site.
    const heroCrane = content(locale, 'modularBuilds').hero.facts.find((fact) => /кран|crane|γερανό/i.test(fact))
    expect(heroCrane).toMatch(WAREHOUSE)
    expect(hubAnswer(locale, 'delivery-crane').answer).toMatch(WAREHOUSE)
  })

  it.each(LOCALES)('%s: claims delivery in Bulgaria and Greece only, other countries on request, where delivery is priced', (locale) => {
    const EU_WIDE = /other EU|други страни от ЕС|χώρες της ΕΕ/
    expect(content(locale, 'modularHouses').arrival.paragraphs.join(' ')).not.toMatch(EU_WIDE)
    const { calculator, faq } = content(locale, 'delivery')
    expect(calculator.noMatch).toBeTruthy()
    expect(calculator.offer.outside).toBeTruthy()
    expect(faq.items.map((i) => i.a).join(' ')).not.toMatch(EU_WIDE)
  })
})
