import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminExpensesPage from './AdminExpensesPage.jsx'

// The expenses screen.
//
// The behaviour worth pinning is the quick-add reset: after a save the amount clears but
// the DATE AND CATEGORY SURVIVE, because receipts arrive in batches and the fuel receipt
// is usually followed by another from the same day. Losing those two fields per save is
// the sort of friction that ends with a month of fuel entered as one made-up total.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/expenses']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const ROWS = [
  {
    id: 1, spentAt: '2026-08-14', categoryKey: 'travel', amount: 120.5, vatAmount: 20.08,
    description: 'Дизел', submittedByUpn: 'nlekov@nvc-home4you.eu', notes: null,
    updatedAt: null, updatedByUpn: null,
  },
  {
    id: 2, spentAt: '2026-08-01', categoryKey: null, amount: 60, vatAmount: null,
    description: null, submittedByUpn: null, notes: null, updatedAt: null, updatedByUpn: null,
  },
]

const ROLLUP = {
  byCategory: [
    { key: 'travel', total: 120.5, count: 1 },
    { key: 'uncategorised', total: 60, count: 1 },
  ],
  byMonth: [{ key: '2026-08', total: 180.5, count: 2 }],
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
    if (u.includes('/api/admin/buy-cycles')) {
      return json([{ id: 3, label: '2026 C1', isClosed: false }, { id: 2, label: '2025 C2', isClosed: true }])
    }
    if (u.includes('/api/admin/operating-expenses/categories')) {
      return json(['site-hosting', 'travel', 'ads', 'draw-vladi', 'other'])
    }
    if (u.includes('/api/admin/operating-expenses/rollup')) return json(ROLLUP)
    if (u.includes('/api/admin/operating-expenses') && options.method === 'POST') {
      return json({ ok: true, expense: ROWS[0] })
    }
    if (u.includes('/api/admin/operating-expenses')) return json(ROWS)
    return json({})
  }))
})

describe('AdminExpensesPage', () => {
  it('shows the rollup with an explicit uncategorised line', async () => {
    render(<AdminExpensesPage />)

    // The parts must add up to the whole: an uncategorised expense appears under its own
    // name rather than silently dropping out of the breakdown.
    await waitFor(() => expect(screen.getAllByText('Без категория').length).toBeGreaterThan(0))
    expect(screen.getAllByText('€180.50').length).toBeGreaterThan(0)
  })

  it('keeps the date and category after a save, clearing only the money fields', async () => {
    const user = userEvent.setup()
    render(<AdminExpensesPage />)
    await waitFor(() => expect(screen.getByText('Нов разход')).toBeInTheDocument())

    // Scoped to the quick-add card: the filter bar repeats the same labels below.
    const quickAdd = within(screen.getByText('Нов разход').closest('section'))
    const date = quickAdd.getByLabelText('Дата')
    const category = quickAdd.getByLabelText('Категория')
    const amount = quickAdd.getByLabelText('Сума (EUR)')

    await user.clear(date)
    await user.type(date, '2026-08-14')
    await user.selectOptions(category, 'travel')
    await user.type(amount, '120.50')
    await user.click(screen.getByRole('button', { name: 'Запиши' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toMatchObject({
        spentAt: '2026-08-14', categoryKey: 'travel', amount: 120.5, vatAmount: null,
      })
    })

    // The next receipt from the same day starts two fields ahead.
    await waitFor(() => expect(amount.value).toBe(''))
    expect(date.value).toBe('2026-08-14')
    expect(category.value).toBe('travel')
  })

  it('offers only OPEN cycles for attribution, and sends the chosen one', async () => {
    const user = userEvent.setup()
    render(<AdminExpensesPage />)
    await waitFor(() => expect(screen.getByText('Нов разход')).toBeInTheDocument())

    const quickAdd = within(screen.getByText('Нов разход').closest('section'))
    const cycle = quickAdd.getByLabelText('Цикъл')

    // The closed cycle is not on offer — attributing new spending to a finished cycle is
    // the mistake the IsClosed flag exists to prevent.
    expect(within(cycle).getByRole('option', { name: '2026 C1' })).toBeInTheDocument()
    expect(within(cycle).queryByRole('option', { name: '2025 C2' })).not.toBeInTheDocument()

    // The date keeps its default (today) — only the cycle and amount are the point here.
    await user.selectOptions(cycle, '3')
    await user.type(quickAdd.getByLabelText('Сума (EUR)'), '250')
    await user.click(screen.getByRole('button', { name: 'Запиши' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toMatchObject({ buyCycleId: 3, amount: 250 })
    })
  })

  it('will not record an expense of nothing', async () => {
    render(<AdminExpensesPage />)
    await waitFor(() => expect(screen.getByText('Нов разход')).toBeInTheDocument())

    // No amount typed — the button is dead rather than the request refused later.
    expect(screen.getByRole('button', { name: 'Запиши' })).toBeDisabled()
  })
})
