import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import BoxHouseConfiguratorPage from '../../pages/BoxHouseConfiguratorPage.jsx'
import content from '../../content/bg/boxConfigurator.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js,
// as on every other route; the content file's seo block keeps only the url and the breadcrumb.
export default function BgBoxHouseConfiguratorRoute() {
  const seo = getRouteSeo(paths.boxConfigurator.bg, 'bg')

  return (
    <>
      <SEO {...seo} />
      <BreadcrumbsJSONLD items={content.breadcrumbs} />
      <BoxHouseConfiguratorPage content={content} />
    </>
  )
}
