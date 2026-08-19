import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminProductModelsPage from './AdminProductModelsPage.jsx'

// The cost-price catalogue.
//
// The rule this screen exists to keep: cost is edited HERE, retail is READ from the gallery
// through the house link and rendered read-only. A second editable retail column is the
// 73 m² incident, so the strongest thing a test can do is prove the retail figure appears
// with no input around it.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/product-models']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const ROWS = [
  {
    id: 3, name: 'Expandable 58', categoryKey: 'prefab', houseId: 9,
    houseTitle: 'Разгъваема къща 58м²', factoryPrice: 9000,
    retailPrice: 24900, retailCurrency: 'EUR', isActive: true, notes: null,
    lotCount: 4, updatedAt: null, updatedByUpn: null,
  },
  {
    id: 4, name: 'M8 anchor bolt', categoryKey: null, houseId: null, houseTitle: null,
    factoryPrice: 0.4, retailPrice: null, retailCurrency: null, isActive: true, notes: null,
    lotCount: 0, updatedAt: null, updatedByUpn: null,
  },
]

let calls = []
let duplicateHouseLink = false

beforeEach(() => {
  calls = []
  duplicateHouseLink = false
  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/product-models/categories')) {
      return json(['prefab', 'wagon', 'modular', 'garage', 'container', 'materials', 'other'])
    }
    if (u.includes('/api/admin/product-models') && (options.method === 'POST' || options.method === 'PUT')) {
      return json({ ok: true, model: ROWS[0], duplicateHouseLink })
    }
    if (u.includes('/api/admin/product-models')) return json(ROWS)
    if (u.includes('/api/admin/gallery')) {
      return json([
        { id: 9, title: 'Разгъваема къща 58м²', categoryKey: 'prefab' },
        { id: 11, title: 'Фургон 6м', categoryKey: 'wagon' },
        { id: 12, title: 'Модулна къща М1', categoryKey: 'modular' },
      ])
    }
    return json({})
  }))
})

describe('AdminProductModelsPage', () => {
  it('shows cost and retail side by side, and retail is not an input', async () => {
    render(<AdminProductModelsPage />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Expandable 58' })).toBeInTheDocument())
    expect(screen.getByText('$9,000')).toBeInTheDocument()
    expect(screen.getByText('€24,900')).toBeInTheDocument()

    // Nowhere on this page is there a box holding the retail price. It is the gallery's
    // number; this screen only reads it through the link.
    const inputs = Array.from(document.querySelectorAll('input')).map((i) => i.value)
    expect(inputs).not.toContain('24900')
  })

  it('a model that is not a gallery house shows cost alone', async () => {
    render(<AdminProductModelsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'M8 anchor bolt' })).toBeInTheDocument())

    const cards = screen.getAllByRole('listitem')
    const bolt = cards.find((c) => within(c).queryByRole('heading', { name: 'M8 anchor bolt' }))
    expect(within(bolt).getByText('$0.4')).toBeInTheDocument()
    expect(within(bolt).queryByText(/€/)).not.toBeInTheDocument()
  })

  it('warns without blocking when a second model links the same house', async () => {
    duplicateHouseLink = true
    const user = userEvent.setup()
    render(<AdminProductModelsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Expandable 58' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нов модел' }))
    await user.type(screen.getByLabelText(/Име/), 'From factory B')
    await user.click(screen.getByRole('button', { name: 'Запази' }))

    // Saved AND flagged: two cost rows for one house are legitimate (two factories), so
    // the warning informs the person who just typed it rather than refusing the row.
    await waitFor(() => expect(screen.getByText(/дублирате/)).toBeInTheDocument())
    const post = calls.find((c) => c.method === 'POST' && c.url.includes('product-models'))
    expect(post).toBeTruthy()
  })

  it('category drives the form: gallery pick IS the name, modular keeps a free name', async () => {
    const user = userEvent.setup()
    render(<AdminProductModelsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Expandable 58' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нов модел' }))

    // No category yet: a free name box, no gallery dropdown.
    expect(screen.getByLabelText(/Име/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Модел от галерията')).not.toBeInTheDocument()

    // Prefab: the name box gives way to a gallery dropdown holding ONLY prefab houses —
    // one identity, not two boxes that can disagree.
    await user.selectOptions(screen.getByLabelText('Категория'), 'prefab')
    const gallery = screen.getByLabelText('Модел от галерията')
    expect(screen.queryByLabelText(/Име/)).not.toBeInTheDocument()
    expect(within(gallery).getByRole('option', { name: 'Разгъваема къща 58м²' })).toBeInTheDocument()
    expect(within(gallery).queryByRole('option', { name: 'Фургон 6м' })).not.toBeInTheDocument()

    // Picking the house makes the save send its title as the name.
    await user.selectOptions(gallery, '9')
    await user.click(screen.getByRole('button', { name: 'Запази' }))
    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.includes('product-models'))
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toMatchObject({
        name: 'Разгъваема къща 58м²', categoryKey: 'prefab', houseId: 9,
      })
    })
  })

  it('modular is deliberately a free name, even though the gallery lists modular houses', async () => {
    // The business rule, restated by the owner 2026-08-19: a modular build is a custom
    // project every time, so its cost model is named, not linked.
    const user = userEvent.setup()
    render(<AdminProductModelsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Expandable 58' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Нов модел' }))
    await user.selectOptions(screen.getByLabelText('Категория'), 'modular')

    expect(screen.getByLabelText(/Име/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Модел от галерията')).not.toBeInTheDocument()
  })

  it('offers Delete only on a model no container line names', async () => {
    render(<AdminProductModelsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Expandable 58' })).toBeInTheDocument())

    const cards = screen.getAllByRole('listitem')
    const used = cards.find((c) => within(c).queryByRole('heading', { name: 'Expandable 58' }))
    const unused = cards.find((c) => within(c).queryByRole('heading', { name: 'M8 anchor bolt' }))

    expect(within(used).queryByRole('button', { name: 'Изтрий' })).not.toBeInTheDocument()
    expect(within(unused).getByRole('button', { name: 'Изтрий' })).toBeInTheDocument()
  })
})
