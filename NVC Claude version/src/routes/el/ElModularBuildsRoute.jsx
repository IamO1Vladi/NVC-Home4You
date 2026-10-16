// src/routes/el/ElModularBuildsRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import ModularBuildsPage from '../../pages/ModularBuildsPage.jsx'
import content from '../../content/el/modularBuilds.js'
// The internal doors page's words, for its container question, which the page shows in its
// Questions section (marked up on the doors page).
import doors from '../../content/el/internalDoors.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs all come from routeMeta.js, the way the prices
// routes already do it. This page used to carry two sets — one here or in the content file's
// seo block, one in routeMeta.js — that disagreed with each other, and the hand-typed
// hreflang lists on the bg and en routes left out the Greek page.
//
// No ProductsJSONLD here any more. This file used to publish a static list from the content
// file — in BGN, at 4,240 / 4,950 / 5,370, none of which the page showed — so Google was told
// the cheapest container cost about €2,170. The page now renders its Product markup from the
// same /api/gallery rows its cards print, so the markup can only ever state a visible price.
const RELATED = { doors }

export default function ElModularBuildsRoute() {
  const seo = getRouteSeo(paths.modularBuilds.el, 'el')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: 'Αρχική', url: 'https://nvc-home4you.eu/el' },
          { name: 'Οικίσκοι κοντέινερ', url: seo.url },
        ]}
      />

      <ModularBuildsPage locale="el" content={content} related={RELATED} />
    </>
  )
}
