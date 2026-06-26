import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import InteriorsPage from '../../pages/InteriorsPage.jsx'
import content from '../../content/bg/interiors.js'

export default function BgInteriorsRoute() {
  const pageUrl = content.seo.url
  const alternateEn = 'https://nvc-home4you.eu/en/interiors'

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

      <InteriorsPage content={content} />
    </>
  )
}
