import { describe, expect, it } from 'vitest'
import { itemFacts, itemKind, similarItems, tidyDescription } from './itemFacts.js'
import { priceEntry } from './GalleryCard.jsx'
import { BOX_ASSEMBLY_CREW, boxAssemblyGross, boxAssemblyNet, VAT_RATE } from '../content/shared/prices.js'
import { LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { euro } from '../lib/euro.js'
import { paths } from '../routes/paths.js'
import bgGallery from '../content/bg/gallery.js'
import enGallery from '../content/en/gallery.js'
import elGallery from '../content/el/gallery.js'

// The gallery model's page (2026-10-17): its line, its key facts, the models like it, and its
// description tidied for reading. Every figure in the facts comes from its module.

const CONTENT = { bg: bgGallery, en: enGallery, el: elGallery }

const CONTAINER = { id: 13, title: 'Living container', price: 4300, category: 'wagon' }
const BOX = { id: 10, title: 'Expandable house 37 m²', price: 14000, category: 'modular' }
const BOX_NO_ASSEMBLY = { id: 99, title: 'Expandable house', price: 9000, category: 'modular' }
const CAPSULE_MODULAR = { id: 100015, title: 'Space house', price: 55000, category: 'modular' }
const CAPSULE_MOVED = { id: 100015, title: 'Space house', price: 55000, category: 'capsule' }
const PROJECT = { id: 100017, title: 'Alpine house', price: 44780, category: 'prefab' }
const GARAGE = { id: 50, title: 'Garage', price: 3000, category: 'garage' }

const facts = (item, locale = 'en') => itemFacts(item, priceEntry(item), CONTENT[locale].detail.facts, locale)
const byKey = (list) => Object.fromEntries(list.map((fact) => [fact.key, fact]))
const fill = (pattern, values) => Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), pattern)

describe('itemKind', () => {
  it('names the four lines in the gallery filters\' ids; garage is none of them', () => {
    expect(itemKind(CONTAINER)).toBe('wagon')
    expect(itemKind(BOX)).toBe('modular')
    expect(itemKind(PROJECT)).toBe('prefab')
    expect(itemKind(GARAGE)).toBeNull()
    expect(itemKind(null)).toBeNull()
  })

  it('the capsule is a capsule before and after staff move it out of modular', () => {
    expect(itemKind(CAPSULE_MODULAR)).toBe('capsule')
    expect(itemKind(CAPSULE_MOVED)).toBe('capsule')
  })
})

describe('itemFacts: every figure from its module', () => {
  it.each(['bg', 'en', 'el'])('%s: a container in stock, its warranty, assembly included, the container calculator', (locale) => {
    const copy = CONTENT[locale].detail.facts
    const f = byKey(facts(CONTAINER, locale))
    expect(Object.keys(f)).toEqual(['lead', 'warranty', 'assembly', 'delivery'])
    expect(f.lead.value).toBe(fill(copy.containerLead, { days: LEAD_TIMES.containerInStockDays }))
    expect(f.lead.value).toContain(String(LEAD_TIMES.containerInStockDays))
    expect(f.warranty.value).toContain(String(WARRANTY_YEARS.structure))
    expect(f.assembly.value).toBe(copy.assemblyIncluded)
    expect(f.delivery.link.to).toBe(`${paths.delivery[locale]}?product=container`)
  })

  it.each(['bg', 'en', 'el'])('%s: a Box house to the address, its production, its own assembly figure and crew', (locale) => {
    const copy = CONTENT[locale].detail.facts
    const f = byKey(facts(BOX, locale))
    expect(f.lead.value).toContain(LEAD_TIMES.boxToAddressMonths)
    expect(f.lead.note).toContain(String(LEAD_TIMES.boxProductionDays))
    const gross = Math.round(boxAssemblyNet(10) * (1 + VAT_RATE))
    expect(f.assembly.value).toBe(fill(copy.assemblyPrice, { price: euro(gross, locale) }))
    expect(f.assembly.note).toBe(fill(copy.assemblyCrew, { workers: BOX_ASSEMBLY_CREW.workers, days: BOX_ASSEMBLY_CREW.days }))
    expect(f.warranty.value).toContain(String(WARRANTY_YEARS.structure))
    expect(f.delivery.link.to).toBe(`${paths.delivery[locale]}?product=box`)
  })

  it('a Box house the prices table has no assembly figure for: on request, and only then', () => {
    expect(boxAssemblyNet(99)).toBeNull()
    expect(byKey(facts(BOX_NO_ASSEMBLY)).assembly.value).toBe(enGallery.detail.facts.assemblyOnRequest)
    expect(byKey(facts(BOX)).assembly.value).not.toBe(enGallery.detail.facts.assemblyOnRequest)
  })

  it('a Box house with no price keeps its assembly figure, by its id (the prices table leaves it out)', () => {
    const unpriced = { ...BOX, price: 0 }
    expect(priceEntry(unpriced)).toBeNull()
    const gross = Math.round(boxAssemblyNet(10) * (1 + VAT_RATE))
    expect(boxAssemblyGross(10)).toBe(gross)
    expect(boxAssemblyGross(99)).toBeNull()
    expect(byKey(facts(unpriced)).assembly.value).toBe(fill(enGallery.detail.facts.assemblyPrice, { price: euro(gross, 'en') }))
  })

  it.each([['under modular', CAPSULE_MODULAR], ['moved', CAPSULE_MOVED]])('the capsule %s: the Box houses\' lead time and warranty, no assembly, the Box calculator', (_, capsule) => {
    const copy = enGallery.detail.facts
    const f = byKey(facts(capsule))
    expect(f.lead.value).toContain(LEAD_TIMES.boxToAddressMonths)
    // Its production time was not given separately: none is claimed.
    expect(f.lead.note).toBe(copy.capsuleLeadNote)
    expect(f.warranty.value).toContain(String(WARRANTY_YEARS.structure))
    expect(f.assembly.value).toBe(copy.assemblyNone)
    expect(f.delivery.link.to).toBe(`${paths.delivery.en}?product=box`)
  })

  it('a steel-frame project: lead time, warranty and assembly per project, delivery in its quote', () => {
    const copy = bgGallery.detail.facts
    const f = byKey(facts(PROJECT, 'bg'))
    expect(f.lead.value).toBe(copy.perProject)
    expect(f.warranty.value).toBe(copy.perProject)
    expect(f.warranty.note).toBeUndefined()
    expect(f.assembly.value).toBe(copy.perProject)
    expect(f.delivery.value).toBe(copy.deliveryProject)
    expect(f.delivery.link.to).toBe(`${paths.delivery.bg}?product=project`)
  })

  it('a garage has no facts', () => {
    expect(facts(GARAGE)).toEqual([])
  })

  it('a link keeps its arrow with its last word', () => {
    expect(byKey(facts(CONTAINER)).delivery.link.label).toMatch(/ →$/)
  })

  it.each(['bg', 'en', 'el'])('%s: the content types no figure of its own', (locale) => {
    for (const [key, text] of Object.entries(CONTENT[locale].detail.facts)) {
      expect(`${key}: ${text}`).not.toMatch(/\d/)
    }
  })
})

describe('similarItems', () => {
  const C6 = { id: 6, price: 4800, category: 'wagon' }
  const C12 = { id: 12, price: 4950, category: 'wagon' }
  const C14 = { id: 14, price: 5200, category: 'wagon' }
  const C8 = { id: 8, price: 6500, category: 'wagon' }
  const LIST = [C8, BOX, CONTAINER, C14, C12, CAPSULE_MODULAR, C6, PROJECT, BOX_NO_ASSEMBLY]

  it('up to three of the same line, the closest in price first, never the model itself', () => {
    expect(similarItems(LIST, CONTAINER)).toEqual([C6, C12, C14])
    expect(similarItems(LIST, CONTAINER, 3)).not.toContain(CONTAINER)
    expect(similarItems(LIST, C8)).toEqual([C14, C12, C6])
  })

  it('"itself" is the item, not its id: an id-twin is another model', () => {
    const twin = { ...CONTAINER, title: 'Another' }
    expect(similarItems([CONTAINER, twin], CONTAINER)).toEqual([twin])
  })

  it('the capsule is not a Box house, in either category, and a model alone in its line has none', () => {
    expect(similarItems(LIST, BOX)).toEqual([BOX_NO_ASSEMBLY])
    expect(similarItems(LIST, CAPSULE_MODULAR)).toEqual([])
    expect(similarItems([...LIST, CAPSULE_MOVED], CAPSULE_MODULAR)).toEqual([CAPSULE_MOVED])
    expect(similarItems(LIST, PROJECT)).toEqual([])
    expect(similarItems(LIST, GARAGE)).toEqual([])
  })
})

describe('tidyDescription', () => {
  it('drops the text\'s own "Описание" heading at the top, as the page heads the section with it', () => {
    const html = '<p><strong>Описание</strong></p><p>Цената включва сглобяване и ДДС</p>'
    expect(tidyDescription(html, { title: 'Описание' })).toBe('<p>Цената включва сглобяване и ДДС</p>')
    expect(tidyDescription('<h3>Description:</h3><p>Text</p>', { title: 'Description' })).toBe('<p>Text</p>')
  })

  it('keeps a first block that says more than the section\'s name', () => {
    const html = '<p><strong>Описание на модела</strong></p><p>Текст</p>'
    expect(tidyDescription(html, { title: 'Описание' })).toBe(html)
  })

  it('drops the editor\'s empty spacers and empty headings, and a pasted wrapper', () => {
    const html = '<div class="gdetail-richtext"><h4>Основни</h4><p>&nbsp;</p><p>Площ: 37 м²<br>&nbsp;</p><h2></h2><h2><br></h2><p></p></div>'
    expect(tidyDescription(html, { title: 'Описание', minLevel: 3 })).toBe('<h3>Основни</h3><p>Площ: 37 м²</p>')
  })

  it('moves the text\'s headings as one, the highest to minLevel, so no level is skipped', () => {
    // The Box houses' text: h4 sections, straight under the page's h2 until 2026-10-17.
    const box = '<h4>Основни</h4><p>Площ</p><h5>Баня</h5><p>Душ</p>'
    expect(tidyDescription(box, { minLevel: 3 })).toBe('<h3>Основни</h3><p>Площ</p><h4>Баня</h4><p>Душ</p>')
    expect(tidyDescription(box, { minLevel: 4 })).toBe(box)
    // An h2 over an h3 keeps its step: h3 over h4 on the page.
    expect(tidyDescription('<h2>A</h2><h3>B</h3>', { minLevel: 3 })).toBe('<h3>A</h3><h4>B</h4>')
    // Never deeper than h6.
    expect(tidyDescription('<h1>A</h1><h6>B</h6>', { minLevel: 4 })).toBe('<h4>A</h4><h6>B</h6>')
  })

  it('puts the text\'s headings under the section\'s, and a paragraph-long "heading" back to a paragraph', () => {
    const long = 'Experience modern, intelligent living in a beautifully designed 38 m² space capsule built with a robust galvanised-steel frame.'
    const html = `<h3>${long}</h3><h2>Specifications</h2><ul><li><p>Floor area: 38 m²</p></li></ul>`
    expect(tidyDescription(html, { title: 'Description', minLevel: 3 }))
      .toBe(`<p>${long}</p><h3>Specifications</h3><ul><li><p>Floor area: 38 m²</p></li></ul>`)
    expect(tidyDescription('<h2>Specs</h2>', { minLevel: 4 })).toBe('<h4>Specs</h4>')
  })

  it('passes nothing through as nothing', () => {
    expect(tidyDescription('', { title: 'Описание' })).toBe('')
  })
})
