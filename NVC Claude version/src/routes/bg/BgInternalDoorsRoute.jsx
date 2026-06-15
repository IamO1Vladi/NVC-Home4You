import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import InternalDoorsPage from '../../pages/InternalDoorsPage.jsx'
import content from '../../content/bg/internalDoors.js'

export default function BgInternalDoorsRoute() {
  const url = 'https://nvc-home4you.eu/bg/interiorni-vrati'
  const enUrl = 'https://nvc-home4you.eu/en/internal-doors'

  return (
    <>
      <BreadcrumbsJSONLD items={[
        { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
        { name: 'Интериорни врати', url: 'https://nvc-home4you.eu/bg/interiorni-vrati' },
      ]} />
      <SEO
        title='Интериорни врати | NVC Home4You'
        description='Интериорни врати с различни типове, покрития и окомплектовка. Разгледайте вариантите и изпратете запитване.'
        url={url}
        canonical={url}
        hreflangs={[
          { hrefLang: 'bg', href: url },
          { hrefLang: 'en', href: enUrl },
          { hrefLang: 'x-default', href: enUrl },
        ]}
      />
      <InternalDoorsPage content={content} />
    </>
  )
}
