import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import CasesPage from '../../pages/CasesPage.jsx'
import content from '../../content/en/cases.js'

export default function EnCasesRoute() {
  const pageUrl = content.seo.url
  const alternateBg = 'https://nvc-home4you.eu/bg/казуси-и-отзиви'

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        hreflangs={[
          { hrefLang: 'en', href: pageUrl },
          { hrefLang: 'bg', href: alternateBg },
          { hrefLang: 'x-default', href: pageUrl },
        ]}
      />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />

      <CasesPage content={content} />
    </>
  )
}
