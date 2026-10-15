// src/routes/bg/BgInteriorsRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD, ServiceJSONLD } from '../../components/StructuredData.jsx'
import InteriorsPage from '../../pages/InteriorsPage.jsx'
import content from '../../content/bg/interiors.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical, hreflangs (all three languages) and the share picture (the
// owner's bathroom, the hero's photo) come from routeMeta.js, as on the other rebuilt pages;
// the content file has no seo block. The FAQ markup is the page's own.
//
// A Service of the site's Organization, served in Bulgaria (from Sofia to Petrich, as the
// page says), with no Offer and no price: the price comes after the site visit.
export default function BgInteriorsRoute() {
  const seo = getRouteSeo(paths.interiors.bg, 'bg')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: `https://nvc-home4you.eu${paths.home.bg}` },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />

      <ServiceJSONLD
        name={content.service.name}
        serviceType={content.service.serviceType}
        description={seo.description}
        url={seo.url}
        image={seo.image}
        areaServed={['BG']}
      />

      <InteriorsPage locale="bg" content={content} />
    </>
  )
}
