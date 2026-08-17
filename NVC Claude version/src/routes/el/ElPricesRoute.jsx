import React from 'react'
import SEO from '../../components/SEO.jsx'
import PricesPage from '../../pages/PricesPage.jsx'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs all come from routeMeta.js rather than being
// retyped here. Every other route file hard-codes them, and that is how content/el/partner.js
// ended up canonicalising onto a URL that 404s — see src/seo/seoUrls.test.js.
export default function ElPricesRoute() {
  const seo = getRouteSeo(paths.prices.el, 'el')

  return (
    <>
      <SEO {...seo} />
      <PricesPage locale="el" />
    </>
  )
}
