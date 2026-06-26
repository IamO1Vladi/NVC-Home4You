import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import SteelHousesPage from '../../pages/SteelHousesPage.jsx'
import content from '../../content/el/steelHouses.js'

export default function ElSteelHousesRoute() {
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
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/steel-houses' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/sglobqemi-kyshti' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/steel-houses' },
        ]}
      />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />

      <SteelHousesPage content={content} />
    </>
  )
}
