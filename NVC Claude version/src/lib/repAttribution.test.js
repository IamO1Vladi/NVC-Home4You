import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  REP_KEY,
  REP_TTL_MS,
  isValidRepSlug,
  saveRep,
  loadRep,
  clearRep,
} from './repAttribution.js'

describe('repAttribution', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('accepts the slugs the server registry would and rejects the rest', () => {
    expect(isValidRepSlug('dtodorov')).toBe(true)
    expect(isValidRepSlug('DTodorov')).toBe(true)
    expect(isValidRepSlug('d.todorov_2-x')).toBe(true)
    expect(isValidRepSlug('a')).toBe(false)
    expect(isValidRepSlug('-leading')).toBe(false)
    expect(isValidRepSlug('not a slug!')).toBe(false)
    expect(isValidRepSlug('x'.repeat(41))).toBe(false)
    expect(isValidRepSlug('')).toBe(false)
    expect(isValidRepSlug(undefined)).toBe(false)
    expect(isValidRepSlug(42)).toBe(false)
  })

  it('round-trips the slug, lower-cased', () => {
    saveRep('DTodorov')
    expect(loadRep()).toBe('dtodorov')
    const stored = JSON.parse(window.localStorage.getItem(REP_KEY))
    expect(stored.slug).toBe('dtodorov')
    expect(typeof stored.savedAt).toBe('number')
  })

  it('last touch wins', () => {
    saveRep('first')
    saveRep('second')
    expect(loadRep()).toBe('second')
  })

  it('stores nothing for a slug that would never be registered', () => {
    saveRep('not a slug!')
    expect(window.localStorage.getItem(REP_KEY)).toBeNull()
    expect(loadRep()).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(loadRep()).toBeNull()
  })

  it('returns null on corrupted stored JSON', () => {
    window.localStorage.setItem(REP_KEY, '{not json')
    expect(loadRep()).toBeNull()
  })

  it('returns null when the stored slug is not a slug', () => {
    window.localStorage.setItem(REP_KEY, JSON.stringify({ slug: 'bad slug', savedAt: Date.now() }))
    expect(loadRep()).toBeNull()
    window.localStorage.setItem(REP_KEY, JSON.stringify({ slug: 42, savedAt: Date.now() }))
    expect(loadRep()).toBeNull()
    window.localStorage.setItem(REP_KEY, JSON.stringify('dtodorov'))
    expect(loadRep()).toBeNull()
  })

  it('returns null when the stored value has no timestamp', () => {
    window.localStorage.setItem(REP_KEY, JSON.stringify({ slug: 'dtodorov' }))
    expect(loadRep()).toBeNull()
  })

  it('ignores a visit older than the TTL', () => {
    const stale = { slug: 'dtodorov', savedAt: Date.now() - REP_TTL_MS - 1000 }
    window.localStorage.setItem(REP_KEY, JSON.stringify(stale))
    expect(loadRep()).toBeNull()
  })

  it('still attributes a visit just inside the TTL', () => {
    const fresh = { slug: 'dtodorov', savedAt: Date.now() - REP_TTL_MS + 60_000 }
    window.localStorage.setItem(REP_KEY, JSON.stringify(fresh))
    expect(loadRep()).toBe('dtodorov')
  })

  it('clears the remembered slug', () => {
    saveRep('dtodorov')
    clearRep()
    expect(loadRep()).toBeNull()
  })

  it('does not throw when localStorage is unavailable', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveRep('dtodorov')).not.toThrow()
    setSpy.mockRestore()

    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(loadRep()).toBeNull()
    getSpy.mockRestore()

    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => clearRep()).not.toThrow()
    removeSpy.mockRestore()
  })
})
