import React from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import PricesPage from './PricesPage.jsx'
import { paths } from '../routes/paths.js'
import { getRouteSeo } from '../seo/routeMeta.js'
import { buildPriceSections, startingPrice } from '../content/shared/prices.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'

// The "finished house from" figure, and the title that repeats it.
//
// Both said something untrue for a while. The page took the minimum over every box row's
// total, and a row with no assembly mapped has a total equal to its bare price — so the
// 18 m² house, while its assembly was quoted on request, put "finished house from €10,500"
// under the H1. And the title carries the same figure typed by hand (the SEO manifest
// generator cannot load the gallery), so nothing noticed when the two drifted apart. These pin
// the headline to the cheapest house that can actually be finished at a known cost, and the
// title to the headline.
//
// The gallery rows below are shaped like /api/gallery's, with the live prices of the models
// that matter: the 18 m² house (its assembly 1,000 net since 2026-10-17, so the cheapest
// finished house at 10,500 + 1,200), the 37 m² house (the catalogue's starting point), a
// bigger house, the capsule (it arrives ready, no assembly), a house added in the admin panel
// that has no assembly cost yet (cheaper than all, so counting it would show) and one wagon.

const GALLERY = [
  { id: 100016, category: 'modular', price: 10500, currency: 'EUR', title: 'Expandable House – 18 m²', titleBg: 'Разгъваема къща – 18 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 18 m²', coverUrl: '/api/img/gallery/100016/a.webp', images: [] },
  { id: 10, category: 'modular', price: 14000, currency: 'EUR', title: 'Expandable House – 37 m²', titleBg: 'Разгъваема къща – 37 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 37 m²', coverUrl: '/api/img/gallery/10/a.webp', images: [] },
  { id: 5, category: 'modular', price: 23000, currency: 'EUR', title: 'Expandable House – 58 m²', titleBg: 'Разгъваема къща – 58 м²', titleEl: 'Αναπτυσσόμενη κατοικία — 58 m²', coverUrl: '/api/img/gallery/5/a.webp', images: [] },
  { id: 100015, category: 'modular', price: 55000, currency: 'EUR', title: 'Space house', titleBg: 'Космическа къща - капсула', titleEl: 'Φουτουριστική κατοικία-κάψουλα', coverUrl: '/api/img/gallery/100015/a.webp', images: [] },
  { id: 100099, category: 'modular', price: 9000, currency: 'EUR', title: 'A new house', titleBg: 'Нова къща', titleEl: 'Νέο σπίτι', coverUrl: '/api/img/gallery/100099/a.webp', images: [] },
  { id: 13, category: 'wagon', price: 4300, currency: 'EUR', title: 'Container House – 6000mm*3000mm', titleBg: 'Контейнерна къща – 6 × 3 м', titleEl: 'Σπίτι τύπου Container – 6000 mm × 3000 mm', coverUrl: '/api/img/gallery/13/a.webp', images: [] },
]

// The cheapest finished house in these rows: the 18 m² one.
const FINISHED_FROM = 10500 + 1200

// Intl puts a no-break space between the digits and the € in Bulgarian; the title is typed
// with an ordinary one. Same figure, so compare them with the spaces made alike.
const spaces = (s) => String(s).replace(/\s/g, ' ')

function renderPrices(locale, { entry = paths.prices[locale], extra = null } = {}) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        {extra}
        <PricesPage locale={locale} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

function stubGallery() {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ items: GALLERY }) })))
}

describe('PricesPage "from" figure', () => {
  beforeAll(stubGallery)

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('is still 14,840 in the catalogue: the 37 m² house with its assembly', () => {
    // The fixture's 37 m² row is 14,000 + 700 net assembly × 1.2. If the catalogue and the
    // gallery ever disagree on it, this is the line that says so. The page falls back to it
    // only when the gallery has no finished row at all.
    expect(startingPrice('bg')).toBe(14840)
  })

  it('is the 18 m² house with its assembly, read from the rows the page renders', () => {
    const { box } = buildPriceSections(GALLERY)
    const finished = box.filter((row) => row.assemblyGross != null || row.arrivesReady)
    expect(Math.min(...finished.map((row) => row.total))).toBe(FINISHED_FROM)
    expect(box.find((row) => row.id === 100016)).toMatchObject({ assemblyNet: 1000, assemblyGross: 1200, total: FINISHED_FROM })
  })

  it.each(['bg', 'en', 'el'])('leaves out a house whose assembly is on request (%s)', async (locale) => {
    const { container, unmount } = renderPrices(locale)

    // Wait for the gallery rows: the new house's card renders, so it is still listed...
    await waitFor(() => expect(container.querySelector('#item-100099')).not.toBeNull())

    // ...but the headline figure is the cheapest FINISHED house, not its bare 9,000.
    const value = container.querySelector('.prices-from-value').textContent
    expect(value).toBe(euro(FINISHED_FROM, locale))
    expect(value).not.toBe(euro(9000, locale))
    unmount()
  })
})

describe('the prices title', () => {
  it.each(['bg', 'en', 'el'])('states the same starting price the page prints (%s)', (locale) => {
    const { title } = getRouteSeo(paths.prices[locale], locale)
    expect(spaces(title)).toContain(spaces(euro(FINISHED_FROM, locale)))
  })
})

// The rows whose assembly is on request: a house added in the admin panel before prices.js
// knows its assembly (the 18 m² house was one until 2026-10-17). Their "total" is only the
// house's own price, and the headline fix above left the card and the table printing it under
// "Общо с ДДС", so the page said "finished from €14,840" and, one line further down, "total
// €10,500". Those cells now say the assembly is on request, and the Offer markup keeps the real
// house price without calling it a total.
describe('a row whose assembly is on request', () => {
  beforeAll(stubGallery)

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it.each(['bg', 'en', 'el'])('shows no total on its card or in the table (%s)', async (locale) => {
    const t = getPricesCopy(locale)
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-100099')).not.toBeNull())

    const cardTotal = (id) => container.querySelector(`#item-${id} .prices-card-total strong`).textContent
    expect(cardTotal(100099)).toBe(t.assemblyOnRequest)
    // A house with known assembly still shows its finished total, the 18 m² one now too.
    expect(cardTotal(10)).toBe(euro(14840, locale))
    expect(cardTotal(100016)).toBe(euro(FINISHED_FROM, locale))

    const tableTotal = (pattern) => {
      const row = [...container.querySelectorAll('.prices-table tbody tr')]
        .find((tr) => pattern.test(tr.querySelector('.prices-model-name').textContent))
      return row.querySelector('td.is-total').textContent
    }
    expect(tableTotal(/^(A new house|Нова къща|Νέο σπίτι)$/)).toBe(t.assemblyOnRequest)
    expect(tableTotal(/\s37\s/)).toBe(euro(14840, locale))
    expect(tableTotal(/\s18\s/)).toBe(euro(FINISHED_FROM, locale))
    unmount()
  })

  it.each(['bg', 'en', 'el'])('keeps its house price in the Offer markup but does not call it a total (%s)', async (locale) => {
    const t = getPricesCopy(locale)
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-100099')).not.toBeNull())

    const script = container.querySelector('script[type="application/ld+json"]')
    const products = JSON.parse(script.textContent).itemListElement.map((entry) => entry.item)
    const byAnchor = (id) => products.find((p) => p.url.endsWith(`#item-${id}`))

    const onRequest = byAnchor(100099)
    expect(onRequest.offers.price).toBe(9000)
    expect(onRequest.description).not.toContain(t.colTotal)
    expect(onRequest.description).toContain(t.assemblyOnRequest)

    const finished = byAnchor(10)
    expect(finished.offers.price).toBe(14840)
    expect(finished.description).toContain(`${t.colTotal}: ${euro(14840, locale)}`)
    unmount()
  })
})

// The capsule needs no assembly: it arrives ready (owner, 2026-10-17). Its row says so where the
// assembly would be, and its price is its finished total, never "on request".
describe('a house that arrives ready', () => {
  beforeAll(stubGallery)

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it.each(['bg', 'en', 'el'])('says so in its assembly cells, and totals at its own price (%s)', async (locale) => {
    const t = getPricesCopy(locale)
    expect(t.arrivesReady).toBeTruthy()
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-100015')).not.toBeNull())

    const card = container.querySelector('#item-100015')
    expect(card.querySelector('.prices-breakdown div:nth-child(2) dd').textContent).toBe(t.arrivesReady)
    expect(card.querySelector('.prices-card-total strong').textContent).toBe(euro(55000, locale))
    expect(card.textContent).not.toContain(t.assemblyOnRequest)

    const row = [...container.querySelectorAll('.prices-table tbody tr')]
      .find((tr) => /Space house|капсула|κάψουλα/.test(tr.querySelector('.prices-model-name').textContent))
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent)
    // House, assembly without VAT, assembly with VAT, total.
    expect(cells).toEqual([euro(55000, locale), t.arrivesReady, t.arrivesReady, euro(55000, locale)])

    const products = JSON.parse(container.querySelector('script[type="application/ld+json"]').textContent).itemListElement.map((entry) => entry.item)
    const capsule = products.find((p) => p.url.endsWith('#item-100015'))
    expect(capsule.offers.price).toBe(55000)
    expect(capsule.description).toContain(`${t.colTotal}: ${euro(55000, locale)}`)
    unmount()
  })
})

// The containers page links to /bg/ceni#item-13. The router does no hash scrolling, and on
// a direct load the cards only exist once /api/gallery answers, so the page scrolls to the
// card itself. jsdom has no scrollIntoView, so a spy stands in and records which element
// it was called on.
describe('a link to one card', () => {
  let scrolled

  beforeAll(stubGallery)

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = vi.fn(function scrollIntoView(options) {
      scrolled.push({ id: this.id, options })
    })
  })

  afterEach(() => {
    delete Element.prototype.scrollIntoView
  })

  it('scrolls to the card on a direct load, once the rows have rendered', async () => {
    const { unmount } = renderPrices('bg', { entry: `${paths.prices.bg}#item-13` })
    await waitFor(() => expect(scrolled.map((s) => s.id)).toContain('item-13'))
    // A plain jump, not an animated one, so reduced motion is never overridden.
    expect(scrolled.at(-1).options).toEqual({ block: 'start' })
    unmount()
  })

  it('scrolls to the card after a client-side navigation', async () => {
    const extra = <Link to={`${paths.prices.bg}#item-13`}>to the containers</Link>
    const { container, getByText, unmount } = renderPrices('bg', { extra })
    await waitFor(() => expect(container.querySelector('#item-13')).not.toBeNull())
    expect(scrolled).toEqual([])

    fireEvent.click(getByText('to the containers'))
    await waitFor(() => expect(scrolled.map((s) => s.id)).toEqual(['item-13']))
    unmount()
  })

  it.each(['#item-999', '#faq', '#item-13x'])('ignores %s', async (hash) => {
    const { container, unmount } = renderPrices('bg', { entry: `${paths.prices.bg}${hash}` })
    await waitFor(() => expect(container.querySelector('#item-13')).not.toBeNull())
    expect(scrolled).toEqual([])
    unmount()
  })
})

// The page's onward links (2026-10-16): until then it linked only to the steel page and the
// configurator, so the containers and Box pages, the delivery calculator and the partner page
// were not reachable from the prices a visitor came for.
describe('PricesPage onward links', () => {
  beforeAll(stubGallery)
  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it.each(['bg', 'en', 'el'])('%s: each section ends with a link to its product page, and carries its id', async (locale) => {
    const t = getPricesCopy(locale)
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-13')).not.toBeNull())

    const box = container.querySelector('#prices-box')
    const wagon = container.querySelector('#prices-wagon')
    expect(box).toContainElement(container.querySelector('#item-10'))
    expect(wagon).toContainElement(container.querySelector('#item-13'))
    const last = (section) => [...section.querySelectorAll('a[href]')].at(-1)
    expect(last(box)).toHaveAttribute('href', paths.modularHouses[locale])
    expect(last(box)).toHaveTextContent(t.boxSectionLink)
    expect(last(wagon)).toHaveAttribute('href', paths.modularBuilds[locale])
    expect(last(wagon)).toHaveTextContent(t.wagonSectionLink)
    unmount()
  })

  it.each(['bg', 'en', 'el'])('%s: "not included" links to the delivery calculator', async (locale) => {
    const t = getPricesCopy(locale)
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-13')).not.toBeNull())
    const scope = container.querySelector('.prices-scope')
    const link = [...scope.querySelectorAll('a')].find((a) => a.textContent === t.excludedLink)
    expect(link).toHaveAttribute('href', paths.delivery[locale])
    unmount()
  })

  it.each(['bg', 'en', 'el'])('%s: the volume line names the partner thresholds from partnerTerms.js and opens its form', async (locale) => {
    const { PARTNER_MIN_UNITS } = await import('../content/shared/partnerTerms.js')
    const t = getPricesCopy(locale)
    expect(t.volumeLink).not.toMatch(/\{\w+\}/)
    expect(t.volumeLink).toContain(String(PARTNER_MIN_UNITS.container))
    expect(t.volumeLink).toContain(String(PARTNER_MIN_UNITS.box))
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-13')).not.toBeNull())
    const link = container.querySelector('.prices-volume a')
    expect(link).toHaveAttribute('href', `${paths.partner[locale]}#zapitvane`)
    expect(link).toHaveTextContent(t.volumeLink)
    unmount()
  })

  it('types no threshold into the copy: the figures are placeholders', async () => {
    const { PRICES_COPY } = await import('../content/shared/pricesCopy.js')
    for (const copy of Object.values(PRICES_COPY)) {
      expect(copy.volumeLink).toContain('{containerMin}')
      expect(copy.volumeLink).toContain('{boxMin}')
      expect(copy.volumeLink).not.toMatch(/\d/)
    }
  })
})

describe('PricesPage section anchors', () => {
  let scrolled
  beforeAll(stubGallery)
  afterAll(() => {
    vi.unstubAllGlobals()
  })
  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = function scrollIntoView(options) { scrolled.push({ id: this.id, options }) }
  })
  afterEach(() => {
    delete Element.prototype.scrollIntoView
  })

  it.each(['prices-box', 'prices-wagon'])('scrolls to #%s on a direct load, once the rows have rendered', async (id) => {
    const { unmount } = renderPrices('bg', { entry: `${paths.prices.bg}#${id}` })
    await waitFor(() => expect(scrolled.map((s) => s.id)).toContain(id))
    expect(scrolled.at(-1).options).toEqual({ block: 'start' })
    unmount()
  })
})

