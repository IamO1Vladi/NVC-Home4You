import React from 'react'
import { render as rtlRender, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import AdminFactorySheetsPage from './AdminFactorySheetsPage.jsx'

// The factory order sheets, moved off localStorage.
//
// What is pinned here is the migration contract more than the form: the sheet a colleague
// still has in THIS browser's localStorage must be offered for import and must survive the
// round trip; the arrays must reach the server as JSON strings; and the legacy copy must be
// removed only after a save actually succeeds — a failed save leaves what may be the only
// copy in existence alone.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/factory-sheets']}>{ui}</MemoryRouter>)

const json = (body) => Promise.resolve({
  ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)),
})

const LIST = [
  {
    id: 1, client: 'Иван Петров', project: 'Разгъваема къща 58 м²', reference: 'FS-2026-014',
    sheetDate: '2026-08-18', hasPlan: true, windowCount: 4, contactCount: 6,
    createdAt: '2026-08-18T08:00:00Z', updatedAt: '2026-08-18T09:00:00Z',
    updatedByUpn: 'maria@nvc-home4you.eu',
  },
]

const DETAIL = {
  id: 1, client: 'Иван Петров', project: 'Разгъваема къща 58 м²', reference: 'FS-2026-014',
  sheetDate: '2026-08-18', lang: 'bg',
  planImage: '', planName: '',
  windowsJson: '[{"id":"w-1","x":25,"y":40,"type":"1200×950","note":""}]',
  contactsJson: '[]',
  specsJson: '[{"id":"s-1","label":"Модел","value":"58 м²"}]',
  notes: 'Терасата гледа на юг.',
  createdAt: '2026-08-18T08:00:00Z', updatedAt: null, updatedByUpn: null,
}

let calls = []

beforeEach(() => {
  calls = []
  window.localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales', email: 'sales@x.eu' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.match(/\/api\/admin\/factory-sheets\/\d+$/) && (!options.method || options.method === 'GET')) return json(DETAIL)
    if (u.includes('/api/admin/factory-sheets')) {
      if (options.method === 'POST') return json({ ok: true, sheet: { ...DETAIL, id: 7 } })
      if (options.method === 'PUT') return json({ ok: true, sheet: DETAIL })
      return json(LIST)
    }
    return json({})
  }))
})

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('AdminFactorySheetsPage', () => {
  it('lists the sheets with enough to tell them apart', async () => {
    render(<AdminFactorySheetsPage />)

    await waitFor(() => expect(screen.getByText('FS-2026-014')).toBeInTheDocument())
    expect(screen.getByText(/4 прозорци|4 windows/)).toBeInTheDocument()
    // Who touched it last, shortened.
    expect(screen.getByText(/maria/)).toBeInTheDocument()
  })

  it('opens a sheet with its markers and specs intact', async () => {
    const user = userEvent.setup()
    render(<AdminFactorySheetsPage />)
    await waitFor(() => expect(screen.getByText('FS-2026-014')).toBeInTheDocument())

    await user.click(screen.getByText('FS-2026-014'))

    await waitFor(() => expect(screen.getByDisplayValue('Иван Петров')).toBeInTheDocument())
    expect(screen.getByDisplayValue('1200×950')).toBeInTheDocument()
    expect(screen.getByDisplayValue('58 м²')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Терасата гледа на юг.')).toBeInTheDocument()
  })

  it('saves the arrays as JSON strings, which is what the server stores', async () => {
    const user = userEvent.setup()
    render(<AdminFactorySheetsPage />)
    await waitFor(() => expect(screen.getByText('FS-2026-014')).toBeInTheDocument())
    await user.click(screen.getByText('FS-2026-014'))
    await waitFor(() => expect(screen.getByDisplayValue('Иван Петров')).toBeInTheDocument())

    // An edit makes it dirty, which is what arms the Save button.
    fireEvent.change(screen.getByDisplayValue('Терасата гледа на юг.'), { target: { value: 'Ново указание.' } })
    await user.click(screen.getByRole('button', { name: /^Запази$|^Save$/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/factory-sheets/1') && c.method === 'PUT')
      expect(sent).toBeTruthy()
      const body = JSON.parse(sent.body)
      expect(body.notes).toBe('Ново указание.')
      expect(typeof body.windowsJson).toBe('string')
      expect(JSON.parse(body.windowsJson)[0].type).toBe('1200×950')
    })
  })

  it('save stays disarmed until something actually changed', async () => {
    const user = userEvent.setup()
    render(<AdminFactorySheetsPage />)
    await waitFor(() => expect(screen.getByText('FS-2026-014')).toBeInTheDocument())
    await user.click(screen.getByText('FS-2026-014'))
    await waitFor(() => expect(screen.getByDisplayValue('Иван Петров')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /^Запази$|^Save$/ })).toBeDisabled()
  })

  // --- The localStorage migration path --------------------------------------------------

  const LEGACY = JSON.stringify({
    lang: 'bg',
    config: {
      client: 'Стар клиент', project: '', reference: 'LEGACY-01', date: '2026-08-01',
      planImage: '', planName: '',
      windows: [{ id: 'w-9', x: 10, y: 10, type: 'Панорамен / френски', note: '' }],
      contacts: [], specs: [{ id: 's-9', label: 'Модел', value: '37 м²' }], notes: '',
    },
  })

  it('offers the sheet still sitting in this browser, and imports it', async () => {
    window.localStorage.setItem('nvc_factory_sheet_v1', LEGACY)
    const user = userEvent.setup()
    render(<AdminFactorySheetsPage />)

    await waitFor(() => expect(screen.getByText(/стария инструмент|old internal tool/)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Внеси го|Import it/ }))

    // The old sheet is on screen, editable, as an UNSAVED new sheet.
    await waitFor(() => expect(screen.getByDisplayValue('Стар клиент')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Панорамен / френски')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Запази$|^Save$/ })).toBeEnabled()
  })

  it('removes the browser copy only after the save succeeds', async () => {
    // Before the save it may be the only copy in existence.
    window.localStorage.setItem('nvc_factory_sheet_v1', LEGACY)
    const user = userEvent.setup()
    render(<AdminFactorySheetsPage />)

    await waitFor(() => expect(screen.getByText(/стария инструмент|old internal tool/)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Внеси го|Import it/ }))
    await waitFor(() => expect(screen.getByDisplayValue('Стар клиент')).toBeInTheDocument())

    expect(window.localStorage.getItem('nvc_factory_sheet_v1')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: /^Запази$|^Save$/ }))

    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/factory-sheets') && c.method === 'POST')).toBe(true)
      expect(window.localStorage.getItem('nvc_factory_sheet_v1')).toBeNull()
    })
  })

  it('a failed save keeps the browser copy', async () => {
    window.localStorage.setItem('nvc_factory_sheet_v1', LEGACY)
    const user = userEvent.setup()
    render(<AdminFactorySheetsPage />)

    await waitFor(() => expect(screen.getByText(/стария инструмент|old internal tool/)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Внеси го|Import it/ }))
    await waitFor(() => expect(screen.getByDisplayValue('Стар клиент')).toBeInTheDocument())

    const passthrough = global.fetch
    vi.stubGlobal('fetch', (url, options = {}) =>
      options.method === 'POST' && String(url).includes('/factory-sheets')
        ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ errors: ['no'] }), text: () => Promise.resolve('') })
        : passthrough(url, options))

    await user.click(screen.getByRole('button', { name: /^Запази$|^Save$/ }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(window.localStorage.getItem('nvc_factory_sheet_v1')).not.toBeNull()
  })

  it('pasting a configurator summary becomes spec rows', async () => {
    const user = userEvent.setup()
    render(<AdminFactorySheetsPage />)
    await waitFor(() => expect(screen.getByText('FS-2026-014')).toBeInTheDocument())
    await user.click(screen.getByText('FS-2026-014'))
    await waitFor(() => expect(screen.getByDisplayValue('Иван Петров')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText(/Поставете тук|Paste the copied/), {
      target: { value: 'Модел: 73 м²\nОтопление: Климатик' },
    })
    await user.click(screen.getByRole('button', { name: /Внеси от обобщение|Import from summary/ }))

    expect(screen.getByDisplayValue('73 м²')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Климатик')).toBeInTheDocument()
  })
})
