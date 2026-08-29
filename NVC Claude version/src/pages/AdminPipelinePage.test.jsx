import React from 'react'
import { render as rtlRender, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import AdminPipelinePage from './AdminPipelinePage.jsx'
import SubmitStatus from '../components/SubmitStatus.jsx'
import { MAX_ATTEMPTS, _resetSubmissions, _setRetryDelays } from '../lib/backgroundSubmit.js'

// The banner is rendered app-wide from App.jsx, above every route including this one, so a
// page test that wants to read what a save reported has to put it back.
const render = (ui, entry = '/admin/pipeline') =>
  rtlRender(<MemoryRouter initialEntries={[entry]}>{ui}<SubmitStatus /></MemoryRouter>)

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
// Which categories the server says carry catalogue models. Mutable so a test can serve a
// list the panel does not hold a copy of, which is the only way to tell "reads the server"
// apart from "happens to agree with it".
let withGalleryModels = ['wagon', 'modular']

beforeEach(() => {
  calls = []
  detail = DETAIL
  boardRows = BOARD
  withGalleryModels = ['wagon', 'modular']
  _resetSubmissions()
  // Zero backoff. A save that fell back to the retries would otherwise still be firing
  // requests into the NEXT test's call log a second after this one ended.
  _setRetryDelays([0, 0, 0, 0])
  // jsdom has no layout engine, so scrollIntoView is undefined on every element.
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales', email: 'sales@x.eu' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/pipeline/1/draft')) return json({ ok: true, text: 'Здравейте Иван, ...' })
    if (u.includes('/api/admin/pipeline/1/reply')) return json({ ok: true, activityId: 99 })
    if (u.includes('/api/admin/pipeline/1/attachments')) return json({ ok: true, activityId: 98 })
    if (u.includes('/api/admin/pipeline/due/report')) return json({ ok: true, count: 2, recipients: ['me@x.eu'] })
    if (u.includes('/api/admin/pipeline/1/convert')) return json({ ok: true, customerId: 42, created: true })
    // The leads sheet reads the purchases screen's category list rather than keeping a
    // second copy: it is the same question about the same catalogue.
    if (u.includes('/api/admin/customers/categories')) {
      return json({
        all: ['prefab', 'wagon', 'modular', 'garage', 'container', 'interiors', 'logistics', 'materials', 'other'],
        withGalleryModels,
        stagedPayment: ['prefab', 'modular', 'garage'],
      })
    }
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

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); _resetSubmissions(); _setRetryDelays() })

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

  // The composer is a contenteditable rich-text editor, and jsdom cannot type into one —
  // so tests write the HTML and fire the input event the editor listens for, which is the
  // same path a real keystroke takes from that point on.
  const replyBox = () => screen.getByRole('textbox', { name: /Отговор|Reply/ })
  const typeReply = (html) => {
    const box = replyBox()
    box.innerHTML = html
    fireEvent.input(box)
  }

  it('sends the reply as rich HTML and returns the box to the bare signature', async () => {
    // Reset only after the server confirms: resetting optimistically would lose what
    // someone typed if the send failed, and retyping a reply is the least forgivable
    // data loss in a tool like this.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    typeReply('<p>Ще пратя <strong>офертата</strong> днес.</p>')
    await user.click(screen.getByRole('button', { name: /Изпрати|Send/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/reply') && c.method === 'POST')
      expect(sent).toBeTruthy()
      // Multipart even with nothing attached, so the path that carries files is the
      // same one every reply exercises. The body is the markup, not flattened text.
      expect(sent.body.get('body')).toContain('<strong>офертата</strong>')
    })
    // Back to the signature, ready for the next message.
    await waitFor(() => expect(replyBox().textContent).toContain('Поздрави'))
    expect(replyBox().textContent).not.toContain('Ще пратя')
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

    typeReply('<p>Ето офертата.</p>')
    await user.click(screen.getByRole('button', { name: /Изпрати|Send/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/reply') && c.method === 'POST')
      expect(sent.body.getAll('files')).toHaveLength(1)
      expect(sent.body.getAll('files')[0].name).toBe('oferta.pdf')
    })
  })

  it('files dropped on the composer attach exactly like picked ones', async () => {
    // The drop feeds the same picked-files state the button fills, so the chip, the
    // remove button and the send request are all one code path — this only has to prove
    // the file ARRIVES there.
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const composer = document.querySelector('.adm-composer')
    const file = new File(['%PDF-1.4'], 'dropped.pdf', { type: 'application/pdf' })
    fireEvent.drop(composer, { dataTransfer: { files: [file], types: ['Files'] } })

    expect(screen.getByText('dropped.pdf')).toBeInTheDocument()
    // The highlight is gone the moment the drop lands.
    expect(document.querySelector('.adm-drop-veil')).not.toBeInTheDocument()
  })

  it('the drop highlight answers a file drag and ignores a text drag', async () => {
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const composer = document.querySelector('.adm-composer')

    // Dragged text — selected words, a link — must not light the box up: dropping it
    // into the editor is how quoting works, and a veil would swallow that drop.
    fireEvent.dragEnter(composer, { dataTransfer: { files: [], types: ['text/plain'] } })
    expect(document.querySelector('.adm-drop-veil')).not.toBeInTheDocument()

    fireEvent.dragEnter(composer, { dataTransfer: { files: [], types: ['Files'] } })
    expect(document.querySelector('.adm-drop-veil')).toBeInTheDocument()

    // Crossing INTO a child fires enter+leave pairs; the veil must survive the churn...
    fireEvent.dragEnter(composer.querySelector('.adm-composer-actions'), { dataTransfer: { types: ['Files'] } })
    fireEvent.dragLeave(composer.querySelector('.adm-composer-actions'), { dataTransfer: { types: ['Files'] } })
    expect(document.querySelector('.adm-drop-veil')).toBeInTheDocument()

    // ...and leaving the composer itself takes it down.
    fireEvent.dragLeave(composer, { dataTransfer: { types: ['Files'] } })
    expect(document.querySelector('.adm-drop-veil')).not.toBeInTheDocument()
  })

  it('a drop that misses the composer does not navigate the page away', async () => {
    // The browser's default for a dropped file is to OPEN it — replacing the panel and
    // taking a half-typed reply with it. The page swallows stray drops while mounted.
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const stray = new Event('drop', { bubbles: true, cancelable: true })
    stray.dataTransfer = { files: [new File(['x'], 'x.pdf')], types: ['Files'] }
    window.dispatchEvent(stray)

    expect(stray.defaultPrevented).toBe(true)
    // And nothing attached — the miss is inert, not a secret second drop zone.
    expect(screen.queryByText('x.pdf')).not.toBeInTheDocument()
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

  it('will not send an empty reply — and the signature alone counts as empty', async () => {
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    // Wait for the signature to arrive, so this is the interesting case (a box with
    // content that is still "nothing to say") rather than the trivial empty one.
    await waitFor(() => expect(replyBox().textContent).toContain('Sales'))
    expect(screen.getByRole('button', { name: /Изпрати|Send/ })).toBeDisabled()
  })

  it('starts the composer as the signed-in user’s signature, in the customer’s language', async () => {
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await waitFor(() => expect(replyBox().textContent).toContain('Sales'))
    // The lead's locale is bg — the signature goes to the customer, so it greets in
    // their language, not the panel's.
    expect(replyBox().textContent).toContain('Поздрави')
    expect(replyBox().textContent).toContain('024 371 650')
    expect(replyBox().textContent).toContain('sales@x.eu')
  })

  it('puts a draft in the box for editing instead of sending it', async () => {
    // The whole safety model: a draft is a suggestion until a person presses Send.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Чернова|Draft/ }))

    await waitFor(() => {
      expect(replyBox().textContent).toContain('Здравейте Иван, ...')
    })
    // The signature is re-appended under the draft — the draft arrives as bare prose.
    expect(replyBox().textContent).toContain('024 371 650')
    expect(calls.some((c) => c.url.includes('/reply'))).toBe(false)
  })

  it('passes what is already typed to the drafter as a steer, as prose', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    typeReply('<p>push for a <strong>site visit</strong></p>')
    await user.click(screen.getByRole('button', { name: /Чернова|Draft/ }))

    await waitFor(() => {
      const drafted = calls.find((c) => c.url.includes('/draft'))
      // Flattened: the model reads text, and the signature is not an instruction.
      expect(JSON.parse(drafted.body).instruction).toBe('push for a site visit')
    })
  })

  it('renders our messages as formatting and the customer’s as literal text', async () => {
    // Ours come from the rich composer, sanitized; a customer's body is untrusted and
    // must never be interpreted — markup they send renders as the characters they typed.
    detail = {
      ...DETAIL,
      activities: [
        { id: 21, type: 'email_in', subject: '', body: '<b>look at this</b>', actorUpn: '', fromCustomer: true, occurredAt: '2026-07-01T09:00:00Z', attachments: [] },
        { id: 22, type: 'email_out', subject: '', body: '<p>Оферта: <strong>26 500 €</strong></p>', actorUpn: 's@x.eu', fromCustomer: false, occurredAt: '2026-07-02T09:00:00Z', attachments: [] },
      ],
    }
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    // The customer's tags are visible as text, exactly as typed.
    expect(screen.getByText('<b>look at this</b>')).toBeInTheDocument()

    // Ours became real markup: the strong element exists, the tag text does not appear.
    const strong = screen.getByText('26 500 €')
    expect(strong.tagName).toBe('STRONG')
    expect(screen.queryByText(/<strong>/)).not.toBeInTheDocument()
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

  it('makes a customer out of the lead with one press', async () => {
    // Identity only — the server copies name/phone/email/address and links LeadId; the
    // purchase is added on the customer card this navigates to.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Направи клиент|Make customer/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/1/convert') && c.method === 'POST')
      expect(sent).toBeTruthy()
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

  it('does not list the same person twice over a difference in capitals', async () => {
    // The server merges ADMIN_ALLOWED_USERS with the owners already on leads and dedupes
    // them case-insensitively, so the list comes back with one spelling. Comparing exactly
    // on this side would decide the stored owner was missing and prepend it — putting the
    // same person in the dropdown twice, which is what the merge existed to prevent.
    detail = { ...DETAIL, ownerUpn: 'Maria@X.eu' }
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const values = [...ownerBox().querySelectorAll('option')].map((o) => o.value)
    const maria = values.filter((v) => v.toLowerCase() === 'maria@x.eu')
    expect(maria).toHaveLength(1)
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
      // owner rides along even when it is null, because the server reads absent and null
      // the same way — everyone — and sending the key unconditionally keeps the request
      // saying which view it came from.
      expect(JSON.parse(sent.body)).toEqual({ to: 'boss@nvc-home4you.eu', owner: null })
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

  // Answers /fields with one status and body, leaving every other call alone.
  const refuseFields = (status, body) => {
    const passthrough = global.fetch
    vi.stubGlobal('fetch', (url, options = {}) => {
      if (!String(url).includes('/fields')) return passthrough(url, options)
      calls.push({ url, method: options.method || 'GET', body: options.body })
      return Promise.resolve({
        ok: false,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(''),
      })
    })
  }

  it('a REFUSED save keeps the sheet open and says why, inside the sheet', async () => {
    // Closing over a refusal would throw away the very edits that did not land — and the
    // page's own error banner renders BEHIND the modal, where nobody would see it.
    //
    // A 4xx specifically. The sheet used to keep itself open for any failure at all, which
    // meant a server having a bad minute also left somebody staring at a dialog with nothing
    // to fix in it; that case now closes and retries itself, one test below.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    refuseFields(400, { errors: ['The database said no.'] })

    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The database said no.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Asked once and left alone. The retries are for requests that might yet be accepted.
    expect(calls.filter((c) => c.url.includes('/fields'))).toHaveLength(1)
  })

  it('the new-lead dialog opens without somebody else’s failure already on it', async () => {
    // `error` is the page's, and this dialog now renders it. Opening without clearing one
    // puts a failed reply's sentence above an empty form, where it reads as though creating
    // a lead had gone wrong before anything was typed. Every other editor in the panel
    // clears it as it opens; this was the one that did not.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const passthrough = global.fetch
    vi.stubGlobal('fetch', (url, options = {}) => (String(url).includes('/reply')
      ? Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ errors: ['Mail server is down.'] }),
          text: () => Promise.resolve(''),
        })
      : passthrough(url, options)))

    typeReply('<p>Ще се видим в петък.</p>')
    await user.click(screen.getByRole('button', { name: /^Изпрати$|^Send$/ }))
    await waitFor(() => expect(screen.getByText('Mail server is down.')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Нов лийд|New lead/ }))
    const dialog = await waitFor(() => screen.getByRole('dialog'))

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('Mail server is down.')).not.toBeInTheDocument()
  })

  it('a refused new lead keeps the dialog and everything typed into it', async () => {
    // The create dialog has the most to lose of any editor in the panel: nothing it holds
    // exists anywhere yet, so a refusal that closed it would not be a save gone wrong, it
    // would be the record never having been written down at all.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Нов лийд|New lead/ }))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    const name = within(dialog).getByLabelText(/^Име \*$|^Name \*$/)
    const phone = within(dialog).getByLabelText(/^Телефон$|^Phone$/)
    await user.type(name, 'Георги Иванов')
    await user.type(phone, 'not a phone number')

    const passthrough = global.fetch
    vi.stubGlobal('fetch', (url, options = {}) => {
      const creating = String(url).endsWith('/api/admin/pipeline') && options.method === 'POST'
      if (!creating) return passthrough(url, options)
      calls.push({ url, method: 'POST', body: options.body })
      return Promise.resolve({
        ok: false, status: 400,
        json: () => Promise.resolve({ errors: ['That phone number is not one.'] }),
        text: () => Promise.resolve(''),
      })
    })

    await user.click(within(dialog).getByRole('button', { name: /^Създай$|^Create$/ }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That phone number is not one.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Име \*$|^Name \*$/)).toHaveValue('Георги Иванов')
    expect(within(dialog).getByLabelText(/^Телефон$|^Phone$/)).toHaveValue('not a phone number')
    expect(calls.filter((c) => c.method === 'POST' && String(c.url).endsWith('/api/admin/pipeline'))).toHaveLength(1)
  })

  it('a save the SERVER fumbled closes the sheet and finishes in the banner', async () => {
    // The other half of the same rule. Nothing here is the typist's fault and nothing they
    // can fix by looking at the form, so the sheet gets out of the way and the request
    // carries on without them — the same machinery, banner and backoff, that the public
    // offer form has used since visitors started pressing Send five times.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    await user.type(nameBox(dialog), 'ff')
    refuseFields(503, { errors: ['Try later.'] })

    await user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Named, because by the time this is read the sheet is long gone.
    expect(await screen.findByText(/Ivan Petrovff/)).toBeInTheDocument()
    expect(screen.getByText(/Запазването не успя|did not go through/)).toBeInTheDocument()
    // The sheet's own attempt, then the full public budget behind it.
    expect(calls.filter((c) => c.url.includes('/fields'))).toHaveLength(1 + MAX_ATTEMPTS)
    expect(screen.getByRole('button', { name: /Опитай пак|Try again/ })).toBeInTheDocument()
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

  // --- Finding one customer by name -----------------------------------------------------
  //
  // Cyrillic on purpose. The folding is what decides whether typing "иван" finds "Иван", and
  // toLowerCase and toLocaleLowerCase do not agree on every letter — a filter that misses the
  // name you can see on screen is one nobody uses a second time.

  const CYRILLIC_BOARD = [
    { ...BOARD[0], id: 1, name: 'Иван Петров' },
    { ...BOARD[1], id: 2, name: 'Иванка Петрова' },
    { ...BOARD[1], id: 3, name: 'Мария Димитрова' },
  ]

  const findByName = () => screen.getByRole('searchbox', { name: /Име на клиента|Customer name/ })

  it('finds every customer whose name contains what was typed', async () => {
    boardRows = CYRILLIC_BOARD
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Мария Димитрова')).toBeInTheDocument())

    const before = calls.length
    await user.type(findByName(), 'иван')

    // Lower case against capitals, and a prefix rather than a whole name.
    expect(within(list()).getByText('Иван Петров')).toBeInTheDocument()
    expect(within(list()).getByText('Иванка Петрова')).toBeInTheDocument()
    expect(within(list()).queryByText('Мария Димитрова')).not.toBeInTheDocument()
    // Narrowed in the browser, like the status and activity filters beside it.
    expect(calls.length).toBe(before)
  })

  it('exact match takes the name that is only a prefix of another', async () => {
    // The case contains is bad at, and the reason the mode exists at all.
    boardRows = CYRILLIC_BOARD
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Мария Димитрова')).toBeInTheDocument())

    await user.type(findByName(), 'иван петров')
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Съвпадение|^Match$/ }), 'equals')

    expect(within(list()).getByText('Иван Петров')).toBeInTheDocument()
    expect(within(list()).queryByText('Иванка Петрова')).not.toBeInTheDocument()
  })

  it('the mode picker only appears once there is something to match', async () => {
    boardRows = CYRILLIC_BOARD
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Мария Димитрова')).toBeInTheDocument())

    expect(screen.queryByRole('combobox', { name: /Съвпадение|^Match$/ })).not.toBeInTheDocument()
    await user.type(findByName(), 'и')
    expect(screen.getByRole('combobox', { name: /Съвпадение|^Match$/ })).toBeInTheDocument()
  })

  it('narrows the archive the same way it narrows the working board', async () => {
    // The whole point of filtering in the browser: five tabs, one filter, and no endpoint
    // had to learn a name parameter for it to work on all of them.
    boardRows = CYRILLIC_BOARD
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Мария Димитрова')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^Архив$|^Archived$/ }))
    await waitFor(() => expect(within(list()).getByText('Мария Димитрова')).toBeInTheDocument())

    await user.type(findByName(), 'иванка')

    expect(within(list()).getByText('Иванка Петрова')).toBeInTheDocument()
    expect(within(list()).queryByText('Мария Димитрова')).not.toBeInTheDocument()
  })

  it('clearing the filters clears the name with them', async () => {
    // "Every narrowing this page offers, undone together" — a button that leaves one filter
    // running is worse than no button, because the list stays wrong and looks reset.
    boardRows = CYRILLIC_BOARD
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Мария Димитрова')).toBeInTheDocument())

    await user.type(findByName(), 'няма такъв')
    expect(within(list()).getByText(/Няма лийдове, отговарящи|No leads match/)).toBeInTheDocument()

    await user.click(within(list()).getByRole('button', { name: /Изчисти филтрите|Clear filters/ }))

    expect(within(list()).getByText('Мария Димитрова')).toBeInTheDocument()
    expect(findByName()).toHaveValue('')
  })

  // --- The merged "what they want" box ------------------------------------------------
  //
  // This used to be two controls asking the same question — a dropdown of catalogue models
  // and a free-text box — and sales filled in whichever they reached first. It is now one
  // box that suggests the models and accepts anything. What these tests hold down is that
  // merging the CONTROLS did not merge the COLUMNS: HouseId is still a foreign key when the
  // answer is a catalogue model, and still empty when it is not.

  // By its label rather than its role, because the role is now the thing under test: the
  // same field is a combobox where the catalogue has models to offer and a plain text box
  // where it has none.
  const modelBox = (dialog) =>
    within(dialog).getByLabelText(/Какво търси|What they want/)

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

  // --- The customer's own details -----------------------------------------------------
  //
  // A name misheard over the phone or an email with a typo in it used to be wrong for good.
  // The enquiry behind a lead is an immutable event and has to keep saying what the form
  // said, so the lead row is the only place a correction can go — and this sheet is the
  // only screen that edits it.

  const nameBox = (dialog) => within(dialog).getByLabelText(/^Име \*$|^Name \*$/)
  const emailBox = (dialog) => within(dialog).getByLabelText(/^Имейл$|^Email$/)
  const phoneBox = (dialog) => within(dialog).getByLabelText(/^Телефон$|^Phone$/)
  const saveSheet = (dialog, user) =>
    user.click(within(dialog).getByRole('button', { name: /Запази|^Save$/ }))

  it('corrects the name, the email and the phone through the save that was already there', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    await user.clear(nameBox(dialog))
    await user.type(nameBox(dialog), 'Ivan Petroff')
    await user.clear(emailBox(dialog))
    await user.type(emailBox(dialog), 'ivan@nvc-home4you.eu')
    await user.type(phoneBox(dialog), '0888 123 456')

    await saveSheet(dialog, user)

    await waitFor(() => {
      const writes = calls.filter((c) => c.method === 'POST')
      // ONE writer. Three more boxes on a sheet that already saves in a single request is
      // not a reason for a second endpoint, and two ways to write a lead is how the two
      // start disagreeing about what it says.
      expect(writes).toHaveLength(1)
      expect(writes[0].url).toContain('/fields')

      const saved = JSON.parse(writes[0].body)
      expect(saved.name).toBe('Ivan Petroff')
      expect(saved.email).toBe('ivan@nvc-home4you.eu')
      expect(saved.phone).toBe('0888 123 456')
      // Riding with the rest of the sheet, the boxes nobody touched included.
      expect(saved.nextStep).toBe('Send revised quote')
    })
  })

  it('a blanked name comes back refused rather than looking saved', async () => {
    // The rule is the server's, and the panel deliberately does not pre-empt it: two
    // definitions of "required" is one that goes quietly out of date. What the panel owes
    // is the refusal, in the sheet, with the edits still on screen.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    const passthrough = global.fetch
    vi.stubGlobal('fetch', (url, options = {}) => {
      if (!String(url).includes('/fields')) return passthrough(url, options)
      calls.push({ url, method: options.method || 'GET', body: options.body })
      return Promise.resolve({
        ok: false, status: 400,
        json: () => Promise.resolve({ errors: ['A lead has to keep a name.'] }),
        text: () => Promise.resolve(''),
      })
    })

    await user.clear(nameBox(dialog))
    await saveSheet(dialog, user)

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/fields') && c.method === 'POST')
      // Sent blank rather than swallowed here, so the server is the one saying no.
      expect(JSON.parse(sent.body).name).toBe('')
    })
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A lead has to keep a name.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(nameBox(dialog)).toHaveValue('')

    // And the footer does not answer the same question the other way at the same time. The
    // chip means "this save just succeeded"; a refused save keeps the sheet open, so a
    // stale one sits in green beside the red alert, and it is the half people scan for.
    expect(within(dialog).queryByText(/^Запазено$|^Saved$/)).not.toBeInTheDocument()
  })

  it('the Saved chip belongs to the save that earned it, not to the next opening', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    await user.type(nameBox(dialog), 'ff')
    await saveSheet(dialog, user)

    // A successful save closes the sheet, so the chip is never on screen for the save that
    // set it — which makes every LATER opening the only place it was ever visible.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const reopened = await openSheet(user)
    expect(within(reopened).queryByText(/^Запазено$|^Saved$/)).not.toBeInTheDocument()
  })

  // --- A picker or a plain box, decided by the category --------------------------------

  const categoryBox = (dialog) =>
    within(dialog).getByRole('combobox', { name: /Категория|^Category$/ })
  const suggestions = (dialog) =>
    [...dialog.querySelectorAll('#leadModelOptions option')].map((o) => o.value)

  it('offers the catalogue for the categories that have one', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    // The lead arrives as modular: a picker, holding the models filed under it.
    expect(modelBox(dialog)).toHaveAttribute('list', 'leadModelOptions')
    expect(suggestions(dialog)).toEqual(['Nova 60', 'Nova 40'])

    await user.selectOptions(categoryBox(dialog), 'wagon')

    expect(modelBox(dialog)).toHaveAttribute('list', 'leadModelOptions')
    expect(suggestions(dialog)).toEqual(['Site cabin'])
  })

  it('asks for a description where the catalogue has nothing to offer', async () => {
    // An input with a list attribute IS a combobox to a browser and to a screen reader, so
    // this is the difference a person sees: an arrow that opens onto the catalogue, or a
    // box to write in.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    for (const key of ['garage', 'prefab']) {
      await user.selectOptions(categoryBox(dialog), key)

      expect(modelBox(dialog)).not.toHaveAttribute('list')
      expect(dialog.querySelector('#leadModelOptions')).toBeNull()
      expect(within(dialog).queryByRole('combobox', { name: /Какво търси|What they want/ }))
        .not.toBeInTheDocument()
    }
  })

  it('switching category keeps what was typed and drops only the link', async () => {
    // The deliberate half of this: the words always survive, the foreign key does not.
    // Emptying the box would throw away a sentence somebody typed to fix a dropdown they
    // got wrong, and keeping the old id would leave a garage lead pointing at a modular
    // house that no screen would ever show them again.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    expect(modelBox(dialog)).toHaveValue('Nova 60')

    await user.selectOptions(categoryBox(dialog), 'garage')

    expect(modelBox(dialog)).toHaveValue('Nova 60')
    // And the one thing that did change is the one thing said out loud.
    expect(within(dialog).getByText(/каталогът няма модели|the catalogue has no models/))
      .toBeInTheDocument()

    await saveSheet(dialog, user)

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.url.includes('/fields')).body)
      expect(saved.categoryKey).toBe('garage')
      expect(saved.customModel).toBe('Nova 60')
      // 0, not null: the server reads 0 as "clear it" and null as "leave it alone".
      expect(saved.houseId).toBe(0)
    })
  })

  it('says nothing under the box until there is something to say', async () => {
    // The caption answers "which of the two things just happened", so an untouched box has
    // no answer to give. Testing the catalogue first put a permanent line under every lead
    // with no category yet — the ordinary state of a phone lead, a trade-fair lead and a
    // good share of the imported ones — blaming the catalogue for holding nothing before
    // anybody had asked it for anything, and never giving the instruction that would have
    // helped: choose a category.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    const noCatalogue = /каталогът няма модели|the catalogue has no models/

    await user.selectOptions(categoryBox(dialog), '')
    await user.clear(modelBox(dialog))
    expect(within(dialog).queryByText(noCatalogue)).not.toBeInTheDocument()

    // Typing under no category is free text — true, and not a complaint about the
    // catalogue, which has not been asked anything.
    await user.type(modelBox(dialog), 'Something off a photo')
    expect(within(dialog).getByText(/свободен текст — без връзка|free text — not linked/))
      .toBeInTheDocument()
    expect(within(dialog).queryByText(noCatalogue)).not.toBeInTheDocument()

    // An empty box stays silent on a real category with no models, too.
    await user.selectOptions(categoryBox(dialog), 'garage')
    await user.clear(modelBox(dialog))
    expect(within(dialog).queryByText(noCatalogue)).not.toBeInTheDocument()

    // And the line appears once there is a description it is actually about.
    await user.type(modelBox(dialog), 'Two bays, 6m')
    expect(within(dialog).getByText(noCatalogue)).toBeInTheDocument()
  })

  it('reads which categories have models from the server, not from a list in here', async () => {
    // The catalogue decides this, and it changes without the SPA being rebuilt. Serving a
    // list the panel holds no copy of is the only way to tell reading the server apart from
    // happening to agree with it.
    withGalleryModels = ['prefab']
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)

    // Modular is off the served list, whatever this page used to believe about it.
    await waitFor(() => expect(modelBox(dialog)).not.toHaveAttribute('list'))

    // And prefab is on it, so it gets the picker even though the gallery mock carries no
    // prefab models: the control follows the CATEGORY, not whether models happened to load.
    // An empty picker on a category that should have one is a visible fault; the same
    // category silently demoted to a text box is a lead typed in by hand for ever.
    await user.selectOptions(categoryBox(dialog), 'prefab')
    expect(modelBox(dialog)).toHaveAttribute('list', 'leadModelOptions')
    expect(suggestions(dialog)).toEqual([])
  })

  // --- The due tab's owner filter ------------------------------------------------------

  const toolbar = () => document.querySelector('.adm-pipeline-toolbar')
  // Scoped to the toolbar on purpose: the assignment dropdown in the lead header answers a
  // different question under the same word.
  const dueOwnerBox = () =>
    within(toolbar()).getByRole('combobox', { name: /Отговорник|Owner/ })
  const queryDueOwnerBox = () =>
    within(toolbar()).queryByRole('combobox', { name: /Отговорник|Owner/ })

  const boardCalls = () =>
    calls.filter((c) => c.method === 'GET' && c.url.includes('/api/admin/pipeline?'))

  it('narrows the due list to one owner, at the server', async () => {
    // Asked of the server rather than of the rows already in hand: the due query takes the
    // thousand most overdue leads and stops, so narrowing here would search one owner's
    // promises among whatever survived that cap.
    const user = userEvent.setup()
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.selectOptions(dueOwnerBox(), 'maria@x.eu')

    await waitFor(() => expect(calls.some((c) =>
      c.url.includes('due=true') && c.url.includes('owner=maria%40x.eu'))).toBe(true))
  })

  it('starts on everyone, so the morning view needs no picking', async () => {
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(calls.some((c) => c.url.includes('due=true'))).toBe(true))

    expect(dueOwnerBox()).toHaveValue('')
    expect(boardCalls().every((c) => !c.url.includes('owner='))).toBe(true)
  })

  it('offers the people the assignment dropdown does, from the one request', async () => {
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(calls.some((c) => c.url.includes('due=true'))).toBe(true))

    await waitFor(() =>
      expect([...dueOwnerBox().querySelectorAll('option')].map((o) => o.value))
        .toEqual(['', 'maria@x.eu', 'vladi@x.eu']))
    // A second idea of who can own a lead would be a second list to keep in step.
    expect(calls.filter((c) => c.url.includes('/api/admin/pipeline/users'))).toHaveLength(1)
  })

  it('the filter belongs to the due tab and appears on no other', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    // The other views answer the ownership question their own way — "Mine" is a tab.
    expect(queryDueOwnerBox()).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /За връзка|^Due$/ }))
    await waitFor(() => expect(queryDueOwnerBox()).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /Активни|^Active$/ }))
    await waitFor(() => expect(queryDueOwnerBox()).not.toBeInTheDocument())
  })

  it('the filter is still on the request when the board reloads under it', async () => {
    // The board is re-fetched after every save, reply and note. A filter that is on screen
    // but missing from the request that answers it widens the list back out under someone.
    const user = userEvent.setup()
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.selectOptions(dueOwnerBox(), 'maria@x.eu')
    await waitFor(() => expect(calls.some((c) => c.url.includes('owner=maria%40x.eu'))).toBe(true))

    // A status move is the shortest write that reloads the board behind it.
    fireEvent.change(document.getElementById('dealStatus'), { target: { value: 'won' } })

    await waitFor(() => expect(calls.some((c) => c.url.includes('/1/status'))).toBe(true))
    await waitFor(() => {
      const board = boardCalls()
      expect(board[board.length - 1].url).toContain('owner=maria%40x.eu')
    })
  })

  it('an owner with nothing overdue is not reported as the whole team being clear', async () => {
    // The filter narrows at the SERVER, so a person who is up to date comes back as an
    // EMPTY board rather than as a board filtered down to nothing — which is why the
    // "filters hid everything" branch, which tests board.length, could not catch this.
    // What fell through instead was "Nothing overdue. Everything is on schedule.": a claim
    // about the entire pipeline, made while one person was selected, with the only thing
    // contradicting it a dropdown three controls away.
    const user = userEvent.setup()
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    boardRows = []
    await user.selectOptions(dueOwnerBox(), 'maria@x.eu')

    const empty = await screen.findByText(/maria@x\.eu/, { selector: '.adm-empty p' })
    expect(empty).toBeInTheDocument()
    expect(screen.queryByText(/Всичко е по график|Everything is on schedule/)).not.toBeInTheDocument()
  })

  it('the way back out clears the owner along with the other two', async () => {
    // A clear-filters button that leaves one narrowing on is the same fault in a smaller
    // place: the list stays empty and the button has said it did something.
    const user = userEvent.setup()
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    boardRows = []
    await user.selectOptions(dueOwnerBox(), 'maria@x.eu')
    await screen.findByRole('button', { name: /Изчисти филтрите|Clear filters/ })

    boardRows = BOARD
    await user.click(screen.getByRole('button', { name: /Изчисти филтрите|Clear filters/ }))

    await waitFor(() => expect(dueOwnerBox()).toHaveValue(''))
    await waitFor(() => {
      const board = boardCalls()
      expect(board[board.length - 1].url).not.toContain('owner=')
    })
  })

  it('Retry actually reloads the board and reports what happened', async () => {
    // Retry used to be handed the bare loader, which reports nothing. AdminShell renders the
    // page only while the state is 'ready', so a retry that SUCCEEDED left the error screen
    // exactly where it was, and one that met an expired session became an unhandled
    // rejection instead of the sign-in prompt — the button could be pressed all afternoon.
    let boardFails = true
    const user = userEvent.setup()

    const passthrough = global.fetch
    vi.stubGlobal('fetch', (url, options = {}) => {
      const u = String(url)
      if (boardFails && u.includes('/api/admin/pipeline?')) {
        calls.push({ url, method: options.method || 'GET', body: options.body })
        return Promise.resolve({
          ok: false, status: 500,
          json: () => Promise.resolve({}), text: () => Promise.resolve(''),
        })
      }
      return passthrough(url, options)
    })

    render(<AdminPipelinePage />)
    const retry = await screen.findByRole('button', { name: /Опитай отново|Try again/ })

    boardFails = false
    await user.click(retry)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Опитай отново|Try again/ })).not.toBeInTheDocument()
  })

  // --- "They are waiting on us" --------------------------------------------------------

  const awaitingBadge = () => within(list()).queryByText(/Чака отговор|Awaiting reply/)

  it('flags the leads whose last word was the customer’s', async () => {
    boardRows = [{ ...BOARD[0], awaitingReply: true }]
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Ivan Petrov')).toBeInTheDocument())

    // Its own words, not a tint: "we are late" and "they are waiting" are different kinds
    // of urgent and a lead is regularly both, so neither may come down to a colour.
    expect(awaitingBadge()).toBeInTheDocument()
  })

  it('says nothing on a lead where the last word was ours', async () => {
    boardRows = [{ ...BOARD[0], awaitingReply: false }]
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Ivan Petrov')).toBeInTheDocument())

    expect(awaitingBadge()).not.toBeInTheDocument()
  })

  it('reads as a different thing from the stage beside it and from an overdue date', async () => {
    // The whole point of the flag is that it can appear ON a lead that is already late.
    // Sharing the stage badge's class, or the due label's, would make the row say one thing
    // twice and the other not at all.
    boardRows = [{ ...BOARD[0], awaitingReply: true, nextContactAt: '2020-01-01T00:00:00Z' }]
    render(<AdminPipelinePage />)
    await waitFor(() => expect(within(list()).getByText('Ivan Petrov')).toBeInTheDocument())

    const badge = awaitingBadge()
    expect(badge).toHaveClass('adm-badge', 'adm-badge-awaiting')
    expect(badge.className).not.toMatch(/adm-stage-|adm-due/)
    // And the late date is still there, saying its own separate thing.
    expect(within(list()).getByText(/закъснение|late/)).toBeInTheDocument()
  })

  // --- Logging a call or a meeting -----------------------------------------------------

  const logKindBox = () => screen.getByRole('combobox', { name: /Запиши като|Log as/ })
  const logButton = (name) => screen.getByRole('button', { name })

  it('logs a call as a call rather than as a note', async () => {
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    typeReply('<p>Обади се — иска да види мостра в събота.</p>')
    await user.selectOptions(logKindBox(), 'call')
    await user.click(logButton(/\+ Обаждане|\+ Call/))

    await waitFor(() => {
      const logged = calls.find((c) => c.url.includes('/activities') && c.method === 'POST')
      expect(JSON.parse(logged.body).type).toBe('call')
    })
    // Never through the reply endpoint: logging a call must not mail the customer.
    expect(calls.some((c) => c.url.includes('/reply'))).toBe(false)
  })

  it('jotting something down still takes no choosing', async () => {
    // The common case. A composer that made people pick a kind before every scribble is one
    // where everything ends up logged as whatever was left selected.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    expect(logKindBox()).toHaveValue('note')

    typeReply('<p>Предпочита обаждания след шест.</p>')
    await user.click(logButton(/\+ Бележка|\+ Note/))

    await waitFor(() => {
      const logged = calls.find((c) => c.url.includes('/activities') && c.method === 'POST')
      expect(JSON.parse(logged.body).type).toBe('note')
    })
  })

  it('offers exactly the three kinds a person may file by hand', async () => {
    // email_out belongs to Send, which actually sends something, and a status row is written
    // by the app as a side effect of a real status change — offering either here would put a
    // claim in the thread that nothing backs up.
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    expect([...logKindBox().querySelectorAll('option')].map((o) => o.value))
      .toEqual(['note', 'call', 'meeting'])
  })

  it('the thread names a meeting, which it used to render as an unlabelled bubble', async () => {
    // The composer could only ever post a note, so this was the entry no screen could make
    // and no screen could describe.
    detail = {
      ...DETAIL,
      activities: [
        { id: 30, type: 'meeting', subject: '', body: 'Видяхме се на място.', actorUpn: 's@x.eu', fromCustomer: false, occurredAt: '2026-07-03T09:00:00Z', attachments: [] },
      ],
    }
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByText('Видяхме се на място.')).toBeInTheDocument())

    const bubble = screen.getByText('Видяхме се на място.').closest('.adm-bubble')
    expect(within(bubble).getByText(/Среща|Meeting/)).toBeInTheDocument()
  })

  it('a call that comes with a file stays a call, and the file is still filed', async () => {
    // The upload endpoint writes every attachment as a note — that is its rule and a
    // caption and its file belong together. So the kind is written separately rather than
    // being allowed to fall away: pick "Обаждане", attach the drawing that followed, and
    // the thread would otherwise show a note.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(['x'], 'skica.pdf', { type: 'application/pdf' }))

    typeReply('<p>Обади се и прати скицата.</p>')
    await user.selectOptions(logKindBox(), 'call')
    await user.click(logButton(/\+ Обаждане|\+ Call/))

    await waitFor(() => {
      const logged = calls.find((c) => c.url.includes('/activities') && c.method === 'POST')
      expect(JSON.parse(logged.body).type).toBe('call')
      expect(calls.some((c) => c.url.includes('/attachments') && c.method === 'POST')).toBe(true)
    })
  })

  it('will not let a call be filed with a file and nothing said', async () => {
    // The failure the kinds were added to fix, arriving by the other door. `separately` is
    // true, the activity was gated behind a non-empty body, and the upload endpoint files
    // every attachment as a note — so pressing "+ Обаждане" with only a drawing attached
    // logged a note and lost the call, silently, with the button happily enabled.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(['x'], 'skica.pdf', { type: 'application/pdf' }))
    await user.selectOptions(logKindBox(), 'call')

    expect(logButton(/\+ Обаждане|\+ Call/)).toBeDisabled()
    // Said on screen, not in a tooltip: a browser shows no title on a disabled control.
    expect(screen.getByText(/Опишете какво се случи|Write what happened/)).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes('/attachments'))).toBe(false)

    // And it is the words that unlock it, not the kind going back to a note.
    typeReply('<p>Обади се и прати скицата.</p>')
    await waitFor(() => expect(logButton(/\+ Обаждане|\+ Call/)).toBeEnabled())
  })

  it('a note with a file is still one write per file, captioned as it always was', async () => {
    // The unchanged half. Here the words ARE the file's label, so splitting them would print
    // the same sentence twice.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.upload(
      document.querySelector('input[type="file"]'),
      new File(['x'], 'survey.pdf', { type: 'application/pdf' }))

    typeReply('<p>Геодезията.</p>')
    await user.click(logButton(/\+ Бележка|\+ Note/))

    await waitFor(() => expect(calls.some((c) => c.url.includes('/attachments'))).toBe(true))
    expect(calls.some((c) => c.url.includes('/activities') && c.method === 'POST')).toBe(false)
  })

  // --- The follow-up date the server sets by itself ------------------------------------

  it('shows the follow-up date the server just scheduled, without a reload', async () => {
    // Logging what we did schedules the next contact three days out, server-side and
    // silently. A page holding the lead it loaded before that write would go on showing the
    // old date, and the person would decide the rule does not work.
    //
    // The date is far out on purpose: near ones start reading as "late" once real time
    // passes them, and the assertion would begin failing by itself.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    detail = { ...DETAIL, nextContactAt: '2099-06-01T00:00:00.0000000Z' }

    typeReply('<p>Обади се, ще мисли до петък.</p>')
    await user.selectOptions(logKindBox(), 'call')
    await user.click(logButton(/\+ Обаждане|\+ Call/))

    await waitFor(() => expect(screen.getByText(/Jun 2099/)).toBeInTheDocument())
  })

  it('the sheet offers the scheduled date too, so saving cannot undo it', async () => {
    // The sheet takes its copy of the lead once, when the lead is opened — and it is the
    // half with a Save button under it. A stale date here is not merely wrong on screen: it
    // gets written back over the one the server set, cancelling the reminder silently.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    detail = { ...DETAIL, nextContactAt: '2099-06-01T00:00:00.0000000Z' }

    typeReply('<p>Записах срещата.</p>')
    await user.selectOptions(logKindBox(), 'meeting')
    await user.click(logButton(/\+ Среща|\+ Meeting/))
    await waitFor(() => expect(screen.getByText(/Jun 2099/)).toBeInTheDocument())

    const dialog = await openSheet(user)
    expect(dialog.querySelector('input[type="date"]')).toHaveValue('2099-06-01')

    await saveSheet(dialog, user)
    await waitFor(() => {
      const saved = calls.filter((c) => c.url.includes('/fields') && c.method === 'POST')
      expect(JSON.parse(saved[saved.length - 1].body).nextContactAt).toBe('2099-06-01')
    })
  })

  it('a date somebody is typing into the sheet survives a reload that did not move it', async () => {
    // The sync watches the SERVER's value, so a lead re-read that says the same date leaves
    // the sheet alone. Re-taking the whole form from every reload instead would throw away
    // an unsaved date every time anything behind the sheet wrote to the lead.
    const user = userEvent.setup()
    render(<AdminPipelinePage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    const dialog = await openSheet(user)
    const dateBox = dialog.querySelector('input[type="date"]')
    fireEvent.change(dateBox, { target: { value: '2026-09-30' } })

    // A status move is the shortest write that re-reads the lead underneath.
    fireEvent.change(document.getElementById('dealStatus'), { target: { value: 'won' } })
    await waitFor(() => expect(calls.some((c) => c.url.includes('/1/status'))).toBe(true))

    expect(dateBox).toHaveValue('2026-09-30')
  })

  it('the report is of the view it reports on, owner filter included', async () => {
    // The button sits two controls from the filter. Sending the team's list while one
    // salesperson is on screen mails three hundred rows to answer a screen showing twelve,
    // and the confirmation is the first hint — a number that matches nothing in front of
    // the person who pressed it.
    const user = userEvent.setup()
    render(<AdminPipelinePage />, '/admin/pipeline?view=due')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Petrov' })).toBeInTheDocument())

    await user.selectOptions(dueOwnerBox(), 'maria@x.eu')
    await user.click(screen.getByRole('button', { name: /Изпрати справка|Send report/ }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^Изпрати$|^Send$/ }))

    await waitFor(() => {
      const sent = calls.find((c) => c.url.includes('/due/report') && c.method === 'POST')
      expect(JSON.parse(sent.body).owner).toBe('maria@x.eu')
    })
  })
})
