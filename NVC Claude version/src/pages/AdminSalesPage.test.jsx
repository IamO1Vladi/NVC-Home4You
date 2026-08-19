import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSalesPage from './AdminSalesPage.jsx'

// The sales screen.
//
// Pinned: the money is rendered off the server DTO (never added up here), a container with
// no rate says "no COGS" instead of pretending the goods were free, the lot options carry
// their availability, and an oversell 409 surfaces the server's own "only N left" message.

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
    id: 1, purchaseLotId: 21, productModelName: 'Expandable 58', shipmentReference: 'MSKU-1',
    customerId: null, customerName: null, soldAt: '2026-08-10',
    quantity: 1, unitSalePrice: 15000,
    paymentFees: 100, transportCost: 200, installationCost: null, otherCosts: null,
    saleAmountEur: 15000, saleExpensesEur: 300, cogsEur: 9450,
    grossProfitEur: 5550, netProfitEur: 5250,
    notes: null, updatedAt: null, updatedByUpn: null,
  },
  {
    id: 2, purchaseLotId: 22, productModelName: 'Container 6m', shipmentReference: null,
    customerId: 7, customerName: 'Иван Петров', soldAt: '2026-07-02',
    quantity: 2, unitSalePrice: 4000,
    paymentFees: null, transportCost: null, installationCost: null, otherCosts: null,
    saleAmountEur: 8000, saleExpensesEur: 0, cogsEur: null,
    grossProfitEur: null, netProfitEur: null,
    notes: null, updatedAt: null, updatedByUpn: null,
  },
]

const OPTIONS = [
  {
    purchaseLotId: 21, productModelName: 'Expandable 58', shipmentReference: 'MSKU-1',
    buyCycleLabel: '2024-2026', qtyPurchased: 5, qtySold: 1, qtyOnHand: 4,
  },
  // Sold out — must not be offered on a NEW sale.
  {
    purchaseLotId: 22, productModelName: 'Container 6m', shipmentReference: 'MSKU-1',
    buyCycleLabel: '2024-2026', qtyPurchased: 10, qtySold: 10, qtyOnHand: 0,
  },
]

let calls = []
let oversell = false

beforeEach(() => {
  calls = []
  oversell = false
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/sales/lot-options')) return json(OPTIONS)
    if (u.includes('/api/admin/sales') && (options.method === 'POST' || options.method === 'PUT')) {
      return oversell
        ? json({ errors: ['That line has only 4 left.'], available: 4 }, 409)
        : json({ ok: true, sale: SALES[0] })
    }
    if (u.includes('/api/admin/sales')) return json(SALES)
    if (u.includes('/api/admin/customers')) return json([{ id: 7, name: 'Иван Петров' }])
    return json({})
  }))
})

describe('AdminSalesPage', () => {
  it('renders the server’s money and totals it honestly', async () => {
    render(<AdminSalesPage />)

    await waitFor(() => expect(screen.getByText('Expandable 58')).toBeInTheDocument())
    // The DTO's own numbers, verbatim.
    expect(screen.getByText('€15,000')).toBeInTheDocument()
    expect(screen.getAllByText(/€5,250/).length).toBeGreaterThan(0)

    // Total revenue sums both; total net stays a DASH because one sale has no COGS —
    // a total that quietly omitted it would claim profit nobody computed.
    expect(screen.getByText('€23,000')).toBeInTheDocument()
    const profitCard = screen.getByText('Обща нетна печалба').closest('div')
    expect(within(profitCard).getByText('—')).toBeInTheDocument()
  })

  it('says "no COGS" for a container without a rate rather than pretending', async () => {
    render(<AdminSalesPage />)
    await waitFor(() => expect(screen.getByText('Container 6m')).toBeInTheDocument())

    expect(screen.getByText(/без курс на контейнера/)).toBeInTheDocument()
  })

  it('offers only lines with stock left, each saying how many', async () => {
    const user = userEvent.setup()
    render(<AdminSalesPage />)
    await waitFor(() => expect(screen.getByText('Expandable 58')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нова продажба' }))

    expect(screen.getByRole('option', { name: /Expandable 58 — MSKU-1 \(4 налични\)/ })).toBeInTheDocument()
    // The sold-out line is not on the menu — a line with nothing left is noise on a sale
    // form (owner, 2026-08-19).
    expect(screen.queryByRole('option', { name: /Container 6m/ })).not.toBeInTheDocument()

    // And the price box says what it means: the price of ONE unit.
    expect(screen.getByText('Цената, на която е продаден 1 брой.')).toBeInTheDocument()
  })

  it('surfaces the oversell refusal with the server’s number', async () => {
    oversell = true
    const user = userEvent.setup()
    render(<AdminSalesPage />)
    await waitFor(() => expect(screen.getByText('Expandable 58')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нова продажба' }))
    await user.selectOptions(screen.getByLabelText('Ред от контейнер'), '21')
    await user.type(screen.getByLabelText('Брой'), '9')
    await user.click(screen.getByRole('button', { name: 'Запази' }))

    // The 409 body's message, verbatim — "only 4 left" is the actionable part.
    await waitFor(() => expect(screen.getByText(/only 4 left/)).toBeInTheDocument())
  })
})
