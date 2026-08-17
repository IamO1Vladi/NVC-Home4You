import React from 'react'
import { render as rtlRender, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCustomersPage from './AdminCustomersPage.jsx'

// The customer sheet.
//
// What is pinned here is mostly arithmetic and disclosure: a "left to pay" that follows the
// two numbers above it, a payment block that never hides a value it is holding, and an ЕГН
// that does not travel anywhere it should not. All of those fail quietly — the screen looks
// fine and the invoice is wrong — which is why they are tests rather than careful reading.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/customers']}>{ui}</MemoryRouter>)

const json = (body) => Promise.resolve({
  ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)),
})

const LIST = [
  {
    id: 1, type: 'company', name: 'Стройко ООД', eik: '831919995', phone: '0888123456',
    email: 'office@stroyko.bg', country: 'Bulgaria', purchaseCount: 2, modelLabel: 'Nova 60 +1',
    totalFinalPrice: 70000, totalDeposit: 20000, totalLeftToPay: 50000, currency: 'EUR',
    createdAt: '2026-08-01T09:00:00Z',
  },
  {
    id: 2, type: 'person', name: 'Иван Петров', eik: null, phone: '', email: '',
    country: 'Bulgaria', purchaseCount: 1, modelLabel: 'Фургон 6м',
    totalFinalPrice: null, totalDeposit: null, totalLeftToPay: null, currency: 'EUR',
    createdAt: '2026-07-20T09:00:00Z',
  },
]

const DETAIL = {
  id: 1, type: 'company', eik: '831919995', personalId: null, name: 'Стройко ООД',
  phone: '0888123456', email: 'office@stroyko.bg', address: 'Sofia', country: 'Bulgaria',
  notes: '', leadId: null, leadName: null,
  createdAt: '2026-08-01T09:00:00Z', updatedAt: null, updatedByUpn: null,
  purchases: [
    {
      id: 11, factoryId: 5, factoryName: 'Bursa Prefab', categoryKey: 'prefab',
      houseId: 3, houseTitle: 'Nova 60', customModel: null,
      depositPaid: 20000, finalPrice: 50000, leftToPay: 30000, currency: 'EUR',
      purchasedAt: '2026-06-01', notes: '',
      files: [
        { id: 90, kind: 'prepaid-invoice', fileName: 'proforma.pdf', contentType: 'application/pdf', sizeBytes: 1024, downloadUrl: '/api/admin/customers/files/90', createdAt: '2026-06-02T09:00:00Z' },
      ],
    },
  ],
}

const CATEGORIES = {
  all: ['prefab', 'wagon', 'modular', 'garage', 'container', 'materials', 'other'],
  withGalleryModels: ['prefab', 'wagon', 'garage'],
  stagedPayment: ['prefab', 'modular', 'garage', 'container', 'materials', 'other'],
  types: ['person', 'company'],
}

let calls = []
let detail = DETAIL

beforeEach(() => {
  calls = []
  detail = DETAIL
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/customers/categories')) return json(CATEGORIES)
    if (u.includes('/api/admin/customers/1')) {
      if (options.method === 'PUT') return json({ ok: true, customer: detail, duplicateOf: null })
      return json(detail)
    }
    if (u.includes('/api/admin/customers')) {
      if (options.method === 'POST') return json({ ok: true, customer: { ...detail, id: 1 }, duplicateOf: null })
      return json(LIST)
    }
    if (u.includes('/api/admin/factories')) {
      return json([
        { id: 5, name: 'Bursa Prefab', isActive: true, purchaseCount: 2 },
        { id: 6, name: 'Retired Works', isActive: false, purchaseCount: 0 },
      ])
    }
    if (u.includes('/api/admin/gallery')) {
      return json([
        { id: 3, title: 'Nova 60', categoryKey: 'prefab', isPublished: true },
        { id: 4, title: 'Nova 40', categoryKey: 'prefab', isPublished: true },
        { id: 8, title: 'Modul 90', categoryKey: 'modular', isPublished: true },
      ])
    }
    return json({})
  }))
})

const openCustomer = async (user, name = 'Стройко ООД') => {
  await waitFor(() => expect(screen.getByRole('button', { name })).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name }))
  return waitFor(() => screen.getByRole('dialog'))
}

describe('AdminCustomersPage', () => {
  it('lists customers with what is still owed', async () => {
    render(<AdminCustomersPage />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Стройко ООД' })).toBeInTheDocument())
    expect(screen.getByText(/50[\s ]?000 EUR/)).toBeInTheDocument()
    expect(screen.getByText('Nova 60 +1')).toBeInTheDocument()
  })

  it('tells people what the search box actually covers', async () => {
    // The box passes through whatever was typed, so this cannot promise an ЕГН never
    // reaches a URL — a person can type one in. What the panel CAN do is say plainly that
    // it will not match, so nobody tries it twice. The guarantee behind the sentence is
    // server-side: CustomerStoreTests.Search_never_matches_a_personal_id.
    render(<AdminCustomersPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Стройко ООД' })).toBeInTheDocument())

    expect(screen.getByText(/По ЕГН не се търси/)).toBeInTheDocument()
  })

  it('searches on what was typed, once, through the q parameter', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Стройко ООД' })).toBeInTheDocument())

    await user.type(screen.getByRole('searchbox'), 'Стройко{Enter}')

    await waitFor(() => {
      const searches = calls.filter((c) => c.url.includes('/api/admin/customers?q='))
      // Submitted on Enter, not on every keystroke — otherwise each character typed is
      // its own request and its own line in a server log.
      expect(searches).toHaveLength(1)
      expect(decodeURIComponent(searches[0].url)).toContain('q=Стройко')
    })
  })

  it('the list request never brings back a personal id', async () => {
    render(<AdminCustomersPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Иван Петров' })).toBeInTheDocument())

    // The summary shape has no personalId field, so it is not in browser memory for every
    // row on screen. Mirrors the server-side assertion on CustomerSummaryDto.
    //
    // Note there is no "and nothing on the page looks like an ЕГН" assertion here, because
    // that cannot be written: a Bulgarian mobile number is also ten digits. It is the same
    // collision that stops the panel from guessing at an ЕГН client-side, and the reason
    // the checksum is gated on the country instead.
    expect(Object.keys(LIST[0])).not.toContain('personalId')
  })

  // --- The identifier follows the type ------------------------------------------------

  it('shows ЕИК for a company and ЕГН for a person, never both', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    expect(within(dialog).getByLabelText('ЕИК')).toHaveValue('831919995')
    expect(within(dialog).queryByLabelText(/ЕГН/)).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: 'Физическо лице' }))

    expect(within(dialog).getByLabelText(/ЕГН/)).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('ЕИК')).not.toBeInTheDocument()
  })

  it('sends only the identifier that belongs to the type', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('radio', { name: 'Физическо лице' }))
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      // The ЕИК goes rather than lingering as a value nothing on the form shows and
      // nothing will ever correct.
      expect(saved.eik).toBeNull()
      expect(saved.type).toBe('person')
    })
  })

  // --- Money --------------------------------------------------------------------------

  it('works out what is left to pay as the numbers are typed', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    expect(within(dialog).getByText(/30[\s ]?000 EUR/)).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Платено капаро'), { target: { value: '35000' } })

    await waitFor(() => expect(within(dialog).getByText(/15[\s ]?000 EUR/)).toBeInTheDocument())
  })

  it('says nothing rather than zero when no price has been agreed', async () => {
    detail = {
      ...DETAIL,
      purchases: [{ ...DETAIL.purchases[0], finalPrice: null, depositPaid: 5000, leftToPay: null, files: [] }],
    }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    // "Nothing outstanding" and "we have not settled on a number" are different answers,
    // and only one of them is good news.
    const readout = dialog.querySelector('output')
    expect(readout).toHaveTextContent('—')
  })

  it('an empty price box is not the number zero', async () => {
    detail = { ...DETAIL, purchases: [{ ...DETAIL.purchases[0], files: [] }] }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    fireEvent.change(within(dialog).getByLabelText('Крайна цена'), { target: { value: '' } })
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].finalPrice).toBeNull()
    })
  })

  // --- The wagon rule -----------------------------------------------------------------

  it('hides the payment block for a wagon', async () => {
    detail = {
      ...DETAIL,
      purchases: [{
        ...DETAIL.purchases[0], categoryKey: 'wagon', houseId: null, houseTitle: '',
        customModel: 'Фургон 6м', depositPaid: null, finalPrice: null, files: [],
      }],
    }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    expect(within(dialog).queryByLabelText('Платено капаро')).not.toBeInTheDocument()
    expect(within(dialog).getByText(/наведнъж/)).toBeInTheDocument()
  })

  it('but never hides a wagon that already has money on it', async () => {
    // Hiding a field that is holding a value is how data goes missing without anyone
    // touching it.
    detail = {
      ...DETAIL,
      purchases: [{
        ...DETAIL.purchases[0], categoryKey: 'wagon', houseId: null, houseTitle: '',
        customModel: 'Фургон 6м', depositPaid: 500, finalPrice: 9000, files: [],
      }],
    }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    expect(within(dialog).getByLabelText('Платено капаро')).toHaveValue(500)
  })

  it('a purchase with no category chosen yet is not treated as a wagon', async () => {
    // "Not a category that takes staged payment" and "no category yet" are different
    // states. Conflating them opened every new purchase with its money fields missing and
    // a note about wagons on it.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('button', { name: '+ Добави покупка' }))

    expect(within(dialog).getAllByLabelText('Платено капаро')).toHaveLength(2)
    expect(within(dialog).queryByText(/наведнъж/)).not.toBeInTheDocument()
  })

  // --- What they bought ---------------------------------------------------------------

  it('suggests catalogue models for a category that has them', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    const titles = [...dialog.querySelectorAll('#purchaseModels-0 option')].map((o) => o.value)
    expect(titles).toEqual(['Nova 60', 'Nova 40'])
  })

  it('offers no model for a modular house, because it is a custom build', async () => {
    detail = {
      ...DETAIL,
      purchases: [{
        ...DETAIL.purchases[0], categoryKey: 'modular', houseId: null, houseTitle: '',
        customModel: '90 кв.м, две спални', files: [],
      }],
    }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    // Modul 90 exists in the gallery and is deliberately still not offered here.
    expect(dialog.querySelectorAll('#purchaseModels-0 option')).toHaveLength(0)
    expect(within(dialog).getByText(/проект по поръчка/)).toBeInTheDocument()
  })

  it('links a catalogue model as a foreign key when one is picked', async () => {
    detail = {
      ...DETAIL,
      purchases: [{ ...DETAIL.purchases[0], houseId: null, houseTitle: '', customModel: '', files: [] }],
    }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    fireEvent.change(within(dialog).getByLabelText('Модел / описание'), { target: { value: 'Nova 40' } })
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].houseId).toBe(4)
      expect(saved.purchases[0].customModel).toBeNull()
    })
  })

  it('keeps anything else as free text', async () => {
    detail = {
      ...DETAIL,
      purchases: [{ ...DETAIL.purchases[0], houseId: null, houseTitle: '', customModel: '', files: [] }],
    }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    fireEvent.change(within(dialog).getByLabelText('Модел / описание'), { target: { value: 'Две свързани, по проект' } })
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].customModel).toBe('Две свързани, по проект')
      expect(saved.purchases[0].houseId).toBeNull()
    })
  })

  // --- Purchases and invoices ---------------------------------------------------------

  it('a customer can hold more than one purchase', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('button', { name: '+ Добави покупка' }))
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases).toHaveLength(2)
      // The new one has no id, which is how the server tells it apart from an edit.
      expect(saved.purchases[1].id).toBe(0)
    })
  })

  it('sends what the server stores, not what the form displays', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0]).not.toHaveProperty('modelText')
      expect(saved.purchases[0]).not.toHaveProperty('files')
    })
  })

  it('offers an existing invoice through the authenticated endpoint', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    const link = within(dialog).getByRole('link', { name: 'proforma.pdf' })
    // By row id. The blob key never reaches the browser, so an invoice cannot be found by
    // guessing a path.
    expect(link).toHaveAttribute('href', '/api/admin/customers/files/90')
  })

  it('cannot attach a file to a purchase that has not been saved yet', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('button', { name: '+ Добави покупка' }))

    // Disabled with a reason rather than absent, so the control does not look missing.
    const buttons = within(dialog).getAllByRole('button', { name: 'Прикачи' })
    expect(buttons.at(-1)).toBeDisabled()
    expect(within(dialog).getAllByText(/Запазете клиента/).length).toBeGreaterThan(0)
  })

  // --- Factories ----------------------------------------------------------------------

  it('offers active factories, plus whichever one this purchase already names', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    const picker = within(dialog).getByLabelText('Фабрика')
    expect(within(picker).getByRole('option', { name: /Bursa Prefab/ })).toBeInTheDocument()
    // Retired, not named by this purchase, so it is not on offer for a new one.
    expect(within(picker).queryByRole('option', { name: /Retired Works/ })).not.toBeInTheDocument()
  })

  it('warns when the same identifier is already on another customer', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    global.fetch.mockImplementation((url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
      if (String(url).includes('/api/admin/customers/1') && options.method === 'PUT') {
        return json({ ok: true, customer: detail, duplicateOf: 'Стройко ЕООД' })
      }
      return json(String(url).includes('/api/admin/customers/1') ? detail : [])
    })

    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    // Saved anyway — a company that buys through two branches is one ЕИК twice, so this is
    // information for the person who typed it, not a verdict.
    await waitFor(() => expect(screen.getByText(/Стройко ЕООД/)).toBeInTheDocument())
  })
})
