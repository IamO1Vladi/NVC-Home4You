import React from 'react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import HomePage from './HomePage.jsx'
import enHome from '../content/en/home.js'
import { getPriceRows } from '../content/shared/prices.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { forgetHomePhotos } from '../lib/homePhotos.js'

// The home page as the redesign left it: the section order, the figures that must come
// from the price helpers rather than the copy, the links that must carry the real model
// keys and the visitor's language, and the photo fetch that must fall back to the content
// defaults when the API has nothing. The reviews API answers empty, so the testimonials
// section stays unmounted and the heading order below is the order on a fresh site.

const PHOTOS_URL = '/api/home/photos'
const REVIEWS_URL = '/api/reviews/featured'

/** fetch for the page: reviews empty, photos as `photos` says (a 404 by default). */
function stubFetch({ photos = null } = {}) {
  return vi.fn((url) => {
    const href = String(url)
    if (href.includes(REVIEWS_URL)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [], averageRating: 0, totalCount: 0 }) })
    }
    if (href.includes(PHOTOS_URL)) {
      if (!photos) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(photos) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })
}

function renderHome(props = {}) {
  return render(
    <MemoryRouter initialEntries={['/en']}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        <HomePage locale="en" bundle={enHome} {...props} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // The photo body is kept for the visit (and its figure with it); each test is a first visit.
    forgetHomePhotos()
  })

  it('renders the sections in the approved order', async () => {
    vi.stubGlobal('fetch', stubFetch())
    const { container } = renderHome()

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(PHOTOS_URL), expect.anything()))

    expect(container.querySelector('main.hp')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Because a home shouldn't be an expense")

    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(h2s).toEqual([
      '3 models from €14,000 — build yours online',
      enHome.home.serviceTiles.heading,
      enHome.home.catalogues.heading,
      enHome.home.steps.heading,
      enHome.home.whyUs.heading,
      enHome.home.finalCta.title,
    ])

    // The band sits between the hero and the prices strip.
    const main = container.querySelector('main.hp')
    const order = [...main.children].map((el) => el.id || el.className)
    expect(order.indexOf('contact-band')).toBe(order.indexOf('hp-hero') + 1)
    expect(order.indexOf('prices')).toBe(order.indexOf('contact-band') + 1)

    // The glide carousel and its section are gone from the page.
    expect(container.querySelector('section.gl')).toBeNull()
  })

  it('quotes the cheapest container in the hero lead, from the figure the photos call brings', async () => {
    vi.stubGlobal('fetch', stubFetch({
      photos: { hero: [], models: { 37: null, 58: null, 73: null }, from: { wagon: 4300, modular: 10500 } },
    }))
    const { container } = renderHome()

    // The cheapest thing sold, VAT and assembly in (owner, 2026-10-12), not the Box house the
    // strip below quotes; and the figure is the API's, not one typed into the copy.
    await waitFor(() => expect(container.querySelector('.hp-lead')).toHaveTextContent('€4,300'))
    expect(container.querySelector('.hp-lead strong')).toHaveTextContent('€4,300')
    expect(container.querySelector('.hp-lead')).toHaveTextContent(enHome.home.hero.lead.replace('{price}', '€4,300'))
    expect(container.querySelector('.hp-lead')).not.toHaveTextContent('€14,000')
    // One request for photos and figure together.
    expect(global.fetch.mock.calls.filter(([url]) => String(url).includes(PHOTOS_URL))).toHaveLength(1)
    // The strip keeps quoting its Box models from its own helpers.
    expect(screen.getByRole('heading', { level: 2, name: '3 models from €14,000 — build yours online' })).toBeInTheDocument()
  })

  it('prints the lead without any figure until the API gives one', async () => {
    vi.stubGlobal('fetch', stubFetch())
    const { container } = renderHome()

    // While the call is out and after it fails (a 404 here), the lead has no figure at all.
    expect(container.querySelector('.hp-lead')).toHaveTextContent(enHome.home.hero.leadNoPrice)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(PHOTOS_URL), expect.anything()))
    expect(container.querySelector('.hp-lead')).toHaveTextContent(enHome.home.hero.leadNoPrice)
    expect(container.querySelector('.hp-lead')).not.toHaveTextContent('€')
    expect(container.querySelector('.hp-lead strong')).toBeNull()
  })

  it('prints the lead without a figure when an older API sends photos but no from', async () => {
    vi.stubGlobal('fetch', stubFetch({ photos: { hero: [], models: { 37: null, 58: null, 73: null } } }))
    const { container } = renderHome()

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(PHOTOS_URL), expect.anything()))
    expect(container.querySelector('.hp-lead')).toHaveTextContent(enHome.home.hero.leadNoPrice)
    expect(container.querySelector('.hp-lead')).not.toHaveTextContent('€')
  })

  it('accents the slogan and points the second hero button at the prices strip', () => {
    vi.stubGlobal('fetch', stubFetch())
    const { container } = renderHome()

    expect(container.querySelector('.hp-slogan .hp-em')).toHaveTextContent('home')
    // The second hero button jumps to the prices strip, whose id is the anchor.
    expect(screen.getByRole('link', { name: enHome.home.hero.pricesCta })).toHaveAttribute('href', '#prices')
    expect(container.querySelector('#prices')).not.toBeNull()
  })

  it('links the three model cards into the configurator by real model key', () => {
    vi.stubGlobal('fetch', stubFetch())
    const { container } = renderHome()

    const hrefs = [...container.querySelectorAll('a.hp-model')].map((a) => a.getAttribute('href'))
    expect(hrefs).toHaveLength(3)
    expect(hrefs[0]).toMatch(/\?model=37$/)
    expect(hrefs[1]).toMatch(/\?model=58$/)
    expect(hrefs[2]).toMatch(/\?model=73$/)
    expect(hrefs.every((h) => h.startsWith('/en/'))).toBe(true)

    // Each card quotes the house without its assembly and says so under the figure; that is
    // the base price the configurator opens on.
    const rows = getPriceRows('en')
    const prices = [...container.querySelectorAll('a.hp-model .hp-model-price')].map((el) => el.textContent)
    rows.forEach((row, i) => {
      expect(prices[i]).toContain(euro(row.standard.house, 'en'))
      expect(prices[i]).not.toContain(euro(row.standard.total, 'en'))
    })
    container.querySelectorAll('a.hp-model .hp-model-incl').forEach((el) =>
      expect(el).toHaveTextContent(enHome.home.strip.incl))

    // Without an admin slot the cards show the static catalogue renders.
    const srcs = [...container.querySelectorAll('a.hp-model img')].map((img) => img.getAttribute('src'))
    expect(srcs[0]).toContain('box-config/')
    expect(srcs[1]).toContain('box-config/')
  })

  it('links the six catalogues through the brochure API in the page language', () => {
    vi.stubGlobal('fetch', stubFetch())
    const { container } = renderHome()

    const section = container.querySelector('#catalogues')
    expect(section).not.toBeNull()
    const links = within(section).getAllByRole('link')
    expect(links).toHaveLength(6)
    const slugs = ['modular-builds', 'standard-containers', 'villa-office', 'sloped-roof', 'box-house', 'space-capsules']
    links.forEach((a, i) => {
      expect(a.getAttribute('href')).toBe(`/api/brochures/${slugs[i]}.pdf?lang=en#page=1`)
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toContain('noopener')
    })

    // The strip's "Prefer paper?" line sits under the box-house prices, so it opens the
    // box-house brochure rather than the general catalogue, in English too.
    const paper = container.querySelector('.hp-paper a[target="_blank"]')
    expect(paper.getAttribute('href')).toBe('/api/brochures/box-house.pdf?lang=en#page=1')
  })

  it('prints the phone and the email as links, from the content file', () => {
    vi.stubGlobal('fetch', stubFetch())
    const { container } = renderHome()

    const tels = [...container.querySelectorAll('a[href^="tel:"]')]
    expect(tels.length).toBeGreaterThanOrEqual(2)
    tels.forEach((a) => expect(a).toHaveAttribute('href', 'tel:+359879355269'))

    const mails = [...container.querySelectorAll('a[href^="mailto:"]')]
    expect(mails.length).toBeGreaterThanOrEqual(2)
    mails.forEach((a) => expect(a).toHaveAttribute('href', 'mailto:contact@nvc-home4you.eu'))

    expect(container.querySelector('.hp-where')).toHaveTextContent(enHome.home.finalCta.where)

    // The schema reads the same object the page prints from.
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]').textContent)
    expect(ld.telephone).toBe('+359879355269')
    expect(ld.address.addressLocality).toBe('Petrich')
    expect(ld.openingHoursSpecification[0]).toMatchObject({ opens: '07:00', closes: '19:00' })
  })

  it('shows the content photographs while the API has none', async () => {
    vi.stubGlobal('fetch', stubFetch())
    const { container } = renderHome()

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(PHOTOS_URL), expect.anything()))

    const slides = container.querySelectorAll('.hp-hero-media .hp-slide img')
    expect(slides).toHaveLength(5)
    expect(slides[0].getAttribute('src')).toContain('/api/img/content/bukcsfwf9-rdg-eg-vb.webp')
    expect(slides[0].getAttribute('sizes')).toBe('(max-width: 767px) 100vw, 78vw')
    expect(slides[0]).toHaveAttribute('width')
    expect(slides[0]).toHaveAttribute('height')
    // Five numerals, the first selected, each named for a screen reader.
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('aria-label', 'Photo 1 of 5: Container units')
  })

  it('uses the admin slots for the hero and the model cards when the API has them', async () => {
    vi.stubGlobal('fetch', stubFetch({
      photos: {
        hero: [
          { slot: 'hero-1', url: '/api/img/home/1/porch.webp', alt: 'A porch' },
          { slot: 'hero-3', url: '/api/img/home/3/kitchen.webp', alt: '' },
        ],
        models: { 37: null, 58: { url: '/api/img/gallery/8/fiftyeight.webp', alt: '' }, 73: null },
      },
    }))
    const { container } = renderHome()

    await waitFor(() => {
      const first = container.querySelector('.hp-hero-media .hp-slide img')
      expect(first.getAttribute('src')).toContain('/api/img/home/1/porch.webp')
    })

    const slides = container.querySelectorAll('.hp-hero-media .hp-slide img')
    expect(slides).toHaveLength(2)
    expect(slides[1].getAttribute('src')).toContain('/api/img/home/3/kitchen.webp')
    // The caption beside the numerals still goes by the default in that position.
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-label', 'Photo 2 of 2: Modular houses')

    const cards = [...container.querySelectorAll('a.hp-model img')].map((img) => img.getAttribute('src'))
    expect(cards[0]).toContain('box-config/')
    expect(cards[1]).toContain('/api/img/gallery/8/fiftyeight.webp')
    expect(cards[2]).toContain('box-config/')
  })
})
