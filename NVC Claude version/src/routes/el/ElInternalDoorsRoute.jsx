import React from 'react'
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import InternalDoorsPage from '../../pages/InternalDoorsPage.jsx'
import content from '../../content/el/internalDoors.js'

export default function ElInternalDoorsRoute() {
  const url = 'https://nvc-home4you.eu/el/esoterikes-portes'

  return (
    <>
      <BreadcrumbsJSONLD items={[
        { name: 'Αρχική', url: 'https://nvc-home4you.eu/el' },
        { name: 'Εσωτερικές πόρτες', url },
      ]} />
      <SEO
        title='Εσωτερικές Πόρτες | NVC Home4You'
        description='Εσωτερικές πόρτες με πολλά στιλ, φινιρίσματα και επιλογές μηχανισμών. Δείτε τις παραλλαγές και στείλτε αίτημα.'
        url={url}
        canonical={url}
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/internal-doors' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/interiorni-vrati' },
          { hrefLang: 'el', href: url },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/internal-doors' },
        ]}
      />
      <InternalDoorsPage content={content} />
    </>
  )
}
