import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENQUIRY_ORIGINS, buildOfferPayload, sendOffer } from './sendOffer.js'
import { _resetSubmissions } from './backgroundSubmit.js'
import { saveRep } from './repAttribution.js'
import contract from './__fixtures__/enquiry-origins.json'

const labels = { sending: 's', retrying: 'r', success: 'ok', error: 'e', retry: 'again', close: 'x' }
const posted = () => fetch.mock.calls.filter(([url]) => String(url).endsWith('/api/offer'))
const bodyOf = (call) => JSON.parse(call[1].body)

beforeEach(() => {
  _resetSubmissions()
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendOffer', () => {
  it('knows exactly the origins the server accepts (the shared contract file)', () => {
    expect([...ENQUIRY_ORIGINS]).toEqual(contract.origins)
  })

  it('posts the ordinary offer with the origin, the rep and the honeypot', async () => {
    saveRep('dtodorov')
    const onSuccess = vi.fn()

    expect(sendOffer({
      name: ' Иван ', email: 'ivan@example.com ', phone: '+359 88 000 0000', project: 'Врати: 12 бр.',
      locale: 'bg', origin: 'doors', website: '', labels, onSuccess,
    })).toBe(true)

    await vi.waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0])).toEqual({
      name: 'Иван', email: 'ivan@example.com', phone: '+359 88 000 0000', project: 'Врати: 12 бр.',
      modelId: '', locale: 'bg', rep: 'dtodorov', website: '', origin: 'doors',
    })
    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('leaves the key out without an origin, so the body is the older shape', () => {
    const payload = buildOfferPayload({ name: 'A', email: 'a@b.c', locale: 'en' })

    expect(payload).not.toHaveProperty('origin')
    expect(payload).toEqual({ name: 'A', email: 'a@b.c', phone: '', project: '', modelId: '', locale: 'en', rep: '', website: '' })
  })

  it.each(['interiors', 'about'])('accepts %s', (origin) => {
    expect(buildOfferPayload({ name: 'A', email: 'a@b.c', locale: 'el', origin }).origin).toBe(origin)
  })

  it('refuses an origin the server does not know, before anything is sent', () => {
    expect(() => sendOffer({ name: 'A', email: 'a@b.c', locale: 'bg', origin: 'Doors', labels })).toThrow(/unknown origin/)
    expect(posted()).toHaveLength(0)
  })

  it('sends nothing without a name or an email', () => {
    expect(sendOffer({ name: '  ', email: 'a@b.c', locale: 'bg', origin: 'interiors', labels })).toBe(false)
    expect(sendOffer({ name: 'A', email: '', locale: 'bg', origin: 'interiors', labels })).toBe(false)
    expect(posted()).toHaveLength(0)
  })
})
