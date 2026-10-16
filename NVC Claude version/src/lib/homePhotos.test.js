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
  slotAlt,
  slotHeroPhoto,
  slotPhotoOf,
  useHomeFrom,
  useHomePhotos,
  usePagePhoto,
  useSlotPhoto,
  useSlotPhotos,
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

  // 2026-10-16: each API slide goes to ITS position (hero-N is slide N), and the deck keeps all
  // of the defaults' slides. Until then the API's list replaced the whole deck, so filling
  // only hero-5 left ONE slide, labelled and linked as slide 1 (the containers page).
  it('puts each API slide in its own position, keeping that position pathKey and label, and no frame', () => {
    const api = {
      hero: [
        { slot: 'hero-1', url: '/api/img/home/1/x.webp', alt: 'A porch' },
        { slot: 'hero-3', url: '/api/img/home/3/y.webp', alt: '' },
      ],
      models: {},
    }
    const { slides } = mergeHomePhotos(DEFAULTS, api)
    expect(slides).toHaveLength(3)
    expect(slides[0]).toMatchObject({ src: '/api/img/home/1/x.webp', alt: 'A porch', pathKey: 'modularBuilds', label: 'Modular builds' })
    expect(slides[0].frame).toBeUndefined()
    // Position 2 has no photo of the owner's: its default, as the content gives it.
    expect(slides[1]).toEqual({ ...DEFAULTS[1], label: 'Modular houses' })
    // Position 3's photo, and position 3's link and label — not position 2's.
    expect(slides[2]).toMatchObject({ src: '/api/img/home/3/y.webp', alt: '', pathKey: 'steelHouses', label: 'Steel houses' })
  })

  it('filling only hero-5 changes slide 5 and keeps all five slides, links and labels', () => {
    const five = [
      ...DEFAULTS,
      { src: '/api/img/content/d.webp', alt: 'Steel houses', pathKey: 'steelHouses' },
      { src: '/api/img/content/e.webp', alt: 'Interiors', pathKey: 'interiors' },
    ]
    const { slides } = mergeHomePhotos(five, { hero: [{ slot: 'hero-5', url: '/api/img/home/5/kitchen.webp', alt: '' }] })

    expect(slides).toHaveLength(5)
    expect(slides.map((s) => s.src)).toEqual([...five.slice(0, 4).map((s) => s.src), '/api/img/home/5/kitchen.webp'])
    expect(slides.map((s) => s.pathKey)).toEqual(five.map((s) => s.pathKey))
    expect(slides.map((s) => s.label)).toEqual(five.map((s) => s.alt))
    expect(slides[0].frame).toEqual(five[0].frame)
  })

  it('never grows or shrinks the deck: a slot past the defaults is ignored', () => {
    const api = { hero: [1, 2, 3, 4, 5].map((n) => ({ slot: `hero-${n}`, url: `/api/img/home/${n}/p.webp`, alt: '' })) }
    const { slides } = mergeHomePhotos(DEFAULTS.slice(0, 1), api)
    expect(slides).toHaveLength(1)
    expect(slides[0]).toMatchObject({ src: '/api/img/home/1/p.webp', pathKey: 'modularBuilds' })
  })

  it('ignores entries without a url or a slot name, and keeps the first of a repeated slot', () => {
    const api = {
      hero: [
        { slot: 'hero-1', url: '' },
        null,
        { slot: 'hero-2', url: '/api/img/home/2/ok.webp' },
        { url: '/api/img/home/x/no-slot.webp' },
        { slot: 'hero-0', url: '/api/img/home/0/zero.webp' },
        { slot: 'model-37', url: '/api/img/home/6/model.webp' },
        { slot: 'hero-2', url: '/api/img/home/2/second.webp' },
      ],
    }
    const { slides } = mergeHomePhotos(DEFAULTS, api)
    expect(slides.map((s) => s.src)).toEqual([DEFAULTS[0].src, '/api/img/home/2/ok.webp', DEFAULTS[2].src])
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
    partner: { url: '/api/img/home/13/p.webp', alt: 'Units in the yard' },
  },
}

describe('pagePhotoOf', () => {
  it('returns the url and alt of a filled page slot', () => {
    expect(pagePhotoOf(PAGES_BODY, 'modularHouses')).toEqual({ url: '/api/img/cases/3/kariani.webp', alt: 'Paralia Kariani, 58 m²' })
    expect(pagePhotoOf(PAGES_BODY, 'steelHouses')).toEqual({ url: '/api/img/home/11/s.webp', alt: '' })
    expect(pagePhotoOf(PAGES_BODY, 'delivery')).toEqual({ url: '/api/img/home/12/d.webp', alt: 'Crane at the yard' })
    expect(pagePhotoOf(PAGES_BODY, 'partner')).toEqual({ url: '/api/img/home/13/p.webp', alt: 'Units in the yard' })
  })

  it("knows the five page slots the API serves, and the delivery and partner pages' default file", () => {
    // The same keys and order as HomeSlotNames.PageKeys in the API (page-delivery and then
    // page-partner appended 2026-10-15); a key missing here makes usePagePhoto answer null
    // for a filled slot.
    expect(PAGE_KEYS).toEqual(['modularBuilds', 'modularHouses', 'steelHouses', 'delivery', 'partner'])
    expect(PAGE_PHOTO_DEFAULTS.delivery.url).toBe('/delivery/crane-lift-1500.webp')
    expect(PAGE_PHOTO_DEFAULTS.partner.url).toBe('/delivery/crane-lift-1500.webp')
    const file = path.resolve(__dirname, '../../public', PAGE_PHOTO_DEFAULTS.partner.url.slice(1))
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
    // The seeded slide in its own position; the other positions keep their defaults.
    expect(home.result.current.slides.map((s) => s.src)).toEqual(['/api/img/home/1/porch.webp', DEFAULTS[1].src, DEFAULTS[2].src])
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
    expect(second.result.current.slides.map((s) => s.src)).toEqual(['/api/img/home/1/porch.webp', DEFAULTS[1].src, DEFAULTS[2].src])
  })

  it('takes the answer a moment later', async () => {
    const body = { hero: [{ slot: 'hero-2', url: '/api/img/home/2/porch.webp', alt: '' }], models: {} }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))
    const { result } = renderHook(() => useHomePhotos(DEFAULTS))
    expect(result.current.slides[1].src).toBe(DEFAULTS[1].src)
    await waitFor(() => expect(result.current.slides[1].src).toBe('/api/img/home/2/porch.webp'))
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

// The page photos of 2026-10-16: the body's "slots" map, by slot name, only the filled ones.

const SLOTS_BODY = {
  hero: [],
  models: { 37: null, 58: null, 73: null },
  pages: { modularBuilds: null, modularHouses: { url: '/api/img/cases/3/kariani.webp', alt: 'Kariani' }, steelHouses: null, delivery: null, partner: null },
  from: { wagon: null, modular: null },
  slots: {
    'about-hero': { url: '/api/img/home/14/team.webp', alt: 'Екипът пред склада' },
    'about-team-radina-ivanova': { url: '/api/img/home/18/radina.webp', alt: '' },
    'home-tile-interiors': { url: '/api/img/home/29/kitchen.webp' },
  },
}

describe('slotPhotoOf', () => {
  it('returns the url and alt of a filled slot', () => {
    expect(slotPhotoOf(SLOTS_BODY, 'about-hero')).toEqual({ url: '/api/img/home/14/team.webp', alt: 'Екипът пред склада' })
    expect(slotPhotoOf(SLOTS_BODY, 'about-team-radina-ivanova')).toEqual({ url: '/api/img/home/18/radina.webp', alt: '' })
    // An alt the API left out reads as no alt, not "undefined".
    expect(slotPhotoOf(SLOTS_BODY, 'home-tile-interiors')).toEqual({ url: '/api/img/home/29/kitchen.webp', alt: '' })
  })

  it('is null for a slot the map leaves out, which is how the API says "empty"', () => {
    expect(slotPhotoOf(SLOTS_BODY, 'factory-floor')).toBeNull()
    expect(slotPhotoOf({ ...SLOTS_BODY, slots: {} }, 'about-hero')).toBeNull()
  })

  it('is null for a body from before the slots existed: an older API, or an older body kept in <head>', () => {
    const { slots, ...older } = SLOTS_BODY
    expect(slots).toBeTruthy()
    expect(slotPhotoOf(older, 'about-hero')).toBeNull()
    expect(slotPhotoOf({ hero: [], models: {} }, 'about-hero')).toBeNull()
  })

  it('never throws, and is null for anything not of the expected shape', () => {
    const bodies = [
      null, undefined, 'text', 42, [], {},
      { slots: null }, { slots: 'no' }, { slots: [] }, { slots: [{ url: '/x.webp' }] },
      { slots: { 'about-hero': null } }, { slots: { 'about-hero': 'url' } }, { slots: { 'about-hero': { url: '' } } },
      { slots: { 'about-hero': { url: '   ' } } }, { slots: { 'about-hero': { url: 7 } } },
    ]
    for (const body of bodies) expect(slotPhotoOf(body, 'about-hero')).toBeNull()
    for (const name of [undefined, null, '', 42, 'toString', '__proto__', 'constructor']) {
      expect(slotPhotoOf(SLOTS_BODY, name)).toBeNull()
    }
  })
})

describe('slotAlt', () => {
  const admin = { url: '/api/img/home/14/a.webp', alt: '  Екипът пред склада  ' }

  it('is the owner description on the Bulgarian site, and the page general one in English and Greek', () => {
    expect(slotAlt(admin, { locale: 'bg', adminAlt: 'The NVC team' })).toBe('Екипът пред склада')
    expect(slotAlt(admin, { locale: 'en', adminAlt: 'The NVC team' })).toBe('The NVC team')
    expect(slotAlt(admin, { locale: 'el', adminAlt: 'Η ομάδα της NVC' })).toBe('Η ομάδα της NVC')
  })

  it('falls back to the general description when the owner left it empty', () => {
    expect(slotAlt({ url: '/x.webp', alt: '' }, { locale: 'bg', adminAlt: 'Екипът на NVC' })).toBe('Екипът на NVC')
    expect(slotAlt({ url: '/x.webp', alt: '   ' }, { locale: 'bg', adminAlt: 'Екипът на NVC' })).toBe('Екипът на NVC')
    expect(slotAlt({ url: '/x.webp' }, { locale: 'bg' })).toBe('')
  })

  it('is empty for a decorative picture, whatever was typed', () => {
    expect(slotAlt(admin, { locale: 'bg', adminAlt: 'x', decorative: true })).toBe('')
  })
})

describe('slotHeroPhoto', () => {
  const DEFAULT_PHOTO = { url: '/delivery/crane-lift-1500.webp', srcSet: '/delivery/crane-lift-800.webp 800w', alt: 'Кран', caption: 'Chip', position: '30% 50%' }

  it('is the page photo object itself, untouched, while the slot is empty', () => {
    expect(slotHeroPhoto(null, DEFAULT_PHOTO, { locale: 'bg' })).toBe(DEFAULT_PHOTO)
    expect(slotHeroPhoto(undefined, DEFAULT_PHOTO, { locale: 'bg' })).toBe(DEFAULT_PHOTO)
    expect(slotHeroPhoto({ url: '' }, DEFAULT_PHOTO, { locale: 'bg' })).toBe(DEFAULT_PHOTO)
  })

  it("is the owner's photo once filled: its alt by slotAlt, the default as the fallback, the admin caption, no crop and no srcSet", () => {
    const admin = { url: '/api/img/home/14/a.webp', alt: 'Екипът' }
    expect(slotHeroPhoto(admin, DEFAULT_PHOTO, { locale: 'bg', adminAlt: 'NVC', adminCaption: 'Наш монтаж' })).toEqual({
      url: '/api/img/home/14/a.webp',
      alt: 'Екипът',
      fallback: '/delivery/crane-lift-1500.webp',
      caption: 'Наш монтаж',
    })
    const en = slotHeroPhoto(admin, DEFAULT_PHOTO, { locale: 'en', adminAlt: 'The NVC team' })
    expect(en.alt).toBe('The NVC team')
    // No admin caption: no chip, since the default's chip names the default photo.
    expect(en.caption).toBeUndefined()
    expect(en.position).toBeUndefined()
    expect(en.srcSet).toBeUndefined()
  })
})

describe('useSlotPhotos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const answer = (body, ok = true) => vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 503, json: () => Promise.resolve(body) })
  const NAMES = ['about-hero', 'factory-floor']

  it('is undefined while the first answer is on its way, then each slot: the photo, or null when empty', async () => {
    vi.stubGlobal('fetch', answer(SLOTS_BODY))
    const { result } = renderHook(() => useSlotPhotos(NAMES))

    expect(result.current).toEqual({ 'about-hero': undefined, 'factory-floor': undefined })
    await waitFor(() => expect(result.current['about-hero']).toEqual({ url: '/api/img/home/14/team.webp', alt: 'Екипът пред склада' }))
    expect(result.current['factory-floor']).toBeNull()
  })

  it('settles to null for every slot when the API fails with nothing kept, and for an API without slots', async () => {
    vi.stubGlobal('fetch', answer({}, false))
    const failed = renderHook(() => useSlotPhotos(NAMES))
    await waitFor(() => expect(failed.result.current['about-hero']).toBeNull())
    expect(failed.result.current['factory-floor']).toBeNull()

    forgetHomePhotos()
    const { slots, ...older } = SLOTS_BODY
    expect(slots).toBeTruthy()
    vi.stubGlobal('fetch', answer(older))
    const old = renderHook(() => useSlotPhotos(NAMES))
    await waitFor(() => expect(old.result.current['about-hero']).toBeNull())
  })

  it('keeps the photo on screen when a refresh fails', async () => {
    vi.stubGlobal('fetch', answer(SLOTS_BODY))
    await loadHomePhotos()

    vi.stubGlobal('fetch', answer({}, false))
    const { result } = renderHook(() => useSlotPhoto('about-hero'))
    expect(result.current?.url).toBe('/api/img/home/14/team.webp')
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    await loadHomePhotos()
    expect(result.current?.url).toBe('/api/img/home/14/team.webp')
  })

  it('follows a body another hook fetched, so a page never shows two answers', async () => {
    vi.stubGlobal('fetch', answer(SLOTS_BODY))
    const { result } = renderHook(() => useSlotPhoto('about-hero'))
    await waitFor(() => expect(result.current?.url).toBe('/api/img/home/14/team.webp'))

    // The owner cleared it; the next answer (fetched by some other hook) says so.
    vi.stubGlobal('fetch', answer({ ...SLOTS_BODY, slots: {} }))
    await fetchHomePhotos()
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('asks nothing for no names', () => {
    vi.stubGlobal('fetch', vi.fn())
    const { result } = renderHook(() => useSlotPhotos([]))
    expect(result.current).toEqual({})
    expect(fetch).not.toHaveBeenCalled()
  })

  it('writes the answer into <head>, so the snapshot of a page that only reads slots carries them', async () => {
    vi.stubGlobal('fetch', answer(SLOTS_BODY))
    const { result } = renderHook(() => useSlotPhoto('about-hero'))
    await waitFor(() => expect(result.current?.url).toBe('/api/img/home/14/team.webp'))

    const seed = document.getElementById(HOME_PHOTOS_SEED_ID)
    expect(seed?.parentNode).toBe(document.head)
    expect(JSON.parse(seed.textContent).slots['about-hero'].url).toBe('/api/img/home/14/team.webp')
  })

  it("paints the seeded owner's photo in the first render of a prerendered load", async () => {
    const el = document.createElement('script')
    el.type = 'application/json'
    el.id = HOME_PHOTOS_SEED_ID
    el.textContent = JSON.stringify(SLOTS_BODY)
    document.head.appendChild(el)
    vi.resetModules()
    const fresh = await import('./homePhotos.js')
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const { result } = renderHook(() => fresh.useSlotPhotos(NAMES))
    expect(result.current['about-hero']).toEqual({ url: '/api/img/home/14/team.webp', alt: 'Екипът пред склада' })
    expect(result.current['factory-floor']).toBeNull()
    // The refresh still goes out.
    expect(fetch).toHaveBeenCalledTimes(1)
    fresh.forgetHomePhotos()
  })
})

describe('one request per page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('the home page hooks (slides and models, tiles, a page photo, the "from" figure) share a single call', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SLOTS_BODY) }))
    const { result } = renderHook(() => ({
      home: useHomePhotos(DEFAULTS),
      tiles: useSlotPhotos(['home-tile-interiors', 'home-tile-modular-builds']),
      page: usePagePhoto('modularHouses'),
      from: useHomeFrom(),
    }))

    await waitFor(() => expect(result.current.tiles['home-tile-interiors']?.url).toBe('/api/img/home/29/kitchen.webp'))
    await waitFor(() => expect(result.current.page?.url).toBe('/api/img/cases/3/kariani.webp'))
    expect(result.current.tiles['home-tile-modular-builds']).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(1)
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
