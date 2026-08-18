import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import AdminAuditPage from './AdminAuditPage.jsx'

// The audit log as a person meets it.
//
// What is pinned here is mostly about not lying: a redacted value must never be printed as
// though it were the value, a creation must not read as though it changed something, and
// the page must offer no way to alter what it shows — the API has no write path, and the UI
// must not imply one.

const render = (ui, entry = '/admin/audit') =>
  rtlRender(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>)

const json = (body) => Promise.resolve({
  ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)),
})

const ENTRIES = [
  {
    id: 3, occurredAt: '2026-08-18T09:00:00Z', actorUpn: 'maria@nvc-home4you.eu',
    entityType: 'Customer', entityId: '12', action: 'updated', summary: 'Стройко ООД',
    changes: [{ field: 'Phone', from: '0888111222', to: '0888999000' }],
  },
  {
    id: 2, occurredAt: '2026-08-18T08:00:00Z', actorUpn: null,
    entityType: 'Factory', entityId: '5', action: 'created', summary: 'Bursa Prefab',
    changes: [{ field: 'Name', from: null, to: 'Bursa Prefab' }],
  },
  {
    id: 1, occurredAt: '2026-08-17T17:00:00Z', actorUpn: 'vladi@nvc-home4you.eu',
    entityType: 'Customer', entityId: '12', action: 'updated', summary: 'Стройко ООД',
    changes: [{ field: 'PersonalId', from: null, to: '(set)' }],
  },
]

const FILTERS = {
  actors: ['maria@nvc-home4you.eu', 'vladi@nvc-home4you.eu'],
  entityTypes: ['Customer', 'Factory'],
  actions: ['created', 'updated', 'deleted'],
  hasSystem: true,
}

let calls = []
let page = { entries: ENTRIES, total: ENTRIES.length, hasMore: false }

beforeEach(() => {
  calls = []
  page = { entries: ENTRIES, total: ENTRIES.length, hasMore: false }
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales', email: 'sales@x.eu' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/audit/filters')) return json(FILTERS)
    if (u.includes('/api/admin/audit')) return json(page)
    return json({})
  }))
})

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('AdminAuditPage', () => {
  it('shows who changed what, with both sides of the value', async () => {
    render(<AdminAuditPage />)

    await waitFor(() => expect(screen.getByText('Phone')).toBeInTheDocument())
    // Two entries share this customer, which is itself the point of a log.
    expect(screen.getAllByText('Стройко ООД')).toHaveLength(2)
    expect(screen.getByText('0888111222')).toBeInTheDocument()
    expect(screen.getByText('0888999000')).toBeInTheDocument()
    // The UPN is shortened for the list; the whole thing stays in the title.
    expect(screen.getByTitle('maria@nvc-home4you.eu')).toHaveTextContent('maria')
  })

  it('never prints a redacted marker as though it were the value', async () => {
    // The server writes "(set)" for an ЕГН. Rendering that literally would leave a reader
    // wondering whether somebody typed it — and it must certainly never look like a number.
    render(<AdminAuditPage />)

    await waitFor(() => expect(screen.getByText('PersonalId')).toBeInTheDocument())

    expect(screen.queryByText('(set)')).not.toBeInTheDocument()
    expect(screen.getByText(/filled in|попълнено/)).toBeInTheDocument()
  })

  it('names the system as the actor when nobody was signed in', async () => {
    // The importers and the CLI. "Nobody" is the honest answer and has to read as one.
    render(<AdminAuditPage />)

    await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument())
    expect(screen.getAllByText(/System|Системата/).length).toBeGreaterThan(0)
  })

  it('a creation shows what appeared, not a change from nothing', async () => {
    render(<AdminAuditPage />)

    await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument())

    const created = screen.getByText('Name').closest('li')
    // No "from → to" scaffolding on a row that had no "from".
    expect(within(created).queryByText(/^from$|^от$/)).not.toBeInTheDocument()
  })

  it('offers no way to change anything', async () => {
    // The API has no write path; the UI must not imply one.
    render(<AdminAuditPage />)

    await waitFor(() => expect(screen.getByText('Phone')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /Delete|Изтрий|Edit|Редактирай|Save|Запази/ }))
      .not.toBeInTheDocument()
    expect(calls.every((c) => c.method === 'GET')).toBe(true)
  })

  it('filters narrow the query the server is asked', async () => {
    const user = userEvent.setup()
    render(<AdminAuditPage />)
    await waitFor(() => expect(screen.getByText('Phone')).toBeInTheDocument())

    await user.selectOptions(screen.getByRole('combobox', { name: /Who|Кой/ }), 'maria@nvc-home4you.eu')

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('actor=maria%40nvc-home4you.eu'))).toBe(true)
    })
  })

  it('the system can be filtered for by name', async () => {
    const user = userEvent.setup()
    render(<AdminAuditPage />)
    await waitFor(() => expect(screen.getByText('Phone')).toBeInTheDocument())

    await user.selectOptions(screen.getByRole('combobox', { name: /Who|Кой/ }), 'system')

    await waitFor(() => expect(calls.some((c) => c.url.includes('actor=system'))).toBe(true))
  })

  it('a link can land pre-filtered on one table', async () => {
    render(<AdminAuditPage />, '/admin/audit?entity=Customer')

    await waitFor(() => expect(calls.some((c) => c.url.includes('entityType=Customer'))).toBe(true))
  })

  it('an empty result under filters says so and offers the way back', async () => {
    const user = userEvent.setup()
    render(<AdminAuditPage />)
    await waitFor(() => expect(screen.getByText('Phone')).toBeInTheDocument())

    page = { entries: [], total: 0, hasMore: false }
    await user.selectOptions(screen.getByRole('combobox', { name: /What|Какво/ }), 'deleted')

    await waitFor(() => {
      expect(screen.getByText(/No entries match|Няма записи, отговарящи/)).toBeInTheDocument()
    })
    // Two of them, and deliberately: the toolbar one is how you clear when results ARE
    // showing, the empty-state one is where the eye already is when they are not.
    expect(screen.getAllByRole('button', { name: /Clear filters|Изчисти филтрите/ })).toHaveLength(2)
  })

  it('paging appends rather than replacing what is on screen', async () => {
    page = { entries: ENTRIES.slice(0, 2), total: 3, hasMore: true }
    const user = userEvent.setup()
    render(<AdminAuditPage />)
    await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument())

    page = { entries: ENTRIES.slice(2), total: 3, hasMore: false }
    await user.click(screen.getByRole('button', { name: /Show more|Покажи още/ }))

    await waitFor(() => expect(screen.getByText('PersonalId')).toBeInTheDocument())
    // The first page is still there.
    expect(screen.getByText('Name')).toBeInTheDocument()
  })
})
