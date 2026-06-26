import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import FloorPlannerPage from '../../pages/FloorPlannerPage.jsx'
import content from '../../content/bg/floorPlanner.js'

const URL = 'https://nvc-home4you.eu/bg/планировчик-на-разпределение'
const EN_URL = 'https://nvc-home4you.eu/en/floor-planner'

export default function BgFloorPlannerRoute() {
  return (
    <>
      <BreadcrumbsJSONLD
        items={[
          { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
          { name: content.seo.breadcrumb, url: URL },
        ]}
      />
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={URL}
        canonical={URL}
        hreflangs={[
          { hrefLang: 'bg', href: URL },
          { hrefLang: 'en', href: EN_URL },
        ]}
      />
      <FloorPlannerPage content={content} />
    </>
  )
}
