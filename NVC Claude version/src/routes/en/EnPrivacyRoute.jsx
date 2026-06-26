// src/routes/en/EnPrivacyRoute.jsx
import SEO from '../../components/SEO.jsx'
import PrivacyPage from '../../pages/PrivacyPage.jsx'
import enContent from '../../content/en/privacy.js'

export default function EnPrivacyRoute() {
  return (
    <>
      <SEO
        title="Privacy & Cookie Policy | NVC Home4You"
        description="How NVC Home4You collects, uses and protects your personal data, including data kept to prepare your offer, and how to manage cookies — GDPR compliant."
        url="https://nvc-home4you.eu/en/privacy-and-cookies"
        canonical="https://nvc-home4you.eu/en/privacy-and-cookies"
        locale="en"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/privacy-and-cookies' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/poveritelnost-i-biskvitki' },
          { hrefLang: 'el', href: 'https://nvc-home4you.eu/el/aporrito-kai-cookies' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/privacy-and-cookies' },
        ]}
      />
      <PrivacyPage locale="en" content={enContent} />
    </>
  )
}
