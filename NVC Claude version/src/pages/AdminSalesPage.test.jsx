import React from 'react'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSalesPage from './AdminSalesPage.jsx'

// Sales to customers, after the buy side was archived (2026-08-19).
//
// What is pinned: the customer is the link and the save refuses without one, the money is
// the server's, and the page never calls its net figure "profit" — the cost of the goods
// left with the procurement ledger, so a margin here would be a guess.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/sales']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const SALES = [
  {
    id: 1, customerId: 7, customerName: 'Иван Петров', description: 'Разгъваема къща 58м²',
    soldAt: '2026-08-10', quantity: 1, unitSalePrice: 24900,
    paymentFees: 120, transportCost: 250, installationCost: 800, otherCosts: null,
    saleAmountEur: 24900, saleExpensesEur: 1170, netEur: 23730,
    notes: null, updatedAt: null, updatedByUpn: null,
  },
  {
    // One of the 30 rows imported from Quickbase: no customer link, its QB customer name
    // sitting in the notes instead.
    id: 2, customerId: null, customerName: null, description: null,
    soldAt: '2026-07-02', quantity: 2, unitSalePrice: 4000,
    paymentFees: null, transportCost: null, installationCost: null, otherCosts: null,
    saleAmountEur: 8000, saleExpensesEur: 0, netEur: 8000,
    notes: 'Импортирана от Quickbase (rid 3). Клиент по Quickbase: Мария Иванова.',
    updatedAt: null, updatedByUpn: null,
  },
]

let calls = []

beforeEach(() => {
  calls = []
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/sales') && (options.method === 'POST' || options.method === 'PUT')) {
      return json({ ok: true, sale: SALES[0] })
    }
    if (u.includes('/api/admin/sales')) return json(SALES)
    if (u.includes('/api/admin/customers')) return json([{ id: 7, name: 'Иван Петров' }])
    return json({})
  }))
})

describe('AdminSalesPage', () => {
  it('renders the server’s money and totals both columns', async () => {
    render(<AdminSalesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())
    expect(screen.getByText('€24,900')).toBeInTheDocument()
    // Revenue 24,900 + 8,000; net 23,730 + 8,000.
    expect(screen.getByText('€32,900')).toBeInTheDocument()
    expect(screen.getByText('€31,730')).toBeInTheDocument()
  })

  it('marks an imported sale that has no customer yet', async () => {
    render(<AdminSalesPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    // The row is visible and honest about the gap rather than pretending or hiding.
    expect(screen.getByText('без свързан клиент')).toBeInTheDocument()
  })

  it('never calls the net figure profit — the goods cost is not tracked here', async () => {
    render(<AdminSalesPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    // The procurement version's two profit columns are gone — nothing on the page is
    // labelled as profit any more...
    expect(screen.queryByText(/Брутна печалба/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Нетна печалба/)).not.toBeInTheDocument()
    // ...and the one place the word appears is the disclaimer saying this is NOT it.
    expect(screen.getByText(/Не е печалба/)).toBeInTheDocument()
  })

  it('will not save without a customer, and sends the chosen one', async () => {
    const user = userEvent.setup()
    render(<AdminSalesPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нова продажба' }))

    // Quantity alone is not enough — the customer IS the link now.
    await user.type(screen.getByLabelText('Брой'), '1')
    expect(screen.getByRole('button', { name: 'Запази' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Клиент'), '7')
    await user.type(screen.getByLabelText(/Единична цена/), '24900')
    await user.click(screen.getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toMatchObject({ customerId: 7, quantity: 1, unitSalePrice: 24900 })
    })
  })
})
