import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import DeliveryEstimator from './DeliveryEstimator.jsx'
import bgDelivery from '../content/bg/delivery.js'
import elDelivery from '../content/el/delivery.js'
import enDelivery from '../content/en/delivery.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { DELIVERY_RATES } from '../content/shared/deliveryRates.js'

// The delivery-cost estimator on /…/delivery. The audit found the Greek page printing the
// browser's own English when the geocoder could not be reached ("Failed to fetch"), and
// Leaflet's English control wording on the map.

// jsdom has no renderer for Leaflet's vector layers; the route line is not under test.
vi.mock('react-leaflet', async (importOriginal) => ({
  ...(await importOriginal()),
  Polyline: () => null,
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

function search(estimator, address = 'Θεσσαλονίκη, Εγνατία 1') {
  const input = screen.getByRole('textbox', { name: estimator.strings.placeholder })
  fireEvent.change(input, { target: { value: address } })
  fireEvent.click(screen.getByRole('button', { name: estimator.strings.buttonIdle }))
}

describe('DeliveryEstimator errors', () => {
  it.each([
    ['el', elDelivery.estimator, 'Failed to fetch'],
    ['el', elDelivery.estimator, 'NetworkError when attempting to fetch resource.'],
    ['en', enDelivery.estimator, 'Failed to fetch'],
    ['bg', bgDelivery.estimator, 'Failed to fetch'],
  ])('%s: a network failure shows the page\'s own message, not the browser\'s "%s"', async (_, estimator, browserText) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(browserText)))
    render(<DeliveryEstimator content={estimator} />)

    search(estimator)

    expect(await screen.findByText(estimator.strings.genericError, { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(browserText, { exact: false })).not.toBeInTheDocument()
  })

  it("keeps the estimator's own messages, which are already in the page's language", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }))
    render(<DeliveryEstimator content={elDelivery.estimator} />)

    search(elDelivery.estimator)

    expect(await screen.findByText('Η διεύθυνση δεν βρέθηκε', { exact: false })).toBeInTheDocument()
  })

  it('says so when the geocoder answers with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
    render(<DeliveryEstimator content={elDelivery.estimator} />)

    search(elDelivery.estimator)

    expect(await screen.findByText('Η γεωκωδικοποίηση απέτυχε', { exact: false })).toBeInTheDocument()
  })
})

describe('DeliveryEstimator map', () => {
  it("puts Leaflet's controls in Greek on the Greek page", () => {
    const { container } = render(<DeliveryEstimator content={elDelivery.estimator} />)

    expect(container.querySelector('.leaflet-control-zoom-in')).toHaveAttribute('title', 'Μεγέθυνση')
    expect(container.querySelector('.leaflet-control-zoom-out')).toHaveAttribute('aria-label', 'Σμίκρυνση')
    expect(container.querySelector('.leaflet-control-attribution a[href="https://leafletjs.com"]'))
      .toHaveAttribute('title', 'Βιβλιοθήκη JavaScript για διαδραστικούς χάρτες')
    expect(container.querySelector('img.leaflet-marker-icon')).toHaveAttribute('alt', 'Σημείο στον χάρτη')
  })

  it.each([
    ['en', enDelivery.estimator],
    ['bg', bgDelivery.estimator],
  ])("leaves Leaflet's own wording alone where the content has none (%s)", (_, estimator) => {
    const { container } = render(<DeliveryEstimator content={estimator} />)

    expect(container.querySelectorAll('.leaflet-control-zoom')).toHaveLength(1)
    expect(container.querySelector('.leaflet-control-zoom-in')).toHaveAttribute('title', 'Zoom in')
    expect(container.querySelector('.leaflet-control-attribution a[href="https://leafletjs.com"]'))
      .toHaveAttribute('title', 'A JavaScript library for interactive maps')
    expect(container.querySelector('img.leaflet-marker-icon')).toHaveAttribute('alt', 'Marker')
  })

  it('shows Greek place names in the Greek copy around the map', () => {
    render(<DeliveryEstimator content={elDelivery.estimator} />)

    expect(screen.getByText(/^Κοντέινερ: 1 €\/χλμ από το Μαρικοστίνοβο,/)).toBeInTheDocument()
  })

  // Owner, 2026-10-15: abroad only Greece, at the same rates; other countries on request.
  it.each([
    ['bg', bgDelivery.estimator],
    ['en', enDelivery.estimator],
    ['el', elDelivery.estimator],
  ])('%s: says under the heading that other countries are quoted on request', (_locale, estimator) => {
    render(<DeliveryEstimator content={estimator} />)
    expect(screen.getByText(estimator.strings.countriesNote)).toBeInTheDocument()
  })
})

// The rates are the owner's (2026-10-15, deliveryRates.js): containers 1 €/km, Box houses
// about 2 €/km plus a crane, none of it with VAT. The estimator still prices a container.
describe('DeliveryEstimator rates and search', () => {
  const flat = (text) => String(text).replace(/\s/g, ' ')
  const VAT = { bg: 'без ДДС', en: 'excl. VAT', el: 'χωρίς ΦΠΑ' }
  const LOCALES = { bg: bgDelivery.estimator, en: enDelivery.estimator, el: elDelivery.estimator }

  it.each(Object.keys(LOCALES))('%s: the heading names both products and says the prices are without VAT', (locale) => {
    const { products } = DELIVERY_RATES
    const estimator = LOCALES[locale]
    const sub = flat(estimator.strings.subheading)
    for (const value of [products.container.perKm, products.box.perKm, products.box.crane.about]) {
      expect(sub).toContain(flat(euro(value, locale)))
    }
    expect(sub).toMatch(/без ДДС|exclude VAT|δεν περιλαμβάνουν ΦΠΑ/)
    expect(sub).not.toMatch(/0[.,]8\b|\bEUR\b|евро/)
    expect(estimator.ratePerKm).toBe(products.container.perKm)
    expect(estimator.strings.vatLabel).toBe(VAT[locale])
    expect(estimator).not.toHaveProperty('currency')
  })

  it('limits the address search to the countries we deliver to, so Бургас is not Burgos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    vi.stubGlobal('fetch', fetchMock)
    render(<DeliveryEstimator content={bgDelivery.estimator} />)

    search(bgDelivery.estimator, 'Бургас')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.hostname).toBe('nominatim.openstreetmap.org')
    expect(url.searchParams.get('countrycodes')).toBe('bg,gr')
    expect(url.searchParams.get('q')).toBe('Бургас')
  })

  it('prints whole euros with the VAT label, and a failed search clears the old price', async () => {
    let fail = false
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (fail) return Promise.reject(new TypeError('Failed to fetch'))
      const href = String(url)
      if (href.includes('nominatim')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ lat: '42.6977', lon: '23.3219', display_name: 'София, България' }]) })
      }
      // 174.4 km one way: 348.8 km billed, at 1 €/km.
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ routes: [{ distance: 174400, geometry: { coordinates: [[23.33813, 41.43165], [23.3219, 42.6977]] } }] }),
      })
    }))
    const { container } = render(<DeliveryEstimator content={bgDelivery.estimator} />)
    const price = () => flat(container.querySelector('.est-price').textContent)

    search(bgDelivery.estimator, 'София')
    await waitFor(() => expect(price()).toBe(flat(euro(349, 'bg') + ' без ДДС')))
    expect(screen.getByText('София, България')).toBeInTheDocument()

    fail = true
    search(bgDelivery.estimator, 'Несъществуващо място')
    expect(await screen.findByText(bgDelivery.estimator.strings.genericError, { exact: false })).toBeInTheDocument()
    expect(price()).toBe(bgDelivery.estimator.strings.emptyValue)
    expect(screen.queryByText('София, България')).not.toBeInTheDocument()
  })
})
