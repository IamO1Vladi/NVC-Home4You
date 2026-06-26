import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import FloorPlannerPage from '../../pages/FloorPlannerPage.jsx'
import content from '../../content/en/floorPlanner.js'

const URL = 'https://nvc-home4you.eu/en/floor-planner'
const BG_URL = 'https://nvc-home4you.eu/bg/планировчик-на-разпределение'

export default function EnFloorPlannerRoute() {
  return (
    <>
      <BreadcrumbsJSONLD
        items={[
          { name: 'Home', url: 'https://nvc-home4you.eu/en' },
          { name: content.seo.breadcrumb, url: URL },
        ]}
      />
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={URL}
        canonical={URL}
        hreflangs={[
          { hrefLang: 'en', href: URL },
          { hrefLang: 'bg', href: BG_URL },
        ]}
      />
      <FloorPlannerPage content={content} />
    </>
  )
}
