// Generates a server-side SEO manifest: { "<pathname>": "<head-tags-html>" }.
//
// Single source of truth = src/seo/routeMeta.js (+ src/routes/paths.js). This runs
// after `vite build`; the .NET app (api-dotnet/Program.cs) splices the matching block
// between the <!--SEO-START--> / <!--SEO-END--> markers in index.html for each request,
// so crawlers and social scrapers that don't run JS get correct per-route metadata.
//
// Keep the tag set below in sync with src/components/SEO.jsx (same tags, as a string).
import { writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { paths } from '../src/routes/paths.js'
import { getRouteSeo } from '../src/seo/routeMeta.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const SITE_URL = 'https://nvc-home4you.eu'
const OG_LOCALE = { bg: 'bg_BG', en: 'en_GB', ro: 'ro_RO', el: 'el_GR' }
const OG_IMAGE = `${SITE_URL}/og/default.jpg`

const escAttr = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escText = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function headTags(seo) {
  const { title, description, url, canonical, locale, hreflangs = [] } = seo
  const ogLocale = OG_LOCALE[locale] || locale
  const ogAlternates = hreflangs
    .filter((h) => h.hrefLang !== 'x-default' && OG_LOCALE[h.hrefLang] && OG_LOCALE[h.hrefLang] !== ogLocale)
    .map((h) => `<meta property="og:locale:alternate" content="${OG_LOCALE[h.hrefLang]}" />`)
  const alternates = hreflangs.map(
    (h) => `<link rel="alternate" hreflang="${escAttr(h.hrefLang)}" href="${escAttr(h.href)}" />`
  )

  return [
    `<title>${escText(title)}</title>`,
    `<meta name="description" content="${escAttr(description)}" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    `<meta property="og:site_name" content="NVC Home4You" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="${ogLocale}" />`,
    ...ogAlternates,
    `<meta property="og:title" content="${escAttr(title)}" />`,
    `<meta property="og:description" content="${escAttr(description)}" />`,
    `<meta property="og:url" content="${escAttr(url)}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:secure_url" content="${OG_IMAGE}" />`,
    `<meta property="og:image:type" content="image/jpeg" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escAttr(title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(title)}" />`,
    `<meta name="twitter:description" content="${escAttr(description)}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<link rel="canonical" href="${escAttr(canonical || url)}" />`,
    ...alternates,
  ].join('\n    ')
}

const manifest = {}
for (const [pageKey, localized] of Object.entries(paths)) {
  for (const [locale, path] of Object.entries(localized)) {
    const seo = getRouteSeo(path, locale)
    if (seo) manifest[path] = headTags(seo)
  }
}

const json = JSON.stringify(manifest, null, 2)

// Vite now builds straight into the .NET web root, so there is a single target: the
// build output directory. (This used to write to both dist/ and wwwroot/ to keep them
// in sync across the old manual copy step — that copy no longer exists.)
const target = resolve(root, '../api-dotnet/wwwroot/seo-manifest.json')
if (!existsSync(dirname(target))) {
  console.error(`SEO manifest: build output not found at ${dirname(target)} — run vite build first.`)
  process.exit(1)
}
writeFileSync(target, json, 'utf8')
console.log(`SEO manifest -> ${target}`)
console.log(`Done: ${Object.keys(manifest).length} routes.`)
