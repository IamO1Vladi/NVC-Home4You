// src/routes/el/ElDeliveryRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD, ServiceJSONLD } from '../../components/StructuredData.jsx'
import DeliveryPage from '../../pages/DeliveryPage.jsx'
import content from '../../content/el/delivery.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js,
// as on the product routes; the content file has no seo block any more. The page's FAQ
// markup is the page's own (DeliveryPage renders it beside the questions it repeats).
//
// No Offer markup: the page shows a rate and an estimate, not a price for a product. The
// delivery is described as a Service of the site's Organization, with no price, as the
// steel-frame houses are.
export default function ElDeliveryRoute() {
  const seo = getRouteSeo(paths.delivery.el, 'el')

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

      <DeliveryPage locale="el" content={content} />
    </>
  )
}
