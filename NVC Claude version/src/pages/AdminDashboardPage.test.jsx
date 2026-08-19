import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboardPage from './AdminDashboardPage.jsx'

// The reporting screen.
//
// Pinned: the numbers are the server's, verbatim; a COGS-less period says so in words and
// dashes rather than pretending; the opex cap colors as a ceiling (under = good) where
// revenue colors as a floor; and the finance tab groups the money screens on a phone.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/dashboard']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const DASH = {
  period: 'month', periodLabel: '2026-08',
  revenueEur: 15000, cogsEur: 4500, grossProfitEur: 10500,
  saleExpensesEur: 300, opexEur: 1000, netResultEur: 9200, unitsSold: 2,
  targets: [
    { metricKey: 'revenue', targetValue: 20000, actualValue: 15000 },
    { metricKey: 'opex-cap', targetValue: 1500, actualValue: 1000 },
  ],
  byModel: [
    { productModelName: 'Разгъваема къща 58м²', qtySold: 2, revenueEur: 15000, cogsEur: 4500, grossProfitEur: 10500 },
  ],
  opexByCategory: [{ key: 'warehouse', total: 1000, count: 1 }],
  byMonth: [],
  stock: { unitsOnHand: 5, valueEur: 6750, unpricedUnits: 2 },
  cycleCosts: null,
}

let calls = []
let dash = DASH

beforeEach(() => {
  calls = []
  dash = DASH
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/dashboard')) return json(dash)
    if (u.includes('/api/admin/buy-cycles')) return json([{ id: 1, label: '2024-2026', isClosed: false }])
    return json({})
  }))
})

describe('AdminDashboardPage', () => {
  it('renders the server’s figures and the stock line with its unpriced caveat', async () => {
    render(<AdminDashboardPage />)

    await waitFor(() => expect(screen.getByText('€15,000')).toBeInTheDocument())
    expect(screen.getByText('€9,200')).toBeInTheDocument()
    // Stock says what it could not value rather than absorbing it.
    expect(screen.getByText(/5 бр\. на стойност €6,750/)).toBeInTheDocument()
    expect(screen.getByText(/\+2 бр\. без курс/)).toBeInTheDocument()
  })

  it('treats the opex cap as a ceiling and revenue as a floor', async () => {
    render(<AdminDashboardPage />)
    await waitFor(() => expect(screen.getByText('Цели за периода')).toBeInTheDocument())

    // Revenue at 75% of a floor target: shown, not celebrated.
    expect(screen.getByText(/75% от целта/)).toBeInTheDocument()
    // Opex at 67% of a CEILING: under the cap, which is the good side.
    expect(screen.getByText(/под тавана/)).toBeInTheDocument()
  })

  it('says COGS is unknown instead of showing a number nobody computed', async () => {
    dash = { ...DASH, cogsEur: null, grossProfitEur: null, netResultEur: null }
    render(<AdminDashboardPage />)

    await waitFor(() => expect(screen.getByText(/себестойността е неизвестна/)).toBeInTheDocument())
    // The cards show dashes for the poisoned figures while revenue stays real.
    expect(screen.getByText('€15,000')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('switching to a cycle asks the server for that cycle', async () => {
    const user = userEvent.setup()
    render(<AdminDashboardPage />)
    await waitFor(() => expect(screen.getByText('€15,000')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText(/Месец \/ Цикъл \/ Година/), 'cycle')
    await user.selectOptions(screen.getByLabelText('Цикъл'), '1')

    await waitFor(() => {
      const call = calls.find((c) => c.url.includes('period=cycle') && c.url.includes('cycleId=1'))
      expect(call).toBeTruthy()
    })
  })
})
