// src/routes/bg/BgFaqRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { FAQJSONLD } from '../../components/StructuredData.jsx'
import FAQPage from '../../pages/FAQPage.jsx'
import content from '../../content/bg/faq.js'

function toJsonLdQuestions(groups = []) {
  return groups.flatMap((group) => {
    const items = Array.isArray(group?.items) ? group.items : []
    return items
      .filter((item) => item?.q && item?.a)
      .map((item) => ({ question: item.q, answer: item.a }))
  })
}

export default function BgFaqRoute() {
  const pageUrl = content.seo.url
  const alternateEn = 'https://nvc-home4you.eu/en/faq'
  const questions = toJsonLdQuestions(content.groups)

  return (
    <>
      <SEO
        title={content.seo.title}
        description={content.seo.description}
        url={pageUrl}
        canonical={pageUrl}
        hreflangs={[
          { hrefLang: 'bg', href: pageUrl },
          { hrefLang: 'en', href: alternateEn },
          { hrefLang: 'x-default', href: alternateEn },
        ]}
      />

      <FAQJSONLD questions={questions} />

      <FAQPage content={content} />
    </>
  )
}
