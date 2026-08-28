// src/routes/en/EnModularBuildsRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { ProductsJSONLD } from '../../components/StructuredData.jsx'
import ModularBuildsPage from '../../pages/ModularBuildsPage.jsx'
import content from '../../content/en/modularBuilds.js'

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

export default function EnModularBuildsRoute() {
  const alternateBg = 'https://nvc-home4you.eu/bg/modulni-postroiki'
  const pageUrl = content.seo.url
  const items = buildProductsJsonLd(content.products, pageUrl, content.schemaCategory, content.currency)

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        locale="en"
        hreflangs={[
          { hrefLang: 'en', href: pageUrl },
          { hrefLang: 'bg', href: alternateBg },
          { hrefLang: 'x-default', href: pageUrl },
        ]}
      />

      <ProductsJSONLD
        items={items}
        listName={content.listName}
        listUrl={pageUrl}
        defaultCurrency={content.currency}
      />

      <ModularBuildsPage locale="en" content={content} />
    </>
  )
}
