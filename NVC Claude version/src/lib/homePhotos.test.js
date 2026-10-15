import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderHook, waitFor } from '@testing-library/react'
import {
  HOME_PHOTOS_SEED_ID,
  PAGE_KEYS,
  PAGE_PHOTO_DEFAULTS,
  fetchHomePhotos,
  forgetHomePhotos,
  homeFromOf,
  loadHomePhotos,
  mergeHomePhotos,
  pagePhotoOf,
  useHomeFrom,
  useHomePhotos,
  usePagePhoto,
} from './homePhotos.js'

// The merge decides what the hero and the model cards show; the failure paths decide that a
// missing table, a dead API or a malformed body never reach the page as anything but the
// content defaults.

// Every test starts as a first visit: no body kept from an earlier one, no copy in <head>.
afterEach(() => {
  forgetHomePhotos()
})

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

// The product pages' main photos: the same body, its "pages" object, one { url, alt } per
// route key. Every failure is null, and null is the page's cue to show its own default.

const PAGES_BODY = {
  hero: [],
  models: { 37: null, 58: null, 73: null },
  pages: {
    modularBuilds: null,
    modularHouses: { url: '/api/img/cases/3/kariani.webp', alt: 'Paralia Kariani, 58 m²' },
    steelHouses: { url: '/api/img/home/11/s.webp' },
    delivery: { url: '/api/img/home/12/d.webp', alt: 'Crane at the yard' },
  },
}

describe('pagePhotoOf', () => {
  it('returns the url and alt of a filled page slot', () => {
    expect(pagePhotoOf(PAGES_BODY, 'modularHouses')).toEqual({ url: '/api/img/cases/3/kariani.webp', alt: 'Paralia Kariani, 58 m²' })
    expect(pagePhotoOf(PAGES_BODY, 'steelHouses')).toEqual({ url: '/api/img/home/11/s.webp', alt: '' })
    expect(pagePhotoOf(PAGES_BODY, 'delivery')).toEqual({ url: '/api/img/home/12/d.webp', alt: 'Crane at the yard' })
  })

  it("knows the four page slots the API serves, and the delivery page's default file", () => {
    // The same keys and order as HomeSlotNames.PageKeys in the API (page-delivery appended
    // 2026-10-15); a key missing here makes usePagePhoto answer null for a filled slot.
    expect(PAGE_KEYS).toEqual(['modularBuilds', 'modularHouses', 'steelHouses', 'delivery'])
    expect(PAGE_PHOTO_DEFAULTS.delivery.url).toBe('/delivery/crane-lift-1500.webp')
    const file = path.resolve(__dirname, '../../public', PAGE_PHOTO_DEFAULTS.delivery.url.slice(1))
    expect(fs.existsSync(file)).toBe(true)
  })

  it('is null for an empty slot, an unknown key, or a body without pages', () => {
    expect(pagePhotoOf(PAGES_BODY, 'modularBuilds')).toBeNull()
    expect(pagePhotoOf(PAGES_BODY, 'gallery')).toBeNull()
    expect(pagePhotoOf(PAGES_BODY, undefined)).toBeNull()
    // An API from before the pages existed answers without the key at all.
    expect(pagePhotoOf({ hero: [], models: {} }, 'modularHouses')).toBeNull()
    for (const body of [null, {}, { pages: 'no' }, { pages: { modularHouses: { url: '' } } }, 'text', 42]) {
      expect(pagePhotoOf(body, 'modularHouses')).toBeNull()
    }
  })
})

describe('loadHomePhotos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one open request between callers, and fetches afresh once it has settled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(PAGES_BODY) }))

    const [a, b] = await Promise.all([loadHomePhotos(), loadHomePhotos()])
    expect(a).toEqual(PAGES_BODY)
    expect(b).toBe(a)
    expect(fetch).toHaveBeenCalledTimes(1)

    await loadHomePhotos()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('usePagePhoto', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const answer = (body, ok = true) => vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) })

  it('is undefined while the first answer is on its way, then the page slot once it lands', async () => {
    vi.stubGlobal('fetch', answer(PAGES_BODY))
    const { result } = renderHook(() => usePagePhoto('modularHouses'))

    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toEqual({ url: '/api/img/cases/3/kariani.webp', alt: 'Paralia Kariani, 58 m²' }))
  })

  it('stays null for an empty slot and when the API fails', async () => {
    vi.stubGlobal('fetch', answer(PAGES_BODY))
    const empty = renderHook(() => usePagePhoto('modularBuilds'))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await loadHomePhotos()
    expect(empty.result.current).toBeNull()

    // A visit with nothing kept: the failure settles to null rather than staying undefined.
    forgetHomePhotos()
    vi.stubGlobal('fetch', answer({}, false))
    const failed = renderHook(() => usePagePhoto('steelHouses'))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await loadHomePhotos()
    expect(failed.result.current).toBeNull()
  })

  it('does not fetch at all for a key that is not a product page', () => {
    vi.stubGlobal('fetch', vi.fn())
    const { result } = renderHook(() => usePagePhoto('gallery'))
    expect(result.current).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never shows the previous page photo after the key changes', async () => {
    vi.stubGlobal('fetch', answer(PAGES_BODY))
    const { result, rerender } = renderHook(({ pageKey }) => usePagePhoto(pageKey), { initialProps: { pageKey: 'modularHouses' } })
    await waitFor(() => expect(result.current?.url).toBe('/api/img/cases/3/kariani.webp'))

    rerender({ pageKey: 'steelHouses' })
    // Straight after the switch, before the next answer: the steel slot of the same body,
    // never the houses photo.
    expect(result.current).toEqual({ url: '/api/img/home/11/s.webp', alt: '' })
  })

  it('answers at once, before any fetch lands, once a body has been kept', async () => {
    vi.stubGlobal('fetch', answer(PAGES_BODY))
    await loadHomePhotos()

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { result } = renderHook(() => usePagePhoto('modularHouses'))
    expect(result.current).toEqual({ url: '/api/img/cases/3/kariani.webp', alt: 'Paralia Kariani, 58 m²' })
    // The refresh still goes out.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the kept photo when the refresh fails, and takes a fresh answer when it does not', async () => {
    vi.stubGlobal('fetch', answer(PAGES_BODY))
    await loadHomePhotos()

    vi.stubGlobal('fetch', answer({}, false))
    const failed = renderHook(() => usePagePhoto('modularHouses'))
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await loadHomePhotos()
    expect(failed.result.current?.url).toBe('/api/img/cases/3/kariani.webp')

    // The owner has cleared the slot since: the next answer says so, and the page goes back
    // to its default.
    vi.stubGlobal('fetch', answer({ ...PAGES_BODY, pages: { ...PAGES_BODY.pages, modularHouses: null } }))
    const cleared = renderHook(() => usePagePhoto('modularHouses'))
    expect(cleared.result.current?.url).toBe('/api/img/cases/3/kariani.webp')
    await waitFor(() => expect(cleared.result.current).toBeNull())
  })
})

// The snapshot carries the last answer in <head>, so the first render of the next load has it.

describe('the copy in <head>', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const seed = () => document.getElementById(HOME_PHOTOS_SEED_ID)
  const plant = (text) => {
    const el = document.createElement('script')
    el.type = 'application/json'
    el.id = HOME_PHOTOS_SEED_ID
    el.textContent = text
    document.head.appendChild(el)
  }

  it('is written when a body arrives, once, and replaced by the next one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(PAGES_BODY) }))
    await fetchHomePhotos()
    expect(seed()).not.toBeNull()
    expect(seed().parentNode).toBe(document.head)
    expect(seed().getAttribute('type')).toBe('application/json')
    expect(JSON.parse(seed().textContent)).toEqual(PAGES_BODY)

    const next = { hero: [], models: {}, pages: { modularBuilds: { url: '/api/img/home/b.webp', alt: '' } } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(next) }))
    await fetchHomePhotos()
    expect(document.querySelectorAll(`#${HOME_PHOTOS_SEED_ID}`)).toHaveLength(1)
    expect(JSON.parse(seed().textContent)).toEqual(next)
  })

  it('is left alone by a failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(PAGES_BODY) }))
    await fetchHomePhotos()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await fetchHomePhotos()
    expect(JSON.parse(seed().textContent)).toEqual(PAGES_BODY)
  })

  it('escapes "<" so an alt cannot close the script, and still reads back the same', async () => {
    const body = { hero: [], models: {}, pages: { steelHouses: { url: '/api/img/home/s.webp', alt: 'a </script><b>x' } } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))
    await fetchHomePhotos()
    expect(seed().textContent).not.toContain('<')
    expect(seed().textContent).toContain(String.fromCharCode(92) + 'u003c/script>')
    expect(JSON.parse(seed().textContent)).toEqual(body)
  })

  it('seeds the first render of a fresh load, for the product pages and for home', async () => {
    plant(JSON.stringify({ hero: [{ slot: 'hero-1', url: '/api/img/home/1/porch.webp', alt: 'A porch' }], models: {}, pages: PAGES_BODY.pages }))
    vi.resetModules()
    const fresh = await import('./homePhotos.js')
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const page = renderHook(() => fresh.usePagePhoto('modularHouses'))
    expect(page.result.current?.url).toBe('/api/img/cases/3/kariani.webp')
    const empty = renderHook(() => fresh.usePagePhoto('modularBuilds'))
    expect(empty.result.current).toBeNull()

    const home = renderHook(() => fresh.useHomePhotos(DEFAULTS))
    expect(home.result.current.slides.map((s) => s.src)).toEqual(['/api/img/home/1/porch.webp'])
    fresh.forgetHomePhotos()
  })

  it('is ignored when it is not JSON', async () => {
    plant('{nope')
    vi.resetModules()
    const fresh = await import('./homePhotos.js')
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const page = renderHook(() => fresh.usePagePhoto('modularHouses'))
    expect(page.result.current).toBeUndefined()
    fresh.forgetHomePhotos()
  })
})

describe('useHomePhotos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts from the defaults on a first visit, and from the kept body once there is one', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const first = renderHook(() => useHomePhotos(DEFAULTS))
    expect(first.result.current.slides.map((s) => s.src)).toEqual(DEFAULTS.map((s) => s.src))
    first.unmount()

    const body = { hero: [{ slot: 'hero-1', url: '/api/img/home/1/porch.webp', alt: 'A porch' }], models: {} }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))
    await fetchHomePhotos()

    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const second = renderHook(() => useHomePhotos(DEFAULTS))
    expect(second.result.current.slides.map((s) => s.src)).toEqual(['/api/img/home/1/porch.webp'])
  })
})

describe('homeFromOf', () => {
  it('reads the gallery figures the API sends beside the photos', () => {
    expect(homeFromOf({ hero: [], from: { wagon: 4300, modular: 10500 } })).toEqual({ wagon: 4300, modular: 10500 })
    // A decimal can arrive as a string from a serializer set to keep precision.
    expect(homeFromOf({ from: { wagon: '4300', modular: null } })).toEqual({ wagon: 4300, modular: null })
  })

  it('is unknown, never zero, for an older API, a failure or a body of the wrong shape', () => {
    const unknown = { wagon: null, modular: null }
    for (const body of [null, undefined, {}, { from: null }, { from: 'cheap' }, { from: { wagon: 0 } }, { from: { wagon: -5 } }, { from: { wagon: 'abc' } }, { from: { wagon: '' } }, 'text', 42]) {
      expect(homeFromOf(body)).toEqual(unknown)
    }
  })
})

describe('useHomeFrom', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const answer = (body) => vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) })

  it('starts no request of its own and takes the figure from the body the photos fetch brings', async () => {
    vi.stubGlobal('fetch', answer({ hero: [], models: {}, from: { wagon: 4300, modular: 10500 } }))
    const { result } = renderHook(() => useHomeFrom())

    expect(result.current).toEqual({ wagon: null, modular: null })
    expect(fetch).not.toHaveBeenCalled()

    await fetchHomePhotos()
    await waitFor(() => expect(result.current.wagon).toBe(4300))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the figure on screen when a later fetch fails', async () => {
    vi.stubGlobal('fetch', answer({ from: { wagon: 4300, modular: null } }))
    const { result } = renderHook(() => useHomeFrom())
    await fetchHomePhotos()
    await waitFor(() => expect(result.current.wagon).toBe(4300))

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await fetchHomePhotos()
    expect(result.current.wagon).toBe(4300)
  })

  it('follows a newer body, and drops to unknown when the API stops sending a figure', async () => {
    vi.stubGlobal('fetch', answer({ from: { wagon: 4300, modular: null } }))
    const { result } = renderHook(() => useHomeFrom())
    await fetchHomePhotos()
    await waitFor(() => expect(result.current.wagon).toBe(4300))

    vi.stubGlobal('fetch', answer({ from: { wagon: 3900, modular: null } }))
    await fetchHomePhotos()
    await waitFor(() => expect(result.current.wagon).toBe(3900))

    vi.stubGlobal('fetch', answer({ hero: [], models: {} }))
    await fetchHomePhotos()
    await waitFor(() => expect(result.current.wagon).toBeNull())
  })

  it('paints the seeded figure on the first render of a prerendered load', async () => {
    const el = document.createElement('script')
    el.type = 'application/json'
    el.id = HOME_PHOTOS_SEED_ID
    el.textContent = JSON.stringify({ hero: [], models: {}, from: { wagon: 4300, modular: 10500 } })
    document.head.appendChild(el)
    vi.resetModules()
    const fresh = await import('./homePhotos.js')

    const { result } = renderHook(() => fresh.useHomeFrom())
    expect(result.current).toEqual({ wagon: 4300, modular: 10500 })
    fresh.forgetHomePhotos()
  })
})
