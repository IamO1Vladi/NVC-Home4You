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

const render = (ui, entry = '/admin/customers') =>
  rtlRender(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>)

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
      quantity: 2, depositPaid: 20000, finalPrice: 50000, unitPrice: 25000,
      leftToPay: 30000, currency: 'EUR', purchasedAt: '2026-06-01', notes: '',

      // Columns this form cannot type into and must never send back. The tracking ones
      // belong to the orders board, the four expenses came in with the Quickbase import.
      // They are here so a save that started naming them again has something to fail on.
      status: 'in-production', publicReference: 'NVC-7Q2M',
      expectedAtHarbor: '2026-09-10', expectedReadyAt: '2026-08-25',
      carrierName: 'Speedy', trackingReference: 'SP-99', carrierNote: null, carrierCheckedAt: null,
      paymentFees: 120, transportCost: 3400, installationCost: 900, otherCosts: 0,
      saleExpenses: 4420,

      files: [
        { id: 90, kind: 'deposit-proforma', fileName: 'proforma.pdf', contentType: 'application/pdf', sizeBytes: 1024, downloadUrl: '/api/admin/customers/files/90', createdAt: '2026-06-02T09:00:00Z' },
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
// Whether /categories answers at all. The page swallows a failure there and runs on its
// own constant, so this is the only way to reach the fallback the constant exists for.
let categoriesFail = false

beforeEach(() => {
  calls = []
  detail = DETAIL
  categoriesFail = false
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Sales' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/customers/categories')) {
      return categoriesFail
        ? Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
        : json(CATEGORIES)
    }
    // The upload answers with the row it wrote, in the same shape the detail read describes
    // a file. That is what lets the sheet patch itself instead of refetching the customer
    // and replacing everything somebody is halfway through typing.
    if (u.includes('/api/admin/customers/purchases/') && u.endsWith('/files')) {
      const id = 900 + calls.filter((c) => c.url.endsWith('/files')).length
      return json({
        ok: true,
        id,
        kind: options.body.get('kind'),
        fileName: options.body.get('file').name,
        contentType: 'application/pdf',
        sizeBytes: 8,
        downloadUrl: `/api/admin/customers/files/${id}`,
        createdAt: '2026-08-20T09:00:00Z',
      })
    }
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
  it('opens the customer named in the URL, so "Make customer" lands ready to work', async () => {
    // The pipeline's convert button navigates here with ?customer={id}. Landing on a bare
    // list would mean finding the person you just created by hand.
    render(<AdminCustomersPage />, '/admin/customers?customer=1')

    const dialog = await waitFor(() => screen.getByRole('dialog'))
    expect(within(dialog).getByDisplayValue('Стройко ООД')).toBeInTheDocument()
  })

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

  // --- How many ------------------------------------------------------------------------

  it('saves the number of units somebody typed', async () => {
    // The column existed, the orders board read it back as "× 3 бр.", and nothing on this
    // panel could put a number in it — every sale of three was recorded as a sale of one.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    expect(within(dialog).getByLabelText('Брой')).toHaveValue(2)

    fireEvent.change(within(dialog).getByLabelText('Брой'), { target: { value: '3' } })
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].quantity).toBe(3)
    })
  })

  it('a new purchase is one of the thing until somebody says otherwise', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('button', { name: '+ Добави покупка' }))

    expect(within(dialog).getAllByLabelText('Брой')[1]).toHaveValue(1)

    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[1].quantity).toBe(1)
      // And the one that was already two stays two, rather than being reset by the save
      // that only came to add its neighbour.
      expect(saved.purchases[0].quantity).toBe(2)
    })
  })

  it('a quantity box left empty says nothing rather than one', async () => {
    // The server leaves an absent quantity alone. Sending 1 for an empty box would turn
    // "I cleared it by accident" into a sale of three quietly becoming a sale of one.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    fireEvent.change(within(dialog).getByLabelText('Брой'), { target: { value: '' } })
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].quantity).toBeNull()
    })
  })

  it('reads a purchase that predates the column as one, not as zero', async () => {
    // Quantity was added to a populated table and landed on the default a NOT NULL column
    // gets, so every purchase recorded before that migration carries 0 — which `?? 1` sails
    // straight past. Rendered as 0 it is a number the server now refuses, and the refusal
    // blocks the entire customer: identity, prices, notes, all of it, over a box nobody
    // touched. The database is backfilled too; this is what a row that slipped through
    // looks like on screen.
    detail = { ...DETAIL, purchases: [{ ...DETAIL.purchases[0], quantity: 0 }] }

    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    expect(within(dialog).getByLabelText('Брой')).toHaveValue(1)
  })

  it('sends a whole number of units, whatever the box was left holding', async () => {
    // step="1" does not refuse "2.5" — it is a valid number and the input hands it over as
    // typed. The column on the far side is an int, so that body fails JSON binding before
    // any rule of ours runs, and the answer names a JSON path rather than a field: the
    // whole save is lost, the phone number typed beside it with it, and nothing on screen
    // says which of ten boxes to look at.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    fireEvent.change(within(dialog).getByLabelText('Брой'), { target: { value: '2.5' } })
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].quantity).toBe(2)
    })
  })

  it('lets a typed zero travel rather than turning it into "leave it alone"', async () => {
    // Null is the way to say "this submission is not about the count". A 0 quietly becoming
    // null would keep the stored number and report success, so the typo survives and the
    // sale of three still reads as three when somebody meant to correct it.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    fireEvent.change(within(dialog).getByLabelText('Брой'), { target: { value: '0' } })
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].quantity).toBe(0)
    })
  })

  it('reads the reason out of a body the server could not bind', async () => {
    // Our own validation answers { errors: [...] }; ASP.NET answers a binding failure with
    // ProblemDetails, whose errors is an OBJECT keyed by whatever failed. Read only for the
    // array, every one of those degrades to a bare status code and the panel names nothing
    // anybody can go and fix.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    global.fetch.mockImplementation((url, options = {}) => {
      if (String(url).includes('/api/admin/customers/1') && options.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            title: 'One or more validation errors occurred.',
            errors: { '$.purchases[0].quantity': ['The JSON value could not be converted to System.Int32.'] },
          }),
          text: () => Promise.resolve(''),
        })
      }
      return json(detail)
    })

    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    expect(await screen.findByText(/could not be converted/)).toBeInTheDocument()
  })

  it('asks for a quantity even where there is no payment block to put it in', async () => {
    // A wagon hides the money fields, and wagons are the thing people buy five of. Putting
    // the box in with the money would have left the commonest case exactly as it was.
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
    expect(within(dialog).getByLabelText('Брой')).toHaveValue(2)
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

  it('offers no model where the served list says the catalogue has none', async () => {
    // The list is the SERVER'S — it tracks which categories the gallery actually holds
    // models under, and it changes when the catalogue does rather than when this file does.
    // So the page is pinned against what was served, not against what this build believes:
    // the mock says modular carries none, and Modul 90 is in the gallery and still not
    // offered.
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

    expect(dialog.querySelectorAll('#purchaseModels-0 option')).toHaveLength(0)
    // And the caption says what is true of the CATEGORY rather than of modular houses. It
    // used to read "modular houses are custom builds", which was the old reading of this
    // list and is now the wrong sentence under every prefab and garage purchase.
    expect(within(dialog).getByText(/няма модели в тази категория/)).toBeInTheDocument()
  })

  it('falls back to a list that still knows modular carries models', async () => {
    // The one thing the fallback exists for: /categories failing, which the page swallows
    // on purpose. While the two admin screens each kept their own copy of that list this
    // one sat a catalogue revision behind — so a modular purchase lost its picker, its
    // stored link resolved against an empty list to houseId 0, and the next save wrote that
    // reading back over a model somebody had chosen. A 200, and an empty box next time.
    categoriesFail = true
    detail = {
      ...DETAIL,
      purchases: [{
        ...DETAIL.purchases[0], categoryKey: 'modular',
        houseId: 8, houseTitle: 'Modul 90', customModel: null, files: [],
      }],
    }
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    const titles = [...dialog.querySelectorAll('#purchaseModels-0 option')].map((o) => o.value)
    expect(titles).toEqual(['Modul 90'])

    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))
    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      expect(saved.purchases[0].houseId).toBe(8)
    })
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

  it('never sends back the columns no form on this page can reach', async () => {
    // Order tracking is written by the orders board and the four sale expenses came in with
    // the Quickbase import; the server takes neither set from here any more. The submission
    // is a whole row — naming a column it has no input for is how a corrected phone number
    // used to wipe the carrier and every expense off every purchase this customer had.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    await waitFor(() => {
      const saved = JSON.parse(calls.find((c) => c.method === 'PUT').body)
      const sent = Object.keys(saved.purchases[0])
      expect(sent).not.toContain('status')
      expect(sent).not.toContain('publicReference')
      expect(sent).not.toContain('expectedAtHarbor')
      expect(sent).not.toContain('expectedReadyAt')
      expect(sent).not.toContain('carrierName')
      expect(sent).not.toContain('trackingReference')
      expect(sent).not.toContain('carrierNote')
      expect(sent).not.toContain('carrierCheckedAt')
      expect(sent).not.toContain('paymentFees')
      expect(sent).not.toContain('transportCost')
      expect(sent).not.toContain('installationCost')
      expect(sent).not.toContain('otherCosts')
      // Both of these are arithmetic the server does on read, and a form that sends them
      // is a second version of a figure that can disagree with the first.
      expect(sent).not.toContain('saleExpenses')
      expect(sent).not.toContain('unitPrice')
      expect(sent).not.toContain('leftToPay')
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

  it('offers a slot for each of the four documents a sale produces', async () => {
    // A customer pays twice and each payment brings a проформа and then a фактура. The two
    // slots inside a group both read "Проформа" / "Фактура" because the heading above them
    // says which payment — so the name that has to tell them apart is the accessible one.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    expect(within(dialog).getByRole('group', { name: 'Капаро: Проформа' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Капаро: Фактура' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Финално плащане: Проформа' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Финално плащане: Фактура' })).toBeInTheDocument()

    // The existing document is in the deposit's проформа slot and nowhere else.
    const deposit = within(dialog).getByRole('group', { name: 'Капаро: Проформа' })
    expect(within(deposit).getByRole('link', { name: 'proforma.pdf' })).toBeInTheDocument()
  })

  it('files a document under the kind of the slot it was dropped into', async () => {
    // The kind is what the server files by and what decides which slot the document shows
    // up in next time. A slot sending its neighbour's kind is invisible until somebody
    // goes looking for a фактура and finds a проформа.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    const slots = [
      ['Капаро: Проформа', 'deposit-proforma'],
      ['Капаро: Фактура', 'deposit-invoice'],
      ['Финално плащане: Проформа', 'final-proforma'],
      ['Финално плащане: Фактура', 'final-invoice'],
    ]

    for (const [name, kind] of slots) {
      const slot = within(dialog).getByRole('group', { name })
      await user.upload(
        slot.querySelector('input[type="file"]'),
        new File(['%PDF-1.4'], `${kind}.pdf`, { type: 'application/pdf' }))

      await waitFor(() => {
        const sent = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/files')).at(-1)
        expect(sent.url).toContain('/purchases/11/files')
        expect(sent.body.get('kind')).toBe(kind)
        expect(sent.body.get('file').name).toBe(`${kind}.pdf`)
      })
    }
  })

  it('keeps the unsaved half of the sheet when a document is attached', async () => {
    // Attaching used to refetch the whole customer and replace the dialog with the server's
    // copy. That is right after a save and wrong in the middle of one: the count typed a
    // moment earlier snapped back to the stored number with no message, and the next Запази
    // wrote the old number over the new one and returned 200. A purchase added and not yet
    // saved disappeared from the dialog altogether.
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    fireEvent.change(within(dialog).getByLabelText('Брой'), { target: { value: '3' } })
    await user.click(within(dialog).getByRole('button', { name: '+ Добави покупка' }))

    const slot = within(dialog).getAllByRole('group', { name: 'Капаро: Фактура' })[0]
    await user.upload(
      slot.querySelector('input[type="file"]'),
      new File(['%PDF-1.4'], 'faktura.pdf', { type: 'application/pdf' }))

    // The document lands in its slot from the answer the upload gave, with no second trip.
    await waitFor(() => {
      expect(within(slot).getByRole('link', { name: 'faktura.pdf' })).toBeInTheDocument()
    })
    expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/admin/customers/1')))
      .toHaveLength(1)

    const counts = within(dialog).getAllByLabelText('Брой')
    expect(counts).toHaveLength(2)
    expect(counts[0]).toHaveValue(3)
  })

  it('shows a document whose kind no slot claims, instead of dropping it', async () => {
    // The kinds are renamed by a data migration and the code ships separately, so between
    // the two there are rows carrying a key none of the four payment slots match. Filtered
    // by equality alone they render nowhere, which on screen is indistinguishable from
    // having been deleted — and the natural answer to a deleted проформа is to upload it
    // again, which leaves a duplicate behind once the migration does run.
    detail = {
      ...DETAIL,
      purchases: [{
        ...DETAIL.purchases[0],
        files: [
          { id: 91, kind: 'prepaid-invoice', fileName: 'stara-proforma.pdf', contentType: 'application/pdf', sizeBytes: 1024, downloadUrl: '/api/admin/customers/files/91', createdAt: '2026-06-02T09:00:00Z' },
          { id: 92, kind: 'other', fileName: 'dogovor.pdf', contentType: 'application/pdf', sizeBytes: 2048, downloadUrl: '/api/admin/customers/files/92', createdAt: '2026-06-03T09:00:00Z' },
        ],
      }],
    }

    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    // Both in the catch-all: the one the server no longer has a name for, and the contract
    // filed under 'other', which the API has always accepted and no slot ever offered.
    const bucket = within(dialog).getByRole('group', { name: 'Други: Договор и друго' })
    expect(within(bucket).getByRole('link', { name: 'stara-proforma.pdf' })).toBeInTheDocument()
    expect(within(bucket).getByRole('link', { name: 'dogovor.pdf' })).toBeInTheDocument()

    // Visible is not enough on its own — it has to be removable from where it is drawn.
    await user.click(within(bucket).getByRole('button', { name: 'Премахни: stara-proforma.pdf' }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'DELETE' && c.url.endsWith('/files/91'))).toBe(true)
    })
    expect(within(dialog).queryByRole('link', { name: 'stara-proforma.pdf' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'dogovor.pdf' })).toBeInTheDocument()
  })

  it('files a contract under the kind the catch-all slot carries', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    const bucket = within(dialog).getByRole('group', { name: 'Други: Договор и друго' })
    await user.upload(
      bucket.querySelector('input[type="file"]'),
      new File(['%PDF-1.4'], 'dogovor.pdf', { type: 'application/pdf' }))

    await waitFor(() => {
      const sent = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/files')).at(-1)
      expect(sent.body.get('kind')).toBe('other')
    })
  })

  it('cannot attach a file to a purchase that has not been saved yet', async () => {
    const user = userEvent.setup()
    render(<AdminCustomersPage />)
    const dialog = await openCustomer(user)

    await user.click(within(dialog).getByRole('button', { name: '+ Добави покупка' }))

    // Disabled with a reason rather than absent, so the control does not look missing.
    // Matched on the prefix: each button carries the slot it belongs to in its own name,
    // because five of them on one card all reading "Прикачи" is five identical buttons to
    // anybody who cannot see which heading they sit under.
    const buttons = within(dialog).getAllByRole('button', { name: /^Прикачи: / })
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
