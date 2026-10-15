import { describe, expect, it } from 'vitest'

import { dictionaries } from '../i18n/translations.js'
import { DELIVERY_RATES, LEAD_TIMES } from './shared/deliveryRates.js'
import { euro } from '../lib/euro.js'
import { getPricesCopy } from './shared/pricesCopy.js'

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

const EVERY_STRING = [
  ...Object.entries(MODULES).flatMap(([file, mod]) => strings(mod, file)),
  ...LOCALES.flatMap((locale) => strings(getPricesCopy(locale), `pricesCopy.${locale}`)),
  ...strings(dictionaries, 'translations'),
]

const content = (locale, name) => MODULES[`./${locale}/${name}.js`].default
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
    const faqCrane = content(locale, 'faq').groups
      .flatMap((group) => group.items)
      .find((item) => item.a.includes(euro(DELIVERY_RATES.products.box.crane.about, locale)))
    expect(faqCrane, 'the FAQ crane answer').toBeDefined()

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
      faqCrane.a,
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

  it('keeps the customs answer, which the owner confirmed, and no longer folds the crane into delivery', () => {
    const answers = (locale) => content(locale, 'faq').groups.flatMap((group) => group.items).map((item) => item.a)
    expect(answers('bg')).toContain('Да. Ние поемаме декларации, такси и съответствие.')
    expect(answers('en').join(' ')).not.toMatch(/as part of delivery/i)
    expect(answers('el').join(' ')).not.toMatch(/ως μέρος της παράδοσης/)
  })

  it.each(LOCALES)("%s: the FAQ's crane-free option costs what the containers page says, the workers' travel included", (locale) => {
    const { travelMax, nights } = DELIVERY_RATES.products.container.noCrane
    const faqCrane = content(locale, 'faq').groups
      .flatMap((group) => group.items)
      .find((item) => item.a.includes(euro(DELIVERY_RATES.products.box.crane.about, locale)))
    expect(faqCrane.a).toContain(euro(travelMax, locale))
    expect(faqCrane.a).toContain(nights)
  })

  it.each(LOCALES)('%s: the FAQ gives the owner\'s lead times, and no page keeps the old ones', (locale) => {
    // Until 2026-10-15 the FAQ said "6–10 weeks" and the delivery page carried "~30–35 days"
    // chips, which were sea-transit windows. The owner's answer: a stock container within 7
    // days; a Box house made in up to 40 days and at the address in about 3–4 months.
    const { containerInStockDays, boxProductionDays, boxToAddressMonths } = LEAD_TIMES
    const faqTimeline = content(locale, 'faq').groups
      .flatMap((group) => group.items)
      .find((item) => item.a.includes(boxToAddressMonths))
    expect(faqTimeline.a).toContain(`${containerInStockDays} `)
    expect(faqTimeline.a).toContain(`${boxProductionDays} `)

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
    const faqCrane = content(locale, 'faq').groups
      .flatMap((group) => group.items)
      .find((item) => item.a.includes(euro(DELIVERY_RATES.products.box.crane.about, locale)))
    expect(faqCrane.a).toMatch(WAREHOUSE)
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
