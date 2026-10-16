import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import ModularBuildsPage from './ModularBuildsPage.jsx'
import bg from '../content/bg/modularBuilds.js'
import en from '../content/en/modularBuilds.js'
import el from '../content/el/modularBuilds.js'
import { paths } from '../routes/paths.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { WAGON_ASSEMBLY_GROSS } from '../content/shared/prices.js'
import { DELIVERY_RATES, LEAD_TIMES } from '../content/shared/deliveryRates.js'
import { WARRANTY_YEARS } from '../content/shared/warranty.js'
import { HOME_PHOTOS_SEED_ID, fetchHomePhotos, forgetHomePhotos } from '../lib/homePhotos.js'
import { DELIVERED_CONTAINER } from '../content/shared/deliveredMedia.js'

// The container units page as the rebuild left it: one H1, six cards built from the
// gallery's wagon rows, every figure read from those rows, the owner's facts in the copy
// and nothing a visitor has to hover to read.
//
// The gallery below has the shape /api/gallery sends (the six live wagons, with their real
// titles and photo paths), but EVERY PRICE IS THE LIVE ONE PLUS 11. A figure typed into the
// page or its content would print the live price and fail here; only a figure read from the
// rows prints the fixture's. Two box houses are there for the sibling link's "from".

const wagon = (id, price, title, titleBg, titleEl, dir, images) => ({
  id, price, currency: 'EUR', category: 'wagon', title, titleBg, titleEl, catalogId: null,
  description: '<p>The price includes assembling and VAT</p><p><strong>Structure:</strong> 2.3 mm galvanized steel frame</p>',
  descriptionBg: '<p>Цената включва сглобяване и ДДС</p><p><strong>Конструкция:</strong> поцинкована стоманена рамка – 2,3 мм</p>',
  descriptionEl: '<p>Η τιμή περιλαμβάνει τη συναρμολόγηση και τον ΦΠΑ.</p>',
  coverUrl: `/api/img/gallery/${dir}/${images[0]}.webp`,
  images: images.map((name) => `/api/img/gallery/${dir}/${name}.webp`),
})

const GALLERY = [
  wagon(8, 6511, 'Container House – 8000*3000mm with pitched roof Model)', 'Контейнерна къща – 8000*3000мм с двускатен покрив', 'Σπίτι τύπου Container – 8000 × 3000 mm με δίρριχτη στέγη', 3, ['e4e9c6d8', '37755aa751c74bb5bbcd9848842c3a1e', '9559de66']),
  wagon(13, 4311, 'Container House – 6000mm*3000mm', 'Жилищен фургон - 6000мм*3000мм', 'Σπίτι τύπου Container – 6000 mm × 3000 mm', 1, ['7bfcb13d', 'f29ccbc0', '0ad1b444']),
  wagon(14, 5211, 'Container house with cladding - 6000mm*3000mm', 'Жилищен фургон с декоративен панел - 6000мм*3000мм', 'Σπίτι τύπου Container με επένδυση – 6000 × 3000 mm', 4, ['c5d4f493', 'c46bc111', '5ef4bc89']),
  wagon(6, 4811, 'Container House – 7000mm*3000mm', 'Жилищен фургон - 7000мм*3000мм', 'Σπίτι τύπου Container –  7000mm*3000mm', 2, ['a88e345e', 'de4fb44b', 'b1dec27b']),
  wagon(12, 4961, 'Panoramic Office Container - 6000*3000mm', 'Панорамен офис контейнер -  6000*3000мм', 'Πανοραμικό Office Container – 6000 × 3000 mm', 13, ['990fccba', '8735c6f9', 'abdea86d']),
  wagon(7, 5611, 'Container house with cladding - 7000mm*3000mm', 'Жилищен фургон с декоративен панел - 7000мм*3000мм', 'Σπίτι τύπου Container με επένδυση – 7000 × 3000 mm', 5, ['92656983', 'c9d7332c', 'f2a22a1c']),
  { id: 100016, category: 'modular', price: 10511, currency: 'EUR', title: 'Expandable House – 18 m²', titleBg: 'Разгъваема Къща – 18 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 18 m²', coverUrl: '/api/img/gallery/100016/a.webp', images: [] },
  { id: 10, category: 'modular', price: 14011, currency: 'EUR', title: 'Expandable House – 37 m²', titleBg: 'Разгъваема Къща – 37 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 37 m²', coverUrl: '/api/img/gallery/10/a.webp', images: [] },
]

// Cheapest first, as the cards must be.
const BY_PRICE = [13, 6, 12, 14, 7, 8]
const priceOf = (id) => GALLERY.find((item) => item.id === id).price

const CONTENT = { bg, en, el }
// Intl writes a no-break space inside "550 €"; compare with the spaces made alike.
const flatSpaces = (s) => String(s).replace(/\s/g, ' ')
const fillIn = (text, values) => Object.entries(values).reduce((t, [k, v]) => t.replaceAll(`{${k}}`, v), text)
const CYRILLIC = /\p{Script=Cyrillic}/u

let photosBody = null

function stubFetch() {
  return vi.fn((url) => {
    const href = String(url)
    if (href.includes('/api/gallery')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: GALLERY }) })
    }
    if (href.includes('/api/reviews/featured')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [], averageRating: 0, totalCount: 0 }) })
    }
    if (href.includes('/api/home/photos') && photosBody) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(photosBody) })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })
}

function renderPage(locale, actions = {}) {
  return render(
    <MemoryRouter initialEntries={[paths.modularBuilds[locale]]}>
      <ModalActionsProvider onOpenOffer={actions.openOffer || (() => {})} onOpenQuestion={() => {}} onRequestModel={actions.requestModel}>
        <ModularBuildsPage locale={locale} content={CONTENT[locale]} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

/** Renders and waits for the gallery rows: six cards. */
async function renderLoaded(locale, actions) {
  const view = renderPage(locale, actions)
  await waitFor(() => expect(view.container.querySelectorAll('article.pp-unit')).toHaveLength(6))
  return view
}

/** Every string in a content object, with its dotted path. */
function strings(value, at = '') {
  if (typeof value === 'string') return [[at, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

beforeAll(() => {
  vi.stubGlobal('fetch', stubFetch())
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  photosBody = null
  // A photo answer kept from the test before would be on the first render of this one.
  forgetHomePhotos()
})

describe.each(['bg', 'en', 'el'])('ModularBuildsPage (%s)', (locale) => {
  const c = CONTENT[locale]

  it('has one H1, the container heading, under the page name', async () => {
    const { container } = await renderLoaded(locale)
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe(c.hero.h1)
    expect(container.querySelector('.pp-hero .hp-eyebrow').textContent).toBe(c.hero.eyebrow)
    // Headings in order: the H1, then the sections' h2s, then each card's h3.
    const levels = [...container.querySelectorAll('h1, h2, h3')].map((h) => Number(h.tagName[1]))
    levels.forEach((level, i) => { if (i) expect(level - levels[i - 1]).toBeLessThanOrEqual(1) })
  })

  it('prints the hero "from" figure from the cheapest row, with what it includes', async () => {
    const { container } = await renderLoaded(locale)
    const price = container.querySelector('.pp-hero .pp-price')
    expect(price.querySelector('strong').textContent).toBe(euro(4311, locale))
    expect(price.textContent).toContain(c.hero.basis)
  })

  it('renders one card per wagon row, cheapest first, each price read from its row', async () => {
    const { container } = await renderLoaded(locale)
    const cards = [...container.querySelectorAll('article.pp-unit')]
    expect(cards.map((card) => card.id)).toEqual(BY_PRICE.map((id) => `item-${id}`))

    for (const card of cards) {
      const id = Number(card.id.replace('item-', ''))
      expect(card.querySelector('.pp-unit-price').textContent).toBe(euro(priceOf(id), locale))
      expect(card.querySelector('.pp-unit-caption').textContent).toBe(c.units.basis)
      expect(card.querySelector('.pp-unit-diff').textContent).toBe(c.units.diff[id])

      // The enquiry is a button, the details a link to the gallery page in this language.
      const ask = within(card).getByRole('button', { name: new RegExp(c.units.ask) })
      expect(ask.tagName).toBe('BUTTON')
      const more = within(card).getByRole('link', { name: new RegExp(c.units.more.replace(/[→]/g, '.')) })
      expect(more.getAttribute('href').startsWith(`${paths.gallery[locale]}/`)).toBe(true)
    }
  })

  it('attaches the card\'s model to the offer form', async () => {
    const requestModel = vi.fn()
    const { container } = await renderLoaded(locale, { requestModel })
    const card = container.querySelector('#item-12')
    fireEvent.click(within(card).getByRole('button', { name: new RegExp(c.units.ask) }))
    expect(requestModel).toHaveBeenCalledTimes(1)
    const model = requestModel.mock.calls[0][0]
    expect(model.id).toBe(12)
    expect(model.titleBg).toBe('Панорамен офис контейнер -  6000*3000мм')
    expect(model.path.startsWith(`${paths.gallery.bg}/`)).toBe(true)
  })

  it('says the other catalogue sizes are made to order, and what the kitchen is', async () => {
    const { container } = await renderLoaded(locale)
    expect(container.textContent).toContain(c.units.madeToOrder)

    const table = container.querySelector('#specs table')
    expect(table.getAttribute('aria-labelledby')).toBe('pp-specs-title')
    const rowHeads = [...table.querySelectorAll('th[scope="row"]')].map((th) => th.textContent)
    expect(rowHeads).toEqual(c.specs.rows.map((row) => row.label))
    expect(table.textContent).toContain(c.specs.rows.at(-1).value)
  })

  it('states assembly, crane, accommodation, foundation and delivery, with the figures computed', async () => {
    const { container } = await renderLoaded(locale)
    const block = container.querySelector('#assembly').textContent
    const CONTAINER = DELIVERY_RATES.products.container
    expect(block).toContain(fillIn(c.assembly.crane, { crane: euro(CONTAINER.crane.about, locale) }))
    expect(block).toContain(fillIn(c.assembly.noCrane, { nights: CONTAINER.noCrane.nights, travel: euro(CONTAINER.noCrane.travelMax, locale) }))
    expect(block).toContain(c.assembly.foundation)
    expect(block).toContain(euro(WAGON_ASSEMBLY_GROSS, locale))
    // The owner's fixed 1 €/km, in whole euros (the old 0.80 and its cents are gone), and a
    // stock container within 7 days.
    expect(block).toContain(fillIn(c.assembly.delivery, { rate: euro(CONTAINER.perKm, locale), days: LEAD_TIMES.containerInStockDays }))
    expect(block).not.toMatch(/0[.,]80?\b/)
    expect(block).not.toMatch(/\{\w+\}/)
    const link = within(container.querySelector('#assembly')).getByRole('link', { name: c.assembly.deliveryLink })
    // Preset to the container, so the calculator opens on the product the visitor was reading.
    expect(link.getAttribute('href')).toBe(`${paths.delivery[locale]}?product=container`)
  })

  it('takes the rate, the crane, the nights and the travel from deliveryRates.js', async () => {
    // Changed in the module for this one render: the page must follow, which a figure typed
    // into the content or the page could not.
    const CONTAINER = DELIVERY_RATES.products.container
    const saved = JSON.parse(JSON.stringify(CONTAINER))
    Object.assign(CONTAINER, { perKm: 7, crane: { optional: true, about: 1234 }, noCrane: { workers: 2, nights: '9–10', travelMax: 321 } })
    try {
      const { container } = await renderLoaded(locale)
      const block = flatSpaces(container.querySelector('#assembly').textContent)
      for (const figure of [euro(7, locale), euro(1234, locale), '9–10', euro(321, locale)]) {
        expect(block).toContain(flatSpaces(figure))
      }
      // Every figure carries the VAT label, since house prices elsewhere include VAT.
      const vat = { bg: 'без ДДС', en: 'excl. VAT', el: 'χωρίς ΦΠΑ' }[locale]
      for (const key of ['crane', 'noCrane', 'delivery']) expect(c.assembly[key]).toContain(vat)
    } finally {
      Object.assign(CONTAINER, saved)
    }
  })

  it('states the warranty after assembly and delivery, every year read from warranty.js', async () => {
    // Changed in the module for this one render, as the delivery figures above: the real 15, 6,
    // 6 and 2, typed into the content, would print here instead.
    const saved = { ...WARRANTY_YEARS }
    Object.assign(WARRANTY_YEARS, { structure: 17, panels: 9, joinery: 8, sanitary: 5 })
    try {
      const { container } = await renderLoaded(locale)
      const block = container.querySelector('#warranty')
      expect(block.previousElementSibling.id).toBe('assembly')
      expect(block.querySelector('h2#warranty-title').textContent).toBe(c.warranty.heading)
      const rows = [...block.querySelectorAll('dl.pp-terms > div')]
      expect(rows.map((row) => row.dataset.warranty)).toEqual(['structure', 'panels', 'joinery', 'sanitary'])
      rows.forEach((row, i) => {
        expect(row.querySelector('dt').textContent).toBe(c.warranty.rows[i].label)
        expect(row.querySelector('dd').textContent).toBe(fillIn(c.warranty.rows[i].text, { years: WARRANTY_YEARS[row.dataset.warranty] }))
      })
      const text = block.textContent
      // textContent runs a label into its figure ("Structure17"), so digits are delimited by
      // what is not a digit rather than by \b.
      for (const years of [17, 9, 8, 5]) expect(text).toMatch(new RegExp(`(?<!\\d)${years}(?!\\d)`))
      expect(text).not.toMatch(/(?<!\d)(15|6|2)(?!\d)|\{\w+\}/)
      expect(text).toContain(c.warranty.conditions)
      expect(text).toContain(c.warranty.excluded)
    } finally {
      Object.assign(WARRANTY_YEARS, saved)
    }
  })

  it('links the prices table, the gallery filter, the catalogues and the two other lines', async () => {
    const { container } = await renderLoaded(locale)
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain(`${paths.prices[locale]}#item-13`)
    expect(hrefs).toContain(`${paths.gallery[locale]}?cat=wagon`)
    expect(hrefs.filter((h) => h.startsWith('/api/brochures/'))).toEqual([
      `/api/brochures/standard-containers.pdf?lang=${locale}#page=1`,
      `/api/brochures/villa-office.pdf?lang=${locale}#page=1`,
      `/api/brochures/sloped-roof.pdf?lang=${locale}#page=1`,
    ])

    const sibs = container.querySelector('.pp-siblings')
    const houses = within(sibs).getByRole('link', { name: new RegExp(c.siblings.houses.label) })
    expect(houses.getAttribute('href')).toBe(paths.modularHouses[locale])
    // The houses' "from" is the cheapest house without its assembly, and says so.
    expect(houses.textContent).toContain(c.siblings.houses.price.replace('{price}', euro(10511, locale)))
    const steel = within(sibs).getByRole('link', { name: new RegExp(c.siblings.steel.label) })
    expect(steel.getAttribute('href')).toBe(paths.steelHouses[locale])
  })

  it('publishes Product markup in EUR from the same six rows', async () => {
    const { container } = await renderLoaded(locale)
    const blocks = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))
    const list = blocks.find((b) => b['@type'] === 'ItemList')
    expect(list.itemListElement).toHaveLength(6)
    const offers = list.itemListElement.map((entry) => entry.item.offers)
    expect(offers.map((o) => o.price)).toEqual(BY_PRICE.map(priceOf))
    expect(new Set(offers.map((o) => o.priceCurrency))).toEqual(new Set(['EUR']))
    expect(JSON.stringify(list)).not.toMatch(/BGN/)
  })

  it('shows no 78 m², no leva and nothing only a hover would reveal', async () => {
    const { container } = await renderLoaded(locale)
    const main = container.querySelector('main')
    expect(main.textContent).not.toMatch(/78\s?(m²|м²)/)
    expect(main.innerHTML).not.toMatch(/BGN|лв\.?(?![\p{L}])/u)
    // Nothing hidden: no hidden attribute, no inline display:none, and no aria-label that
    // replaces what a card link says (the old cards' screen-reader text did).
    expect(main.querySelectorAll('[hidden], [style*="display: none"], [style*="display:none"]')).toHaveLength(0)
    expect(main.querySelectorAll('.pp-unit a[aria-label], .pp-unit button[aria-label]')).toHaveLength(0)
    // The old stylesheet, whose cards hid their specs below 960px and behind :hover above.
    expect(fs.existsSync(path.resolve(__dirname, '../style/ModularBuilds.css'))).toBe(false)
  })

  it('opens on the owner\'s delivered container, and on the admin\'s photo once one is set', async () => {
    const first = await renderLoaded(locale)
    const img = () => first.container.querySelector('.pp-hero-media img')
    // A static file, so its own 800/1200 srcset: nothing resizes /public.
    expect(img().getAttribute('src')).toBe(DELIVERED_CONTAINER.url)
    expect(img().getAttribute('srcset')).toBe(DELIVERED_CONTAINER.srcSet)
    expect(img().getAttribute('alt')).toBe(c.hero.photo.alt)
    first.unmount()

    photosBody = { hero: [], models: {}, pages: { modularBuilds: { url: '/api/img/home/page-modular-builds.webp', alt: '' }, modularHouses: null, steelHouses: null } }
    const second = renderPage(locale)
    await waitFor(() => expect(second.container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('page-modular-builds'))
    // A blank admin alt falls back to the page's generic one, not the default photo's, which
    // describes a different picture.
    expect(c.hero.adminAlt).toBeTruthy()
    expect(second.container.querySelector('.pp-hero-media img').getAttribute('alt')).toBe(c.hero.adminAlt)
  })

  it('uses the admin\'s own alt on the Bulgarian page only, since it is typed in Bulgarian', async () => {
    photosBody = { hero: [], models: {}, pages: { modularBuilds: { url: '/api/img/home/page-modular-builds.webp', alt: 'Контейнер в двора' }, modularHouses: null, steelHouses: null } }
    const { container } = renderPage(locale)
    await waitFor(() => expect(container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('page-modular-builds'))
    expect(container.querySelector('.pp-hero-media img').getAttribute('alt')).toBe(locale === 'bg' ? 'Контейнер в двора' : c.hero.adminAlt)
  })

  it('opens on the admin\'s photo from the first render once an answer is kept', async () => {
    // What the snapshot's <head> copy gives a fresh load (homePhotos.test.js reads that path);
    // here an earlier answer on the same visit stands in for it.
    photosBody = { hero: [], models: {}, pages: { modularBuilds: { url: '/api/img/home/page-modular-builds.webp', alt: '' } } }
    await fetchHomePhotos()
    expect(document.getElementById(HOME_PHOTOS_SEED_ID)).not.toBeNull()

    const { container } = renderPage(locale)
    // No waiting: the very first render has it, so there is no swap from the default.
    expect(container.querySelector('.pp-hero-media img').getAttribute('src')).toContain('page-modular-builds')
  })
})

describe('the content files', () => {
  it.each(['en', 'el'])('%s holds no Cyrillic, and neither does its rendered page', async (locale) => {
    expect(strings(CONTENT[locale]).filter(([, text]) => CYRILLIC.test(text))).toEqual([])
    const { container } = await renderLoaded(locale)
    expect(container.querySelector('main').textContent).not.toMatch(CYRILLIC)
  })

  it.each(['bg', 'en', 'el'])('%s types no price and no leva', (locale) => {
    // Figures in euros are filled in from the rows; a typed one is how the brochures' 4,240
    // and 5,370 ended up in the markup.
    const typed = strings(CONTENT[locale]).filter(([, text]) => /€\s?\d|\d\s?€|\bEUR\b|евро|ευρώ|BGN|лв/.test(text))
    expect(typed).toEqual([])
  })

  it('has the same keys in every language', () => {
    const keys = (obj) => strings(obj).map(([at]) => at).sort()
    expect(keys(en)).toEqual(keys(bg))
    expect(keys(el)).toEqual(keys(bg))
  })
})

// 2026-10-16: container buyers can choose the internal doors (internalDoors.js says so), so the
// specs links end with the doors page.
describe.each(['bg', 'en', 'el'])('ModularBuildsPage doors link (%s)', (locale) => {
  it('links the internal doors from what every container has', async () => {
    const { container } = await renderLoaded(locale)
    const specs = container.querySelector('#specs')
    expect(within(specs).getByRole('link', { name: CONTENT[locale].specs.doorsLink })).toHaveAttribute('href', paths.doors[locale])
  })
})
