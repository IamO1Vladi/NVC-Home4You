// Responsive image URLs for everything served from /api/img — ROADMAP #9's client half.
//
// Every heavy image on the site already carried srcSet and sizes; what was missing was a
// server that answered them. Until 2026-09-05 these helpers only produced resized URLs
// through Cloudinary fetch mode, and VITE_CLOUDINARY_CLOUD was never enabled — so every
// srcset in production quietly collapsed to the plain src and a phone downloaded the
// 2560px original. Now /api/img/{key}?w= resizes first-party (see ImagesController and
// ImageWidths in the API), and these helpers emit that by default. Cloudinary remains as
// the opt-in it always was: set VITE_CLOUDINARY_CLOUD and it takes over unchanged.
//
// Only /api/img URLs are rewritten. Static assets under /public (plan renders, swatch
// thumbs, SVGs) have no resizer behind them, and an external URL is not ours to resize —
// both pass through untouched, which is also why cdnSrcSet returns undefined for them:
// React then omits the attribute entirely rather than writing a srcset of one lie.
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD || ''
const SITE_ORIGIN = 'https://nvc-home4you.eu'
const API_PREFIX = '/api/img/'

// Sensible default ladder: small enough for thumbnails, large enough for detail views.
export const DEFAULT_WIDTHS = [320, 480, 640, 800, 1200, 1600]

// MUST MIRROR ImageWidths.Ladder in the API. The server snaps every ?w= up to a rung of
// this ladder, and the helper snaps the same way so a srcset descriptor always names the
// width actually served — if the two drift, the browser's layout math is quietly lied to.
// Both test suites pin the same cases.
const LADDER = [120, 160, 200, 240, 320, 400, 480, 640, 800, 1000, 1200, 1600, 2000]

// The rung a width lands on: the smallest ladder value that covers it. Null means "serve
// the original" — for nonsense, and for anything past the top rung, where the 2560px
// original is the honest answer rather than an upscale-shaped lie.
function snapWidth(width) {
  if (!Number.isFinite(width) || width <= 0) return null
  for (const rung of LADDER) {
    if (rung >= width) return rung
  }
  return null
}

const isFirstParty = (url) => typeof url === 'string' && url.startsWith(API_PREFIX)

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

function cloudinaryImage(url, { width, quality = 'auto' } = {}) {
  const src = toAbsolute(url)
  // Don't double-wrap Cloudinary URLs or try to fetch non-http(s) sources (data:, blob:, svg fallbacks).
  if (!/^https?:\/\//i.test(src) || src.includes('res.cloudinary.com')) return url
  const t = ['f_auto', `q_${quality}`, 'c_limit']
  if (width) t.push(`w_${Math.round(width)}`)
  return `https://res.cloudinary.com/${CLOUD}/image/fetch/${t.join(',')}/${encodeURIComponent(src)}`
}

// A single resized URL. `width` is the target CSS pixel width; the server never upscales.
export function cdnImage(url, { width, quality = 'auto' } = {}) {
  if (!url) return url
  if (CLOUD) return cloudinaryImage(url, { width, quality })

  if (!isFirstParty(url)) return url
  const snapped = snapWidth(width)
  if (snapped === null) return url
  // Image keys never carry a query of their own (ImageKey strips them at minting), but a
  // caller passing one through must not produce "??" — that would fork the browser cache.
  return `${url}${url.includes('?') ? '&' : '?'}w=${snapped}`
}

// A `srcset` string across the given widths — or undefined when nothing can resize this
// URL, so React omits the attribute entirely and the plain `src` is used.
//
// Widths are snapped and deduped: asking for [400, 600, 800] serves [400, 640, 800] and
// SAYS so in the descriptors, because a descriptor that flatters the file is worse than a
// slightly bigger file — the browser would render it too small for the screen it picked
// it for.
export function cdnSrcSet(url, widths = DEFAULT_WIDTHS) {
  if (!url) return undefined
  if (CLOUD) return widths.map((w) => `${cloudinaryImage(url, { width: w })} ${w}w`).join(', ')

  if (!isFirstParty(url)) return undefined
  const snapped = [...new Set(widths.map(snapWidth).filter((w) => w !== null))].sort((a, b) => a - b)
  if (snapped.length === 0) return undefined
  return snapped.map((w) => `${cdnImage(url, { width: w })} ${w}w`).join(', ')
}
