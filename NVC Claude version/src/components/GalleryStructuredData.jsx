import React from 'react'
import { blockText, getCategoryLabels, getCoverUrl, getCurrency, getItemSlug, getLocalizedDescription, getLocalizedTitle, offerAvailability } from '../gallery/galleryUtils.js'
import { absoluteUrl, displayTitle } from '../lib/productRows.js'

// The same model is one Product wherever it is marked up: the gallery index, its own page, the
// containers and Box houses pages all name it `<gallery item url>#product`. So the parts that
// identify it agree with productRows.js productJsonLdItems: the sku is gal-<id>, the name is the
// cards' cleaned title (displayTitle), the images are absolute URLs (the API's /api/img/... paths
// mean nothing out of context), and the availability is the model's own (offerAvailability: a
// container in stock, a Box house made to order). The description reads the rich text block by
// block (blockText), not glued into one run.
const productSku = (item, fallback) => (item?.id != null ? `gal-${item.id}` : fallback)

function JsonLD({ data }) {
  if (!data) return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function GalleryBreadcrumbsJSONLD({ items = [] }) {
  return (
    <JsonLD
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  )
}

// The gallery index passes exactly the cards it shows (GalleryIndexPage.jsx), so the list has one
// entry per card. A card with no photo still has its page and its name, so it stays in the list
// with no image rather than dropping out of it; only an item with no page or no name is left out.
export function GalleryListJSONLD({ items = [], locale, listName, listUrl }) {
  const eligible = (items || []).filter((item) => item?.url && item?.title)
  if (!eligible.length) return null

  return (
    <JsonLD
      data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: listName,
        url: listUrl,
        itemListElement: eligible.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: item.url,
          item: {
            '@type': 'Product',
            '@id': `${item.url}#product`,
            name: displayTitle(item.title),
            description: blockText(item.description),
            // JSON.stringify drops undefined: no photo, no image property.
            image: item.coverUrl ? [absoluteUrl(item.coverUrl)] : undefined,
            sku: productSku(item, item.slug),
            offers: typeof item.price === 'number' ? {
              '@type': 'Offer',
              price: item.price,
              priceCurrency: item.currency || 'EUR',
              availability: offerAvailability(item),
              url: item.url,
            } : undefined,
          },
        })),
      }}
    />
  )
}

// categoryLabels: the page locale's filter labels, so the category is named in the page's
// language like everything else in this block — not the raw API key ("modular").
export function GalleryProductJSONLD({ item, locale, url, categoryLabels }) {
  if (!item) return null
  const title = getLocalizedTitle(item, locale)
  const description = blockText(getLocalizedDescription(item, locale))
  const image = getCoverUrl(item)
  const currency = getCurrency(item, locale)
  const slug = getItemSlug(item, locale)
  const category = getCategoryLabels(item.category, categoryLabels).join(', ')
  if (!title || !description || !image || !url) return null

  return (
    <JsonLD
      data={{
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${url}#product`,
        name: displayTitle(title),
        description,
        image: [image, ...((item.images || []).filter((src) => src && src !== image))].map(absoluteUrl),
        sku: productSku(item, slug),
        brand: {
          '@type': 'Brand',
          name: 'NVC Home4You',
        },
        // Left out rather than sent raw when no label resolves; JSON.stringify drops undefined.
        category: category || undefined,
        offers: typeof item.price === 'number' ? {
          '@type': 'Offer',
          price: item.price,
          priceCurrency: currency,
          availability: offerAvailability(item),
          url,
        } : undefined,
      }}
    />
  )
}
