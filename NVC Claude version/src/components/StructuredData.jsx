import React from 'react'

export function LocalBusinessJSONLD({
  name = 'NVC Home4You',
  url = 'https://nvc-home4you.eu/',
  image = 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcy/eg/vb',
  telephone = '+359892456245',
  email = 'contact@nvc-home4you.eu',
  address = {
    streetAddress: 'Marikostinovo',
    addressLocality: 'Petrich',
    addressRegion: 'Blagoevgrad',
    postalCode: '2850',
    addressCountry: 'BG',
  },
  sameAs = ['https://www.facebook.com/profile.php?id=61581135006737'],
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name,
    image,
    url,
    telephone,
    email,
    address: { '@type': 'PostalAddress', ...address },
    areaServed: ['BG', 'EU'],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '19:00',
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

function asImageArray(image) {
  if (!image) return undefined
  if (Array.isArray(image)) {
    const arr = image.filter(Boolean)
    return arr.length ? arr : undefined
  }
  return [image]
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

/**
 * Product list JSON-LD (Merchant listings / Product structured data).
 *
 * Compatibility additions in this migrated version:
 * - accepts `currency` or `priceCurrency`
 * - accepts `image`, `imageUrl`, `coverUrl`, `coverURL`
 * - accepts `name` or `title`
 * - accepts `description` or `desc`
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
  defaultReturnPolicy = makeDefaultReturnPolicy({ applicableCountry: 'BG' }),
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

  const seller = {
    '@type': 'Organization',
    name: sellerName,
    url: sellerUrl,
  }

  const data = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    url: listUrl,
    itemListElement: eligible.map((p, idx) => {
      const offerCurrency = p.currency || p.priceCurrency || defaultCurrency
      const returnPolicy = p.returnPolicy || defaultReturnPolicy
      const shippingDetails = p.shippingDetails || defaultShippingDetails

      return {
        '@type': 'ListItem',
        position: idx + 1,
        url: p.url,
        item: {
          '@type': 'Product',
          '@id': p['@id'] || `${p.url}#product`,
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
