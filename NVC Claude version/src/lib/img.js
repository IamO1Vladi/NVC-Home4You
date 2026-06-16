// On-the-fly image resizing + modern formats via Cloudinary "fetch" mode.
//
// When VITE_CLOUDINARY_CLOUD is set (production build), image URLs are routed through
// Cloudinary, which fetches the original (Quickbase OR our own /public assets), resizes it,
// serves WebP/AVIF and caches the result on its CDN. When it is unset (dev, or until you
// enable it) every function below is a transparent pass-through — images load exactly as
// they do today, so this is zero-risk until you flip it on.
//
// Enable by adding to .env.production:  VITE_CLOUDINARY_CLOUD=your_cloud_name
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD || ''
const SITE_ORIGIN = 'https://nvc-home4you.eu'

// Sensible default ladder: small enough for thumbnails, large enough for detail views.
export const DEFAULT_WIDTHS = [320, 480, 640, 800, 1200, 1600]

export const isCdnEnabled = () => Boolean(CLOUD)

// Cloudinary fetch needs an absolute, publicly reachable URL (it pulls the origin itself),
// so resolve same-origin /public paths against the live site.
function toAbsolute(url) {
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window !== 'undefined' && window.location?.origin) {
    try { return new URL(url, window.location.origin).href } catch { return url }
  }
  return SITE_ORIGIN + (url.startsWith('/') ? url : `/${url}`)
}

// A single resized URL. `width` is the target CSS pixel width (Cloudinary's c_limit never upscales).
export function cdnImage(url, { width, quality = 'auto' } = {}) {
  if (!url || !CLOUD) return url
  const src = toAbsolute(url)
  // Don't double-wrap Cloudinary URLs or try to fetch non-http(s) sources (data:, blob:, svg fallbacks).
  if (!/^https?:\/\//i.test(src) || src.includes('res.cloudinary.com')) return url
  const t = ['f_auto', `q_${quality}`, 'c_limit']
  if (width) t.push(`w_${Math.round(width)}`)
  return `https://res.cloudinary.com/${CLOUD}/image/fetch/${t.join(',')}/${encodeURIComponent(src)}`
}

// A `srcset` string across the given widths — or undefined when the CDN is off, so React
// omits the attribute entirely and the plain `src` is used.
export function cdnSrcSet(url, widths = DEFAULT_WIDTHS) {
  if (!url || !CLOUD) return undefined
  return widths.map((w) => `${cdnImage(url, { width: w })} ${w}w`).join(', ')
}
