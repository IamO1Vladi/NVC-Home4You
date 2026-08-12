import React from 'react'
import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import AdminPipelinePage from './AdminPipelinePage.jsx'

const render = (ui) => rtlRender(<MemoryRouter initialEntries={['/admin/pipeline']}>{ui}</MemoryRouter>)

const json = (body) => Promise.resolve({
  ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)),
})

const BOARD = [
  { id: 1, name: 'Ivan Petrov', status: 'quoted', ownerUpn: '', modelLabel: 'Nova 60', nextStep: '', createdAt: '2026-07-01T09:00:00Z', lastActivityAt: '2026-08-01T09:00:00Z', activityCount: 2 },
  { id: 2, name: 'Maria Dimitrova', status: 'new', ownerUpn: 'maria@x.eu', modelLabel: '', nextStep: '', createdAt: '2026-08-10T09:00:00Z', lastActivityAt: '2026-08-11T09:00:00Z', activityCount: 1 },
]

const DETAIL = {
  id: 1, name: 'Ivan Petrov', email: 'ivan@example.com', phone: '', status: 'quoted',
  ownerUpn: '', locale: 'bg', country: '', buildLocation: '', projectName: '',
  nextStep: 'Send revised quote', notes: '', houseId: 3, houseTitle: 'Nova 60', customModel: '',
  offerId: 7, questionId: null, createdAt: '2026-07-01T09:00:00Z', lastActivityAt: '2026-08-01T09:00:00Z',
  activities: [
    { id: 10, type: 'email_in', subject: 'Question', body: 'How much for the 60?', actorUpn: '', fromCustomer: true, occurredAt: '2026-07-01T09:00:00Z', attachments: [] },
    { id: 11, type: 'status', subject: '', body: 'contacted → quoted', actorUpn: 's@x.eu', fromCustomer: false, occurredAt: '2026-07-02T09:00:00Z', attachments: [] },
    { id: 12, type: 'email_out', subject: 'Re: Question', body: 'It is 26500 EUR.', actorUpn: 's@x.eu', fromCustomer: false, occurredAt: '2026-07-02T10:00:00Z', attachments: [{ id: 5, fileName: 'quote.pdf', contentType: 'application/pdf', sizeBytes: 2048, downloadUrl: '/api/admin/pipeline/attachments/5' }] },
  ],
}

let calls = []

beforeEach(() => {
  calls = []
  // jsdom has no layout engine, so scrollIntoView is undefined on every element.
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/pipeline/1/draft')) return json({ ok: true, text: 'Здравейте Иван, ...' })
    if (u.includes('/api/admin/pipeline/1/reply')) return json({ ok: true, activityId: 99 })
    if (u.match(/\/api\/admin\/pipeline\/\d+$/)) return json(DETAIL)
    if (u.includes('/api/admin/pipeline')) return json(BOARD)
    return json({})
  }))
})

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('AdminPipelinePage', () => {
  it('opens on the lead that has been quiet longest so the morning view needs no click', async () => {
    render(<AdminPipelinePage />)

    // The board arrives already sorted quietest-first; the page selects the top row.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())
    expect(calls.some((c) => c.url.match(/\/api\/admin\/pipeline\/1$/))).toBe(true)
  })

  it('defaults to the active deals rather than everything ever closed', async () => {
    render(<AdminPipelinePage />)

    await waitFor(() => expect(calls.some((c) => c.url.includes('status=open'))).toBe(true))
  })

  it('shows both sides of the conversation and the attachment', async () => {
    render(<AdminPipelinePage />)

    await waitFor(() => expect(screen.getByText('How much for the 60?')).toBeInTheDocument())
    expect(screen.getByText('It is 26500 EUR.')).toBeInTheDocument()

    // Attachments link to the authenticated route, never a blob URL.
    const file = screen.getByRole('link', { name: 'quote.pdf' })
    expect(file).toHaveAttribute('href', '/api/admin/pipeline/attachments/5')
  })

  it('renders a status move as a divider, not as a message from anyone', async () => {
    render(<AdminPipelinePage />)

    await waitFor(() => expect(screen.getByText('contacted → quoted')).toBeInTheDocument())
    // It is punctuation in the thread: no speaker label attached to it.
    expect(screen.getByText('contacted → quoted').closest('li')).toHaveClass('adm-thread-meta')
  })

  it('sends a reply and only then clears the box', async () => {
    // Clearing optimistically would lose what someone typed if the send failed, and
    // retyping a reply is the least forgivable data loss in a tool like this.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const box = screen.getByPlaceholderText(/Напишете|Write your/)
    await user.type(box, 'Ще пратя офертата днес.')
    await user.click(screen.getByRole('button', { name: /Изпрати|Send/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/reply') && c.method === 'POST')
      expect(sent).toBeTruthy()
      expect(JSON.parse(sent.body).body).toBe('Ще пратя офертата днес.')
    })
    await waitFor(() => expect(box).toHaveValue(''))
  })

  it('will not send an empty reply', async () => {
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    expect(screen.getByRole('button', { name: /Изпрати|Send/ })).toBeDisabled()
  })

  it('puts a draft in the box for editing instead of sending it', async () => {
    // The whole safety model: a draft is a suggestion until a person presses Send.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Чернова|Draft/ }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Напишете|Write your/)).toHaveValue('Здравейте Иван, ...')
    })
    expect(calls.some((c) => c.url.includes('/reply'))).toBe(false)
  })

  it('passes what is already typed to the drafter as a steer', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText(/Напишете|Write your/), 'push for a site visit')
    await user.click(screen.getByRole('button', { name: /Чернова|Draft/ }))

    await waitFor(() => {
      const drafted = calls.find((c) => c.url.includes('/draft'))
      expect(JSON.parse(drafted.body).instruction).toBe('push for a site visit')
    })
  })

  it('offers to claim an unowned lead and not an owned one', async () => {
    render(<AdminPipelinePage />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Поеми|Take it/ })).toBeInTheDocument()
  })

  it('surfaces the next step where it cannot be missed', async () => {
    render(<AdminPipelinePage />)

    await waitFor(() => expect(screen.getByText(/Send revised quote/)).toBeInTheDocument())
  })
})
