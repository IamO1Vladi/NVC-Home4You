import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminProcurementPage from './AdminProcurementPage.jsx'

// The buy side of the panel.
//
// The rules worth pinning are the ones that keep the money honest: the page renders the
// SERVER'S landed figures rather than adding anything up itself, "no rate yet" shows as a
// dash rather than an invented euro number, and a blank unit cost asks the server to
// prefill from the model's factory price — the one moment that price is read.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/procurement']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const CYCLES = [
  {
    id: 1, label: '2026 C1', startDate: '2026-01-10', endDate: '2026-04-30',
    markupCoefficient: 2.7, borderVatRate: 0.2, isClosed: false, notes: null,
    shipmentCount: 1, updatedAt: null, updatedByUpn: null,
  },
  {
    id: 2, label: '2025 C2', startDate: '2025-09-01', endDate: '2025-12-20',
    markupCoefficient: 2.6, borderVatRate: 0.2, isClosed: true, notes: null,
    shipmentCount: 0, updatedAt: null, updatedByUpn: null,
  },
]

// One container: $10,000 of goods, $2,000 freight, $500 customs — the owner's worked
// example, with the server's own answers riding on the DTO.
const SHIPMENT = {
  id: 7, buyCycleId: 1, buyCycleLabel: '2026 C1', reference: 'MSKU-4411', factoryId: 5,
  factoryName: 'Bursa Prefab', freightCost: 2000, customsDuty: 500, importVatPaid: null,
  otherCosts: null, otherCostsNote: null,
  orderedAt: '2026-01-15', departedAt: '2026-02-01', arrivedAt: null, status: 'in-transit',
  usdToEurRate: null, rateSource: null, rateAt: null,
  goodsCostUsd: 10000, crossingCostUsd: 2500, landedBaseUsd: 12500,
  suggestedPriceUsd: 36250, landedBaseEur: null, suggestedPriceEur: null,
  lotCount: 1, unitCount: 1,
  missingForCosting: ['UsdToEurRate'],
  lots: [{
    id: 21, productModelId: 3, productModelName: 'Expandable 58', houseId: 9,
    quantity: 1, unitCost: 10000, lineTotalUsd: 10000,
    unitLandedCostUsd: 12500, unitLandedCostEur: null, notes: null,
  }],
  notes: null, updatedAt: null, updatedByUpn: null,
}

let calls = []

beforeEach(() => {
  calls = []
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/buy-cycles/defaults')) return json({ markupCoefficient: 2.7, borderVatRate: 0.2 })
    if (u.includes('/api/admin/buy-cycles')) return json(CYCLES)
    if (u.includes('/api/admin/factories')) return json([{ id: 5, name: 'Bursa Prefab', isActive: true }])
    if (u.includes('/api/admin/product-models')) {
      return json([{ id: 3, name: 'Expandable 58', isActive: true }])
    }
    if (u.includes('/api/admin/shipments') && (options.method === 'POST' || options.method === 'PUT')) {
      return json({ ok: true, shipment: SHIPMENT })
    }
    if (u.includes('/api/admin/shipments')) return json([SHIPMENT])
    return json({})
  }))
})

describe('AdminProcurementPage', () => {
  it('lists cycles with the coefficients that price them', async () => {
    render(<AdminProcurementPage />)

    await waitFor(() => expect(screen.getByRole('heading', { name: '2026 C1' })).toBeInTheDocument())
    // ×2.7 and the VAT fraction, off the row — these are what every container in the
    // cycle is priced with, so they belong on the card rather than behind an edit.
    expect(screen.getByText(/×2.7/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2025 C2' })).toBeInTheDocument()
    expect(screen.getByText('Затворен')).toBeInTheDocument()
  })

  it('offers Delete only on a cycle with nothing in it', async () => {
    render(<AdminProcurementPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: '2026 C1' })).toBeInTheDocument())

    const cards = screen.getAllByRole('listitem')
    const used = cards.find((c) => within(c).queryByRole('heading', { name: '2026 C1' }))
    const empty = cards.find((c) => within(c).queryByRole('heading', { name: '2025 C2' }))

    expect(within(used).queryByRole('button', { name: 'Изтрий' })).not.toBeInTheDocument()
    expect(within(empty).getByRole('button', { name: 'Изтрий' })).toBeInTheDocument()
  })

  it('shows the server’s landed figures and a dash-shaped silence where the rate is missing', async () => {
    const user = userEvent.setup()
    render(<AdminProcurementPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: '2026 C1' })).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: 'Контейнери' })[0])
    await waitFor(() => expect(screen.getByText('MSKU-4411')).toBeInTheDocument())

    // The cycle cards carry their own edit buttons; the container's is inside its row.
    const row = screen.getByText('MSKU-4411').closest('li')
    await user.click(within(row).getByRole('button', { name: 'Редактирай' }))

    // The DTO's numbers, verbatim: $12,500 landed, $36,250 suggested — and NO euro figure
    // anywhere, because the shipment has no rate and the page must not invent one.
    await waitFor(() => expect(screen.getByText('$12,500')).toBeInTheDocument())
    expect(screen.getByText('$36,250')).toBeInTheDocument()
    expect(screen.queryByText(/€/)).not.toBeInTheDocument()

    // And it says WHY the costing is incomplete, naming the rate.
    expect(screen.getByText(/липсва/)).toBeInTheDocument()
    expect(screen.getByText(/курсът/)).toBeInTheDocument()
  })

  it('corrects a line in place: edit prefills the form and saves as PUT to that lot', async () => {
    const user = userEvent.setup()
    render(<AdminProcurementPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: '2026 C1' })).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: 'Контейнери' })[0])
    await waitFor(() => expect(screen.getByText('MSKU-4411')).toBeInTheDocument())
    const row = screen.getByText('MSKU-4411').closest('li')
    await user.click(within(row).getByRole('button', { name: 'Редактирай' }))
    await waitFor(() => expect(screen.getByText('Стока в контейнера')).toBeInTheDocument())

    // The line's own edit button loads its values into the form — no remove-and-retype.
    // (The model name also appears as a dropdown option; the row renders it in <strong>.)
    const lotRow = screen.getAllByText('Expandable 58')
      .find((el) => el.tagName === 'STRONG')
      .closest('li')
    await user.click(within(lotRow).getByRole('button', { name: 'Редактирай' }))

    expect(screen.getByLabelText('Брой')).toHaveValue(1)
    expect(screen.getByLabelText(/Единична цена/)).toHaveValue(10000)

    // Fix the quantity; the save goes to THIS lot, not to a new line.
    await user.clear(screen.getByLabelText('Брой'))
    await user.type(screen.getByLabelText('Брой'), '2')
    await user.click(screen.getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const put = calls.find((c) => c.method === 'PUT' && c.url.includes('/lots/21'))
      expect(put).toBeTruthy()
      expect(JSON.parse(put.body)).toMatchObject({ productModelId: 3, quantity: 2, unitCost: 10000 })
    })
  })

  it('sends unitCost null for a blank cost box, which asks the server to prefill from the model', async () => {
    const user = userEvent.setup()
    render(<AdminProcurementPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: '2026 C1' })).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: 'Контейнери' })[0])
    await waitFor(() => expect(screen.getByText('MSKU-4411')).toBeInTheDocument())
    const row = screen.getByText('MSKU-4411').closest('li')
    await user.click(within(row).getByRole('button', { name: 'Редактирай' }))
    await waitFor(() => expect(screen.getByText('Стока в контейнера')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Модел'), '3')
    await user.type(screen.getByLabelText('Брой'), '2')
    await user.click(screen.getByRole('button', { name: 'Добави ред' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.includes('/lots'))
      expect(post).toBeTruthy()
      // 0, not null and not missing: the server reads 0 as "use the model's current
      // factory price", the one moment that reference price is consulted.
      expect(JSON.parse(post.body)).toMatchObject({ productModelId: 3, quantity: 2, unitCost: null })
    })
  })
})
