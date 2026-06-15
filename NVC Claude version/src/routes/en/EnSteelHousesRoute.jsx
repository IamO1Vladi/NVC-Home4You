import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import SteelHousesPage from '../../pages/SteelHousesPage.jsx'
import content from '../../content/en/steelHouses.js'

export default function EnSteelHousesRoute() {
  const pageUrl = content.seo.url
  const alternateBg = 'https://nvc-home4you.eu/bg/sglobqemi-kyshti'

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

      <SteelHousesPage content={content} />
    </>
  )
}
