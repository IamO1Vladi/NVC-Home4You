// src/routes/en/EnFaqRoute.jsx
import React from 'react'
import SEO from '../../components/SEO.jsx'
import { FAQJSONLD } from '../../components/StructuredData.jsx'
import FAQPage from '../../pages/FAQPage.jsx'
import content from '../../content/en/faq.js'

function toJsonLdQuestions(groups = []) {
  return groups.flatMap((group) => {
    const items = Array.isArray(group?.items) ? group.items : []
    return items
      .filter((item) => item?.q && item?.a)
      .map((item) => ({ question: item.q, answer: item.a }))
  })
}

export default function EnFaqRoute() {
  const pageUrl = content.seo.url
  const alternateBg = 'https://nvc-home4you.eu/bg/често-задавани-въпроси'
  const questions = toJsonLdQuestions(content.groups)

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

      <FAQJSONLD questions={questions} />

      <FAQPage content={content} />
    </>
  )
}
