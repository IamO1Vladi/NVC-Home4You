import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  SHARE_HASH_KEY,
  encodeConfig,
  decodeConfig,
  buildShareUrl,
  readSharedConfigFromHash,
  readShortCodeFromSearch,
  createShortLink,
  resolveShortLink,
} from './configShare.js'

const sample = {
  model: '52',
  variant: 'balcony',
  heating: true,
  windows: [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }],
  kitchenExtras: { furnace: true, washingMachine: false, dishwasherCabinet: false },
  windowNotes: 'North wall, please',
  insideDoorCount: 2,
}

describe('configShare', () => {
  it('round-trips a config through encode/decode', () => {
    const decoded = decodeConfig(encodeConfig(sample))
    expect(decoded).toEqual(sample)
  })

  it('produces a URL-safe token (no chars needing escaping in a hash)', () => {
    const token = encodeConfig(sample)
    expect(token).toBeTruthy()
    expect(token).toMatch(/^[A-Za-z0-9+\-$]+$/)
  })

  it('builds a share URL carrying the config in the hash', () => {
    const url = buildShareUrl(sample, { origin: 'https://nvc-home4you.eu', pathname: '/en/box-house-configurator' })
    expect(url.startsWith('https://nvc-home4you.eu/en/box-house-configurator#' + SHARE_HASH_KEY + '=')).toBe(true)
  })

  it('reads the shared config back from a full round-trip URL hash', () => {
    const url = buildShareUrl(sample, { origin: 'https://x.eu', pathname: '/p' })
    const hash = url.slice(url.indexOf('#'))
    expect(readSharedConfigFromHash(hash)).toEqual(sample)
  })

  it('finds the cfg segment when the hash has other fragments too', () => {
    const token = encodeConfig(sample)
    expect(readSharedConfigFromHash(`#foo=bar&${SHARE_HASH_KEY}=${token}`)).toEqual(sample)
    expect(readSharedConfigFromHash(`${SHARE_HASH_KEY}=${token}`)).toEqual(sample) // no leading '#'
  })

  it('returns null for empty, missing, or garbage input', () => {
    expect(readSharedConfigFromHash('')).toBeNull()
    expect(readSharedConfigFromHash('#other=1')).toBeNull()
    expect(readSharedConfigFromHash(`#${SHARE_HASH_KEY}=not-valid-lz`)).toBeNull()
    expect(decodeConfig('')).toBeNull()
    expect(decodeConfig(null)).toBeNull()
  })

  it('rejects a non-object payload (array/primitive)', () => {
    expect(decodeConfig(encodeConfig([1, 2, 3]))).toBeNull()
    expect(decodeConfig(encodeConfig('just a string'))).toBeNull()
  })
})

describe('configShare short links', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads a valid short code from a query string', () => {
    expect(readShortCodeFromSearch('?c=Ab3xK9pQ')).toBe('Ab3xK9pQ')
    expect(readShortCodeFromSearch('?foo=1&c=abcd1234&bar=2')).toBe('abcd1234')
  })

  it('rejects missing or malformed short codes', () => {
    expect(readShortCodeFromSearch('')).toBeNull()
    expect(readShortCodeFromSearch('?x=1')).toBeNull()
    expect(readShortCodeFromSearch('?c=has space')).toBeNull()
    expect(readShortCodeFromSearch('?c=too$hort!')).toBeNull()
    expect(readShortCodeFromSearch('?c=ab')).toBeNull() // below min length
  })

  it('createShortLink posts the config and returns the server url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ab3xK9pQ', url: 'https://nvc-home4you.eu/c/Ab3xK9pQ' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const url = await createShortLink(sample, {
      apiBase: '',
      returnPath: '/en/box-house-configurator',
      modelLabel: 'Box 52',
      locale: 'en',
    })

    expect(url).toBe('https://nvc-home4you.eu/c/Ab3xK9pQ')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [endpoint, opts] = fetchMock.mock.calls[0]
    expect(endpoint).toBe('/api/config-link')
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.config).toEqual(sample)
    expect(body.returnPath).toBe('/en/box-house-configurator')
    expect(body.modelLabel).toBe('Box 52')
    expect(body.locale).toBe('en')
  })

  it('createShortLink returns null when the API fails, so callers can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    expect(await createShortLink(sample, {})).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await createShortLink(sample, {})).toBeNull()
  })

  it('resolveShortLink returns the stored config object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ config: sample, modelLabel: 'Box 52', locale: 'en' }),
    }))
    expect(await resolveShortLink('Ab3xK9pQ', { apiBase: '' })).toEqual(sample)
  })

  it('resolveShortLink returns null on 404 / network error / bad payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }))
    expect(await resolveShortLink('missing', {})).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await resolveShortLink('Ab3xK9pQ', {})).toBeNull()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ config: [1, 2, 3] }) }))
    expect(await resolveShortLink('Ab3xK9pQ', {})).toBeNull()
  })
})
