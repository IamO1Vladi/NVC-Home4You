import React from 'react'
import { render as rtlRender, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import RepLeadsPage from './RepLeadsPage.jsx'
import { _resetSubmissions, _setRetryDelays } from '../lib/backgroundSubmit.js'

// The representatives' panel (ROADMAP #38) is the admin pipeline page in its 'rep' scope,
// so AdminPipelinePage.test.jsx already covers the thread, the composer and the sheet. What
// these pin is the scope itself: which API the page talks to, which controls are gone, and
// that what is left still works for a lead the representative owns.
//
// Same harness as that file: fetch stubbed, every call recorded. Everything under /api/admin
// answers 403, the way the server answers a representative, so a page that reached for an
// admin endpoint could not quietly succeed here.

const REP = 'dtodorov@nvc-home4you.eu'

const render = (ui, entry = '/rep/leads') =>
  rtlRender(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>)

const json = (body, code = 200) => Promise.resolve({
  ok: code >= 200 && code < 300,
  status: code,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const BOARD = [
  { id: 1, name: 'Ivan Petrov', status: 'quoted', ownerUpn: REP, modelLabel: 'Nova 60', nextStep: '', createdAt: '2026-07-01T09:00:00Z', lastActivityAt: '2026-08-01T09:00:00Z', activityCount: 2 },
  { id: 2, name: 'Maria Dimitrova', status: 'new', ownerUpn: REP, modelLabel: '', nextStep: '', createdAt: '2026-08-10T09:00:00Z', lastActivityAt: '2026-08-11T09:00:00Z', activityCount: 1 },
]

const DETAIL = {
  id: 1, name: 'Ivan Petrov', email: 'ivan@example.com', phone: '', status: 'quoted',
  ownerUpn: REP, locale: 'bg', country: '', buildLocation: '', projectName: '',
  nextStep: 'Send revised quote', nextContactAt: '2026-08-10T00:00:00.0000000Z',
  notes: 'Prefers calls after six.', houseId: 3, houseTitle: 'Nova 60',
  customModel: '', categoryKey: 'modular',
  offerId: 7, questionId: null, createdAt: '2026-07-01T09:00:00Z', lastActivityAt: '2026-08-01T09:00:00Z',
  activities: [
    { id: 10, type: 'email_in', subject: 'Question', body: 'How much for the 60?', actorUpn: '', fromCustomer: true, occurredAt: '2026-07-01T09:00:00Z', attachments: [] },
    // The download link the server writes is the ADMIN route — LeadPipelineService builds
    // it the same way whichever controller served the lead. The page must not follow it here.
    { id: 12, type: 'email_out', subject: 'Re: Question', body: 'It is 26500 EUR.', actorUpn: REP, fromCustomer: false, occurredAt: '2026-07-02T10:00:00Z', attachments: [{ id: 5, fileName: 'quote.pdf', contentType: 'application/pdf', sizeBytes: 2048, downloadUrl: '/api/admin/pipeline/attachments/5' }] },
  ],
}

let calls = []
let detail = DETAIL
let signedIn = true

beforeEach(() => {
  calls = []
  detail = DETAIL
  signedIn = true
  _resetSubmissions()
  // Zero backoff, for the same reason as the admin suite: a save handed to the retries
  // must not still be firing into the next test's call log.
  _setRetryDelays([0, 0, 0, 0])
  // jsdom has no layout engine, so scrollIntoView is undefined on every element.
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const u = String(url)
    calls.push({ url: u, method: options.method || 'GET', body: options.body })
    if (!signedIn) return json({}, 401)
    if (u.includes('/api/rep/me')) return json({ name: 'Dimitar Todorov', email: REP, role: 'representative' })
    if (u.includes('/api/rep/pipeline/1/reply')) return json({ ok: true, activityId: 99 })
    if (u.match(/\/api\/rep\/pipeline\/\d+$/)) return json(detail)
    if (u.includes('/api/rep/pipeline')) return json(BOARD)
    return json({}, 403)
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  _resetSubmissions()
  _setRetryDelays()
  // The sign-in test moves jsdom's own location; put it back.
  window.history.replaceState(null, '', '/')
})

const adminCalls = () => calls.filter((c) => c.url.includes('/api/admin'))

const openSheet = async (user) => {
  await user.click(screen.getByRole('button', { name: /Детайли и разговор|Details & conversation/ }))
  return screen.findByRole('dialog')
}

describe('RepLeadsPage', () => {
  it('reads the board, the lead and the identity from the representative’s API, and nothing from the admin one', async () => {
    render(<RepLeadsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const urls = calls.map((c) => c.url)
    expect(urls).toContain('/api/rep/pipeline?status=open')
    expect(urls).toContain('/api/rep/pipeline/1')
    expect(urls).toContain('/api/rep/me')
    // Neither the chrome's two counts, nor the users list, nor the sheet's two catalogue
    // lists: every one of them is an admin endpoint.
    expect(adminCalls()).toEqual([])
  })

  it('offers only the views that make sense for one person: due, active, archived', async () => {
    // "Mine" and "All" are the same list as the other three here, so they would be two
    // tabs that change nothing.
    render(<RepLeadsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const tabs = within(screen.getByRole('navigation', { name: /Моите лийдове|My leads/ }))
    expect(tabs.getByRole('button', { name: /За връзка|^Due$/ })).toBeInTheDocument()
    expect(tabs.getByRole('button', { name: /Активни|^Active$/ })).toBeInTheDocument()
    expect(tabs.getByRole('button', { name: /^Архив$|^Archived$/ })).toBeInTheDocument()
    expect(tabs.queryByRole('button', { name: /^Мои$|^Mine$/ })).not.toBeInTheDocument()
    expect(tabs.queryByRole('button', { name: /^Всички$|^All$/ })).not.toBeInTheDocument()
  })

  it('has none of the team’s controls', async () => {
    // Served with no owner, which the real API never does, to prove the "take it" button
    // is gone rather than merely not applicable: the scope hides the control, whatever the
    // row says.
    detail = { ...DETAIL, ownerUpn: '' }
    const user = userEvent.setup()
    render(<RepLeadsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /Нов лийд|New lead/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Поеми|Take it/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Направи клиент|Make customer/ })).not.toBeInTheDocument()
    // Neither the owner filter in the toolbar nor the owner dropdown in the header.
    expect(screen.queryByText(/^Отговорник|^Owner/)).not.toBeInTheDocument()

    // The report belongs to the due view; it is not there either.
    await user.click(screen.getByRole('button', { name: /За връзка|^Due$/ }))
    await waitFor(() => expect(calls.some((c) => c.url === '/api/rep/pipeline?due=true')).toBe(true))
    expect(screen.queryByRole('button', { name: /Изпрати справка|Send report/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Отговорник|^Owner/)).not.toBeInTheDocument()
  })

  it('the nav is one section, and it is this one', async () => {
    render(<RepLeadsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    // The sidebar and the phone tab bar both render it; every copy points here.
    const links = screen.getAllByRole('link', { name: /Моите лийдове|My leads/ })
    expect(links.length).toBeGreaterThan(0)
    links.forEach((a) => expect(a).toHaveAttribute('href', '/rep/leads'))
    expect(screen.queryByRole('link', { name: /Запитвания|Inquiries/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Начало$|^Home$/ })).not.toBeInTheDocument()
    // The brand mark goes back to this panel's own door, not to the admin menu.
    expect(screen.getByRole('link', { name: /Представител|Representative/ })).toHaveAttribute('href', '/rep/leads')
  })

  it('the sheet opens for an owned lead, with the category and the model as text', async () => {
    const user = userEvent.setup()
    render(<RepLeadsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    expect(within(dialog).getByDisplayValue('Send revised quote')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Prefers calls after six.')).toBeInTheDocument()
    expect(within(dialog).getByText('How much for the 60?')).toBeInTheDocument()
    // Said, not chosen: the category and the model are words on the sheet, and there is no
    // dropdown or combobox anywhere in it.
    expect(within(dialog).getByText('Модулна къща')).toBeInTheDocument()
    expect(within(dialog).getByText('Nova 60')).toBeInTheDocument()
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(dialog).queryByDisplayValue('Nova 60')).not.toBeInTheDocument()

    // And the save goes through the representative's route, the model untouched.
    fireEvent.change(dialog.querySelector('input[type="date"]'), { target: { value: '2026-08-21' } })
    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))
    await waitFor(() => {
      const saved = calls.find((c) => c.url.includes('/fields') && c.method === 'POST')
      expect(saved.url).toBe('/api/rep/pipeline/1/fields')
      const body = JSON.parse(saved.body)
      expect(body.nextContactAt).toBe('2026-08-21')
      expect(body.houseId).toBe(3)
      expect(body.categoryKey).toBe('modular')
    })
  })

  it('a file link points at the representative’s own route, whatever the server wrote', async () => {
    render(<RepLeadsPage />)
    await waitFor(() => expect(screen.getByText('It is 26500 EUR.')).toBeInTheDocument())

    expect(screen.getByRole('link', { name: 'quote.pdf' }))
      .toHaveAttribute('href', '/api/rep/pipeline/attachments/5')
  })

  it('replies and status moves go through the representative’s route', async () => {
    const user = userEvent.setup()
    render(<RepLeadsPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    // The composer is contenteditable, which jsdom cannot type into: write the HTML and
    // fire the input event the editor listens for, as the admin suite does.
    const box = screen.getByRole('textbox', { name: /Отговор|Reply/ })
    box.innerHTML = '<p>Ще пратя офертата днес.</p>'
    fireEvent.input(box)
    await user.click(screen.getByRole('button', { name: /^Изпрати$|^Send$/ }))
    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/reply') && c.method === 'POST')
      expect(sent.url).toBe('/api/rep/pipeline/1/reply')
    })

    fireEvent.change(document.getElementById('dealStatus'), { target: { value: 'negotiating' } })
    await waitFor(() => {
      const moved = calls.find((c) => c.url.includes('/status') && c.method === 'POST')
      expect(moved.url).toBe('/api/rep/pipeline/1/status')
      expect(JSON.parse(moved.body).status).toBe('negotiating')
    })
    expect(adminCalls()).toEqual([])
  })

  it('a 401 shows the sign-in card, and it comes back to this panel', async () => {
    signedIn = false
    window.history.replaceState(null, '', '/rep/leads')
    render(<RepLeadsPage />)

    expect(await screen.findByRole('heading', { name: 'Необходим е вход' })).toBeInTheDocument()
    expect(screen.queryByText('Ivan Petrov')).not.toBeInTheDocument()
    // The same /admin/signin flow as staff, with the return address being this panel and
    // not the admin one — the one place the two panels' paths had to be told apart.
    const link = screen.getByRole('link', { name: /Вход/ })
    expect(link.getAttribute('href')).toBe(`/admin/signin?returnUrl=${encodeURIComponent('/rep/leads')}`)
  })
})
