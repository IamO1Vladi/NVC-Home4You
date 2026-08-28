import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import InteriorsPage from '../../pages/InteriorsPage.jsx'
import content from '../../content/el/interiors.js'

export default function ElInteriorsRoute() {
  const pageUrl = content.seo.url

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/interiors' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/vytreshni-remonti' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/interiors' },
        ]}
      />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />

      <InteriorsPage locale="el" content={content} />
    </>
  )
}
