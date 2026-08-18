import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  sendWithRetry, submitInBackground, subscribeSubmissions, dismissSubmission,
  _resetSubmissions, MAX_ATTEMPTS,
} from './backgroundSubmit.js'

// The engine behind "close the modal and let it send itself".
//
// The stakes: every submission here is a customer enquiry, and the failure this replaces
// was human — a visitor pressing Send five times at a button that appeared to do nothing.
// So the retry logic must genuinely retry the transient cases, genuinely STOP for the
// hopeless ones (or it becomes the spammer itself), and the banner state must never claim
// an enquiry arrived when it did not.

const ok = () => Promise.resolve({ ok: true, status: 200 })
const status = (code) => Promise.resolve({ ok: false, status: code })
const netFail = () => Promise.reject(new TypeError('Failed to fetch'))

// Zero delays: the tests exercise the ORDER of events, not the clock.
const fast = { delays: [0, 0, 0, 0] }

describe('sendWithRetry', () => {
  it('sends once when the first attempt lands', async () => {
    const fetchImpl = vi.fn(ok)

    const result = await sendWithRetry('/api/offer', { name: 'Иван' }, { ...fast, fetchImpl })

    expect(result.ok).toBe(true)
    expect(result.attempt).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    // And it sent what it was given, as JSON.
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).name).toBe('Иван')
  })

  it('retries through network failures and reports which attempt won', async () => {
    // The phone-in-a-dead-spot case: the first tries throw, the next one lands.
    const fetchImpl = vi.fn()
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(ok)

    const result = await sendWithRetry('/api/offer', {}, { ...fast, fetchImpl })

    expect(result.ok).toBe(true)
    expect(result.attempt).toBe(3)
  })

  it('gives up after five attempts, not six and not four', async () => {
    const fetchImpl = vi.fn(netFail)

    const result = await sendWithRetry('/api/offer', {}, { ...fast, fetchImpl })

    expect(result.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(MAX_ATTEMPTS)
  })

  it('retries a 503 but never a 400', async () => {
    // A 400 means the request itself is at fault. Re-sending identical bad input five
    // times is the exact behaviour this module exists to stop humans doing.
    const on503 = vi.fn(() => status(503))
    const on400 = vi.fn(() => status(400))

    const first = await sendWithRetry('/api/offer', {}, { ...fast, fetchImpl: on503 })
    const second = await sendWithRetry('/api/offer', {}, { ...fast, fetchImpl: on400 })

    expect(on503).toHaveBeenCalledTimes(MAX_ATTEMPTS)
    expect(first.ok).toBe(false)

    expect(on400).toHaveBeenCalledTimes(1)
    expect(second.ok).toBe(false)
    expect(second.retriable).toBe(false)
  })

  it('a late success after early failures is still a success', async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => status(503))
      .mockImplementationOnce(() => status(429))
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(ok)

    const result = await sendWithRetry('/api/offer', {}, { ...fast, fetchImpl })

    expect(result.ok).toBe(true)
    expect(result.attempt).toBe(MAX_ATTEMPTS)
  })
})

describe('the submission store', () => {
  beforeEach(() => _resetSubmissions())

  const seen = () => {
    const states = []
    subscribeSubmissions((items) => states.push(items))
    return states
  }

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  // Five attempts are five promise chains and four zero-delay sleeps; counting the exact
  // number of macrotask hops would make the test a mirror of the implementation. Instead:
  // flush until the condition holds or a generous bound passes.
  const until = async (predicate) => {
    for (let i = 0; i < 50; i++) {
      if (predicate()) return
      await flush()
    }
    throw new Error('condition never became true')
  }

  it('reports sending, then success, then leaves on its own', async () => {
    const states = seen()

    submitInBackground({
      url: '/api/offer', payload: {},
      labels: { success: 'Изпратено' },
      options: { ...fast, fetchImpl: ok, successTtlMs: 0 },
    })

    expect(states.at(-1)[0].status).toBe('sending')
    // Auto-dismissed: a success thanks and leaves, it does not need managing.
    await until(() => states.at(-1).length === 0)
    expect(states.some((s) => s[0]?.status === 'success')).toBe(true)
  })

  it('analytics fire only on a confirmed send', async () => {
    // A tracked lead must be a lead the server actually has — never one that died in retry.
    const states = seen()
    const onSuccess = vi.fn()

    submitInBackground({
      url: '/api/offer', payload: {}, labels: {},
      onSuccess,
      options: { ...fast, fetchImpl: vi.fn(netFail), successTtlMs: 0 },
    })
    await until(() => states.at(-1)[0]?.status === 'error')
    expect(onSuccess).not.toHaveBeenCalled()

    submitInBackground({
      url: '/api/offer', payload: {}, labels: {},
      onSuccess,
      options: { ...fast, fetchImpl: ok, successTtlMs: 0 },
    })
    await until(() => onSuccess.mock.calls.length === 1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('a spent submission stays on screen with a working retry', async () => {
    const states = seen()
    // Fails all five, then a retry succeeds — the "walked out of the dead spot" case.
    const fetchImpl = vi.fn()
      .mockImplementationOnce(netFail).mockImplementationOnce(netFail)
      .mockImplementationOnce(netFail).mockImplementationOnce(netFail)
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(ok)

    submitInBackground({
      url: '/api/offer', payload: {}, labels: {},
      options: { ...fast, fetchImpl, successTtlMs: 0 },
    })
    await until(() => states.at(-1)[0]?.status === 'error')

    const failed = states.at(-1)[0]
    // NOT auto-dismissed: closing a failure silently would lose the enquiry.
    expect(failed.status).toBe('error')
    expect(typeof failed.retry).toBe('function')

    failed.retry()
    await until(() => states.some((s) => s[0]?.status === 'success'))
  })

  it('dismiss removes exactly the one submission', async () => {
    const states = seen()
    const failing = { ...fast, fetchImpl: vi.fn(netFail), successTtlMs: 0 }

    const first = submitInBackground({ url: '/a', payload: {}, labels: {}, options: failing })
    const second = submitInBackground({ url: '/b', payload: {}, labels: {}, options: failing })
    await until(() => states.at(-1).length === 2 && states.at(-1).every((x) => x.status === 'error'))

    expect(states.at(-1)).toHaveLength(2)
    dismissSubmission(first)
    expect(states.at(-1)).toHaveLength(1)
    expect(states.at(-1)[0].id).toBe(second)
  })

  it('marks the retrying attempts so the banner can count them out loud', async () => {
    const states = seen()
    const fetchImpl = vi.fn()
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(ok)

    submitInBackground({
      url: '/api/offer', payload: {}, labels: {},
      options: { ...fast, fetchImpl, successTtlMs: 0 },
    })
    await until(() => states.some((x) => x[0]?.status === 'success'))

    // Attempt 1 reads as plain "sending" — nobody should see "attempt 1 of 5" on a
    // request that is going normally. Attempt 2 reads as retrying.
    expect(states.some((s) => s[0]?.status === 'retrying' && s[0]?.attempt === 2)).toBe(true)
  })
})
