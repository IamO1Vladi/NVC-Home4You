import { describe, it, expect } from 'vitest'
import {
  SHARE_HASH_KEY,
  encodeConfig,
  decodeConfig,
  buildShareUrl,
  readSharedConfigFromHash,
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
