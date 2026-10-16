// src/routes/bg/BgFaqRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import FAQPage from '../../pages/FAQPage.jsx'
import content from '../../content/bg/faq.js'
import delivery from '../../content/bg/delivery.js'
import partner from '../../content/bg/partner.js'
import doors from '../../content/bg/internalDoors.js'
import interiors from '../../content/bg/interiors.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical, hreflangs (all three languages) come from routeMeta.js, as on
// the other rebuilt routes; the content file has no seo block. The page prints its own FAQPage
// markup (its own questions only). It gathers the delivery, partner, doors and interiors
// pages' questions from their content files, imported here rather than through the pages, so
// the hub's chunk carries words, not the calculator, the 3D house or the map.
const PAGES = { delivery, partner, doors, interiors }

export default function BgFaqRoute() {
  const seo = getRouteSeo(paths.faq.bg, 'bg')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: 'https://nvc-home4you.eu/bg' },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />

      <FAQPage locale="bg" content={content} pages={PAGES} />
    </>
  )
}
