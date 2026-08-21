import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminSave } from './adminSave.js'
import { UnauthorizedError } from './adminApi.js'
import {
  MAX_ATTEMPTS, subscribeSubmissions, _resetSubmissions, _setRetryDelays,
} from '../lib/backgroundSubmit.js'

// The rule that decides who owns a save once the button has been pressed.
//
// The public forms close their modal on the click and let the retries get on with it. That
// is wrong here for exactly one reason: an admin save can be REFUSED, and a refusal is the
// one answer that closing the dialog makes unrecoverable — no form, no typing, and a banner
// reporting a failure nothing is going to retry. So this file pins the three-way split, and
// pins hardest on the two ways it could quietly go wrong: a refusal being retried (which is
// the panel becoming the spammer the retries exist to prevent), and a lost save going quiet.

const answer = (status, body) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

// Five attempts are five promise chains and four zero-length sleeps; counting the exact
// number of macrotask hops would make the test a mirror of the implementation.
const until = async (predicate) => {
  for (let i = 0; i < 60; i++) {
    if (predicate()) return
    await flush()
  }
  throw new Error('condition never became true')
}

let banner = []

beforeEach(() => {
  _resetSubmissions()
  _setRetryDelays([0, 0, 0, 0])
  banner = []
  subscribeSubmissions((items) => { banner = items })
})

afterEach(() => {
  vi.unstubAllGlobals()
  _resetSubmissions()
  _setRetryDelays()
})

describe('adminSave', () => {
  it('hands back the response body and says so on the banner', async () => {
    // The immediate attempt is the ONLY place a caller can read what the server wrote —
    // a new lead's id, a duplicate-name flag — so it has to come back from here.
    vi.stubGlobal('fetch', vi.fn(() => answer(200, { id: 42, duplicateName: true })))

    const outcome = await adminSave({ url: '/api/admin/pipeline', body: { name: 'Иван' }, lang: 'bg' })

    expect(outcome.outcome).toBe('saved')
    expect(outcome.result.id).toBe(42)
    expect(banner).toHaveLength(1)
    expect(banner[0].status).toBe('success')
  })

  it('names the record on the banner, because the dialog is gone by then', async () => {
    vi.stubGlobal('fetch', vi.fn(() => answer(200, {})))

    await adminSave({ url: '/x', body: {}, lang: 'en', subject: 'Bursa Prefab' })

    expect(banner[0].labels.success).toBe('Saved · Bursa Prefab')
  })

  it('returns a refusal verbatim and does not send it again', async () => {
    const fetchImpl = vi.fn(() => answer(400, { errors: ['A lead has to keep a name.'] }))
    vi.stubGlobal('fetch', fetchImpl)

    const outcome = await adminSave({ url: '/x', body: {}, lang: 'bg' })

    expect(outcome).toEqual({ outcome: 'invalid', message: 'A lead has to keep a name.' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // Nothing on the banner either: the dialog is still open and wearing the answer, and a
    // second account of the same failure in the corner of the screen is one too many.
    expect(banner).toHaveLength(0)
  })

  it('reads ASP.NET’s other validation shape too', async () => {
    // ValidationProblemDetails puts an OBJECT in the same field, and it is what comes back
    // when a body cannot be bound at all — a fractional number where an int was expected.
    vi.stubGlobal('fetch', vi.fn(() => answer(400, { errors: { Quantity: ['Must be at least 1.'] } })))

    const outcome = await adminSave({ url: '/x', body: {} })

    expect(outcome.message).toBe('Must be at least 1.')
  })

  it('hands a 5xx to the retries and keeps the failure on screen once they run out', async () => {
    const fetchImpl = vi.fn(() => answer(503, { errors: ['Later.'] }))
    vi.stubGlobal('fetch', fetchImpl)

    // An edit, because that is what may be repeated: the same fields onto the same row.
    const outcome = await adminSave({ url: '/x/7', method: 'PUT', body: {}, lang: 'bg', subject: 'Иван' })

    expect(outcome).toEqual({ outcome: 'background' })
    await until(() => banner[0]?.status === 'error')

    // One attempt from the dialog, then the public budget. Re-sending from scratch costs a
    // request; sharing one budget across two files would cost a rule that has to stay in
    // step forever.
    expect(fetchImpl).toHaveBeenCalledTimes(1 + MAX_ATTEMPTS)
    expect(banner[0].labels.error).toMatch(/^Запазването не успя/)
    expect(banner[0].labels.error).toContain('Иван')
    // And it stays. A success leaves on a timer; a lost save has to still be there when
    // somebody looks up, or nobody ever learns the record is unchanged.
    await flush()
    expect(banner).toHaveLength(1)
    expect(banner[0].retry).toBeTypeOf('function')
  })

  it('treats a request that never got an answer as the retryable case', async () => {
    // Offline, DNS, a dropped connection. No status ever reaches the caller, and that
    // absence is the whole signal.
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    vi.stubGlobal('fetch', fetchImpl)

    const outcome = await adminSave({ url: '/x/7', method: 'PUT', body: {} })

    expect(outcome.outcome).toBe('background')
    await until(() => banner[0]?.status === 'error')
    expect(fetchImpl).toHaveBeenCalledTimes(1 + MAX_ATTEMPTS)
  })

  it('a backgrounded edit is retried as the PUT it was', async () => {
    // An edit is a PUT to the row it edits. Retrying it as a POST would create a second
    // record every time the wifi dropped, which is the opposite of what the retries are for.
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => answer(503, {}))
      .mockImplementationOnce(() => answer(200, {}))
    vi.stubGlobal('fetch', fetchImpl)

    await adminSave({ url: '/api/admin/orders/7', method: 'PUT', body: { status: 'ready' } })
    await until(() => banner[0]?.status === 'success')

    expect(fetchImpl.mock.calls[1][1].method).toBe('PUT')
  })

  it('tells the caller only when the LATE attempt lands', async () => {
    // Where the list reload belongs: the caller already handles the immediate save and is
    // holding the response body while it does.
    const onLateSuccess = vi.fn()
    vi.stubGlobal('fetch', vi.fn(() => answer(200, {})))
    await adminSave({ url: '/x/7', method: 'PUT', body: {}, onLateSuccess })
    expect(onLateSuccess).not.toHaveBeenCalled()

    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => answer(500, {}))
      .mockImplementationOnce(() => answer(200, {})))
    await adminSave({ url: '/x/7', method: 'PUT', body: {}, onLateSuccess })
    await until(() => onLateSuccess.mock.calls.length === 1)
  })

  it('lets an expired session through to the page rather than retrying it', async () => {
    // A 401 needs a sign-in prompt, not a retry button, and the shell already knows how to
    // put one up.
    vi.stubGlobal('fetch', vi.fn(() => answer(401, {})))

    await expect(adminSave({ url: '/x', body: {} })).rejects.toBeInstanceOf(UnauthorizedError)
    expect(banner).toHaveLength(0)
  })

  it('says so rather than offering a retry when the session runs out mid-backoff', async () => {
    // The promise at the top of adminSave.js — "a 401 needs a sign-in prompt, not a retry
    // button" — held only for the FIRST attempt. Five o'clock arrives during the backoff and
    // the banner would otherwise report a lost save with a button that answers 401 forever.
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => answer(503, {}))
      .mockImplementationOnce(() => answer(401, {})))

    await adminSave({ url: '/x/7', method: 'PUT', body: {}, lang: 'en', subject: 'Ivan' })
    await until(() => banner[0]?.status === 'error')

    expect(banner[0].expired).toBe(true)
    expect(banner[0].labels.expired).toBe('The session expired. Sign in again — the change was not recorded. · Ivan')
    // Nothing to press. The panel's next request is what puts the sign-in screen up.
    expect(banner[0].retry).toBeNull()
  })

  // --- Sending it twice, and when that is not allowed -----------------------------------

  it('does not hand a CREATE to the retries when its answer went missing', async () => {
    // The one request the retries must not have. The row may well have been written — a 504
    // from the gateway says nothing either way — and a second POST makes a second record
    // under a green "Запазено", which is the panel becoming the duplicate-enquiry machine
    // the retries exist to prevent.
    const fetchImpl = vi.fn(() => answer(504, {}))
    vi.stubGlobal('fetch', fetchImpl)

    const outcome = await adminSave({ url: '/api/admin/pipeline', body: { name: 'Иван' }, lang: 'bg' })

    expect(outcome.outcome).toBe('lost')
    expect(outcome.message).toMatch(/^Няма отговор от сървъра/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // Nothing in the corner either: the dialog is still open, holding the typing and the
    // reason, and it is the only place a person can act on this.
    expect(banner).toHaveLength(0)
  })

  it('still retries a POST the caller says is an update', async () => {
    // The lead sheet POSTs to /fields, which writes onto a lead that already exists. Sending
    // it twice lands on the same row, so it is as safe to repeat as any PUT.
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => answer(500, {}))
      .mockImplementationOnce(() => answer(200, {}))
    vi.stubGlobal('fetch', fetchImpl)

    const outcome = await adminSave({
      url: '/api/admin/pipeline/7/fields', body: { name: 'Иван' }, repeatable: true,
    })

    expect(outcome.outcome).toBe('background')
    await until(() => banner[0]?.status === 'success')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('an unreadable success is an answer the server gave, not a request that never got one', async () => {
    // A proxy truncates the body of a 200. JSON.parse throws, and an error with no status on
    // it is exactly how this file recognises a request that never arrived — so the write
    // that HAS landed would be sent again.
    const fetchImpl = vi.fn(() => Promise.resolve({
      ok: true, status: 200, text: () => Promise.resolve('{"id":4'), json: () => Promise.resolve({}),
    }))
    vi.stubGlobal('fetch', fetchImpl)

    const outcome = await adminSave({ url: '/api/admin/pipeline', body: {} })

    expect(outcome.outcome).toBe('invalid')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('a newer save of the same record supersedes the one still being retried', async () => {
    // Save, get a 500, the dialog closes and the retries take it. Reopen inside the backoff,
    // fix the phone number, save again — and the older body must not land last and write the
    // correction away, reporting itself a success while it does.
    const sent = []
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      sent.push(body)
      return body.phone === '0888' ? answer(500, {}) : answer(200, {})
    }))

    const first = await adminSave({ url: '/api/admin/pipeline/7/fields', body: { phone: '0888' }, repeatable: true })
    expect(first.outcome).toBe('background')

    const second = await adminSave({ url: '/api/admin/pipeline/7/fields', body: { phone: '0899' }, repeatable: true })
    expect(second.outcome).toBe('saved')

    // Give the abandoned loop every chance to wake up and land on top of the correction.
    for (let i = 0; i < 20; i++) await flush()

    // Nothing at all after the correction. The attempt already in flight when it arrived is
    // allowed — the browser cannot unsend a request — but the loop behind it stopped there
    // instead of spending its five.
    expect(sent[sent.length - 1]).toEqual({ phone: '0899' })
    expect(sent.filter((b) => b.phone === '0888').length).toBeLessThan(1 + MAX_ATTEMPTS)
    // And its banner went with it — a stale "Опитай пак" would re-send the old body by hand.
    expect(banner.filter((item) => item.status === 'error')).toHaveLength(0)
  })
})
