// src/components/SEO.jsx
import { Helmet } from 'react-helmet-async'

const SITE_URL = 'https://nvc-home4you.eu'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og/default.jpg`

// Map our locale codes to Open Graph locale codes.
const OG_LOCALE = { bg: 'bg_BG', en: 'en_GB', ro: 'ro_RO', el: 'el_GR' }

function toAbsolute(value) {
  if (!value) return undefined
  if (/^https?:\/\//i.test(value)) return value
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin + (value.startsWith('/') ? value : `/${value}`)
  }
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

export default function SEO({
  title,
  description,
  image,
  url,
  locale = 'bg',
  type = 'website',
  canonical,
  noindex = false,
  hreflangs = [],
  imageWidth = 1200,
  imageHeight = 630,
  imageAlt,
}) {
  const ogLocale = OG_LOCALE[locale] || locale
  const ogImage = toAbsolute(image) || DEFAULT_OG_IMAGE
  const pageUrl =
    url || (typeof window !== 'undefined' ? window.location.href : SITE_URL)
  const canonicalUrl = canonical || url || pageUrl
  const robots = noindex
    ? 'noindex,nofollow'
    : 'index,follow,max-image-preview:large'

  return (
    <Helmet>
      {title && <title>{title}</title>}
      {description && <meta name="description" content={description} />}
      <meta name="robots" content={robots} />

      {/* Open Graph */}
      <meta property="og:site_name" content="NVC Home4You" />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content={ogLocale} />
      {hreflangs
        .filter((h) => h.hrefLang !== 'x-default' && OG_LOCALE[h.hrefLang] && OG_LOCALE[h.hrefLang] !== ogLocale)
        .map((h) => (
          <meta key={h.hrefLang} property="og:locale:alternate" content={OG_LOCALE[h.hrefLang]} />
        ))}
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={pageUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:image:alt" content={imageAlt || title || 'NVC Home4You'} />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      {title && <meta name="twitter:title" content={title} />}
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />

      {/* Canonical + hreflang. Skip canonical on noindex pages (e.g. 404) so we don't
          assert a canonical URL for a page we're telling crawlers to drop. */}
      {!noindex && canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      {hreflangs.map((h) => (
        <link key={h.hrefLang} rel="alternate" hrefLang={h.hrefLang} href={h.href} />
      ))}
    </Helmet>
  )
}
