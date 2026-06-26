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

export function slugify(value) {
  const base = String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[’'"“”]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'model'
}

export function getLocalizedTitle(item, locale) {
  return locale === 'bg' && item?.titleBg ? item.titleBg : (item?.title || item?.name || '')
}

export function getLocalizedDescription(item, locale) {
  return locale === 'bg' && item?.descriptionBg ? item.descriptionBg : (item?.description || item?.desc || '')
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
