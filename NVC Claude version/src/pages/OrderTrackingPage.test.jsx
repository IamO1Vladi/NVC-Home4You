import React from 'react'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HelmetProvider } from 'react-helmet-async'
import { I18nProvider } from '../i18n/I18nContext.jsx'
import OrderTrackingPage from './OrderTrackingPage.jsx'

// The customer's tracking page (ROADMAP #27).
//
// The code in the URL is the only credential, so what this page is ALLOWED to show is the
// thing worth testing: a timeline and dates, never money, and a wrong or revoked link must
// look identical to a stranger.

const render = (reference = 'abcd123456') =>
  rtlRender(
    <HelmetProvider>
      <I18nProvider>
        <MemoryRouter initialEntries={[`/order/${reference}`]}>
          <Routes>
            <Route path="/order/:reference" element={<OrderTrackingPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </HelmetProvider>,
  )

const ORDER = {
  reference: 'abcd123456',
  status: 'travelling',
  step: 3,
  timeline: ['placed', 'fabricating', 'scheduled', 'travelling', 'at-harbor', 'ready', 'delivered'],
  model: 'Разгъваема къща 58м²',
  expectedAtHarbor: '2026-09-15',
  expectedReadyAt: '2026-09-30',
  carrierName: 'Maersk',
  carrierNote: 'Напусна Сингапур',
  carrierCheckedAt: '2026-08-18T09:00:00Z',
  orderedAt: '2026-06-01',
}

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

let payload = ORDER
let httpStatus = 200

beforeEach(() => {
  payload = ORDER
  httpStatus = 200
  vi.stubGlobal('fetch', vi.fn(() => json(payload, httpStatus)))
})

describe('OrderTrackingPage', () => {
  it('draws the timeline and marks where the order actually is', async () => {
    render()

    await waitFor(() => expect(screen.getByText('Travelling')).toBeInTheDocument())

    // Every step is named — a customer gets words, not a percentage to interpret.
    expect(screen.getByText('In production')).toBeInTheDocument()
    expect(screen.getByText('Delivered')).toBeInTheDocument()

    // And the current one is marked for assistive tech, not just visually.
    const current = document.querySelector('[aria-current="step"]')
    expect(current).toHaveTextContent('Travelling')
  })

  it('labels both dates as estimates', async () => {
    render()
    await waitFor(() => expect(screen.getByText(/2026-09-15/)).toBeInTheDocument())

    // A date shown as certain and then missed costs more trust than no date at all.
    expect(screen.getAllByText(/approximate/).length).toBe(2)
  })

  it('shows the carrier’s word with the date it was true', async () => {
    render()
    await waitFor(() => expect(screen.getByText('Напусна Сингапур')).toBeInTheDocument())

    // The "as of" is what lets a three-week-old note read as old.
    expect(screen.getByText(/as of/)).toBeInTheDocument()
  })

  it('never renders money, however the payload grows', async () => {
    // The guard against a future field leaking through: the page must not print anything
    // currency-shaped even if the server one day sends it.
    payload = { ...ORDER, finalPrice: 24900, leftToPay: 19900, customerName: 'Иван Петров' }
    render()
    await waitFor(() => expect(screen.getByText('Travelling')).toBeInTheDocument())

    expect(screen.queryByText(/24[ ,.]?900/)).not.toBeInTheDocument()
    expect(screen.queryByText(/19[ ,.]?900/)).not.toBeInTheDocument()
    expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument()
  })

  it('a cancelled order gets a plain statement, not a frozen timeline', async () => {
    payload = { ...ORDER, status: 'cancelled', step: -1 }
    render()

    await waitFor(() => expect(screen.getByText(/cancelled/i)).toBeInTheDocument())
    // No progress list at all — cancelled is not a step on the way to anywhere.
    expect(document.querySelector('.order-track-steps')).toBeNull()
  })

  it('a wrong or revoked link says the same thing either way', async () => {
    httpStatus = 404
    payload = { error: 'not_found' }
    render('revokedcode')

    await waitFor(() => expect(screen.getByText('No such order')).toBeInTheDocument())
    // It offers a way to reach a human rather than a dead end.
    expect(screen.getByText(/info@nvc-home4you.eu/)).toBeInTheDocument()
  })
})
