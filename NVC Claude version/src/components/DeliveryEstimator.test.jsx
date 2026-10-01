import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import DeliveryEstimator from './DeliveryEstimator.jsx'
import bgDelivery from '../content/bg/delivery.js'
import elDelivery from '../content/el/delivery.js'
import enDelivery from '../content/en/delivery.js'

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

    expect(screen.getByText(/^Βάση: Μαρικοστίνοβο\./)).toBeInTheDocument()
  })
})
