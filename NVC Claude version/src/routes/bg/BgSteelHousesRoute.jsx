// src/routes/bg/BgSteelHousesRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD, ServiceJSONLD } from '../../components/StructuredData.jsx'
import SteelHousesPage from '../../pages/SteelHousesPage.jsx'
import content from '../../content/bg/steelHouses.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs all come from routeMeta.js, the way the prices
// routes already do it. This page used to carry two sets — one here or in the content file's
// seo block, one in routeMeta.js — that disagreed with each other, and the hand-typed
// hreflang lists on the bg and en routes left out the Greek page.
//
// No Product markup: this line is priced per project, so there is no offer to publish. It is
// described as a Service instead, provided by the site's Organization (ServiceJSONLD), with
// the page's own description and share picture and no price.
export default function BgSteelHousesRoute() {
  const seo = getRouteSeo(paths.steelHouses.bg, 'bg')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
          { name: 'Сглобяеми къщи по проект', url: seo.url },
        ]}
      />

      <ServiceJSONLD
        name="Сглобяеми къщи със стоманена конструкция по проект"
        serviceType="Проектиране и изграждане на сглобяеми къщи със стоманена конструкция"
        description={seo.description}
        url={seo.url}
        image={seo.image}
      />

      <SteelHousesPage locale="bg" content={content} />
    </>
  )
}
