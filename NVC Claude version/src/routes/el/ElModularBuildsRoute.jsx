// src/routes/el/ElModularBuildsRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { ProductsJSONLD } from '../../components/StructuredData.jsx'
import ModularBuildsPage from '../../pages/ModularBuildsPage.jsx'
import content from '../../content/el/modularBuilds.js'

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

export default function ElModularBuildsRoute() {
  const pageUrl = content.seo.url
  const items = buildProductsJsonLd(content.products, pageUrl, content.schemaCategory, content.currency)

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/modular-builds' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/modulni-postroiki' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/modular-builds' },
        ]}
      />

      <ProductsJSONLD
        items={items}
        listName={content.listName}
        listUrl={pageUrl}
        defaultCurrency={content.currency}
      />

      <ModularBuildsPage locale="el" content={content} />
    </>
  )
}
