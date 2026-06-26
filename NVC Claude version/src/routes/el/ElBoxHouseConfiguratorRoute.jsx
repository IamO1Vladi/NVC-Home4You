import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import BoxHouseConfiguratorPage from '../../pages/BoxHouseConfiguratorPage.jsx'
import content from '../../content/el/boxConfigurator.js'

export default function ElBoxHouseConfiguratorRoute() {
  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={content.seo.url}
        canonical={content.seo.url}
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/box-house-configurator' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/konfigurator-box-kyshti' },
          { hrefLang: 'el', href: content.seo.url },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/box-house-configurator' },
        ]}
      />
      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <BoxHouseConfiguratorPage content={content} />
    </>
  )
}
