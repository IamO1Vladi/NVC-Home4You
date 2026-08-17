import { useEffect, useMemo, useState } from 'react'

export const PAGE_SIZE = 12

export const FILTER_IDS = ['prefab', 'wagon', 'modular', 'garage']

const FILTERS = [
  { id: 'prefab', bg: 'Сглобяема къща', en: 'Prefab house' },
  { id: 'wagon', bg: 'Фургон', en: 'Wagon / site cabin' },
  { id: 'modular', bg: 'Модулна къща', en: 'Modular house' },
  { id: 'garage', bg: 'Гараж', en: 'Garage' },
]

const norm = (v) => String(v ?? '').trim().toLowerCase()
const byBg = Object.fromEntries(FILTERS.map((f) => [norm(f.bg), f.id]))
const byEn = Object.fromEntries(FILTERS.map((f) => [norm(f.en), f.id]))
const byId = new Set(FILTERS.map((f) => f.id))

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

export function snippet(text, n = 120) {
  if (!text) return ''
  const s = String(text).replace(/\s+/g, ' ').trim()
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s
}

export function htmlToText(html) {
  if (!html) return ''
  try {
    const doc = new DOMParser().parseFromString(String(html), 'text/html')
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
  } catch {
    return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }
}

export function pageModel(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)

  const out = []
  const push = (v) => out.push(v)

  const left = Math.max(0, current - 1)
  const right = Math.min(total - 1, current + 1)

  push(0)
  if (left > 1) push('…')
  for (let i = left; i <= right; i += 1) {
    if (i !== 0 && i !== total - 1) push(i)
  }
  if (right < total - 2) push('…')
  push(total - 1)
  return out
}

export function resolveCatParam(v) {
  const n = norm(v)
  if (!n) return 'all'
  if (n === 'all') return 'all'
  if (byId.has(n)) return n
  return byBg[n] || byEn[n] || 'all'
}

export function catFromItemCategory(raw) {
  const parts = Array.isArray(raw) ? raw : String(raw || '').split(/[;,|]/)
  const codes = []
  for (const p of parts) {
    const n = norm(p)
    if (!n) continue
    if (byId.has(n)) codes.push(n)
    else if (byBg[n]) codes.push(byBg[n])
    else if (byEn[n]) codes.push(byEn[n])
  }
  return Array.from(new Set(codes))
}

// Mirrors GallerySlugs.Slugify in api-dotnet — the two must stay byte-identical or sitemap
// URLs stop matching what this router accepts.
//
// NFKC, not NFKD (changed 2026-08-17). NFKD decomposed an accented character into a base
// letter plus a combining mark, and the non-alphanumeric replace below then turned that mark
// into a hyphen — so Bulgarian "й" became "и-" and Greek accents split words in half
// ("Σπίτι τύπου" -> "σπι-τι-τυ-που"). NFKC composes instead, while still folding "m²" to
// "m2" exactly as before, which is why no "…-37-m2" slug changed.
//
// Old URLs are 301'd server-side by GallerySeoService, so there is no legacy slugify here.
export function slugify(value) {
  const base = String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’'"“”]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'model'
}

export function getLocalizedTitle(item, locale) {
  if (locale === 'bg' && item?.titleBg) return item.titleBg
  if (locale === 'el' && item?.titleEl) return item.titleEl
  return item?.title || item?.name || ''
}

export function getLocalizedDescription(item, locale) {
  if (locale === 'bg' && item?.descriptionBg) return item.descriptionBg
  if (locale === 'el' && item?.descriptionEl) return item.descriptionEl
  return item?.description || item?.desc || ''
}

// Meta/Facebook catalogue id (QB field 27) drives Pixel `content_ids`.
// Returns '' when no catalogue id is set — we deliberately do NOT fall back to the
// Quickbase record/model id, so a non-catalogue id never reaches Meta.
export function getMetaContentId(item) {
  const catalogId = item?.catalogId ?? item?.metaId ?? item?.fbCatalogId
  if (catalogId !== undefined && catalogId !== null && String(catalogId).trim() !== '') {
    return String(catalogId).trim()
  }
  return ''
}

// Shared payload for ViewContent / AddToCart / Lead so all product events stay consistent.
// content_ids/content_type are only attached when the item has a real catalogue id.
export function buildMetaProductPayload(item, locale) {
  if (!item) return null
  const contentId = getMetaContentId(item)
  const payload = {
    content_name: getLocalizedTitle(item, locale),
    content_category: item.category || 'Gallery product',
    currency: getCurrency(item, locale) || 'EUR',
  }
  if (contentId) {
    payload.content_ids = [contentId]
    payload.content_type = 'product'
  }
  if (typeof item.price === 'number') payload.value = item.price
  return payload
}

export function getItemImages(item) {
  const images = Array.isArray(item?.images) ? item.images.filter(Boolean) : []
  if (images.length) return images
  const fallback = item?.coverUrl || item?.coverURL || item?.image || item?.imageUrl
  return fallback ? [fallback] : []
}

export function getCoverUrl(item) {
  return item?.coverUrl || item?.coverURL || getItemImages(item)[0] || ''
}

export function getCurrency(item, locale) {
  if (item?.currency) return item.currency
  if (item?.priceCurrency) return item.priceCurrency
  return locale === 'bg' ? 'BGN' : 'EUR'
}

export function getItemSlug(item, locale) {
  if (locale === 'bg' && item?.slugBg) return slugify(item.slugBg)
  if (locale === 'en' && item?.slugEn) return slugify(item.slugEn)
  if (item?.slug) return slugify(item.slug)
  return slugify(getLocalizedTitle(item, locale) || item?.id)
}

export function toLocalizedItem(item, locale, basePath = '') {
  const title = getLocalizedTitle(item, locale)
  const description = getLocalizedDescription(item, locale)
  const slug = getItemSlug(item, locale)
  const url = basePath ? `${basePath}/${slug}` : slug
  const images = getItemImages(item)
  return {
    ...item,
    title,
    description,
    slug,
    url,
    coverUrl: getCoverUrl(item),
    images,
    currency: getCurrency(item, locale),
  }
}

export function findItemBySlug(items, slug, locale) {
  return (items || []).find((item) => getItemSlug(item, locale) === slug) || null
}

let galleryCache = null
let galleryError = null
let galleryPromise = null
let imageHostPreconnected = false

// Open the connection to the (cross-origin) image host as soon as we know it, so the grid
// thumbnails and the detail images don't each pay a fresh DNS/TLS handshake.
function ensureImageHostPreconnect(items) {
  if (imageHostPreconnected || typeof document === 'undefined' || !Array.isArray(items)) return
  const sample = items.find((it) => it && (it.coverUrl || (it.images && it.images[0])))
  const ref = sample?.coverUrl || sample?.images?.[0]
  if (!ref) return
  let origin
  try {
    origin = new URL(ref, window.location.href).origin
  } catch {
    return
  }
  imageHostPreconnected = true
  if (origin === window.location.origin) return
  for (const rel of ['preconnect', 'dns-prefetch']) {
    if (document.head.querySelector(`link[rel="${rel}"][href="${origin}"]`)) continue
    const link = document.createElement('link')
    link.rel = rel
    link.href = origin
    document.head.appendChild(link)
  }
}

async function fetchGallery() {
  if (galleryCache) return galleryCache
  if (galleryError) throw galleryError
  if (!galleryPromise) {
    const base = import.meta.env.VITE_API_BASE || ''
    galleryPromise = fetch(`${base}/api/gallery`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load gallery')
        const json = await res.json()
        galleryCache = json.items || []
        ensureImageHostPreconnect(galleryCache)
        return galleryCache
      })
      .catch((err) => {
        galleryError = err
        throw err
      })
      .finally(() => {
        galleryPromise = null
      })
  }
  return galleryPromise
}

export function useGalleryItems() {
  const [items, setItems] = useState(() => galleryCache || [])
  const [loading, setLoading] = useState(() => !galleryCache && !galleryError)
  const [error, setError] = useState(() => galleryError)

  useEffect(() => {
    let active = true
    if (galleryCache) {
      setItems(galleryCache)
      setLoading(false)
      ensureImageHostPreconnect(galleryCache)
      return undefined
    }
    setLoading(true)
    fetchGallery()
      .then((data) => {
        if (!active) return
        setItems(data)
        setError(null)
      })
      .catch((err) => {
        if (!active) return
        setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { items, loading, error }
}

export function useLocalizedGalleryItems(locale, basePath) {
  const { items, loading, error } = useGalleryItems()
  const localizedItems = useMemo(
    () => items.map((item) => toLocalizedItem(item, locale, basePath)),
    [items, locale, basePath],
  )
  return { items: localizedItems, loading, error }
}
