// src/routes/bg/BgPrivacyRoute.jsx
import SEO from '../../components/SEO.jsx'
import PrivacyPage from '../../pages/PrivacyPage.jsx'
import bgContent from '../../content/bg/privacy.js'

export default function BgPrivacyRoute() {
  return (
    <>
      <SEO
        title="Политика за поверителност и бисквитки | NVC Home4You"
        description="Как NVC Home4You събира, използва и защитава личните Ви данни, включително данните за изготвяне на оферта, и как да управлявате бисквитките — съгласно GDPR."
        url="https://nvc-home4you.eu/bg/poveritelnost-i-biskvitki"
        canonical="https://nvc-home4you.eu/bg/poveritelnost-i-biskvitki"
        locale="bg"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/poveritelnost-i-biskvitki' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/privacy-and-cookies' },
          { hrefLang: 'el', href: 'https://nvc-home4you.eu/el/aporrito-kai-cookies' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/privacy-and-cookies' },
        ]}
      />
      <PrivacyPage locale="bg" content={bgContent} />
    </>
  )
}
