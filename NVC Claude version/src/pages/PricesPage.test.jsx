import React from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { Link, MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import PricesPage from './PricesPage.jsx'
import { paths } from '../routes/paths.js'
import { getRouteSeo } from '../seo/routeMeta.js'
import { startingPrice } from '../content/shared/prices.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { getPricesCopy } from '../content/shared/pricesCopy.js'

// The "finished house from" figure, and the title that repeats it.
//
// Both said something untrue for a while. The page took the minimum over every box row's
// total, and a row with no assembly mapped has a total equal to its bare price — so the
// 18 m² house, whose assembly is quoted on request, put "finished house from €10,500" under
// the H1. And the title carries the same figure typed by hand (the SEO manifest generator
// cannot load the catalogue), so nothing noticed when the two drifted apart. These pin
// both to startingPrice(), the cheapest house that can actually be finished at a known cost.
//
// The gallery rows below are shaped like /api/gallery's, with the live prices of the four
// models that matter: the 18 m² house (no assembly mapped, the cheapest box row), the
// 37 m² house (the real starting point), a bigger house and one wagon.

const GALLERY = [
  { id: 100016, category: 'modular', price: 10500, currency: 'EUR', title: 'Expandable House – 18 m²', titleBg: 'Разгъваема къща – 18 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 18 m²', coverUrl: '/api/img/gallery/100016/a.webp', images: [] },
  { id: 10, category: 'modular', price: 14000, currency: 'EUR', title: 'Expandable House – 37 m²', titleBg: 'Разгъваема къща – 37 м²', titleEl: 'Αναπτυσσόμενη κατοικία – 37 m²', coverUrl: '/api/img/gallery/10/a.webp', images: [] },
  { id: 5, category: 'modular', price: 23000, currency: 'EUR', title: 'Expandable House – 58 m²', titleBg: 'Разгъваема къща – 58 м²', titleEl: 'Αναπτυσσόμενη κατοικία — 58 m²', coverUrl: '/api/img/gallery/5/a.webp', images: [] },
  { id: 13, category: 'wagon', price: 4300, currency: 'EUR', title: 'Container House – 6000mm*3000mm', titleBg: 'Контейнерна къща – 6 × 3 м', titleEl: 'Σπίτι τύπου Container – 6000 mm × 3000 mm', coverUrl: '/api/img/gallery/13/a.webp', images: [] },
]

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

  it('is the catalogue starting price: 14,840, the 37 m² house with its assembly', () => {
    // The fixture's 37 m² row is 14,000 + 700 net assembly × 1.2. If the catalogue and the
    // gallery ever disagree on it, this is the line that says so.
    expect(startingPrice('bg')).toBe(14840)
  })

  it.each(['bg', 'en', 'el'])('leaves out the house whose assembly is on request (%s)', async (locale) => {
    const { container, unmount } = renderPrices(locale)

    // Wait for the gallery rows: the 18 m² card renders, so it is still listed...
    await waitFor(() => expect(container.querySelector('#item-100016')).not.toBeNull())

    // ...but the headline figure is the cheapest FINISHED house, not its bare 10,500.
    const value = container.querySelector('.prices-from-value').textContent
    expect(value).toBe(euro(startingPrice(locale), locale))
    expect(value).not.toBe(euro(10500, locale))
    unmount()
  })
})

describe('the prices title', () => {
  it.each(['bg', 'en', 'el'])('states the same starting price the page prints (%s)', (locale) => {
    const { title } = getRouteSeo(paths.prices[locale], locale)
    expect(spaces(title)).toContain(spaces(euro(startingPrice(locale), locale)))
  })
})

// The rows whose assembly is on request: the 18 m² house today, and the capsule. Their
// "total" is only the house's own price, and the headline fix above left the card and the
// table printing it under "Общо с ДДС", so the page said "finished from €14,840" and, one
// line further down, "total €10,500". Those cells now say the assembly is on request, and
// the Offer markup keeps the real house price without calling it a total.
describe('a row whose assembly is on request', () => {
  beforeAll(stubGallery)

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it.each(['bg', 'en', 'el'])('shows no total on its card or in the table (%s)', async (locale) => {
    const t = getPricesCopy(locale)
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-100016')).not.toBeNull())

    const cardTotal = (id) => container.querySelector(`#item-${id} .prices-card-total strong`).textContent
    expect(cardTotal(100016)).toBe(t.assemblyOnRequest)
    // A house with known assembly still shows its finished total.
    expect(cardTotal(10)).toBe(euro(14840, locale))

    const tableTotal = (pattern) => {
      const row = [...container.querySelectorAll('.prices-table tbody tr')]
        .find((tr) => pattern.test(tr.querySelector('.prices-model-name').textContent))
      return row.querySelector('td.is-total').textContent
    }
    expect(tableTotal(/\s18\s/)).toBe(t.assemblyOnRequest)
    expect(tableTotal(/\s37\s/)).toBe(euro(14840, locale))
    unmount()
  })

  it.each(['bg', 'en', 'el'])('keeps its house price in the Offer markup but does not call it a total (%s)', async (locale) => {
    const t = getPricesCopy(locale)
    const { container, unmount } = renderPrices(locale)
    await waitFor(() => expect(container.querySelector('#item-100016')).not.toBeNull())

    const script = container.querySelector('script[type="application/ld+json"]')
    const products = JSON.parse(script.textContent).itemListElement.map((entry) => entry.item)
    const byAnchor = (id) => products.find((p) => p.url.endsWith(`#item-${id}`))

    const onRequest = byAnchor(100016)
    expect(onRequest.offers.price).toBe(10500)
    expect(onRequest.description).not.toContain(t.colTotal)
    expect(onRequest.description).toContain(t.assemblyOnRequest)

    const finished = byAnchor(10)
    expect(finished.offers.price).toBe(14840)
    expect(finished.description).toContain(`${t.colTotal}: ${euro(14840, locale)}`)
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
