import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminOrdersPage from './AdminOrdersPage.jsx'

// The orders board, which is now the whole logistics product: there is no carrier API, so a
// person moves every order along from this screen.
//
// Three things are worth pinning, and all three are things that fail silently.
//
// The FIRST is where a save goes. This board spent its whole life PUTting to
// /api/admin/customers/{id}/purchases/{id} — a route that has never existed — so every status
// change 404'd and nobody noticed, because a board that does not move looks exactly like a
// board nobody has moved. The URL is asserted here for that reason.
//
// The SECOND is that the one-click advance moves ONE step and appears only where a next step
// exists. Two steps is a lie told to a customer; a button on a delivered order is a lie
// waiting to be told.
//
// The THIRD is the staleness marker, which is the only thing on the screen that notices
// nobody has been here.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/orders']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const TIMELINE = ['placed', 'fabricating', 'scheduled', 'travelling', 'at-harbor', 'ready', 'delivered']
const ALL = [...TIMELINE, 'cancelled']

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()

// One row per case the screen has to get right: past the threshold, exactly on it, finished,
// never moved, and off the timeline entirely.
const BOARD = [
  {
    purchaseId: 7, customerId: 3, customerName: 'Иван Петров', model: 'Nova 60',
    categoryKey: 'modular', factoryName: 'Bursa Prefab', quantity: 1,
    depositPaid: 5000, finalPrice: 42000, leftToPay: 37000, currency: 'EUR',
    status: 'fabricating', purchasedAt: '2026-05-02',
    expectedAtHarbor: '2026-09-10', expectedReadyAt: '2026-09-20',
    carrierName: 'Ro-Ro Lines', trackingReference: 'RRL-8891', carrierNote: 'Загружда се в сряда.',
    carrierCheckedAt: daysAgo(15), publicReference: 'abcd234xyz',
    lastMovedAt: daysAgo(15), lastMovedBy: 'maria@nvc-home4you.eu',
    lastTouchedAt: daysAgo(15),
  },
  {
    purchaseId: 8, customerId: 4, customerName: 'Мария Димитрова', model: 'Cube 40',
    categoryKey: 'modular', factoryName: null, quantity: 1,
    depositPaid: null, finalPrice: null, leftToPay: null, currency: 'EUR',
    status: 'travelling', purchasedAt: '2026-06-11',
    expectedAtHarbor: null, expectedReadyAt: null,
    carrierName: null, trackingReference: null, carrierNote: null,
    carrierCheckedAt: null, publicReference: null,
    lastMovedAt: daysAgo(14), lastMovedBy: 'georgi@nvc-home4you.eu',
    lastTouchedAt: daysAgo(14),
  },
  {
    purchaseId: 9, customerId: 5, customerName: 'Петър Колев', model: 'Nova 90',
    categoryKey: 'modular', factoryName: null, quantity: 1,
    depositPaid: null, finalPrice: null, leftToPay: null, currency: 'EUR',
    status: 'delivered', purchasedAt: '2026-01-04',
    expectedAtHarbor: null, expectedReadyAt: null,
    carrierName: null, trackingReference: null, carrierNote: null,
    carrierCheckedAt: null, publicReference: null,
    lastMovedAt: daysAgo(60), lastMovedBy: 'maria@nvc-home4you.eu',
    lastTouchedAt: daysAgo(60),
  },
  {
    purchaseId: 10, customerId: 6, customerName: 'Елена Стоянова', model: 'Cube 30',
    categoryKey: 'modular', factoryName: null, quantity: 1,
    depositPaid: null, finalPrice: null, leftToPay: null, currency: 'EUR',
    status: 'scheduled', purchasedAt: '2026-02-02',
    expectedAtHarbor: null, expectedReadyAt: null,
    carrierName: null, trackingReference: null, carrierNote: null,
    carrierCheckedAt: null, publicReference: null,
    lastMovedAt: null, lastMovedBy: null, lastTouchedAt: null,
  },
  {
    purchaseId: 11, customerId: 7, customerName: 'Николай Иванов', model: 'Nova 60',
    categoryKey: 'modular', factoryName: null, quantity: 1,
    depositPaid: null, finalPrice: null, leftToPay: null, currency: 'EUR',
    status: 'cancelled', purchasedAt: '2026-03-03',
    expectedAtHarbor: null, expectedReadyAt: null,
    carrierName: null, trackingReference: null, carrierNote: null,
    carrierCheckedAt: null, publicReference: null,
    lastMovedAt: daysAgo(40), lastMovedBy: 'maria@nvc-home4you.eu',
    lastTouchedAt: daysAgo(40),
  },
  {
    // Six weeks on the water and not one status change, because that is what a sailing looks
    // like — but somebody rings the carrier every few days and writes down what they said.
    purchaseId: 12, customerId: 8, customerName: 'Дария Тонева', model: 'Nova 60',
    categoryKey: 'modular', factoryName: null, quantity: 1,
    depositPaid: null, finalPrice: null, leftToPay: null, currency: 'EUR',
    status: 'travelling', purchasedAt: '2026-04-04',
    expectedAtHarbor: null, expectedReadyAt: null,
    carrierName: 'Ro-Ro Lines', trackingReference: 'RRL-1200', carrierNote: 'Минава Суец.',
    carrierCheckedAt: daysAgo(2), publicReference: null,
    lastMovedAt: daysAgo(42), lastMovedBy: 'georgi@nvc-home4you.eu',
    lastTouchedAt: daysAgo(2),
  },
  {
    // Cleared, in the country, and waiting on a person to book a lorry. The step customers
    // are least patient about, and the one silence used to go unmarked on.
    purchaseId: 13, customerId: 9, customerName: 'Стефан Ангелов', model: 'Cube 40',
    categoryKey: 'modular', factoryName: null, quantity: 1,
    depositPaid: null, finalPrice: null, leftToPay: null, currency: 'EUR',
    status: 'ready', purchasedAt: '2026-01-20',
    expectedAtHarbor: null, expectedReadyAt: null,
    carrierName: null, trackingReference: null, carrierNote: null,
    carrierCheckedAt: null, publicReference: null,
    lastMovedAt: daysAgo(80), lastMovedBy: 'maria@nvc-home4you.eu',
    lastTouchedAt: daysAgo(80),
  },
]

const HISTORY = [
  { status: 'fabricating', changedAt: daysAgo(15), changedByUpn: 'maria@nvc-home4you.eu' },
  { status: 'placed', changedAt: daysAgo(40), changedByUpn: null },
]

let calls = []
let board = []
let putFails = false
let statusesFail = false
let boardFailsAfterWrite = false
let boardBroken = false

// The row on screen after a move, so the quiet reload that follows an advance answers with
// what the server would actually say next rather than with the old board.
const findRow = (name) => screen.getByText(name).closest('li')

beforeEach(() => {
  calls = []
  putFails = false
  statusesFail = false
  boardFailsAfterWrite = false
  boardBroken = false
  board = BOARD.map((r) => ({ ...r }))

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const u = String(url)
    const method = options.method || 'GET'
    calls.push({ url: u, method, body: options.body })

    if (u.includes('/api/admin/me')) return json({ name: 'Sales' })
    if (u.includes('/api/admin/reviews/counts')) return json({ pending: 0 })
    if (u.includes('/api/admin/leads/counts')) return json({ notReachedOut: 0 })
    if (u.includes('/api/admin/orders/statuses')) {
      return statusesFail
        ? json({ errors: ['Не се зареди.'] }, 500)
        : json({ timeline: TIMELINE, all: ALL })
    }
    if (u.includes('/history')) return json(HISTORY)

    const write = u.match(/\/api\/admin\/orders\/(\d+)$/)
    if (write && method === 'PUT') {
      if (putFails) return json({ errors: ['Не се записа.'] }, 500)
      const row = board.find((r) => r.purchaseId === Number(write[1]))
      const sent = JSON.parse(options.body)
      // The writer only moves an order when a status is actually sent and it differs — a
      // body with no status at all is a note-only save.
      if (row && sent.status !== undefined && sent.status !== row.status) {
        row.status = sent.status
        row.lastMovedAt = new Date().toISOString()
        row.lastMovedBy = 'sales@nvc-home4you.eu'
        row.lastTouchedAt = row.lastMovedAt
      }
      if (boardFailsAfterWrite) boardBroken = true
      return json({ ok: true })
    }

    if (u.includes('/api/admin/orders')) {
      return boardBroken ? json({ errors: ['Таблото не се зареди.'] }, 500) : json(board)
    }
    return json({})
  }))
})

afterEach(() => { vi.unstubAllGlobals() })

const bodyOf = (call) => JSON.parse(call.body)

describe('AdminOrdersPage', () => {
  it('saves through the orders writer, never through a customer purchase route', async () => {
    // The regression this whole test file exists for. The order fields are written by the
    // one endpoint that cannot touch money; the customer's sheet writes the money.
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    await user.click(within(findRow('Иван Петров')).getByRole('button', { name: 'Редактирай' }))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    const put = await waitFor(() => {
      const found = calls.find((c) => c.method === 'PUT')
      expect(found).toBeTruthy()
      return found
    })

    expect(put.url).toContain('/api/admin/orders/7')
    expect(put.url).not.toContain('/customers/')
    expect(put.url).not.toContain('/purchases/')
    // No status: nothing on this save chose one. The editor was opened on 'fabricating' and
    // is still on it, and posting that back would undo a move a colleague made while the
    // modal was open — the writer compares what it is sent against the row as it stands NOW.
    expect(bodyOf(put)).toEqual({
      expectedAtHarbor: '2026-09-10',
      expectedReadyAt: '2026-09-20',
      carrierName: 'Ro-Ro Lines',
      trackingReference: 'RRL-8891',
      carrierNote: 'Загружда се в сряда.',
    })
  })

  it('sends the status only when the editor actually changed it', async () => {
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    await user.click(within(findRow('Иван Петров')).getByRole('button', { name: 'Редактирай' }))
    const dialog = await waitFor(() => screen.getByRole('dialog'))
    await user.selectOptions(within(dialog).getByRole('combobox'), 'travelling')
    await user.click(within(dialog).getByRole('button', { name: 'Запази' }))

    const put = await waitFor(() => {
      const found = calls.find((c) => c.method === 'PUT')
      expect(found).toBeTruthy()
      return found
    })

    expect(bodyOf(put).status).toBe('travelling')
  })

  it('moves an order exactly one step, carrying the carrier fields with it', async () => {
    // One step, because two is a date told to a customer that never happened. And the whole
    // order goes in the body: the writer overwrites the carrier fields from what it is
    // handed, so a partial body would erase the tracking number on every click.
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    const row = findRow('Иван Петров')
    await user.click(within(row).getByRole('button', { name: 'Премести на: Насрочена за товарене' }))

    const put = await waitFor(() => {
      const found = calls.find((c) => c.method === 'PUT')
      expect(found).toBeTruthy()
      return found
    })

    expect(put.url).toContain('/api/admin/orders/7')
    expect(bodyOf(put).status).toBe('scheduled')
    expect(bodyOf(put).trackingReference).toBe('RRL-8891')
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1)

    // And the button now offers the step after that one, not the one just taken.
    await waitFor(() => {
      const moved = findRow('Иван Петров')
      expect(within(moved).getByText('Насрочена за товарене')).toBeInTheDocument()
      expect(within(moved).getByRole('button', { name: 'Премести на: Пътува' })).toBeInTheDocument()
    })
  })

  it('offers no next step on a delivered or a cancelled order', async () => {
    // Delivered is the end of the timeline and cancelled was never on it. Neither has a
    // "next", and a button that walks an order off the end is worse than no button.
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Петър Колев')).toBeInTheDocument())

    const delivered = findRow('Петър Колев')
    const cancelled = findRow('Николай Иванов')

    expect(within(delivered).queryByRole('button', { name: /Премести на/ })).not.toBeInTheDocument()
    expect(within(cancelled).queryByRole('button', { name: /Премести на/ })).not.toBeInTheDocument()
    expect(within(findRow('Иван Петров')).getByRole('button', { name: /Премести на/ })).toBeInTheDocument()
  })

  it('puts the status back and says so when a move fails', async () => {
    // A row that silently snaps back reads as a misclick, and the next person to look at it
    // believes the old status.
    putFails = true
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    await user.click(
      within(findRow('Иван Петров')).getByRole('button', { name: 'Премести на: Насрочена за товарене' }),
    )

    await waitFor(() => expect(screen.getByText('Не се записа.')).toBeInTheDocument())
    const row = findRow('Иван Петров')
    expect(within(row).getByText('В производство')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Премести на: Насрочена за товарене' })).toBeInTheDocument()
  })

  it('marks an order that has stopped moving, and only past the threshold', async () => {
    // Fifteen days of silence on an order in production is worth a look; fourteen is not,
    // and the difference between them is the whole value of the marker.
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    const stalled = findRow('Иван Петров')
    expect(within(stalled).getByText('Без движение')).toBeInTheDocument()
    expect(within(stalled).getByText('15 дни')).toBeInTheDocument()

    const justInside = findRow('Мария Димитрова')
    expect(within(justInside).queryByText('Без движение')).not.toBeInTheDocument()
  })

  it('never calls a finished order stale, nor one with no move on file', async () => {
    // Delivered has stopped on purpose. And an order that predates the log has no date to
    // have been silent since — colouring it would put a judgement on a date nobody observed.
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Петър Колев')).toBeInTheDocument())

    expect(within(findRow('Петър Колев')).queryByText('Без движение')).not.toBeInTheDocument()

    const undated = findRow('Елена Стоянова')
    expect(within(undated).queryByText('Без движение')).not.toBeInTheDocument()
    expect(within(undated).getByText('Няма записано движение')).toBeInTheDocument()
  })

  it('says when each order last moved and who moved it', async () => {
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    const row = findRow('Иван Петров')
    expect(within(row).getByText(/Последно движение/)).toBeInTheDocument()
    expect(within(row).getByText('maria')).toBeInTheDocument()
  })

  it('shows the order’s own history when the editor opens', async () => {
    // "When did it actually leave?" is asked about one order, usually with the customer
    // already on the phone — so the history is fetched with the editor, not with the board.
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    expect(calls.some((c) => c.url.includes('/history'))).toBe(false)

    await user.click(within(findRow('Иван Петров')).getByRole('button', { name: 'Редактирай' }))
    const dialog = await waitFor(() => screen.getByRole('dialog'))

    await waitFor(() => expect(calls.some((c) => c.url.includes('/api/admin/orders/7/history'))).toBe(true))

    const entries = await waitFor(() => {
      const list = dialog.querySelector('.adm-audit-list')
      expect(list).toBeTruthy()
      return within(list).getAllByRole('listitem')
    })

    expect(entries).toHaveLength(2)
    // Newest first, and the move nobody signed reads as the system rather than as a blank.
    expect(within(entries[0]).getByText('В производство')).toBeInTheDocument()
    expect(within(entries[0]).getByText('maria')).toBeInTheDocument()
    expect(within(entries[1]).getByText('Приета')).toBeInTheDocument()
    expect(within(entries[1]).getByText('Системата')).toBeInTheDocument()
  })

  it('marks an order left sitting at "ready", where the customer is least patient', async () => {
    // Cleared, in the country, and waiting on somebody to book a lorry. Eighty days of that
    // used to produce no signal at all, while a fifteen-day-old order in production two lines
    // up was flagged.
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Стефан Ангелов')).toBeInTheDocument())

    const waiting = findRow('Стефан Ангелов')
    expect(within(waiting).getByText('Без движение')).toBeInTheDocument()
    expect(within(waiting).getByText('80 дни')).toBeInTheDocument()
  })

  it('does not call an order stale while somebody is still minding it', async () => {
    // Six weeks on the water is a sailing, not neglect. The status has not moved in 42 days
    // and the carrier note was confirmed two days ago — measuring only the status would badge
    // the best-kept order on the screen.
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Дария Тонева')).toBeInTheDocument())

    expect(within(findRow('Дария Тонева')).queryByText('Без движение')).not.toBeInTheDocument()
  })

  it('says so when the status list fails, instead of quietly dropping every control', async () => {
    // The board renders perfectly — rows, money, statuses, staleness — and not one advance
    // button, because the sequence they are derived from never arrived. Staff conclude the
    // feature was removed and go back to the two-click editor for the day.
    statusesFail = true
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    expect(screen.getByText(/Списъкът със статуси не се зареди/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Премести на/ })).not.toBeInTheDocument()
  })

  it('takes an order one step even when the button is pressed twice', async () => {
    // The first move lands in a couple of hundred milliseconds and the button re-labels
    // itself to the step after it — well inside the time between two impatient clicks. The
    // second one used to PUT a different, further status, and the history table is
    // append-only, so no admin action can tidy that up afterwards.
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    await user.click(
      within(findRow('Иван Петров')).getByRole('button', { name: 'Премести на: Насрочена за товарене' }),
    )
    await waitFor(() => expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1))

    // The same button, now reading "→ Пътува", pressed again straight away.
    await user.click(within(findRow('Иван Петров')).getByRole('button', { name: /Премести на/ }))

    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(1)
    expect(within(findRow('Иван Петров')).getByText('Насрочена за товарене')).toBeInTheDocument()
  })

  it('stops calling an order stale the moment it is moved, even if the re-read fails', async () => {
    // The one screen whose stated job is to say when nothing has happened, warning that
    // nobody has touched an order that was touched two seconds ago. That is the direction of
    // wrongness that trains people to ignore the marker.
    boardFailsAfterWrite = true
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    const before = findRow('Иван Петров')
    expect(within(before).getByText('Без движение')).toBeInTheDocument()

    await user.click(within(before).getByRole('button', { name: 'Премести на: Насрочена за товарене' }))

    await waitFor(() => {
      const moved = findRow('Иван Петров')
      expect(within(moved).getByText('Насрочена за товарене')).toBeInTheDocument()
      expect(within(moved).queryByText('Без движение')).not.toBeInTheDocument()
      expect(within(moved).queryByText('15 дни')).not.toBeInTheDocument()
    })
  })

  it('does not leave a green success sitting above a red failure', async () => {
    // Read forty times a day at a glance, "Мария не беше преместена" directly above
    // "Преместена: Иван Петров → Насрочена за товарене" is read as "it failed, but something
    // about Иван worked".
    const user = userEvent.setup()
    render(<AdminOrdersPage />)
    await waitFor(() => expect(screen.getByText('Иван Петров')).toBeInTheDocument())

    await user.click(
      within(findRow('Иван Петров')).getByRole('button', { name: 'Премести на: Насрочена за товарене' }),
    )
    // A verb, so the line reads as an announcement rather than as a name next to a status.
    await waitFor(() => expect(
      screen.getByText('Преместена: Иван Петров → Насрочена за товарене'),
    ).toBeInTheDocument())

    putFails = true
    await user.click(
      within(findRow('Мария Димитрова')).getByRole('button', { name: 'Премести на: На пристанище' }),
    )

    await waitFor(() => expect(screen.getByText('Не се записа.')).toBeInTheDocument())
    expect(screen.queryByText('Преместена: Иван Петров → Насрочена за товарене')).not.toBeInTheDocument()
  })
})
