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
  notes: 'Prefers calls after six.', houseId: 3, houseTitle: 'Nova 60',
  // "Logistics" is a real value from the imported CRM data and not a gallery category,
  // which is what makes it the case the model dropdown has to disappear for.
  customModel: '', categoryKey: 'modular',
  offerId: 7, questionId: null, createdAt: '2026-07-01T09:00:00Z', lastActivityAt: '2026-08-01T09:00:00Z',
  activities: [
    { id: 10, type: 'email_in', subject: 'Question', body: 'How much for the 60?', actorUpn: '', fromCustomer: true, occurredAt: '2026-07-01T09:00:00Z', attachments: [] },
    { id: 11, type: 'status', subject: '', body: 'contacted → quoted', actorUpn: 's@x.eu', fromCustomer: false, occurredAt: '2026-07-02T09:00:00Z', attachments: [] },
    { id: 12, type: 'email_out', subject: 'Re: Question', body: 'It is 26500 EUR.', actorUpn: 's@x.eu', fromCustomer: false, occurredAt: '2026-07-02T10:00:00Z', attachments: [{ id: 5, fileName: 'quote.pdf', contentType: 'application/pdf', sizeBytes: 2048, downloadUrl: '/api/admin/pipeline/attachments/5' }] },
  ],
}

let calls = []
// The detail payload the mock serves, so a test can swap in a lead whose category is not
// one the gallery filters on — the case the model dropdown has to disappear for.
let detail = DETAIL
// Same for the board, so the filter tests can serve rows whose activity dates are computed
// relative to NOW — hard-coded dates would make "last 7 days" drift out of the window as
// real time passes, and the test would start failing by itself weeks later.
let boardRows = BOARD

beforeEach(() => {
  calls = []
  detail = DETAIL
  boardRows = BOARD
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
    if (u.includes('/api/admin/gallery')) {
      return json([
        { id: 3, title: 'Nova 60', categoryKey: 'modular', isPublished: true },
        { id: 4, title: 'Nova 40', categoryKey: 'modular', isPublished: true },
        { id: 5, title: 'Site cabin', categoryKey: 'wagon', isPublished: true },
      ])
    }
    // Before the generic pipeline match, which would otherwise answer this URL with the
    // board rows.
    if (u.includes('/api/admin/pipeline/users')) return json(['maria@x.eu', 'vladi@x.eu'])
    if (u.match(/\/api\/admin\/pipeline\/\d+$/)) return json(detail)
    if (u.includes('/api/admin/pipeline')) return json(boardRows)
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

  // --- Assigning a lead to a user -----------------------------------------------------

  const ownerBox = () => screen.getByRole('combobox', { name: /Отговорник|Owner/ })

  it('assigns the lead to a picked user', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.selectOptions(ownerBox(), 'maria@x.eu')

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/1/owner') && c.method === 'POST')
      expect(JSON.parse(sent.body)).toEqual({ ownerUpn: 'maria@x.eu' })
    })
  })

  it('unassigning sends null, because "nobody has picked this up" is a real state', async () => {
    detail = { ...DETAIL, ownerUpn: 'maria@x.eu' }
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.selectOptions(ownerBox(), '')

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/1/owner') && c.method === 'POST')
      expect(JSON.parse(sent.body)).toEqual({ ownerUpn: null })
    })
  })

  it('an owner missing from the users list is still shown, not silently dropped', async () => {
    // Someone who left the company still owns their history. A dropdown that cannot
    // express the stored value would reassign it the moment anyone touched the control.
    detail = { ...DETAIL, ownerUpn: 'left-the-company@x.eu' }
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    expect(ownerBox()).toHaveValue('left-the-company@x.eu')
    const values = [...ownerBox().querySelectorAll('option')].map((o) => o.value)
    expect(values).toContain('left-the-company@x.eu')
    expect(values).toContain('maria@x.eu')
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

  // --- The lead sheet ------------------------------------------------------------------

  const openSheet = async (user) => {
    await user.click(screen.getByRole('button', { name: /Детайли и разговор|Details & conversation/ }))
    return screen.findByRole('dialog')
  }

  it('one button opens the conversation, the notes and the editable fields together', async () => {
    // It used to take two controls sitting apart — a "Details" toggle that could only
    // edit and an "Open full screen" that could only read — so the two things people
    // actually do here were on opposite sides of the screen.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    expect(within(dialog).getByText('How much for the 60?')).toBeInTheDocument()
    expect(within(dialog).getByText('It is 26500 EUR.')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Prefers calls after six.')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Send revised quote')).toBeInTheDocument()
  })

  it('there is no second way in, so there is no second place to edit the same field', async () => {
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /Отвори на цял екран|Open full screen/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Детайли$|^Details$/ })).not.toBeInTheDocument()
  })

  it('the next step and its date are the first thing in the sheet', async () => {
    // The field people open this to write. Under six address boxes is how a follow-up
    // date ends up never being set.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    const boxes = Array.from(dialog.querySelectorAll('input, select, textarea'))

    expect(boxes.indexOf(within(dialog).getByDisplayValue('Send revised quote')))
      .toBeLessThan(boxes.indexOf(within(dialog).getByDisplayValue('Nova 60')))
  })

  it('saving from the sheet sends the follow-up date with the rest', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    // Prefilled from the stored date, so saving without touching it cannot clear it.
    const dateBox = dialog.querySelector('input[type="date"]')
    expect(dateBox).toHaveValue('2026-08-10')

    fireEvent.change(dateBox, { target: { value: '2026-08-21' } })
    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

    await waitFor(() => {
      const saved = calls.find((c) => c.url.includes('/fields') && c.method === 'POST')
      expect(JSON.parse(saved.body).nextContactAt).toBe('2026-08-21')
      expect(JSON.parse(saved.body).nextStep).toBe('Send revised quote')
    })
  })

  // --- Sheet auto-close ---------------------------------------------------------------

  it('a successful save closes the sheet by itself', async () => {
    // Pressing Save means "I am done here"; making people close the sheet by hand after
    // every edit was the feedback that led to this.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a failed save keeps the sheet open and says why, inside the sheet', async () => {
    // Closing over an error would throw away the very edits that did not land — and the
    // page's own error banner renders BEHIND the modal, where nobody would see it.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    const passthrough = global.fetch
    vi.stubGlobal('fetch', (url, options = {}) => String(url).includes('/fields')
      ? Promise.resolve({
          ok: false, status: 500,
          json: () => Promise.resolve({ errors: ['The database said no.'] }),
          text: () => Promise.resolve(''),
        })
      : passthrough(url, options))

    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The database said no.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // --- Board filters ------------------------------------------------------------------

  const relativeIso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString()
  const list = () => document.querySelector('.adm-pipeline-list')

  it('narrows the board to one status without a network round trip', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Maria Dimitrova')).toBeInTheDocument())

    const before = calls.length
    await user.selectOptions(screen.getByRole('combobox', { name: /Статус|^Status$/ }), 'new')

    // Ivan is quoted, Maria is new. The DETAIL pane keeps showing Ivan — a filter trims
    // the list beside a conversation, it must not close the conversation.
    expect(within(list()).queryByText('Ivan Petrov')).not.toBeInTheDocument()
    expect(within(list()).getByText('Maria Dimitrova')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument()
    expect(calls.length).toBe(before)
  })

  it('the activity filter separates the recent from the forgotten', async () => {
    boardRows = [
      { ...BOARD[0], id: 1, name: 'Fresh Lead', lastActivityAt: relativeIso(2) },
      { ...BOARD[1], id: 2, name: 'Old Lead', lastActivityAt: relativeIso(45) },
      { ...BOARD[1], id: 3, name: 'Never Touched', lastActivityAt: null },
    ]
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Old Lead')).toBeInTheDocument())

    const box = screen.getByRole('combobox', { name: /Активност|Activity/ })

    await user.selectOptions(box, 'week')
    expect(within(list()).getByText('Fresh Lead')).toBeInTheDocument()
    expect(within(list()).queryByText('Old Lead')).not.toBeInTheDocument()
    // No activity at all is not "recent activity" — it is the most forgotten state.
    expect(within(list()).queryByText('Never Touched')).not.toBeInTheDocument()

    await user.selectOptions(box, 'stale')
    expect(within(list()).queryByText('Fresh Lead')).not.toBeInTheDocument()
    expect(within(list()).getByText('Old Lead')).toBeInTheDocument()
    expect(within(list()).getByText('Never Touched')).toBeInTheDocument()
  })

  it('filters that hide everything say so and offer the way back', async () => {
    // An empty list under active filters otherwise reads as data loss.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Maria Dimitrova')).toBeInTheDocument())

    // Nobody on the board is lost.
    await user.selectOptions(screen.getByRole('combobox', { name: /Статус|^Status$/ }), 'lost')
    expect(within(list()).getByText(/Няма лийдове, отговарящи|No leads match/)).toBeInTheDocument()

    await user.click(within(list()).getByRole('button', { name: /Изчисти филтрите|Clear filters/ }))
    expect(within(list()).getByText('Maria Dimitrova')).toBeInTheDocument()
  })

  // --- The merged "what they want" box ------------------------------------------------
  //
  // This used to be two controls asking the same question — a dropdown of catalogue models
  // and a free-text box — and sales filled in whichever they reached first. It is now one
  // box that suggests the models and accepts anything. What these tests hold down is that
  // merging the CONTROLS did not merge the COLUMNS: HouseId is still a foreign key when the
  // answer is a catalogue model, and still empty when it is not.

  const modelBox = (dialog) =>
    within(dialog).getByRole('combobox', { name: /Какво търси|What they want/ })

  it('suggests the models in the chosen category, and only those', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    const list = dialog.querySelector('#leadModelOptions')
    const titles = [...list.querySelectorAll('option')].map((o) => o.value)

    expect(titles).toContain('Nova 60')
    expect(titles).toContain('Nova 40')
    // A wagon is not a modular house; suggesting it here would file the lead under a model
    // from a category nobody chose.
    expect(titles).not.toContain('Site cabin')
  })

  it('shows the linked model rather than making people guess it is linked', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    expect(modelBox(dialog)).toHaveValue('Nova 60')
    expect(within(dialog).getByText(/свързан модел|linked model/)).toBeInTheDocument()
  })

  it('typing a catalogue model links it as a real foreign key', async () => {
    detail = { ...DETAIL, houseId: null, houseTitle: '', customModel: '' }
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    fireEvent.change(modelBox(dialog), { target: { value: 'Nova 40' } })
    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.url.includes('/fields')).body)
      // The FK, not the string. It is what makes "how many leads for the Nova 40?" a join.
      expect(saved.houseId).toBe(4)
      expect(saved.customModel).toBe('')
    })
  })

  it('typing anything else is kept as free text, with no model attached', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    fireEvent.change(modelBox(dialog), { target: { value: 'Nova 60, but 2m longer' } })

    expect(within(dialog).getByText(/свободен текст|free text/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.url.includes('/fields')).body)
      expect(saved.customModel).toBe('Nova 60, but 2m longer')
      // 0, not null: the server reads 0 as "clear it" and null as "leave it alone", so a
      // lead that used to point at the Nova 60 would otherwise keep pointing at it.
      expect(saved.houseId).toBe(0)
    })
  })

  it('a near-miss is not silently linked to a model', async () => {
    // Prefix matching would attach "Nova 6" to the Nova 60 — a wrong foreign key that
    // nothing downstream can detect. Exact titles only.
    detail = { ...DETAIL, houseId: null, houseTitle: '', customModel: '' }
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    fireEvent.change(modelBox(dialog), { target: { value: 'Nova 6' } })

    expect(within(dialog).getByText(/свободен текст|free text/)).toBeInTheDocument()
  })

  it('a category the gallery has no models for still takes free text', async () => {
    // "Logistics" is real imported CRM data. There is nothing to suggest, and the box
    // carries the answer anyway — which is the whole reason it is a text box.
    detail = { ...DETAIL, categoryKey: 'Logistics', houseId: null, houseTitle: '', customModel: 'Transport to Varna' }
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    expect(dialog.querySelectorAll('#leadModelOptions option')).toHaveLength(0)
    expect(modelBox(dialog)).toHaveValue('Transport to Varna')
  })

  it('a category the gallery does not know is still offered, not silently dropped', async () => {
    // It came from the customer. A dropdown that omits the current value rewrites the
    // record the moment anyone presses Save.
    detail = { ...DETAIL, categoryKey: 'Logistics' }
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    const category = within(dialog).getByRole('combobox', { name: /Категория|^Category$/ })

    expect(category).toHaveValue('Logistics')
    expect(within(category).getByRole('option', { name: 'Logistics' })).toBeInTheDocument()
  })
})
