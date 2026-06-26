import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import DeliveryPage from '../../pages/DeliveryPage.jsx'
import content from '../../content/bg/delivery.js'

export default function BgDeliveryRoute() {
  const pageUrl = content.seo.url
  const alternateEn = 'https://nvc-home4you.eu/en/delivery'

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

      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <DeliveryPage content={content} />
    </>
  )
}
