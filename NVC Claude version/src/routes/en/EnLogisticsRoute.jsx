import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import LogisticsPage from '../../pages/LogisticsPage.jsx'
import content from '../../content/en/logistics.js'

export default function EnLogisticsRoute() {
  const pageUrl = content.seo.url
  const alternateBg = 'https://nvc-home4you.eu/bg/mejdunarodna-logistika'

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

      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <LogisticsPage content={content} />
    </>
  )
}
