import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import LogisticsPage from '../../pages/LogisticsPage.jsx'
import content from '../../content/el/logistics.js'

export default function ElLogisticsRoute() {
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
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/logistics' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/mejdunarodna-logistika' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/logistics' },
        ]}
      />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <LogisticsPage content={content} />
    </>
  )
}
