// src/routes/el/ElFaqRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { FAQJSONLD } from '../../components/StructuredData.jsx'
import FAQPage from '../../pages/FAQPage.jsx'
import content from '../../content/el/faq.js'

function toJsonLdQuestions(groups = []) {
  return groups.flatMap((group) => {
    const items = Array.isArray(group?.items) ? group.items : []
    return items
      .filter((item) => item?.q && item?.a)
      .map((item) => ({ question: item.q, answer: item.a }))
  })
}

export default function ElFaqRoute() {
  const pageUrl = content.seo.url
  const questions = toJsonLdQuestions(content.groups)

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/faq' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/chesto-zadavani-vyprosi' },
          { hrefLang: 'el', href: pageUrl },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/faq' },
        ]}
      />

      <FAQJSONLD questions={questions} />

      <FAQPage content={content} />
    </>
  )
}
