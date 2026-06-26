import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import BoxHouseConfiguratorPage from '../../pages/BoxHouseConfiguratorPage.jsx'
import content from '../../content/bg/boxConfigurator.js'

export default function BgBoxHouseConfiguratorRoute() {
  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={content.seo.url}
        canonical={content.seo.url}
        hreflangs={[
          { hrefLang: 'bg', href: content.seo.url },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/box-house-configurator' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/box-house-configurator' },
        ]}
      />
      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <BoxHouseConfiguratorPage content={content} />
    </>
  )
}
