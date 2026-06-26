// src/routes/el/ElPrivacyRoute.jsx
import SEO from '../../components/SEO.jsx'
import PrivacyPage from '../../pages/PrivacyPage.jsx'
import elContent from '../../content/el/privacy.js'

export default function ElPrivacyRoute() {
  return (
    <>
      <SEO
        title="Πολιτική Απορρήτου & Cookies | NVC Home4You"
        description="Πώς η NVC Home4You συλλέγει, χρησιμοποιεί και προστατεύει τα προσωπικά σας δεδομένα, συμπεριλαμβανομένων όσων τηρούμε για τη δημιουργία προσφοράς, και πώς να διαχειρίζεστε τα cookies — σύμφωνα με τον GDPR."
        url="https://nvc-home4you.eu/el/aporrito-kai-cookies"
        canonical="https://nvc-home4you.eu/el/aporrito-kai-cookies"
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/privacy-and-cookies' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/poveritelnost-i-biskvitki' },
          { hrefLang: 'el', href: 'https://nvc-home4you.eu/el/aporrito-kai-cookies' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/privacy-and-cookies' },
        ]}
      />
      <PrivacyPage locale="el" content={elContent} />
    </>
  )
}
