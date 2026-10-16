// src/routes/el/ElAboutRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { AboutPageJSONLD, BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import AboutPage from '../../pages/AboutPage.jsx'
import content from '../../content/el/about.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical, hreflangs (all three languages) and the share picture come
// from routeMeta.js, as on the product, delivery and partner routes; the content file has no
// seo block. The page is an AboutPage of the site's Organization (index.html), with only the
// fields the page backs; the founding year (2021) and the VAT number the owner confirmed are on
// that Organization itself (foundingDate, vatID), so they are not repeated here.
export default function ElAboutRoute() {
  const seo = getRouteSeo(paths.about.el, 'el')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: 'https://nvc-home4you.eu/el' },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />

      <AboutPageJSONLD
        name={seo.title}
        description={seo.description}
        url={seo.url}
        image={seo.image}
        inLanguage="el"
      />

      <AboutPage locale="el" content={content} />
    </>
  )
}
