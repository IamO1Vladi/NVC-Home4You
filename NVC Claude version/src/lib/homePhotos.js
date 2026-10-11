// The home page's admin-managed photos: the five hero slides and the three model cards.
//
// The admin panel fills eight slots (hero-1..hero-5, model-37/58/73) that the API serves
// anonymously at /api/home/photos. The page fetches them AFTER first paint and merges them
// over the content files' defaults, so the prerendered HTML and every failure path (network
// down, 404 while the migration is not yet applied, an empty table, a malformed body) show
// the default photographs and nothing else. Nothing here throws; a failure is `null`, and
// mergeHomePhotos(defaults, null) is the defaults unchanged.
//
// The fetch has a 4 s cap because the prerender waits on every open /api call: a stalled
// Blob store must not stall the snapshot, and a visitor with a slow link gets the defaults
// rather than a hero that never settles.
import { useEffect, useMemo, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || ''
export const HOME_PHOTOS_URL = `${API_BASE}/api/home/photos`
export const HOME_PHOTOS_TIMEOUT_MS = 4000

export const MODEL_KEYS = ['37', '58', '73']

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
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener?.('abort', onAbort)
  }
}

const isUrl = (value) => typeof value === 'string' && value.trim().length > 0

/**
 * The slides and model photos the page should show: the API's where it has them, the
 * content defaults otherwise.
 *
 * A hero slide from the API keeps the pathKey (and the caption label) of the default in
 * the same position, because the admin picks a photo per slot and the slots are ordered the
 * same way as the defaults; it carries no `frame`, since the crop hints were made for the
 * default photographs. The models map holds a URL string or null per model key.
 */
export function mergeHomePhotos(defaults = [], api = null) {
  const defaultSlides = Array.isArray(defaults) ? defaults : []
  const hero = Array.isArray(api?.hero) ? api.hero.filter((h) => h && isUrl(h.url)) : []

  const slides = hero.length
    ? hero.map((h, i) => {
      const fallback = defaultSlides[i] || defaultSlides[0] || {}
      return {
        src: h.url,
        alt: typeof h.alt === 'string' ? h.alt : '',
        pathKey: fallback.pathKey || 'modularBuilds',
        label: fallback.label || fallback.alt || '',
        frame: undefined,
      }
    })
    : defaultSlides.map((s) => ({ ...s, label: s.label || s.alt || '' }))

  const models = {}
  for (const key of MODEL_KEYS) {
    const slot = api?.models && typeof api.models === 'object' ? api.models[key] : null
    models[key] = slot && isUrl(slot.url) ? slot.url : null
  }

  return { slides, models }
}

/** The merged photos for the page; the defaults until the API answers, and after it fails. */
export function useHomePhotos(defaults = []) {
  const [api, setApi] = useState(null)

  useEffect(() => {
    const controller = typeof AbortController === 'function' ? new AbortController() : null
    let active = true
    fetchHomePhotos(controller?.signal).then((body) => {
      if (active && body) setApi(body)
    })
    return () => {
      active = false
      controller?.abort()
    }
  }, [])

  return useMemo(() => mergeHomePhotos(defaults, api), [defaults, api])
}
