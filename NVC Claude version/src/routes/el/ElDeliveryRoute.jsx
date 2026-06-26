import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import DeliveryPage from '../../pages/DeliveryPage.jsx'
import content from '../../content/el/delivery.js'

export default function ElDeliveryRoute() {
  const pageUrl = content.seo.url

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/delivery' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/dostavka-do-vratata' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/delivery' },
        ]}
      />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <DeliveryPage content={content} />
    </>
  )
}
