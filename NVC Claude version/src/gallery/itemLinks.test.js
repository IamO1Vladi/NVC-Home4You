import { describe, expect, it } from 'vitest'
import { galleryItemLinks, routerPath, CONFIGURATOR_MODEL_BY_ID, CAPSULE_ID } from './itemLinks.js'
import { paths } from '../routes/paths.js'
import bgGallery from '../content/bg/gallery.js'
import enGallery from '../content/en/gallery.js'
import elGallery from '../content/el/gallery.js'

// Where a gallery product page links on to: its product page, its prices row, the
// configurator on its model and the delivery calculator, each only where the target exists.

const COPY = { bg: bgGallery.detail.links, en: enGallery.detail.links, el: elGallery.detail.links }
const item = (id, category, price = 10000) => ({ id, category, price, currency: 'EUR', title: `#${id}` })
const byKey = (links) => Object.fromEntries(links.map((l) => [l.key, l.to]))

describe('galleryItemLinks', () => {
  it.each(['bg', 'en', 'el'])('%s: every link has words in the gallery content', (locale) => {
    for (const key of ['heading', 'containers', 'box', 'capsule', 'steel', 'prices', 'pricesNoAssembly', 'configurator', 'delivery']) {
      expect(COPY[locale][key], key).toBeTruthy()
    }
  })

  it.each(['bg', 'en', 'el'])('%s: a 58 m² Box house links to its page, its price row, the configurator on the 58 and the Box delivery', (locale) => {
    const links = galleryItemLinks(item(5, 'modular', 23000), locale, COPY[locale])
    expect(links.map((l) => l.key)).toEqual(['product', 'prices', 'configurator', 'delivery'])
    expect(byKey(links)).toEqual({
      product: paths.modularHouses[locale],
      prices: `${paths.prices[locale]}#item-5`,
      configurator: `${paths.boxConfigurator[locale]}?model=58`,
      delivery: `${paths.delivery[locale]}?product=box`,
    })
    expect(links[0].label).toBe(COPY[locale].box)
  })

  it('opens the configurator on the same size for the veranda house, never for a house it cannot build', () => {
    expect(byKey(galleryItemLinks(item(15, 'modular'), 'bg', COPY.bg)).configurator).toBe(`${paths.boxConfigurator.bg}?model=73`)
    expect(byKey(galleryItemLinks(item(11, 'modular'), 'bg', COPY.bg)).configurator).toBe(`${paths.boxConfigurator.bg}?model=37`)
    for (const id of [16, 17, 100016, CAPSULE_ID]) {
      expect(byKey(galleryItemLinks(item(id, 'modular'), 'bg', COPY.bg)).configurator, String(id)).toBeUndefined()
    }
    expect(Object.values(CONFIGURATOR_MODEL_BY_ID).sort()).toEqual(['37', '37', '58', '58', '73', '73'])
  })

  it.each(['bg', 'en', 'el'])('%s: a container links to the containers page, its price row and the container delivery, not the configurator', (locale) => {
    const links = galleryItemLinks(item(13, 'wagon', 4300), locale, COPY[locale])
    expect(byKey(links)).toEqual({
      product: paths.modularBuilds[locale],
      prices: `${paths.prices[locale]}#item-13`,
      delivery: `${paths.delivery[locale]}?product=container`,
    })
    expect(links[0].label).toBe(COPY[locale].containers)
  })

  // The capsule is filed under modular today and moves to its own "capsule" category once staff
  // move it (2026-10-17). Its links must be the same in both states.
  it.each(['modular', 'capsule'])('gives the capsule filed under %s its card on the Box houses page and the Box houses\' delivery (owner, 2026-10-17)', (category) => {
    for (const locale of ['bg', 'en', 'el']) {
      const links = galleryItemLinks(item(CAPSULE_ID, category, 55000), locale, COPY[locale])
      expect(byKey(links), locale).toEqual({
        product: `${paths.modularHouses[locale]}#item-${CAPSULE_ID}`,
        prices: `${paths.prices[locale]}#item-${CAPSULE_ID}`,
        delivery: `${paths.delivery[locale]}?product=box`,
      })
      expect(links[0].label).toBe(COPY[locale].capsule)
      // It arrives ready: no "with assembly", and never the configurator.
      expect(links.find((l) => l.key === 'prices').label).toBe(COPY[locale].pricesNoAssembly)
    }
  })

  it('links any model filed under capsule to its own card, by its own id', () => {
    expect(byKey(galleryItemLinks(item(100030, 'capsule', 60000), 'bg', COPY.bg))).toEqual({
      product: `${paths.modularHouses.bg}#item-100030`,
      prices: `${paths.prices.bg}#item-100030`,
      delivery: `${paths.delivery.bg}?product=box`,
    })
  })

  it.each(['bg', 'en', 'el'])('%s: a steel-frame project (prefab) links to the steel-frame houses page and the project delivery, with or without a price', (locale) => {
    for (const price of [42000, null]) {
      const links = galleryItemLinks(item(100020, 'prefab', price), locale, COPY[locale])
      // Priced per project: no row on the prices page, and no configurator.
      expect(byKey(links)).toEqual({
        product: paths.steelHouses[locale],
        delivery: `${paths.delivery[locale]}?product=project`,
      })
      expect(links[0].label).toBe(COPY[locale].steel)
      // The calculator quotes a house to a plan with the project: the link promises no figure.
      expect(links.find((l) => l.key === 'delivery').label).toBe(COPY[locale].deliveryProject)
      expect(COPY[locale].deliveryProject).toBeTruthy()
    }
  })

  it.each(['bg', 'en', 'el'])('%s: says "with assembly" only where the prices row has an assembly figure', (locale) => {
    const label = (id, category) => galleryItemLinks(item(id, category), locale, COPY[locale]).find((l) => l.key === 'prices').label
    expect(label(5, 'modular')).toBe(COPY[locale].prices)
    expect(label(13, 'wagon')).toBe(COPY[locale].prices)
    // The 18 m² house has an assembly price since 2026-10-17; the capsule arrives ready.
    expect(label(100016, 'modular')).toBe(COPY[locale].prices)
    expect(label(CAPSULE_ID, 'modular')).toBe(COPY[locale].pricesNoAssembly)
  })

  it('links no prices row the prices page does not have: no price, or a category it does not list', () => {
    expect(byKey(galleryItemLinks(item(5, 'modular', 0), 'bg', COPY.bg)).prices).toBeUndefined()
    // Garage stays internal: it has no page to link to.
    expect(galleryItemLinks(item(30, 'garage', 9000), 'bg', COPY.bg)).toEqual([])
  })

  it('draws nothing it has no words for', () => {
    expect(galleryItemLinks(item(5, 'modular'), 'bg', {})).toEqual([])
    expect(galleryItemLinks(null, 'bg', COPY.bg)).toEqual([])
  })
})

describe('routerPath', () => {
  it('turns the absolute gallery base into the router path, and leaves a path alone', () => {
    expect(routerPath('https://nvc-home4you.eu/bg/galeriq')).toBe('/bg/galeriq')
    expect(routerPath('https://nvc-home4you.eu/el/gkaleri?cat=wagon')).toBe('/el/gkaleri?cat=wagon')
    expect(routerPath('/en/gallery')).toBe('/en/gallery')
  })
})
