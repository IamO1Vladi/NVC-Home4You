import { describe, expect, it, vi } from 'vitest'
import { productFigures, productQuestions, hubTopicPath, PRODUCT_PAGES, SMALL_BOX_ID } from './productQuestions.js'
import { euro } from './euro.js'
import { paths } from '../routes/paths.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import enModularBuilds from '../content/en/modularBuilds.js'
import elModularBuilds from '../content/el/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import enModularHouses from '../content/en/modularHouses.js'
import elModularHouses from '../content/el/modularHouses.js'
import bgSteelHouses from '../content/bg/steelHouses.js'
import enSteelHouses from '../content/en/steelHouses.js'
import elSteelHouses from '../content/el/steelHouses.js'

// The product pages' questions read every figure from its module (2026-10-17): the lead times
// and the crane from deliveryRates.js; the container's assembly share, the 18 m² house's
// assembly, who assembles a Box house and in how many days, and the architectural project from
// prices.js. Each is mocked to another figure here, so a figure typed into the copy would show,
// and the copy itself is checked for digits.

const TIMES = vi.hoisted(() => ({ containerInStockDays: 9, boxProductionDays: 41, boxToAddressMonths: '7–8', containerMadeToOrderMonths: '5–6' }))
const CRANE = vi.hoisted(() => 777)
vi.mock('../content/shared/deliveryRates.js', async (importOriginal) => {
  const real = await importOriginal()
  const products = { ...real.DELIVERY_RATES.products, box: { ...real.DELIVERY_RATES.products.box, crane: { required: true, about: CRANE, canBeMore: true } } }
  return { ...real, LEAD_TIMES: TIMES, DELIVERY_RATES: { ...real.DELIVERY_RATES, products } }
})
const MOCK = vi.hoisted(() => ({ crew: { workers: 3, days: '6–7' }, project: 1300, small: 1100, wagon: 1111 }))
vi.mock('../content/shared/prices.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    BOX_ASSEMBLY_CREW: MOCK.crew,
    ARCHITECT_PROJECT_EUR: MOCK.project,
    WAGON_ASSEMBLY_GROSS: MOCK.wagon,
    boxAssemblyNet: (id) => (Number(id) === 100016 ? MOCK.small : real.boxAssemblyNet(id)),
  }
})

const LOCALES = ['bg', 'en', 'el']
const CONTENT = {
  modularBuilds: { bg: bgModularBuilds, en: enModularBuilds, el: elModularBuilds },
  modularHouses: { bg: bgModularHouses, en: enModularHouses, el: elModularHouses },
  steelHouses: { bg: bgSteelHouses, en: enSteelHouses, el: elSteelHouses },
}
const flat = (s) => String(s ?? '').replace(/\s/g, ' ')
const answer = (page, locale, id) => flat(productQuestions(page, CONTENT[page][locale], locale).find((q) => q.id === id)?.answer)
const digits = (n) => new RegExp(`(?<![\\d.,])${n}(?![\\d.,])`)

describe('the product pages\' questions read their figures from the modules', () => {
  it.each(LOCALES)('%s: containers: the made-to-order and stock lead times, the assembly share', (locale) => {
    const madeToOrder = answer('modularBuilds', locale, 'container-made-to-order')
    expect(madeToOrder).toContain(TIMES.containerMadeToOrderMonths)
    expect(madeToOrder).toMatch(digits(TIMES.containerInStockDays))
    expect(madeToOrder).not.toMatch(/3–4|(?<!\d)7(?!\d)/)
    expect(answer('modularBuilds', locale, 'container-assembly')).toContain(flat(euro(MOCK.wagon, locale)))
  })

  it.each(LOCALES)('%s: Box houses: the crew and its days, the 18 m² assembly with and without VAT, the lead times, the crane', (locale) => {
    const crew = answer('modularHouses', locale, 'box-assembly-crew')
    // Three workers has no word in the copy's list, so it is printed as a digit.
    expect(crew).toMatch(digits(MOCK.crew.workers))
    expect(crew).toContain(MOCK.crew.days)
    expect(crew).not.toMatch(/двама|two|δύο|3–4/)

    const small = answer('modularHouses', locale, 'box-assembly-18')
    expect(small).toContain(flat(euro(MOCK.small, locale)))
    expect(small).toContain(flat(euro(Math.round(MOCK.small * 1.2), locale)))
    expect(small).not.toMatch(/1[\s.,]?000|1[\s.,]?200/)

    const times = answer('modularHouses', locale, 'box-lead-times')
    expect(times).toMatch(digits(TIMES.boxProductionDays))
    expect(times).toContain(TIMES.boxToAddressMonths)
    expect(answer('modularHouses', locale, 'capsule-ready')).toContain(TIMES.boxToAddressMonths)
    expect(answer('modularHouses', locale, 'box-assembly')).toContain(flat(euro(CRANE, locale)))
  })

  it.each(LOCALES)('%s: steel-frame houses: the architectural project', (locale) => {
    const project = answer('steelHouses', locale, 'steel-project')
    expect(project).toContain(flat(euro(MOCK.project, locale)))
    expect(project).not.toMatch(/1[\s.,]?000/)
  })

  it.each(LOCALES)('%s: types no figure: only the sizes 18 and 74 m² are digits in the copy', (locale) => {
    for (const page of PRODUCT_PAGES) {
      for (const item of CONTENT[page][locale].faq.items.filter((i) => !i.from)) {
        expect(`${item.q} ${item.a}`.replace(/(?<!\d)(18|74)(?!\d)/g, ''), `${page} ${item.id}`).not.toMatch(/\d/)
      }
    }
    // And every placeholder the copy names has a figure for it.
    for (const page of PRODUCT_PAGES) {
      const values = productFigures(page, locale)
      for (const item of CONTENT[page][locale].faq.items.filter((i) => !i.from)) {
        for (const [, key] of item.a.matchAll(/\{(\w+)\}/g)) expect(values[key] ?? null, `${page} ${item.id} {${key}}`).not.toBeNull()
      }
    }
  })

  it('links each page\'s "more questions" to its topic on the hub', () => {
    for (const locale of LOCALES) {
      expect(hubTopicPath('modularBuilds', locale)).toBe(`${paths.faq[locale]}#t-containers`)
      expect(hubTopicPath('modularHouses', locale)).toBe(`${paths.faq[locale]}#t-box`)
      expect(hubTopicPath('steelHouses', locale)).toBe(`${paths.faq[locale]}#t-steel`)
    }
    expect(SMALL_BOX_ID).toBe(100016)
  })
})
