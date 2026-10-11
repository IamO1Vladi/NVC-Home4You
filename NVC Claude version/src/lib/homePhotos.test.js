import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHomePhotos, mergeHomePhotos } from './homePhotos.js'

// The merge decides what the hero and the model cards show; the failure paths decide that a
// missing table, a dead API or a malformed body never reach the page as anything but the
// content defaults.

const DEFAULTS = [
  { src: '/api/img/content/a.webp', alt: 'Modular builds', pathKey: 'modularBuilds', frame: { position: '30% 50%', scale: 1.22 } },
  { src: '/api/img/content/b.webp', alt: 'Modular houses', pathKey: 'modularHouses' },
  { src: '/api/img/content/c.webp', alt: 'Steel houses', pathKey: 'steelHouses' },
]

describe('mergeHomePhotos', () => {
  it('returns the defaults and empty models when the API gave nothing', () => {
    const { slides, models } = mergeHomePhotos(DEFAULTS, null)
    expect(slides.map((s) => s.src)).toEqual(DEFAULTS.map((s) => s.src))
    expect(slides[0].frame).toEqual({ position: '30% 50%', scale: 1.22 })
    expect(slides[0].label).toBe('Modular builds')
    expect(models).toEqual({ 37: null, 58: null, 73: null })
  })

  it('keeps the defaults when the API hero list is empty', () => {
    const { slides } = mergeHomePhotos(DEFAULTS, { hero: [], models: { 37: null, 58: null, 73: null } })
    expect(slides.map((s) => s.src)).toEqual(DEFAULTS.map((s) => s.src))
  })

  it('uses the API hero slides, taking each default pathKey by position and no frame', () => {
    const api = {
      hero: [
        { slot: 'hero-1', url: '/api/img/home/1/x.webp', alt: 'A porch' },
        { slot: 'hero-3', url: '/api/img/home/3/y.webp', alt: '' },
      ],
      models: {},
    }
    const { slides } = mergeHomePhotos(DEFAULTS, api)
    expect(slides).toHaveLength(2)
    expect(slides[0]).toMatchObject({ src: '/api/img/home/1/x.webp', alt: 'A porch', pathKey: 'modularBuilds', label: 'Modular builds' })
    expect(slides[0].frame).toBeUndefined()
    expect(slides[1]).toMatchObject({ src: '/api/img/home/3/y.webp', alt: '', pathKey: 'modularHouses' })
  })

  it('falls back to modularBuilds when the API has more slides than there are defaults', () => {
    const api = { hero: [1, 2, 3, 4, 5].map((n) => ({ slot: `hero-${n}`, url: `/api/img/home/${n}/p.webp`, alt: '' })) }
    const { slides } = mergeHomePhotos(DEFAULTS.slice(0, 1), api)
    expect(slides).toHaveLength(5)
    expect(slides[4].pathKey).toBe('modularBuilds')
  })

  it('drops hero entries without a url', () => {
    const api = { hero: [{ slot: 'hero-1', url: '' }, null, { slot: 'hero-2', url: '/api/img/home/2/ok.webp' }] }
    const { slides } = mergeHomePhotos(DEFAULTS, api)
    expect(slides.map((s) => s.src)).toEqual(['/api/img/home/2/ok.webp'])
  })

  it('maps the model slots to a url or null', () => {
    const api = { hero: [], models: { 37: null, 58: { url: '/api/img/gallery/8/m.webp', alt: '' }, 73: { url: '' } } }
    const { models } = mergeHomePhotos(DEFAULTS, api)
    expect(models).toEqual({ 37: null, 58: '/api/img/gallery/8/m.webp', 73: null })
  })

  it('survives a malformed body', () => {
    for (const body of [{}, { hero: 'no', models: 'no' }, { hero: {}, models: [] }, 'text', 42]) {
      const { slides, models } = mergeHomePhotos(DEFAULTS, body)
      expect(slides).toHaveLength(DEFAULTS.length)
      expect(models).toEqual({ 37: null, 58: null, 73: null })
    }
  })
})

describe('fetchHomePhotos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns the parsed body on success', async () => {
    const body = { hero: [], models: { 37: null, 58: null, 73: null } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))
    await expect(fetchHomePhotos()).resolves.toEqual(body)
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/home/photos'), expect.anything())
  })

  it('returns null on a 404 (the table is not there yet)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) }))
    await expect(fetchHomePhotos()).resolves.toBeNull()
  })

  it('returns null when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(fetchHomePhotos()).resolves.toBeNull()
  })

  it('returns null when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new SyntaxError('bad json')) }))
    await expect(fetchHomePhotos()).resolves.toBeNull()
  })

  it('returns null for a body that is not an object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve('nope') }))
    await expect(fetchHomePhotos()).resolves.toBeNull()
  })

  it('aborts after 4 s and returns null', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const pending = fetchHomePhotos()
    await vi.advanceTimersByTimeAsync(4000)
    await expect(pending).resolves.toBeNull()
  })

  it('honours the caller abort signal', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })))
    const controller = new AbortController()
    const pending = fetchHomePhotos(controller.signal)
    controller.abort()
    await expect(pending).resolves.toBeNull()
  })
})
