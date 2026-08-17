import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminFactoriesPage from './AdminFactoriesPage.jsx'

// The supplier directory.
//
// The rule worth pinning is that a factory with sales against it cannot be deleted from
// this screen. The database refuses it too, but a Delete button that is always there and
// usually refused teaches people to ignore the refusal — so the button is not there.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/factories']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const ROWS = [
  {
    id: 5, name: 'Bursa Prefab', country: 'Türkiye', city: 'Bursa', address: '',
    contactName: 'Emre', contactPhone: '+90 555 1234', contactEmail: 'emre@bursa.example',
    website: '', notes: '', isActive: true, purchaseCount: 12, updatedAt: null, updatedByUpn: null,
  },
  {
    id: 6, name: 'Retired Works', country: 'Bulgaria', city: 'Ruse', address: '',
    contactName: '', contactPhone: '', contactEmail: '',
    website: '', notes: '', isActive: false, purchaseCount: 0, updatedAt: null, updatedByUpn: null,
  },
]

let calls = []
let duplicateName = false

beforeEach(() => {
  calls = []
  duplicateName = false

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/factories')) {
      if (options.method === 'POST' || options.method === 'PUT') {
        return json({ ok: true, factory: ROWS[0], duplicateName })
      }
      return json(ROWS)
    }
    return json({})
  }))
})

describe('AdminFactoriesPage', () => {
  it('lists suppliers with how much history hangs off each', async () => {
    render(<AdminFactoriesPage />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())
    expect(screen.getByText('12 продажби')).toBeInTheDocument()
    expect(screen.getByText('няма продажби')).toBeInTheDocument()
  })

  it('shows an inactive supplier rather than hiding it', async () => {
    // This is the screen where a supplier gets reactivated. A row you cannot see is a row
    // you cannot fix — the purchase form is where inactive ones drop out.
    render(<AdminFactoriesPage />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Retired Works' })).toBeInTheDocument())
    expect(screen.getByText('Неактивна')).toBeInTheDocument()
  })

  it('offers Delete only on a factory nothing points at', async () => {
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    const cards = screen.getAllByRole('listitem')
    const used = cards.find((c) => within(c).queryByRole('heading', { name: 'Bursa Prefab' }))
    const unused = cards.find((c) => within(c).queryByRole('heading', { name: 'Retired Works' }))

    expect(within(used).queryByRole('button', { name: 'Изтрий' })).not.toBeInTheDocument()
    expect(within(unused).getByRole('button', { name: 'Изтрий' })).toBeInTheDocument()
  })

  it('will not save a factory with no name', async () => {
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нова фабрика' }))
    const dialog = await waitFor(() => screen.getByRole('dialog'))

    expect(within(dialog).getByRole('button', { name: 'Запази' })).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Име'), 'Нова')
    expect(within(dialog).getByRole('button', { name: 'Запази' })).toBeEnabled()
  })

  it('warns about a duplicate name but saves anyway', async () => {
    // Two genuinely different suppliers can share a name across countries, so this is
    // information for the person who typed it rather than a verdict on the row.
    duplicateName = true
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нова фабрика' }))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    await user.type(within(dialog).getByLabelText('Име'), 'Bursa Prefab')
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST')).toBe(true)
      expect(screen.getByText(/Вече има фабрика/)).toBeInTheDocument()
    })
  })

  it('carries the active flag through a save', async () => {
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    const cards = screen.getAllByRole('listitem')
    const used = cards.find((c) => within(c).queryByRole('heading', { name: 'Bursa Prefab' }))
    await user.click(within(used).getByRole('button', { name: 'Редактирай' }))

    const dialog = await waitFor(() => screen.getByRole('dialog'))
    await user.click(within(dialog).getByRole('checkbox'))
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      // Deactivated, not deleted: the name stops appearing on new purchases and stays on
      // the twelve that already have it.
      expect(saved.isActive).toBe(false)
    })
  })
})
