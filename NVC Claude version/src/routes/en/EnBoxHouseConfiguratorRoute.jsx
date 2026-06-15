import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import BoxHouseConfiguratorPage from '../../pages/BoxHouseConfiguratorPage.jsx'
import content from '../../content/en/boxConfigurator.js'

export default function EnBoxHouseConfiguratorRoute() {
  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={content.seo.url}
        canonical={content.seo.url}
        locale="en"
        hreflangs={[
          { hrefLang: 'en', href: content.seo.url },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/konfigurator-box-kyshti' },
          { hrefLang: 'x-default', href: content.seo.url },
        ]}
      />
      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <BoxHouseConfiguratorPage content={content} />
    </>
  )
}
