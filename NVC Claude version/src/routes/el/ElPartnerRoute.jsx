// src/routes/el/ElPartnerRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD, ServiceJSONLD } from '../../components/StructuredData.jsx'
import PartnerPage from '../../pages/PartnerPage.jsx'
import content from '../../content/el/partner.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical, hreflangs (all three languages) and the share picture come
// from routeMeta.js, as on the delivery and product routes; the content file has no seo block.
// The FAQ markup is the page's own (PartnerPage renders it from the questions it shows).
//
// No Offer markup and no price: partners get an offer for their quantity. The page is a
// Service of the site's Organization, as the delivery page is.
export default function ElPartnerRoute() {
  const seo = getRouteSeo(paths.partner.el, 'el')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: 'https://nvc-home4you.eu/el' },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />

      <ServiceJSONLD
        name={content.service.name}
        serviceType={content.service.serviceType}
        description={seo.description}
        url={seo.url}
        image={seo.image}
        areaServed={['BG', 'GR']}
      />

      <PartnerPage locale="el" content={content} />
    </>
  )
}
