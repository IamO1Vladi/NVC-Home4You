import React from 'react'
import { COMPANY } from '../content/shared/company.js'

export function LocalBusinessJSONLD({
  name = 'NVC Home4You',
  url = 'https://nvc-home4you.eu/',
  // Absolute, unlike the rest of the migrated content images. This one is consumed by search
  // engines and social crawlers reading the JSON-LD out of context, where a site-relative
  // path has no origin to resolve against.
  image = 'https://nvc-home4you.eu/api/img/content/bvk4n834b-rcy-eg-vb.webp',
  telephone = '+359879355269',
  email = 'contact@nvc-home4you.eu',
  address = {
    streetAddress: 'Marikostinovo',
    addressLocality: 'Petrich',
    addressRegion: 'Blagoevgrad',
    postalCode: '2850',
    addressCountry: 'BG',
  },
  sameAs = ['https://www.facebook.com/profile.php?id=61581135006737'],
  // The home page passes both from its content file (home.localBusiness), so what the
  // page prints and what the schema publishes come from one object. The defaults are the
  // same values, for any caller that does not.
  hours = {
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '07:00',
    closes: '19:00',
  },
}) {
  // The same business as the Organization index.html publishes, by its @id (ORGANIZATION_ID),
  // so search engines read one company with its shop details rather than a second one beside
  // it; the logo is the Organization's. No priceRange: a typed one would go stale the day a
  // gallery price changes.
  const data = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    '@id': ORGANIZATION_ID,
    name,
    logo: 'https://nvc-home4you.eu/logo3.jpg',
    image,
    url,
    telephone,
    email,
    address: { '@type': 'PostalAddress', ...address },
    areaServed: ['BG', 'EU'],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: hours?.dayOfWeek || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: hours?.opens || '07:00',
        closes: hours?.closes || '19:00',
      },
    ],
    sameAs,
  }
  return <JsonLD data={data} />
}

function cleanJsonLD(value) {
  if (value === undefined || value === null || value === '') return undefined

  if (Array.isArray(value)) {
    const arr = value.map(cleanJsonLD).filter((v) => v !== undefined)
    return arr.length ? arr : undefined
  }

  if (typeof value === 'object') {
    const obj = {}
    for (const [k, v] of Object.entries(value)) {
      const cleaned = cleanJsonLD(v)
      if (cleaned !== undefined) obj[k] = cleaned
    }
    return Object.keys(obj).length ? obj : undefined
  }

  return value
}

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function oneYearFromNowISO() {
  const now = new Date()
  const oneYear = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()))
  return toISODate(oneYear)
}

// Structured data is read out of context, by crawlers that have no page to resolve a
// site-relative path against, so every URL it publishes is absolute. Gallery covers arrive
// as /api/img/... and used to go out exactly so.
const SITE_ORIGIN = 'https://nvc-home4you.eu'

function toAbsoluteUrl(value) {
  if (!value || typeof value !== 'string') return value
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value
  return `${SITE_ORIGIN}${value.startsWith('/') ? '' : '/'}${value}`
}

function asImageArray(image) {
  if (!image) return undefined
  if (Array.isArray(image)) {
    const arr = image.filter(Boolean).map(toAbsoluteUrl)
    return arr.length ? arr : undefined
  }
  return [toAbsoluteUrl(image)]
}

function makeDefaultReturnPolicy({ applicableCountry = 'BG' } = {}) {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry,
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
  }
}

function makeDefaultShippingDetails({
  addressCountry = 'BG',
  currency = 'EUR',
  handlingMinDays = 14,
  handlingMaxDays = 60,
  transitMinDays = 1,
  transitMaxDays = 7,
  freeShipping = false,
  shippingRateValue,
  shippingRateMaxValue,
} = {}) {
  const hasShippingCost =
    freeShipping === true ||
    (typeof shippingRateValue === 'number' && Number.isFinite(shippingRateValue)) ||
    (typeof shippingRateMaxValue === 'number' && Number.isFinite(shippingRateMaxValue))

  if (!hasShippingCost) return undefined

  const rate = freeShipping ? 0 : shippingRateValue

  return {
    '@type': 'OfferShippingDetails',
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: handlingMinDays,
        maxValue: handlingMaxDays,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: transitMinDays,
        maxValue: transitMaxDays,
        unitCode: 'DAY',
      },
    },
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: rate,
      maxValue: freeShipping ? undefined : shippingRateMaxValue,
      currency,
    },
  }
}

export { makeDefaultReturnPolicy as buildDefaultReturnPolicy }
export { makeDefaultShippingDetails as buildDefaultShippingDetails }

function JsonLD({ data }) {
  const cleaned = cleanJsonLD(data)
  if (!cleaned) return null

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleaned) }}
    />
  )
}

export function FAQJSONLD({ questions = [] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  }
  return <JsonLD data={data} />
}

export function BreadcrumbsJSONLD({ items = [] }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: it.name || it.title,
      item: it.url || 'https://nvc-home4you.eu/gallery',
    })),
  }
  return <JsonLD data={data} />
}

// The @id of the Organization that index.html publishes on every page, in raw HTML (outside
// the SEO markers, so no route replaces it). Markup that names NVC Home4You as a provider or
// seller points at it by this id, and a crawler joins the two into one entity rather than
// reading a second, thinner company. Keep it equal to the "@id" in index.html.
export const ORGANIZATION_ID = 'https://nvc-home4you.eu/#organization'

/**
 * A service NVC Home4You provides, for a page that sells one with no fixed price: the
 * steel-frame houses, each its own project. No offers and no price, because the page has
 * none to show; no FAQ, rating or review either, since none has been approved for it.
 *
 * `provider` is the site's Organization by ORGANIZATION_ID, with its name and url so the
 * node still reads on its own. `areaServed` defaults to the Organization's own ["BG", "EU"].
 */
export function ServiceJSONLD({
  name,
  serviceType,
  description,
  url,
  image,
  areaServed = ['BG', 'EU'],
}) {
  if (!name || !url) return null
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${toAbsoluteUrl(url)}#service`,
    name,
    serviceType: serviceType || name,
    description,
    url: toAbsoluteUrl(url),
    image: asImageArray(image),
    areaServed,
    provider: {
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'NVC Home4You',
      url: 'https://nvc-home4you.eu/',
    },
  }
  return <JsonLD data={data} />
}

/**
 * The About page as an AboutPage whose subject is the site's Organization, joined to the node
 * index.html publishes by ORGANIZATION_ID. Only what the page itself backs: its url, name,
 * description, language and photo, and the company's legal name, VAT number and founding year
 * from shared/company.js, which the page prints (the owner gave them on 2026-10-15; index.html
 * repeats them). No employees, opening hours or rating: the reviews keep their own markup.
 */
export function AboutPageJSONLD({ name, description, url, image, inLanguage }) {
  if (!url) return null
  const absolute = toAbsoluteUrl(url)
  const organization = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: COMPANY.name,
    legalName: COMPANY.legalName,
    vatID: COMPANY.vatID,
    foundingDate: String(COMPANY.foundingYear),
    url: 'https://nvc-home4you.eu/',
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${absolute}#webpage`,
    url: absolute,
    name,
    description,
    inLanguage,
    primaryImageOfPage: image ? { '@type': 'ImageObject', url: toAbsoluteUrl(image) } : undefined,
    about: organization,
    mainEntity: organization,
  }
  return <JsonLD data={data} />
}

/**
 * Product list JSON-LD (Merchant listings / Product structured data).
 *
 * Emit it only beside the prices it publishes: the product pages and /bg/ceni build `items`
 * from the same gallery rows their cards render (src/lib/productRows.js productJsonLdItems,
 * PricesPage), so search engines are told the figure the visitor reads.
 *
 * - Currency defaults to EUR, the currency every price on the site is in. The old container
 *   page passed BGN beside euro figures and told Google a €4,300 unit cost 4,240 leva.
 * - url and image are made absolute here, whatever the caller passes.
 * - No return policy unless the caller passes one. The default used to declare
 *   MerchantReturnNotPermitted for every product, a legal claim nobody had made; the field
 *   is recommended, not required, so absent is better than invented.
 * - Each product's @id is its url with "#product", or, when the url already points at an
 *   anchor (the prices page's #item-13), that anchor's page with "#product-<sku>", so no
 *   @id carries two fragments.
 *
 * Compatibility: accepts `currency` or `priceCurrency`; `image`, `imageUrl`, `coverUrl` or
 * `coverURL`; `name` or `title`; `description` or `desc`.
 */
export function ProductsJSONLD({
  items = [],
  listName = 'Products',
  listUrl,
  brandName = 'NVC Home4You',
  sellerName = 'NVC Home4You',
  sellerUrl = 'https://nvc-home4you.eu/',
  defaultCurrency = 'EUR',
  defaultAvailability = 'https://schema.org/InStock',
  defaultItemCondition = 'https://schema.org/NewCondition',
  defaultReturnPolicy,
  defaultShippingDetails,
  defaultAggregateRating,
}) {
  const priceValidUntilDefault = oneYearFromNowISO()

  const eligible = (items || [])
    .map((p) => {
      if (!p) return null

      const price = typeof p.price === 'number' ? p.price : Number(p.price)
      const image = p.image || p.imageUrl || p.coverUrl || p.coverURL
      const name = p.name || p.title
      const description = p.description || p.desc

      return {
        ...p,
        url: toAbsoluteUrl(p.url),
        price,
        image,
        name,
        description,
      }
    })
    .filter(
      (p) =>
        p &&
        p.url &&
        p.name &&
        p.description &&
        String(p.description).trim() !== '' &&
        asImageArray(p.image) &&
        p.price > 0
    )

  if (!eligible.length) return null

  // The site's Organization (ORGANIZATION_ID), so each offer's seller is the same entity
  // index.html describes.
  const seller = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: sellerName,
    url: sellerUrl,
  }

  const productId = (p) => {
    if (p['@id']) return p['@id']
    const [page, anchor] = String(p.url).split('#')
    const sku = p.sku || p.id
    return anchor && sku ? `${page}#product-${sku}` : `${page}#product`
  }

  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    url: toAbsoluteUrl(listUrl),
    itemListElement: eligible.map((p, idx) => {
      const offerCurrency = p.currency || p.priceCurrency || defaultCurrency
      const returnPolicy = p.returnPolicy || defaultReturnPolicy
      const shippingDetails = p.shippingDetails || defaultShippingDetails

      return {
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@type': 'Product',
          '@id': productId(p),
          url: p.url,
          name: p.name,
          description: p.description,
          image: asImageArray(p.image),
          brand: {
            '@type': 'Brand',
            name: p.brand || brandName,
          },
          sku: p.sku || p.id,
          mpn: p.mpn,
          category: p.category,
          offers: {
            '@type': 'Offer',
            url: p.url,
            priceCurrency: offerCurrency,
            price: p.price,
            priceValidUntil: p.priceValidUntil || priceValidUntilDefault,
            availability: p.availability || defaultAvailability,
            itemCondition: p.itemCondition || defaultItemCondition,
            seller: p.seller || seller,
            shippingDetails,
            hasMerchantReturnPolicy: returnPolicy,
          },
          aggregateRating: p.aggregateRating || defaultAggregateRating,
          review: p.review,
        },
      }
    }),
  }

  return <JsonLD data={data} />
}
