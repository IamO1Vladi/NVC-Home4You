import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import PartnerPage from '../../pages/PartnerPage.jsx'
import content from '../../content/el/partner.js'

export default function ElPartnerRoute() {
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
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/partner' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/stani-partnjor' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/partner' },
        ]}
      />
      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <PartnerPage content={content} />
    </>
  )
}
