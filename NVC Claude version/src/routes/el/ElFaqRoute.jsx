// src/routes/el/ElFaqRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import FAQPage from '../../pages/FAQPage.jsx'
import content from '../../content/el/faq.js'
import delivery from '../../content/el/delivery.js'
import partner from '../../content/el/partner.js'
import doors from '../../content/el/internalDoors.js'
import interiors from '../../content/el/interiors.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// The head from routeMeta.js (all three languages in the hreflangs), the breadcrumbs here, the
// page's own FAQPage markup in the page; the four pages' questions gathered from their content
// files. See BgFaqRoute.jsx.
const PAGES = { delivery, partner, doors, interiors }

export default function ElFaqRoute() {
  const seo = getRouteSeo(paths.faq.el, 'el')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: 'https://nvc-home4you.eu/el' },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />

      <FAQPage locale="el" content={content} pages={PAGES} />
    </>
  )
}
