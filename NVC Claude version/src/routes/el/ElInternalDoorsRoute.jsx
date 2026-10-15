// src/routes/el/ElInternalDoorsRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import InternalDoorsPage from '../../pages/InternalDoorsPage.jsx'
import content from '../../content/el/internalDoors.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical, hreflangs (all three languages) and the share picture (the
// catalogue's cover) come from routeMeta.js, as on the product, about and partner routes. The
// page prints its own FAQ markup; there is no Product markup, since the doors have no
// published price.
export default function ElInternalDoorsRoute() {
  const seo = getRouteSeo(paths.doors.el, 'el')

  return (
    <>
      <SEO {...seo} />
      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: 'https://nvc-home4you.eu/el' },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />
      <InternalDoorsPage locale="el" content={content} />
    </>
  )
}
