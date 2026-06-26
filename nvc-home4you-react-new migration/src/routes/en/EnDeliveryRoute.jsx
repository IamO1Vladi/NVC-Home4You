import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import DeliveryPage from '../../pages/DeliveryPage.jsx'
import content from '../../content/en/delivery.js'

export default function EnDeliveryRoute() {
  const pageUrl = content.seo.url
  const alternateBg = 'https://nvc-home4you.eu/bg/доставка-до-вратата'

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        hreflangs={[
          { hrefLang: 'en', href: pageUrl },
          { hrefLang: 'bg', href: alternateBg },
          { hrefLang: 'x-default', href: pageUrl },
        ]}
      />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <DeliveryPage content={content} />
    </>
  )
}
