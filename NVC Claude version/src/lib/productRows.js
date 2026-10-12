// The priced rows the three product pages are built from, and the few small sums they do on
// them.
//
// ONE SOURCE, THE SAME CALL THE PRICES PAGE MAKES. /api/gallery through
// useLocalizedGalleryItems, then buildPriceSections (src/content/shared/prices.js), exactly
// as PricesPage.jsx does: the gallery is the single price source and prices.js adds only
// what assembly costs. So a container card, the hero's "from" figure, a sibling link's
// price, the Product markup and the /bg/ceni table all read the same row and cannot
// disagree. No price is ever typed into a content file; if a figure on a product page is
// wrong, it is wrong in the gallery, and staff fix it there.
//
// The gallery is fetched once per visit (galleryUtils caches it at module level), so three
// pages and the prices page share one request. While it loads the rows are empty and the
// pages show no figure rather than a stale one; the prerender waits for the call, so the
// snapshot always carries the real prices.
import { useMemo } from 'react'
import { paths } from '../routes/paths.js'
import { buildPriceSections } from '../content/shared/prices.js'
import { getLocalizedTitle, getItemSlug, getMetaContentId, htmlToText, snippet, useLocalizedGalleryItems } from '../gallery/galleryUtils.js'

export const SITE_ORIGIN = 'https://nvc-home4you.eu'

/**
 * { box, wagon, loading, error, items, galleryPath } for one locale.
 *
 * box and wagon are buildPriceSections' rows ({ id, item, house, assemblyNet, assemblyGross,
 * total, assemblyIncluded }), each sorted by total; item is the localized gallery item, whose
 * url is its gallery page in this locale. items is every localized gallery item, for a page
 * that wants a photo out of one (the container interiors).
 */
export function useProductRows(locale = 'en') {
  const galleryPath = paths.gallery[locale] || paths.gallery.en
  const { items, loading, error } = useLocalizedGalleryItems(locale, galleryPath)
  const { box, wagon } = useMemo(() => buildPriceSections(items), [items])
  return { box, wagon, loading, error, items, galleryPath }
}

/**
 * The smallest of pick(row) over the rows, or null when none has a value.
 *
 * Rows whose value is null are skipped, not counted as zero: the 18 m² house has no known
 * assembly, and a "from" figure taken over a missing number is the wrong figure /bg/ceni
 * printed until the audit caught it. Use it as lowest(box, (r) => r.assemblyGross == null
 * ? null : r.total) for a finished price, or lowest(box, (r) => r.house) for the house alone.
 */
export function lowest(rows, pick = (row) => row.total) {
  let min = null
  for (const row of rows || []) {
    const value = pick(row)
    if (value == null || value === '') continue
    const num = Number(value)
    if (!Number.isFinite(num)) continue
    if (min === null || num < min) min = num
  }
  return min
}

/** The row with this gallery id, or null. Ids compare as strings, as the API sends numbers. */
export function rowById(rows, id) {
  return (rows || []).find((row) => String(row.id) === String(id)) || null
}

/**
 * The rows for these ids, in the order the ids are given; an id the gallery does not have
 * (deleted, unpublished) is skipped, so a page never renders a card without a price.
 */
export function pickRows(rows, ids) {
  return (ids || []).map((id) => rowById(rows, id)).filter(Boolean)
}

/**
 * What a card's "request an offer for this model" hands to requestModel: the same object
 * the gallery item page builds (GalleryItemPage.jsx), so sales gets the title the visitor
 * read, the Bulgarian title and the Bulgarian gallery page whatever language the visitor
 * browsed in.
 */
export function modelRequest(rowOrItem) {
  const item = rowOrItem?.item || rowOrItem
  if (!item) return null
  // A localized item carries the slug of the visitor's language in `slug`, which
  // getItemSlug would otherwise prefer to the Bulgarian title, and an /en enquiry would send
  // sales an English path the Bulgarian gallery does not resolve. The API sends no slug of
  // its own, so dropping it leaves exactly the fields the gallery page works from.
  const { slug, url, ...raw } = item
  return {
    id: item.id,
    title: item.title,
    titleBg: getLocalizedTitle(raw, 'bg'),
    path: `${paths.gallery.bg}/${getItemSlug(raw, 'bg')}`,
    catalogId: getMetaContentId(item),
  }
}

/**
 * A gallery title as a card heading: "*" as " × ", a spaced hyphen as an en dash, doubled
 * spaces collapsed. Staff type the titles in the admin panel ("Панорамен офис контейнер -
 * 6000*3000мм", with two spaces), and on a phone a card heading in that form read as
 * unfinished beside copy that writes "6 × 3 м". Only the punctuation changes: the words and
 * the units stay as staff typed them, so the heading is still recognisably the gallery's.
 * modelRequest keeps the raw title, which is what sales matches against the gallery record.
 *
 * The spaces around the × are non-breaking, so a narrow card never starts a line with
 * "× 3000мм": the two dimensions wrap as one.
 */
export function displayTitle(title) {
  return String(title ?? '')
    .replace(/\s+-\s+/g, ' – ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*\*\s*/g, '\u00a0×\u00a0')
    .trim()
}

/** An absolute URL on the live site for a site path; absolute URLs pass through. */
export function absoluteUrl(path) {
  const value = String(path || '')
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${SITE_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`
}

// An invisible separator, not whitespace, so htmlToText's whitespace collapse keeps it.
const BLOCK_BREAK = '\u2063'

/**
 * The gallery's rich text as sentences. htmlToText reads textContent, which glues a heading,
 * its paragraph and every list item into one word ("ОписаниеЦената включва…изградениБаня"),
 * so each block's end is marked before the tags go, and a block that does not already end
 * in punctuation gets a full stop.
 */
function blockText(html) {
  const marked = String(html || '').replace(/<\/(?:p|li|h[1-6]|div|tr|dt|dd|blockquote)>|<br\s*\/?>/gi, `$&${BLOCK_BREAK}`)
  const parts = htmlToText(marked).split(BLOCK_BREAK).map((part) => part.trim()).filter(Boolean)
  return parts
    .map((part, i) => (i < parts.length - 1 && !/[.!?:;…]$/.test(part) ? `${part}.` : part))
    .join(' ')
}

/**
 * The items ProductsJSONLD takes, from the same rows the cards render: the gallery item
 * page as each product's url, its cover as the image, both absolute, the price in EUR.
 *
 * pick chooses the figure, and it must be the one the card shows beside it: a container's
 * total (VAT and assembly in), a Box house's house price (VAT in, assembly not). Rows whose
 * pick is null are left out rather than published at zero. The description is the gallery's
 * own text, shortened, or the title when the gallery has none.
 */
export function productJsonLdItems(rows, { pick = (row) => row.total, category } = {}) {
  return (rows || [])
    .map((row) => {
      const item = row.item || {}
      const price = pick(row)
      if (price == null || !(Number(price) > 0)) return null
      const text = snippet(blockText(item.description), 300)
      const name = displayTitle(item.title)
      return {
        id: `gal-${row.id}`,
        url: absoluteUrl(item.url),
        // The name the card's heading shows, so the markup and the page say the same thing.
        name,
        description: text || name,
        image: absoluteUrl(item.coverUrl),
        price: Number(price),
        currency: 'EUR',
        category,
      }
    })
    .filter(Boolean)
}
