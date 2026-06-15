import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import InternalDoorsPage from '../../pages/InternalDoorsPage.jsx'
import content from '../../content/en/internalDoors.js'

export default function EnInternalDoorsRoute() {
  const url = 'https://nvc-home4you.eu/en/internal-doors'
  const bgUrl = 'https://nvc-home4you.eu/bg/interiorni-vrati'

  return (
    <>
      <BreadcrumbsJSONLD items={[
        { name: 'Home', url: 'https://nvc-home4you.eu/en' },
        { name: 'Internal doors', url },
      ]} />
      <SEO
        title='Internal Doors | NVC Home4You'
        description='Internal doors with multiple styles, finishes, and hardware options. Explore the variants and send an enquiry.'
        url={url}
        canonical={url}
        locale="en"
        hreflangs={[
          { hrefLang: 'en', href: url },
          { hrefLang: 'bg', href: bgUrl },
          { hrefLang: 'x-default', href: url },
        ]}
      />
      <InternalDoorsPage content={content} />
    </>
  )
}
