// src/routes/en/EnAboutRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { AboutPageJSONLD, BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import AboutPage from '../../pages/AboutPage.jsx'
import content from '../../content/en/about.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical, hreflangs (all three languages) and the share picture come
// from routeMeta.js, as on the product, delivery and partner routes; the content file has no
// seo block. The page is an AboutPage of the site's Organization (index.html), with only the
// fields the page backs: no founding date or company number until the owner confirms them.
export default function EnAboutRoute() {
  const seo = getRouteSeo(paths.about.en, 'en')

  return (
    <>
      <SEO {...seo} />

      <BreadcrumbsJSONLD
        items={[
          { name: content.home, url: 'https://nvc-home4you.eu/en' },
          { name: content.breadcrumb, url: seo.url },
        ]}
      />

      <AboutPageJSONLD
        name={seo.title}
        description={seo.description}
        url={seo.url}
        image={seo.image}
        inLanguage="en"
      />

      <AboutPage locale="en" content={content} />
    </>
  )
}
