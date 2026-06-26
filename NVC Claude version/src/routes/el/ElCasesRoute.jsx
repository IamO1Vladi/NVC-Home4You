import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import CasesPage from '../../pages/CasesPage.jsx'
import content from '../../content/el/cases.js'

export default function ElCasesRoute() {
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
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/cases' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/kazusi-i-otzivi' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/cases' },
        ]}
      />

      <BreadcrumbsJSONLD items={content.breadcrumbs} />

      <CasesPage content={content} />
    </>
  )
}
