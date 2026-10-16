import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import CasesPage from '../../pages/CasesPage.jsx'
import content from '../../content/bg/cases.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js,
// as on every other route; the content file's seo block keeps only the page's url.
export default function BgCasesRoute() {
  const seo = getRouteSeo(paths.cases.bg, 'bg')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />

      <CasesPage content={content} />
    </>
  )
}
