import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import FloorPlannerPage from '../../pages/FloorPlannerPage.jsx'
import content from '../../content/el/floorPlanner.js'

const URL = 'https://nvc-home4you.eu/el/sxediasmos-katopsis'

export default function ElFloorPlannerRoute() {
  return (
    <>
      <BreadcrumbsJSONLD
        items={[
          { name: 'Αρχική', url: 'https://nvc-home4you.eu/el' },
          { name: content.seo.breadcrumb, url: URL },
        ]}
      />
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={URL}
        canonical={URL}
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/floor-planner' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/planirane-na-razpredelenie' },
          { hrefLang: 'el', href: URL },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/floor-planner' },
        ]}
      />
      <FloorPlannerPage content={content} />
    </>
  )
}
