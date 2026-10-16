import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import PricesPage from '../../pages/PricesPage.jsx'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'
import { getPricesCopy } from '../../content/shared/pricesCopy.js'

// Title, description, canonical and hreflangs all come from routeMeta.js rather than being
// retyped here, as on every route now: retyped copies are how content/el/partner.js once
// canonicalised onto a URL that 404s (see src/seo/seoUrls.test.js). Breadcrumbs as on the other
// pages: the home page, then this one, named in pricesCopy.js.
export default function BgPricesRoute() {
  const seo = getRouteSeo(paths.prices.bg, 'bg')
  const t = getPricesCopy('bg')

  return (
    <>
      <SEO {...seo} />
      <BreadcrumbsJSONLD
        items={[
          { name: t.home, url: 'https://nvc-home4you.eu/bg' },
          { name: t.breadcrumb, url: seo.url },
        ]}
      />
      <PricesPage locale="bg" />
    </>
  )
}
