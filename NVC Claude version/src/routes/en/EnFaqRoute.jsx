// src/routes/en/EnFaqRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import FAQPage from '../../pages/FAQPage.jsx'
import content from '../../content/en/faq.js'
import delivery from '../../content/en/delivery.js'
import partner from '../../content/en/partner.js'
import doors from '../../content/en/internalDoors.js'
import interiors from '../../content/en/interiors.js'
import modularBuilds from '../../content/en/modularBuilds.js'
import modularHouses from '../../content/en/modularHouses.js'
import steelHouses from '../../content/en/steelHouses.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// The head from routeMeta.js (all three languages in the hreflangs), the breadcrumbs here, the
// page's own FAQPage markup in the page; the four pages' questions gathered from their content
// files. See BgFaqRoute.jsx.
const PAGES = { delivery, partner, doors, interiors, modularBuilds, modularHouses, steelHouses }

export default function EnFaqRoute() {
  const seo = getRouteSeo(paths.faq.en, 'en')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: 'https://nvc-home4you.eu/en' },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />

      <FAQPage locale="en" content={content} pages={PAGES} />
    </>
  )
}
