import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import FloorPlannerPage from '../../pages/FloorPlannerPage.jsx'
import content from '../../content/bg/floorPlanner.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs all come from routeMeta.js, the way the product
// routes do it. The planner used to carry two titles (this file's, from the content file, and
// routeMeta's), and the bg and en routes left the Greek page out of their hreflang lists.
export default function BgFloorPlannerRoute() {
  const seo = getRouteSeo(paths.planner.bg, 'bg')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
          { name: content.seo.breadcrumb, url: seo.url },
        ]}
      />

      <FloorPlannerPage locale="bg" content={content} />
    </>
  )
}
