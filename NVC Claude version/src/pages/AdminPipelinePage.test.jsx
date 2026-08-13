import React from 'react'
import { render as rtlRender, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import AdminPipelinePage from './AdminPipelinePage.jsx'

const render = (ui, entry = '/admin/pipeline') =>
  rtlRender(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>)

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
  nextStep: 'Send revised quote', nextContactAt: '2026-08-10T00:00:00.0000000Z',
  notes: 'Prefers calls after six.', houseId: 3, houseTitle: 'Nova 60', customModel: '',
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
    if (u.includes('/api/admin/pipeline/1/attachments')) return json({ ok: true, activityId: 98 })
    if (u.includes('/api/admin/pipeline/due/report')) return json({ ok: true, count: 2, recipients: ['me@x.eu'] })
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
      // Multipart even with nothing attached, so the path that carries files is the
      // same one every reply exercises.
      expect(sent.body.get('body')).toBe('Ще пратя офертата днес.')
    })
    await waitFor(() => expect(box).toHaveValue(''))
  })

  it('sends picked files with the reply, in the same request', async () => {
    // Uploading first and sending second would leave a file in the thread whenever the
    // send then failed — an attachment sales believes the customer has.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const file = new File(['%PDF-1.4'], 'oferta.pdf', { type: 'application/pdf' })
    await user.upload(document.querySelector('input[type="file"]'), file)

    // Visible before sending, so nobody presses Send believing they attached nothing.
    expect(screen.getByText('oferta.pdf')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Напишете|Write your/), 'Ето офертата.')
    await user.click(screen.getByRole('button', { name: /Изпрати|Send/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/reply') && c.method === 'POST')
      expect(sent.body.getAll('files')).toHaveLength(1)
      expect(sent.body.getAll('files')[0].name).toBe('oferta.pdf')
    })
  })

  it('a picked file can be taken off again before it is sent', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(['x'], 'wrong.pdf', { type: 'application/pdf' }))

    await user.click(screen.getByRole('button', { name: /wrong\.pdf/ }))

    expect(screen.queryByText('wrong.pdf')).not.toBeInTheDocument()
  })

  it('files can be kept in the thread without emailing them', async () => {
    // The way to file something too big to send, and the way to keep a document that was
    // never meant for the customer.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(['x'], 'survey.pdf', { type: 'application/pdf' }))

    await user.click(screen.getByRole('button', { name: /Бележка|Note/ }))

    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('/attachments') && c.method === 'POST')).toBe(true)
      expect(calls.some((c) => c.url.includes('/reply'))).toBe(false)
    })
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

  // --- The follow-up date and its report ----------------------------------------------

  it('the due tab asks the server the due question, not a status filter', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /За връзка|^Due$/ }))

    await waitFor(() => expect(calls.some((c) => c.url.includes('due=true'))).toBe(true))
  })

  it('a link from the emailed report lands straight on the due view', async () => {
    // Every mail links ?view=due; landing on the default board instead would mean
    // finding the report again by hand.
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')

    await waitFor(() => expect(calls.some((c) => c.url.includes('due=true'))).toBe(true))
  })

  it('sends the report to the typed address and says what was sent', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Изпрати справка|Send report/ }))

    // Scoped to the dialog: the composer behind it has its own Send button.
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByRole('textbox'), 'boss@nvc-home4you.eu')
    await user.click(within(dialog).getByRole('button', { name: /^Изпрати$|^Send$/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/due/report') && c.method === 'POST')
      expect(sent).toBeTruthy()
      expect(JSON.parse(sent.body)).toEqual({ to: 'boss@nvc-home4you.eu' })
    })
    // The outcome is said on the page — a report that vanishes into silence gets sent
    // twice "to be sure".
    await waitFor(() => expect(screen.getByText(/Изпратено: 2|Sent: 2/)).toBeInTheDocument())
  })

  it('opens the whole conversation full screen, with the standing notes under it', async () => {
    // A modal is a reading mode: the thread at full width, then the notes — what has
    // been said, and what we know that was never said to the customer.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Отвори на цял екран|Open full screen/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('How much for the 60?')).toBeInTheDocument()
    expect(within(dialog).getByText('It is 26500 EUR.')).toBeInTheDocument()
    expect(within(dialog).getByText('Prefers calls after six.')).toBeInTheDocument()
  })

  it('saving the details sends the follow-up date with them', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Детайли|^Details$/ }))

    // Prefilled from the stored date, so saving without touching it cannot clear it.
    const dateBox = document.querySelector('input[type="date"]')
    expect(dateBox).toHaveValue('2026-08-10')

    fireEvent.change(dateBox, { target: { value: '2026-08-21' } })
    await user.click(screen.getByRole('button', { name: /Запази|^Save$/ }))

    await waitFor(() => {
      const saved = calls.find((c) => c.url.includes('/fields') && c.method === 'POST')
      expect(JSON.parse(saved.body).nextContactAt).toBe('2026-08-21')
    })
  })
})
