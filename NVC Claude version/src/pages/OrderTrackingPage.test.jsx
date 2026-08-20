import React from 'react'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelmetProvider } from 'react-helmet-async'
import { I18nProvider } from '../i18n/I18nContext.jsx'
import OrderTrackingPage from './OrderTrackingPage.jsx'

// The customer's tracking page (ROADMAP #27).
//
// The code in the URL is the only credential, so what this page is ALLOWED to show is the
// thing worth testing: a timeline and dates, never money, and a wrong or revoked link must
// look identical to a stranger.
//
// Since 2026-08-20 staff move every status by hand, so the page also has to be honest about
// AGE — when each step happened, and when a carrier note stopped being fresh.

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

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

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
  carrierCheckedAt: daysAgo(2),
  orderedAt: '2026-06-01',
  history: [
    { status: 'placed', at: '2026-06-01T10:00:00Z' },
    { status: 'fabricating', at: '2026-06-20T10:00:00Z' },
    { status: 'travelling', at: '2026-08-01T10:00:00Z' },
  ],
  imageUrl: null,
  updatedAt: '2026-08-18T09:00:00Z',
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

afterEach(() => {
  // The language is remembered in localStorage, so a test that switches it would otherwise
  // decide the language of every test that runs after it.
  localStorage.removeItem('lang')
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

  it('leads with what is happening now, in a sentence', async () => {
    render()

    // The question the customer arrived with, answered before any table. The step label
    // alone ("Travelling") is a state; this is an answer.
    await waitFor(() => expect(screen.getByText('On its way to you')).toBeInTheDocument())
    expect(screen.getByText(/At sea\./)).toBeInTheDocument()
  })

  it('dates the steps that actually happened, and leaves the rest undated', async () => {
    render()
    await waitFor(() => expect(screen.getByText('Travelling')).toBeInTheDocument())

    // Read the dates off the timeline itself: the order date also appears in the footer,
    // and asserting on the page as a whole would pass on the wrong one.
    const dated = [...document.querySelectorAll('.order-track-steps li')].map((li) => [
      li.querySelector('.ot-step-name')?.textContent,
      li.querySelector('.ot-step-date')?.textContent ?? null,
    ])

    expect(dated).toEqual([
      ['Placed', '1 June 2026'],
      ['In production', '20 June 2026'],
      // 'scheduled' has no entry, so it carries no date rather than a guessed one.
      ['Scheduled for shipment', null],
      ['Travelling', '1 August 2026'],
      ['At the harbour', null],
      ['Ready for delivery', null],
      ['Delivered', null],
    ])
  })

  it('labels both dates as estimates', async () => {
    render()
    await waitFor(() => expect(screen.getByText('15 September 2026')).toBeInTheDocument())

    // A date shown as certain and then missed costs more trust than no date at all.
    expect(screen.getAllByText(/approximate/).length).toBe(2)
  })

  it('renders a plain day as the day the office typed, in any timezone', async () => {
    // "2026-09-15" parsed as an instant is UTC midnight, which is the 14th for a customer
    // in the Americas. The date on the page must be the date that was entered.
    payload = { ...ORDER, expectedAtHarbor: '2026-01-01', expectedReadyAt: null }
    render()

    await waitFor(() => expect(screen.getByText('1 January 2026')).toBeInTheDocument())
    expect(screen.queryByText(/31 December/)).not.toBeInTheDocument()
  })

  it('shows the carrier’s word with the date it was true', async () => {
    render()
    await waitFor(() => expect(screen.getByText('Напусна Сингапур')).toBeInTheDocument())

    // The "as of" is what lets a three-week-old note read as old.
    expect(screen.getByText(/as of/)).toBeInTheDocument()
  })

  it('says so out loud when the carrier’s word has gone stale', async () => {
    payload = { ...ORDER, carrierCheckedAt: daysAgo(21) }
    render()

    // Staff type these between other work, so a note going quiet is normal. Leaving a
    // three-week-old position to read as today's is the disappointment this page avoids.
    await waitFor(() => expect(screen.getByText(/more than a week old/i)).toBeInTheDocument())
  })

  it('does not cry stale over a note from this week', async () => {
    render()
    await waitFor(() => expect(screen.getByText('Напусна Сингапур')).toBeInTheDocument())
    expect(screen.queryByText(/more than a week old/i)).not.toBeInTheDocument()
  })

  it('shows the customer their own model when there is a photo of it', async () => {
    payload = { ...ORDER, imageUrl: '/api/images/house/42' }
    render()

    await waitFor(() => expect(screen.getByAltText('Разгъваема къща 58м²')).toBeInTheDocument())
    expect(screen.getByAltText('Разгъваема къща 58м²')).toHaveAttribute('src', '/api/images/house/42')
  })

  it('speaks Greek to a Greek visitor', async () => {
    // The site sells in three languages and this link lands wherever the customer is.
    localStorage.setItem('lang', 'el')
    render()

    await waitFor(() => expect(screen.getByText('Στον δρόμο προς εσάς')).toBeInTheDocument())
    expect(screen.getByText('Ταξιδεύει')).toBeInTheDocument()
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
    // It offers a way to reach a human rather than a dead end — and at the address the
    // rest of the site actually publishes.
    expect(screen.getByText(/contact@nvc-home4you\.eu/)).toBeInTheDocument()
  })

  it('survives an order with no history, no photo and no dates', async () => {
    // Every order placed before the history table existed looks like this.
    payload = {
      reference: 'plainorder1',
      status: 'placed',
      step: 0,
      timeline: ORDER.timeline,
      model: null,
      expectedAtHarbor: null,
      expectedReadyAt: null,
      carrierName: null,
      carrierNote: null,
      carrierCheckedAt: null,
      orderedAt: null,
      history: [],
      imageUrl: null,
      updatedAt: null,
    }
    render('plainorder1')

    await waitFor(() => expect(screen.getByText('Order placed')).toBeInTheDocument())
    expect(document.querySelectorAll('.order-track-steps li').length).toBe(7)
    expect(document.querySelector('.ot-step-date')).toBeNull()
  })
})
