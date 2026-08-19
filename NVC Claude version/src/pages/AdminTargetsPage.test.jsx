import React from 'react'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminTargetsPage from './AdminTargetsPage.jsx'

// The targets editor.
//
// Two rules worth pinning. The form only shows the period fields the chosen shape uses —
// a stray month on a cycle target would occupy a slot no report reads. And the save is an
// upsert that SAYS which of the two things happened, because "your number replaced an
// existing one" is information the person setting a target needs to hear.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/targets']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const TARGETS = [
  {
    id: 1, periodType: 'month', year: 2026, month: 8, buyCycleId: null, buyCycleLabel: null,
    periodLabel: '2026-08', metricKey: 'revenue', targetValue: 250000, notes: null,
    updatedAt: null, updatedByUpn: null,
  },
]

let calls = []
let created = false

beforeEach(() => {
  calls = []
  created = false
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/targets/keys')) {
      return json({ periodTypes: ['month', 'cycle', 'year'], metrics: ['revenue', 'gross-margin', 'opex-cap', 'units-sold'] })
    }
    if (u.includes('/api/admin/targets') && options.method === 'PUT') {
      return json({ ok: true, created, target: TARGETS[0] })
    }
    if (u.includes('/api/admin/targets')) return json(TARGETS)
    if (u.includes('/api/admin/buy-cycles')) return json([{ id: 3, label: '2026 C1' }])
    return json({})
  }))
})

describe('AdminTargetsPage', () => {
  it('shows year and month boxes for a monthly target, and no cycle box', async () => {
    render(<AdminTargetsPage />)
    await waitFor(() => expect(screen.getByText('Август 2026')).toBeInTheDocument())

    expect(screen.getByLabelText('Година')).toBeInTheDocument()
    expect(screen.getByLabelText('Месец')).toBeInTheDocument()
    expect(screen.queryByLabelText('Цикъл')).not.toBeInTheDocument()
  })

  it('swaps to a cycle picker when the period is a cycle', async () => {
    const user = userEvent.setup()
    render(<AdminTargetsPage />)
    await waitFor(() => expect(screen.getByText('Август 2026')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Период'), 'cycle')

    // The year and month boxes are GONE, not merely ignored: a stray value in either
    // would land in a slot on the unique index that no cycle lookup ever matches.
    expect(screen.getByLabelText('Цикъл')).toBeInTheDocument()
    expect(screen.queryByLabelText('Година')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Месец')).not.toBeInTheDocument()
  })

  it('sends a cycle target with nulls where the other period columns were', async () => {
    const user = userEvent.setup()
    render(<AdminTargetsPage />)
    await waitFor(() => expect(screen.getByText('Август 2026')).toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Период'), 'cycle')
    await user.selectOptions(screen.getByLabelText('Цикъл'), '3')
    await user.type(screen.getByLabelText('Стойност (EUR)'), '90000')
    await user.click(screen.getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const put = calls.find((c) => c.method === 'PUT')
      expect(put).toBeTruthy()
      expect(JSON.parse(put.body)).toMatchObject({
        periodType: 'cycle', buyCycleId: 3, year: null, month: null, targetValue: 90000,
      })
    })
  })

  it('asks for a count, not euro, when the metric is units sold', async () => {
    const user = userEvent.setup()
    render(<AdminTargetsPage />)
    await waitFor(() => expect(screen.getByText('Август 2026')).toBeInTheDocument())

    // Money metric: the box is labelled in euro.
    expect(screen.getByLabelText('Стойност (EUR)')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Показател'), 'units-sold')

    // Counted metric: the same box now asks for a number of units, stepping in wholes —
    // "12.5 houses" is a typo the form should not invite.
    expect(screen.queryByLabelText('Стойност (EUR)')).not.toBeInTheDocument()
    const count = screen.getByLabelText('Брой')
    expect(count).toHaveAttribute('step', '1')
  })

  it('says whether the save created a target or replaced one', async () => {
    const user = userEvent.setup()
    render(<AdminTargetsPage />)
    await waitFor(() => expect(screen.getByText('Август 2026')).toBeInTheDocument())

    await user.type(screen.getByLabelText('Стойност (EUR)'), '250000')
    await user.click(screen.getByRole('button', { name: 'Запази' }))

    // created: false from the server → the replaced wording, so a person who just
    // overwrote a colleague's number finds out here rather than on the dashboard.
    await waitFor(() => expect(screen.getByText(/вече имаше стойност/)).toBeInTheDocument())
  })
})
