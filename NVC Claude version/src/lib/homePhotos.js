// The admin-managed photos: the home page's five hero slides and three model cards, and the
// main photo of each of the three product pages and of the delivery and partner pages. The same answer also carries "from", the
// gallery's cheapest published price per category, which the home hero quotes (useHomeFrom):
// it rides on this call so the figure costs no request of its own and is seeded and kept
// exactly as the photos are.
//
// The admin panel fills eight home slots (hero-1..hero-5, model-37/58/73) and five page
// slots (page-modular-builds/-houses, page-steel-houses, page-delivery, page-partner) that the
// API serves anonymously at /api/home/photos — the pages under "pages", keyed by the same route
// keys as paths.js (modularBuilds, modularHouses, steelHouses, delivery, partner). A page fetches them AFTER first paint and merges them
// over the content files' defaults, so every failure path (network down, 404 while the
// migration is not yet applied, an empty table, a malformed body) shows the default
// photographs and nothing else. Nothing here throws; a failure is `null`, and
// mergeHomePhotos(defaults, null) is the defaults unchanged.
//
// Since 2026-10-16 the same body also carries "slots": the page photos of kind "photo" (About's
// main photo, team and factory floor, the Interiors and doors photos, the home tiles; names in
// photoSlotNames.js), keyed by slot name, and ONLY the filled ones. A page reads them with
// useSlotPhotos / useSlotPhoto; a missing name, an empty map and a body without "slots" at all
// (an older API, or an older body kept in a snapshot's <head>) all mean "show today's photo".
//
// THE ANSWER IS WRITTEN INTO <head> SO THE NEXT LOAD STARTS WITH IT. The app mounts with
// createRoot over the prerendered snapshot, not hydrate, so whatever the snapshot drew is
// thrown away and the first client render is all that counts. If that render had to wait for
// the API, a page whose owner has set a photo would paint the default (or, on the steel page,
// no photo) and then swap it, and the steel hero would reflow. So every body that arrives is
// also kept in <script type="application/json" id="home-photos-data">: the prerender saves
// documentElement.outerHTML, the script goes out inside every snapshot, and this module reads
// it back on load, so the very first render already has the owner's photos. The live fetch
// still runs on every load and replaces it. A snapshot older than the owner's last change
// shows the old photo until that fetch lands, which is the staleness home already accepts.
//
// The fetch has a 4 s cap because the prerender waits on every open /api call: a stalled
// Blob store must not stall the snapshot, and a visitor with a slow link gets the defaults
// rather than a hero that never settles.
import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''
export const HOME_PHOTOS_URL = `${API_BASE}/api/home/photos`
export const HOME_PHOTOS_TIMEOUT_MS = 4000

export const MODEL_KEYS = ['37', '58', '73']
export const PAGE_KEYS = ['modularBuilds', 'modularHouses', 'steelHouses', 'delivery', 'partner']

// What a page slot shows while it is empty, for the pages whose default is not a content
// photo of its own: the delivery page's crane lifting a unit off the truck, which the partner
// page borrows until the owner uploads a photo of the yard. The alt text is words, so it stays
// in the page's content; this is only where the file is.
export const PAGE_PHOTO_DEFAULTS = {
  delivery: { url: '/delivery/crane-lift-1500.webp', width: 1500, height: 1125 },
  partner: { url: '/delivery/crane-lift-1500.webp', width: 1500, height: 1125 },
}

/** The API body, or null on any failure. Never throws. */
export async function fetchHomePhotos(signal) {
  if (typeof fetch !== 'function') return null
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), HOME_PHOTOS_TIMEOUT_MS)
  const onAbort = () => controller?.abort()
  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener?.('abort', onAbort)
  }
  try {
    const response = await fetch(HOME_PHOTOS_URL, controller ? { signal: controller.signal } : undefined)
    if (!response || !response.ok) return null
    const body = await response.json()
    if (!body || typeof body !== 'object') return null
    remember(body)
    return body
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener?.('abort', onAbort)
  }
}

export const HOME_PHOTOS_SEED_ID = 'home-photos-data'

// The last body the API gave this page load, or the one the snapshot carried in; null when
// there is neither.
let lastBody = readSeed()

// Who wants to hear of each new body: useHomeFrom, which reads the body the photo hooks fetch
// rather than fetching its own.
const listeners = new Set()

function readSeed() {
  try {
    const el = typeof document === 'undefined' ? null : document.getElementById(HOME_PHOTOS_SEED_ID)
    const body = el ? JSON.parse(el.textContent || 'null') : null
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}

// Keeps the body for this visit and writes it into <head> for the snapshot. "<" is escaped so
// an alt text with "</script>" in it cannot end the element early; JSON.parse reads \u003c
// back as "<".
function remember(body) {
  lastBody = body
  listeners.forEach((listener) => listener(body))
  try {
    if (typeof document === 'undefined' || !document.head) return
    let el = document.getElementById(HOME_PHOTOS_SEED_ID)
    if (!el) {
      el = document.createElement('script')
      el.type = 'application/json'
      el.id = HOME_PHOTOS_SEED_ID
      document.head.appendChild(el)
    }
    el.textContent = JSON.stringify(body).replace(/</g, '\\u003c')
  } catch {
    // A page that cannot write its head still has lastBody for this visit.
  }
}

/**
 * Drops the kept body, its <head> copy and any open request, so each test starts as a first
 * visit does.
 */
export function forgetHomePhotos() {
  lastBody = null
  openRequest = null
  if (typeof document !== 'undefined') document.getElementById(HOME_PHOTOS_SEED_ID)?.remove()
}

const isUrl = (value) => typeof value === 'string' && value.trim().length > 0

const HERO_SLOT = /^hero-([1-9][0-9]*)$/

/**
 * The slides and model photos the page should show: the API's where it has them, the
 * content defaults otherwise.
 *
 * The slideshow always has the defaults' slides, as many and in the same order. The API sends
 * only the hero slots that HAVE a photo, each named ("hero-3"), so each one replaces the photo
 * of ITS position and no other: filling hero-5 alone changes slide 5 and leaves slides 1-4 as
 * they were. (Until 2026-10-16 the API's list replaced the whole deck, so filling one slot
 * left a one-slide slideshow.) A replaced slide keeps the pathKey and the caption label of its
 * position, because the link belongs to the place, not to the photo; it carries no `frame`,
 * since the crop hints were made for the default photographs. An entry without a usable slot
 * name or url, or for a position the defaults do not have, is ignored. The models map holds a
 * URL string or null per model key.
 */
export function mergeHomePhotos(defaults = [], api = null) {
  const defaultSlides = Array.isArray(defaults) ? defaults : []

  const byPosition = new Map()
  for (const h of Array.isArray(api?.hero) ? api.hero : []) {
    if (!h || typeof h !== 'object' || !isUrl(h.url)) continue
    const match = typeof h.slot === 'string' ? HERO_SLOT.exec(h.slot) : null
    if (!match) continue
    const at = Number(match[1]) - 1
    if (!byPosition.has(at)) byPosition.set(at, h)
  }

  const slides = defaultSlides.map((slide, i) => {
    const s = slide && typeof slide === 'object' ? slide : {}
    const label = s.label || s.alt || ''
    const h = byPosition.get(i)
    if (!h) return { ...s, label }
    return {
      src: h.url,
      alt: typeof h.alt === 'string' ? h.alt : '',
      pathKey: s.pathKey,
      label,
      frame: undefined,
    }
  })

  const models = {}
  for (const key of MODEL_KEYS) {
    const slot = api?.models && typeof api.models === 'object' ? api.models[key] : null
    models[key] = slot && isUrl(slot.url) ? slot.url : null
  }

  return { slides, models }
}

/**
 * One product page's photo from an API body: `{ url, alt }`, or null when the slot is empty,
 * the key is not a product page, or the body is not the shape we expect. Never throws.
 */
export function pagePhotoOf(api, pageKey) {
  if (!PAGE_KEYS.includes(pageKey)) return null
  const pages = api?.pages && typeof api.pages === 'object' ? api.pages : null
  const slot = pages ? pages[pageKey] : null
  if (!slot || !isUrl(slot.url)) return null
  return { url: slot.url, alt: typeof slot.alt === 'string' ? slot.alt : '' }
}

/**
 * One page photo from an API body, by slot name ("about-hero"): `{ url, alt }`, or null when
 * the slot is empty (the API leaves an empty slot out of "slots"), when the body has no "slots"
 * (an API or a kept body from before 2026-10-16), or when anything is not the shape we expect.
 * Never throws.
 */
export function slotPhotoOf(api, name) {
  if (typeof name !== 'string' || !name) return null
  const slots = api && typeof api === 'object' && api.slots && typeof api.slots === 'object' && !Array.isArray(api.slots)
    ? api.slots
    : null
  if (!slots || !Object.prototype.hasOwnProperty.call(slots, name)) return null
  const slot = slots[name]
  if (!slot || typeof slot !== 'object' || !isUrl(slot.url)) return null
  return { url: slot.url, alt: typeof slot.alt === 'string' ? slot.alt : '' }
}

/**
 * The alt text for an admin photo, the rule every page follows: none for a decorative picture
 * (the words beside it say what it shows); otherwise, on the Bulgarian site the description the
 * owner typed in the panel, and in English and Greek, or when the owner left it empty, the
 * page's own general description (`adminAlt`, a content key that never describes the default
 * photo, since the owner's photo may show something else).
 */
export function slotAlt(admin, { locale, adminAlt = '', decorative = false } = {}) {
  if (decorative) return ''
  const own = locale === 'bg' && typeof admin?.alt === 'string' ? admin.alt.trim() : ''
  return own || (typeof adminAlt === 'string' ? adminAlt : '') || ''
}

/**
 * ProductHero's `photo` for a page whose main photo is a slot: today's photo object, untouched,
 * while the slot is empty; the owner's photo once it is filled, with the alt as slotAlt gives it,
 * the default's file as the fallback should the owner's fail to load, and `adminCaption` for
 * the chip (undefined for none, as a chip that names the default photo would be false). No
 * position (the default's crop hint was made for the default) and no srcSet (ProductHero builds
 * the resizer's ladder for an /api/img URL).
 */
export function slotHeroPhoto(admin, defaultPhoto, { locale, adminAlt = '', adminCaption } = {}) {
  if (!admin || !isUrl(admin.url)) return defaultPhoto
  return {
    url: admin.url,
    alt: slotAlt(admin, { locale, adminAlt }),
    fallback: defaultPhoto?.url,
    caption: adminCaption,
  }
}

const UNKNOWN_FROM = Object.freeze({ wagon: null, modular: null })

const price = (value) => {
  const num = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof num === 'number' && Number.isFinite(num) && num > 0 ? num : null
}

/**
 * The gallery's cheapest published prices from an API body, `{ wagon, modular }` in euro with
 * VAT: wagon is the cheapest container with its assembly in it, modular the cheapest Box house
 * alone. Each is a positive number or null — null for an older API that sent no "from", a
 * category with no priced row, or a body that is not the shape we expect. Never throws.
 */
export function homeFromOf(api) {
  const from = api?.from && typeof api.from === 'object' ? api.from : null
  if (!from) return UNKNOWN_FROM
  const wagon = price(from.wagon)
  const modular = price(from.modular)
  return wagon === null && modular === null ? UNKNOWN_FROM : { wagon, modular }
}

/**
 * The home hero's "from" figures, `{ wagon, modular }` as homeFromOf gives them: the kept
 * body's at first (so a prerendered page paints the figure it was snapshotted with, without a
 * flash), then each body the API sends this visit.
 *
 * It starts no request of its own. The home page already fetches /api/home/photos for its
 * photos (useHomePhotos), and the figure rides on that answer, so it costs nothing extra and
 * cannot disagree with the body the photos came from. A failed fetch sends no body, so the
 * figure on screen stays; with nothing kept the figures stay null and the hero prints its lead
 * without one. A component that wants the figure where no photo hook runs gets nulls.
 */
export function useHomeFrom() {
  const [from, setFrom] = useState(() => homeFromOf(lastBody))

  useEffect(() => {
    const listener = (body) => {
      const next = homeFromOf(body)
      setFrom((prev) => (prev.wagon === next.wagon && prev.modular === next.modular ? prev : next))
    }
    listeners.add(listener)
    // A body may have landed between this render and this effect.
    listener(lastBody)
    return () => { listeners.delete(listener) }
  }, [])

  return from
}

// One request at a time, however many callers ask. StrictMode mounts every effect twice in
// development, and a page may grow a second consumer of the same body; both should ride the
// request already open rather than start another. Only the OPEN request is shared — once it
// settles the next caller fetches afresh — so an admin who changes a photo and navigates
// back sees it (subject to the API's two-minute Cache-Control), and a failure is retried by
// the next page rather than remembered for the rest of the visit.
let openRequest = null

/** fetchHomePhotos, shared by every caller while one request is open. Never rejects. */
export function loadHomePhotos() {
  if (!openRequest) {
    openRequest = fetchHomePhotos().finally(() => { openRequest = null })
  }
  return openRequest
}

/**
 * A product page's admin-set main photo, `{ url, alt }`; null once the answer is in and the
 * slot is empty, or the API failed with nothing kept; undefined while the first answer of a
 * visit with nothing kept is on its way. The page shows its own content default for null
 * (which may itself be "no photo"), so this never decides what an empty slot looks like; for
 * undefined it may show the default too, or hold back, as the steel page does, where a photo
 * arriving late would push the heading down.
 */
export function usePagePhoto(pageKey) {
  const known = PAGE_KEYS.includes(pageKey)
  // The whole body, not this page's slot, so a component re-used for a different page reads
  // that page's slot out of it rather than showing the previous page's photo.
  const [body, setBody] = useState(() => lastBody ?? undefined)

  useEffect(() => {
    if (!known) return undefined
    let active = true
    loadHomePhotos().then((next) => {
      // A failed refresh keeps the photo already on screen rather than swapping it for the
      // default; it only settles to null when there was nothing to keep.
      if (active) setBody((prev) => next || prev || null)
    })
    return () => { active = false }
  }, [pageKey, known])

  if (!known) return null
  return body === undefined ? undefined : pagePhotoOf(body, pageKey)
}

/**
 * Several page photos at once, by slot name: `{ [name]: { url, alt } | null | undefined }`,
 * with the same meaning as usePagePhoto's answer — the owner's photo; null once the answer is
 * in and the slot is empty, or the API failed with nothing kept; undefined while the first
 * answer of a visit with nothing kept is on its way. A page shows today's photo for both null
 * and undefined (SlotImg, slotHeroPhoto), so an empty slot never changes how a page looks.
 *
 * It starts from the kept body (the live one, or the one the snapshot carried in its <head>),
 * so a prerendered page paints the owner's photo in its first render. It asks for the body
 * through loadHomePhotos, so every hook on a page shares one request, and every answer goes
 * through fetchHomePhotos, which writes it into <head> for the next snapshot. It also hears
 * the bodies other hooks fetch, so a page never shows two answers at once.
 */
export function useSlotPhotos(names) {
  const key = (Array.isArray(names) ? names : []).filter((n) => typeof n === 'string' && n).join('|')
  const [body, setBody] = useState(() => lastBody ?? undefined)

  useEffect(() => {
    if (!key) return undefined
    let active = true
    // A failed refresh keeps what is on screen; with nothing kept it settles to null.
    loadHomePhotos().then((next) => {
      if (active) setBody((prev) => next || prev || null)
    })
    const listener = (next) => {
      if (active && next) setBody(next)
    }
    listeners.add(listener)
    return () => {
      active = false
      listeners.delete(listener)
    }
  }, [key])

  return useMemo(() => {
    const photos = {}
    for (const name of key ? key.split('|') : []) {
      photos[name] = body === undefined ? undefined : slotPhotoOf(body, name)
    }
    return photos
  }, [body, key])
}

/** One page photo by slot name, as useSlotPhotos answers for it. */
export function useSlotPhoto(name) {
  return useSlotPhotos([name])[name]
}

/**
 * The merged photos for the page: the kept body's at first, the API's once it answers, and the
 * defaults while there is neither.
 *
 * It shares the open request (loadHomePhotos) with every other hook on the page, so the home
 * page makes ONE call for its hero, its model cards, its tiles and its "from" figure.
 */
export function useHomePhotos(defaults = []) {
  // Starts from the kept body, so a home page whose owner has set photos paints them first.
  const [api, setApi] = useState(() => lastBody)

  useEffect(() => {
    let active = true
    loadHomePhotos().then((body) => {
      if (active && body) setApi(body)
    })
    return () => { active = false }
  }, [])

  return useMemo(() => mergeHomePhotos(defaults, api), [defaults, api])
}
