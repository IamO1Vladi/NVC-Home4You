// src/routes/bg/BgModularBuildsRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { ProductsJSONLD } from '../../components/StructuredData.jsx'
import ModularBuildsPage from '../../pages/ModularBuildsPage.jsx'
import content from '../../content/bg/modularBuilds.js'

function buildProductsJsonLd(items, pageUrl, category, currency) {
  return (items || []).map((item) => ({
    id: item.key,
    url: `${pageUrl}#${item.key}`,
    name: item.schemaName || item.title,
    description: item.schemaDescription || item.desc,
    image: item.image,
    price: item.price,
    currency: item.currency || currency,
    category,
  }))
}

export default function BgModularBuildsRoute() {
  const alternateEn = 'https://nvc-home4you.eu/en/modular-builds'
  const pageUrl = content.seo.url
  const items = buildProductsJsonLd(content.products, pageUrl, content.schemaCategory, content.currency)

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        hreflangs={[
          { hrefLang: 'bg', href: pageUrl },
          { hrefLang: 'en', href: alternateEn },
          { hrefLang: 'x-default', href: alternateEn },
        ]}
      />

      <ProductsJSONLD
        items={items}
        listName={content.listName}
        listUrl={pageUrl}
        defaultCurrency={content.currency}
      />

      <ModularBuildsPage locale="bg" content={content} />
    </>
  )
}
