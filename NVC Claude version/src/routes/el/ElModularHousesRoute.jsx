// src/routes/el/ElModularHousesRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import ModularHousesPage from '../../pages/ModularHousesPage.jsx'
import content from '../../content/el/modularHouses.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs all come from routeMeta.js, the way the prices
// routes already do it. This page used to carry two sets — one here or in the content file's
// seo block, one in routeMeta.js — that disagreed with each other, and the hand-typed
// hreflang lists on the bg and en routes left out the Greek page.
export default function ElModularHousesRoute() {
  const seo = getRouteSeo(paths.modularHouses.el, 'el')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: 'Αρχική', url: 'https://nvc-home4you.eu/el' },
          { name: 'Δομικά σπίτια', url: seo.url },
        ]}
      />

      <ModularHousesPage locale="el" content={content} />
    </>
  )
}
