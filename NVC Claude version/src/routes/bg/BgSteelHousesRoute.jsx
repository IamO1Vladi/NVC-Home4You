import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import SteelHousesPage from '../../pages/SteelHousesPage.jsx'
import content from '../../content/bg/steelHouses.js'

export default function BgSteelHousesRoute() {
  const pageUrl = content.seo.url
  const alternateEn = 'https://nvc-home4you.eu/en/steel-houses'

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

      <SteelHousesPage content={content} />
    </>
  )
}
