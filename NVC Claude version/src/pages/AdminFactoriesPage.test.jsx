import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminFactoriesPage from './AdminFactoriesPage.jsx'
import SubmitStatus from '../components/SubmitStatus.jsx'
import { MAX_ATTEMPTS, _resetSubmissions, _setRetryDelays } from '../lib/backgroundSubmit.js'

// The supplier directory.
//
// The rule worth pinning is that a factory with sales against it cannot be deleted from
// this screen. The database refuses it too, but a Delete button that is always there and
// usually refused teaches people to ignore the refusal — so the button is not there.
//
// The other rule, and the reason this file renders the banner: what a save does depends on
// HOW it failed. This is the screen where the three outcomes are pinned end to end, because
// it is the simplest editor in the panel and the policy is easiest to read here.

// The banner is rendered app-wide from App.jsx, above every route including this one, so a
// page test that wants to read what a save reported has to put it back.
const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/factories']}>{ui}<SubmitStatus /></MemoryRouter>)

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
// What the factories endpoint answers a write with. Mutable so one test can be refused and
// another can hit a server that is down, without either teaching the others its answer.
let writeAnswer = () => json({ ok: true, factory: ROWS[0], duplicateName })

beforeEach(() => {
  calls = []
  duplicateName = false
  writeAnswer = () => json({ ok: true, factory: ROWS[0], duplicateName })
  _resetSubmissions()
  // Zero backoff. A retry loop left running past the end of a test would keep firing saves
  // into the NEXT test's call log, which is a failure that reads as a mystery.
  _setRetryDelays([0, 0, 0, 0])

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/factories')) {
      if (options.method === 'POST' || options.method === 'PUT') return writeAnswer()
      return json(ROWS)
    }
    return json({})
  }))
})

afterEach(() => {
  _resetSubmissions()
  _setRetryDelays()
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
  // --- What a save does with each of the three answers ---------------------------------
  //
  // The panel deliberately does NOT copy the public site here. Out there the modal closes on
  // the click, because every enquiry was going to be accepted eventually and the failure
  // being designed away was a visitor pressing Send five times. A save from the panel can be
  // REFUSED, and closing on a refusal would leave the person who typed it with a red banner,
  // no form and their text gone.

  const openNew = async (user) => {
    await user.click(screen.getByRole('button', { name: 'Нова фабрика' }))
    return waitFor(() => screen.getByRole('dialog'))
  }

  it('a save that lands closes the editor and reports itself in the banner', async () => {
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    const dialog = await openNew(user)
    await user.type(within(dialog).getByLabelText('Име'), 'Нова')
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Named, because the banner outlives the dialog and "Запазено" on its own is a riddle
    // by the time anybody reads it.
    expect(await screen.findByText(/Запазено · Нова/)).toBeInTheDocument()
  })

  it('a refused save keeps the editor, the typing and the reason', async () => {
    writeAnswer = () => json({ errors: ['Име, което вече се използва.'] }, 400)
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    const dialog = await openNew(user)
    await user.type(within(dialog).getByLabelText('Име'), 'Нова')
    await user.type(within(dialog).getByLabelText('Град'), 'Бурса')
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Име, което вече се използва.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Nothing is lost — including the fields nobody was asked about.
    expect(within(dialog).getByLabelText('Име')).toHaveValue('Нова')
    expect(within(dialog).getByLabelText('Град')).toHaveValue('Бурса')
    // And asked exactly once. Re-sending input the server has already refused is the
    // behaviour the retries exist to prevent, not to perform.
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    expect(screen.queryByText(/Запазено/)).not.toBeInTheDocument()
  })

  const openEdit = async (user, name) => {
    const card = screen.getAllByRole('listitem').find((c) => within(c).queryByRole('heading', { name }))
    await user.click(within(card).getByRole('button', { name: 'Редактирай' }))
    return waitFor(() => screen.getByRole('dialog'))
  }

  it('a server having a bad minute closes the editor and finishes the job in the banner', async () => {
    // An EDIT. It is a PUT onto a row that already exists, so the same fields written twice
    // land on the same supplier — which is what makes it safe to hand to a loop that will.
    writeAnswer = () => json({ errors: ['Boom.'] }, 500)
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    const dialog = await openEdit(user, 'Bursa Prefab')
    await user.type(within(dialog).getByLabelText('Град'), 'а')
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    // Nothing here is the typist's fault and nothing they can fix, so the editor gets out of
    // the way and the request carries on without them.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(/Запазването не успя/)).toBeInTheDocument()
    // The dialog's own attempt, then the full public budget behind it.
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1 + MAX_ATTEMPTS)

    // And it stays said. A success thanks and leaves on a timer; a save that was lost has to
    // still be on screen when somebody looks up, or nobody ever learns the row is unchanged.
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(screen.getByText(/Запазването не успя/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Опитай пак' })).toBeInTheDocument()
  })

  it('a CREATE that got no answer is asked once and handed back to the person', async () => {
    // The fourth answer, and the one the retries may not have. A 504 says nothing about
    // whether the row was written, and a second POST writes a second supplier — under a
    // green "Запазено", with nobody ever told there are now two.
    writeAnswer = () => json({ errors: ['Gateway timeout.'] }, 504)
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    const dialog = await openNew(user)
    await user.type(within(dialog).getByLabelText('Име'), 'Нова')
    await user.type(within(dialog).getByLabelText('Град'), 'Бурса')
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Няма отговор от сървъра/)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Град')).toHaveValue('Бурса')
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
    // Nothing in the corner: the dialog is where this can be acted on, and a banner saying
    // the save was lost would be a second, quieter account of the same thing.
    expect(screen.queryByText(/Запазването не успя/)).not.toBeInTheDocument()
  })

  it('cancelling a refused save takes its reason with it', async () => {
    // The alert belongs to an edit that no longer exists. Left behind, it lands on the
    // directory, where it refers to nothing and stays until the next thing clears it.
    writeAnswer = () => json({ errors: ['Име, което вече се използва.'] }, 400)
    const user = userEvent.setup()
    render(<AdminFactoriesPage />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bursa Prefab' })).toBeInTheDocument())

    const dialog = await openNew(user)
    await user.type(within(dialog).getByLabelText('Име'), 'Нова')
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Откажи' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Име, което вече се използва.')).not.toBeInTheDocument()
  })
})
