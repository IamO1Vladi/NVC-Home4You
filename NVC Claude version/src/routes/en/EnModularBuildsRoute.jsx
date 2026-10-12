// src/routes/en/EnModularBuildsRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import ModularBuildsPage from '../../pages/ModularBuildsPage.jsx'
import content from '../../content/en/modularBuilds.js'
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
export default function EnModularBuildsRoute() {
  const seo = getRouteSeo(paths.modularBuilds.en, 'en')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: 'Home', url: 'https://nvc-home4you.eu/en' },
          { name: 'Container units', url: seo.url },
        ]}
      />

      <ModularBuildsPage locale="en" content={content} />
    </>
  )
}
