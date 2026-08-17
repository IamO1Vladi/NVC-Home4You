import { describe, expect, it } from 'vitest'
import { getPriceRows, startingPrice, VAT_RATE, buildPriceSections } from './prices.js'
import { getBoxConfiguratorCatalog } from './boxConfiguratorCatalog.js'

// The published price table.
//
// These numbers go on a public page and into customer conversations, so the failure mode is
// not a broken build — it is quoting somebody the wrong figure and finding out at signing.
//
// THE TWO SIDES ARE QUOTED ON DIFFERENT BASES: catalogue house prices already INCLUDE VAT,
// assembly costs are quoted EXCLUDING it. The first version of this page treated both as net
// and grossed up the sum, charging VAT twice on the house and overstating every total by
// about €2,400. Most of what follows exists to make that specific mistake impossible to
// reintroduce quietly.

describe('price rows', () => {
  const rows = getPriceRows('en')

  it('covers every model in the catalogue', () => {
    const { models } = getBoxConfiguratorCatalog('en')
    expect(rows.map((r) => r.key)).toEqual(models.map((m) => m.key))
  })

  it('takes house prices from the catalogue rather than a second copy', () => {
    const { models } = getBoxConfiguratorCatalog('en')

    for (const model of models) {
      const row = rows.find((r) => r.key === model.key)
      expect(row.standard.house).toBe(model.basePrice)
      expect(row.balcony.house).toBe(model.balconyPrice)
    }
  })

  it('never adds VAT to the house price, which already includes it', () => {
    // The regression that matters. If someone "helpfully" grosses up the house, every
    // figure on the page jumps and nothing looks broken.
    const { models } = getBoxConfiguratorCatalog('en')

    for (const model of models) {
      const row = rows.find((r) => r.key === model.key)
      expect(row.standard.total).toBeLessThan(Math.round(model.basePrice * 1.2))
      expect(row.standard.total - row.standard.assemblyGross).toBe(model.basePrice)
    }
  })

  it('adds VAT to the assembly cost, which does not include it', () => {
    for (const row of rows) {
      for (const variant of ['standard', 'balcony']) {
        const line = row[variant]
        expect(line.assemblyGross).toBe(Math.round(line.assemblyNet * 1.2))
      }
    }
  })

  it('totals gross house plus gross assembly', () => {
    for (const row of rows) {
      for (const variant of ['standard', 'balcony']) {
        const line = row[variant]
        expect(line.total).toBe(line.house + line.assemblyGross)
      }
    }
  })

  it('matches the figures agreed with the client', () => {
    // Confirmed 2026-08-15, after the VAT basis was corrected. Pinned exactly, so an edit to
    // either the catalogue or the assembly table fails here rather than on the live site.
    const expected = {
      37: { standard: { house: 14000, assemblyNet: 700, assemblyGross: 840, total: 14840 },
            balcony:  { house: 16700, assemblyNet: 1300, assemblyGross: 1560, total: 18260 } },
      58: { standard: { house: 23000, assemblyNet: 850, assemblyGross: 1020, total: 24020 },
            balcony:  { house: 25500, assemblyNet: 1600, assemblyGross: 1920, total: 27420 } },
      73: { standard: { house: 26500, assemblyNet: 1000, assemblyGross: 1200, total: 27700 },
            balcony:  { house: 28000, assemblyNet: 1900, assemblyGross: 2280, total: 30280 } },
    }

    for (const row of rows) {
      expect({ ...row.standard }, `${row.key} standard`).toEqual(expected[row.key].standard)
      expect({ ...row.balcony }, `${row.key} balcony`).toEqual(expected[row.key].balcony)
    }
  })

  it('prices rise with floor area', () => {
    const totals = rows.map((r) => r.standard.total)
    expect([...totals].sort((a, b) => a - b)).toEqual(totals)
  })

  it('the roof and veranda option always costs more than the standard build', () => {
    for (const row of rows) {
      expect(row.balcony.total, `${row.key}`).toBeGreaterThan(row.standard.total)
    }
  })

  it('quotes the cheapest finished house as the starting price', () => {
    expect(startingPrice('en')).toBe(14840)
  })

  it('is the Bulgarian standard rate', () => {
    expect(VAT_RATE).toBe(0.2)
  })

  it('gives the same figures in every locale', () => {
    // Only the labels are translated. A price that changed with the language would be a
    // genuine legal problem, not a display bug.
    const bg = getPriceRows('bg')
    const el = getPriceRows('el')

    for (const [i, row] of rows.entries()) {
      expect(bg[i].standard.total).toBe(row.standard.total)
      expect(el[i].standard.total).toBe(row.standard.total)
      expect(bg[i].balcony.total).toBe(row.balcony.total)
    }
  })
})

describe('the full catalogue, priced from the gallery', () => {
  // Shapes mirroring /api/gallery. Ids are the real ones the assembly costs are keyed to.
  const gallery = [
    { id: 10, category: 'Модулна къща', price: 14000, title: '37' },
    { id: 16, category: 'Модулна къща', price: 17800, title: 'panorama 37' },
    { id: 17, category: 'Модулна къща', price: 32700, title: 'two-storey 74' },
    { id: 99, category: 'Модулна къща', price: 21000, title: 'not yet priced for assembly' },
    { id: 13, category: 'Фургон', price: 3990, title: 'wagon 6m' },
    { id: 8, category: 'Фургон', price: 5370, title: 'container 8m' },
    { id: 3, category: 'Гараж', price: 4000, title: 'garage — different section' },
    { id: 2, category: 'Фургон', price: 0, title: 'unpriced, must not appear' },
  ]

  const { box, wagon } = buildPriceSections(gallery)

  it('splits the catalogue into box houses and wagons', () => {
    // Cheapest first by TOTAL, so the assembly cost affects the order:
    //   10 -> 14,840   16 -> 20,080   99 -> 21,000 (no assembly)   17 -> 36,300
    expect(box.map((r) => r.id)).toEqual([10, 16, 99, 17])
    expect(wagon.map((r) => r.id)).toEqual([13, 8])
  })

  it('drops items with no price and ignores other categories', () => {
    const ids = [...box, ...wagon].map((r) => r.id)
    expect(ids).not.toContain(2)   // price 0
    expect(ids).not.toContain(3)   // garage
  })

  it('ADDS assembly to a box house', () => {
    const row = box.find((r) => r.id === 16)   // Панорамна Бокс 37 m², assembly €1,900 net
    expect(row.assemblyNet).toBe(1900)
    expect(row.assemblyGross).toBe(2280)
    expect(row.total).toBe(17800 + 2280)
    expect(row.assemblyIncluded).toBe(false)
  })

  it('SUBTRACTS assembly from a wagon, because its price already contains it', () => {
    // The trap: treating this like a box house would overstate every wagon by €1,000.
    const row = wagon.find((r) => r.id === 13)
    expect(row.total).toBe(3990)          // exactly the gallery price, untouched
    expect(row.assemblyGross).toBe(1000)
    expect(row.house).toBe(2990)
    expect(row.assemblyIncluded).toBe(true)
  })

  it('lists a product with no mapped assembly rather than hiding it', () => {
    // Better a row saying "assembly on request" than a product silently missing from the
    // price list because nobody updated a constant.
    const row = box.find((r) => r.id === 99)
    expect(row).toBeTruthy()
    expect(row.assemblyNet).toBeNull()
    expect(row.total).toBe(21000)
  })

  it('sorts each section cheapest first', () => {
    for (const section of [box, wagon]) {
      const totals = section.map((r) => r.total)
      expect([...totals].sort((a, b) => a - b)).toEqual(totals)
    }
  })
})
