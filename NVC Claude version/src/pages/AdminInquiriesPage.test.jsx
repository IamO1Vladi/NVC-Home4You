import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render as rtlRender, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminInquiriesPage from './AdminInquiriesPage.jsx'

// The inquiry queue is the section sales works from every day, so these cover the things
// that would cost a call: that the outstanding queue is what loads first, that ticking a
// box actually reaches the API for the right record, and that a failed save puts the
// checkbox back rather than leaving the screen disagreeing with the database.

const render = (ui) => rtlRender(<MemoryRouter initialEntries={['/admin/inquiries']}>{ui}</MemoryRouter>)

const openOffer = {
  kind: 'offer', id: 1, name: 'Иван Петров', email: 'ivan@example.bg', phone: '+359 88 123 4567',
  message: 'Интересувам се от Бокс къща 37 м².', modelId: '', locale: 'bg',
  reachedOut: false, leadCreated: false, createdAt: '2026-07-22T10:00:00Z',
}

const openQuestion = {
  kind: 'question', id: 1, name: 'Maria S', email: 'maria@example.com', phone: '',
  message: 'Do you deliver to Greece?', modelId: '', locale: 'el',
  reachedOut: false, leadCreated: true, dealId: 42, createdAt: '2026-08-01T09:00:00Z',
}

function mockApi({ items = [openOffer, openQuestion], status = 200, updateStatus = 200 } = {}) {
  const calls = []
  const json = (body, code = 200) =>
    Promise.resolve({
      ok: code >= 200 && code < 300,
      status: code,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })

  const fetchMock = vi.fn((url, opts) => {
    const u = String(url)
    const method = opts?.method || 'GET'
    calls.push({ url: u, method, body: opts?.body })
    if (status === 401) return json({}, 401)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi', email: 'vladi@nvc-home4you.eu' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 2, reachedOut: 5, offers: 4, questions: 3 })
    if (u.includes('/api/admin/pipeline/promote')) return json({ ok: true, id: 77, created: true })
    if (/\/api\/admin\/leads\/(offer|question)\/\d+/.test(u)) return json({ ok: true }, updateStatus)
    return json(items)
  })

  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

describe('AdminInquiriesPage', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('opens on the outstanding queue rather than the full history', async () => {
    const { calls } = mockApi()
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    const list = calls.find((c) => c.url.includes('/api/admin/leads?'))
    expect(list.url).toContain('reached=false')
  })

  it('shows offers and questions in the same queue', async () => {
    mockApi()
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())
    expect(screen.getByText('Maria S')).toBeInTheDocument()
  })

  it('makes the customer reachable in one tap', async () => {
    mockApi()
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    // Spaces stripped, or the tel: link does nothing on a phone.
    expect(screen.getByRole('link', { name: '+359 88 123 4567' }))
      .toHaveAttribute('href', 'tel:+359881234567')
  })

  it('never offers a mailto, because that reply would leave the thread', async () => {
    // A mail client sends from somebody's personal account, straight past contact@ and
    // out of the conversation the next person to pick this up will read.
    mockApi()
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    expect(screen.queryByRole('link', { name: 'ivan@example.bg' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ivan@example\.bg/ })).toBeInTheDocument()
  })

  it('clicking the email address creates the lead and opens its conversation', async () => {
    const { calls } = mockApi()
    const user = userEvent.setup()
    render(<AdminInquiriesPage />)

    await user.click(await screen.findByRole('button', { name: /ivan@example\.bg/ }))

    await waitFor(() => {
      const promoted = calls.find((c) => c.url.includes('/api/admin/pipeline/promote'))
      expect(promoted).toBeTruthy()
      expect(JSON.parse(promoted.body)).toEqual({ kind: 'offer', id: 1 })
    })
  })

  it('does not promote a second time for an enquiry that already has a lead', async () => {
    // Maria's question was promoted already; clicking her address has to open that
    // conversation rather than start a rival one.
    const { calls } = mockApi()
    const user = userEvent.setup()
    render(<AdminInquiriesPage />)

    await user.click(await screen.findByRole('button', { name: /maria@example\.com/ }))

    expect(calls.some((c) => c.url.includes('/api/admin/pipeline/promote'))).toBe(false)
  })

  it('ticking reached-out posts only that flag, for that record', async () => {
    const { calls } = mockApi()
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    const boxes = screen.getAllByRole('checkbox', { name: /Свързахме се|Reached out/ })
    await userEvent.click(boxes[0])

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post).toBeTruthy()
      // Offer 1, not question 1 — the two id sequences overlap.
      expect(post.url).toContain('/api/admin/leads/offer/1')
      // Only the flag that changed, so a concurrent edit to the other is not clobbered.
      expect(JSON.parse(post.body)).toEqual({ reachedOut: true })
    })
  })

  it('puts the checkbox back when the save fails', async () => {
    mockApi({ updateStatus: 500 })
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    const box = screen.getAllByRole('checkbox', { name: /Свързахме се|Reached out/ })[0]
    await userEvent.click(box)

    // The screen must never claim a lead was handled when the database disagrees.
    await waitFor(() => expect(screen.getByText('Промяната не беше запазена.')).toBeInTheDocument())
    expect(box).not.toBeChecked()
  })

  it('asks for sign-in on a 401 instead of looking broken', async () => {
    mockApi({ status: 401 })
    render(<AdminInquiriesPage />)

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Вход с Microsoft|Sign in with Microsoft/ })).toBeInTheDocument())
  })

  it('filters the queue by the search box', async () => {
    mockApi()
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    await userEvent.type(screen.getByRole('searchbox'), 'maria')

    expect(screen.getByText('Maria S')).toBeInTheDocument()
    expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument()
  })

  it('says the queue is clear rather than showing an empty list', async () => {
    mockApi({ items: [] })
    render(<AdminInquiriesPage />)

    await waitFor(() =>
      expect(screen.getByText('Няма запитвания за обработка. Всичко е поето.')).toBeInTheDocument())
  })

  it('offers to create a lead for an inquiry that has none, and to open the one it has', async () => {
    // The control replaced a hand-ticked "Lead created" checkbox that only recorded that
    // someone had done the work elsewhere. Now it does the work.
    mockApi()
    render(<AdminInquiriesPage />)

    await waitFor(() => expect(screen.getAllByRole('button', { name: /Създай лийд|Create lead/ }).length).toBe(1))
    expect(screen.getByRole('link', { name: /Отвори лийда|Open lead/ })).toBeInTheDocument()
  })

  it('creates the lead from the inquiry it was clicked on', async () => {
    const { calls } = mockApi()
    const user = userEvent.setup()
    render(<AdminInquiriesPage />)

    const button = (await screen.findAllByRole('button', { name: /Създай лийд|Create lead/ }))[0]
    await user.click(button)

    await waitFor(() => {
      const promoted = calls.find((c) => c.url.includes('/api/admin/pipeline/promote'))
      expect(promoted).toBeTruthy()
      // The offer, not the question — the question already has a lead.
      expect(JSON.parse(promoted.body)).toEqual({ kind: 'offer', id: 1 })
    })
  })

  it('filters down to the inquiries that still need a lead', async () => {
    // "Which of these still need me to do something?" is what this page is opened to
    // answer now that replying happens in the leads view.
    mockApi()
    const user = userEvent.setup()
    render(<AdminInquiriesPage />)

    const box = await screen.findByRole('checkbox', { name: /Скрий тези с лийд|Hide ones with a lead/ })

    // Off by default: everything is listed, and only the inquiry without a lead offers
    // the button.
    expect(box).not.toBeChecked()
    await waitFor(() => expect(screen.getByRole('link', { name: /Отвори лийда|Open lead/ })).toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: /Създай лийд|Create lead/ }).length).toBe(1)

    // Checked hides the ones already handled, leaving only work still to do.
    await user.click(box)
    await waitFor(() => expect(screen.queryByRole('link', { name: /Отвори лийда|Open lead/ })).not.toBeInTheDocument())
    expect(screen.getAllByRole('button', { name: /Създай лийд|Create lead/ }).length).toBe(1)
  })

  // --- The archive ------------------------------------------------------------------

  it('archives an inquiry without deleting it, and offers to undo', async () => {
    const { calls } = mockApi()
    const user = userEvent.setup()
    render(<AdminInquiriesPage />)

    const button = (await screen.findAllByRole('button', { name: /^Архивирай$|^Archive$/ }))[0]
    await user.click(button)

    await waitFor(() => {
      const archived = calls.find((c) => c.url.includes('/archive'))
      expect(archived).toBeTruthy()
      expect(archived.url).toContain('/api/admin/leads/offer/1/archive')
      expect(JSON.parse(archived.body)).toEqual({ archived: true })
    })

    // Reversible and frequent, so the safety net comes after the action rather than as a
    // dialog in front of it.
    await waitFor(() => expect(screen.getByRole('button', { name: /Отмени|Undo/ })).toBeInTheDocument())
  })

  it('undo puts the inquiry straight back', async () => {
    const { calls } = mockApi()
    const user = userEvent.setup()
    render(<AdminInquiriesPage />)

    await user.click((await screen.findAllByRole('button', { name: /^Архивирай$|^Archive$/ }))[0])
    await user.click(await screen.findByRole('button', { name: /Отмени|Undo/ }))

    await waitFor(() => {
      const restored = calls.filter((c) => c.url.includes('/archive')).pop()
      expect(JSON.parse(restored.body)).toEqual({ archived: false })
    })
  })

  it('the archive tab asks the server for the archived rows, not for the queue', async () => {
    const { calls } = mockApi()
    const user = userEvent.setup()
    render(<AdminInquiriesPage />)

    await user.click(await screen.findByRole('button', { name: /^Архив$|^Archive$/ }))

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('/api/admin/leads?reached=archived'))).toBe(true))
  })
})
