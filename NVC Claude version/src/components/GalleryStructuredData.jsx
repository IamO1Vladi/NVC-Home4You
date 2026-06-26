import React from 'react'
import { htmlToText, getCoverUrl, getCurrency, getItemSlug, getLocalizedDescription, getLocalizedTitle } from '../gallery/galleryUtils.js'

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

export function GalleryListJSONLD({ items = [], locale, listName, listUrl }) {
  const eligible = (items || []).filter((item) => item?.url && item?.title && item?.coverUrl)
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
            name: item.title,
            description: htmlToText(item.description),
            image: [item.coverUrl],
            offers: typeof item.price === 'number' ? {
              '@type': 'Offer',
              price: item.price,
              priceCurrency: item.currency,
              availability: 'https://schema.org/InStock',
              url: item.url,
            } : undefined,
          },
        })),
      }}
    />
  )
}

export function GalleryProductJSONLD({ item, locale, url }) {
  if (!item) return null
  const title = getLocalizedTitle(item, locale)
  const description = htmlToText(getLocalizedDescription(item, locale))
  const image = getCoverUrl(item)
  const currency = getCurrency(item, locale)
  const slug = getItemSlug(item, locale)
  if (!title || !description || !image || !url) return null

  return (
    <JsonLD
      data={{
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${url}#product`,
        name: title,
        description,
        image: [image, ...((item.images || []).filter((src) => src && src !== image))],
        sku: item.id || slug,
        brand: {
          '@type': 'Brand',
          name: 'NVC Home4You',
        },
        category: item.category,
        offers: typeof item.price === 'number' ? {
          '@type': 'Offer',
          price: item.price,
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          url,
        } : undefined,
      }}
    />
  )
}
