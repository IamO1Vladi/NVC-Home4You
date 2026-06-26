import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import PartnerPage from '../../pages/PartnerPage.jsx'
import content from '../../content/en/partner.js'

export default function EnPartnerRoute() {
  const pageUrl = content.seo.url
  const alternateBg = 'https://nvc-home4you.eu/bg/стани-партньор'

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
      <PartnerPage content={content} />
    </>
  )
}
