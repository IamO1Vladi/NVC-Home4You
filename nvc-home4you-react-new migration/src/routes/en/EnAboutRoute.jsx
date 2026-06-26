// src/routes/en/EnAboutRoute.jsx
import SEO from '../../components/SEO.jsx'
import AboutPage from '../../pages/AboutPage.jsx'
import enContent from '../../content/en/about.js'

export default function EnAboutRoute() {
  return (
    <>
        <SEO
        title="NVC Home4You - About us"
        description="Modular and prefabricated houses with fast delivery and guaranteed quality. Learn more about NVC Home4You and our process from idea to installation."
        image="../../public/logo3"
        url="https://nvc-home4you.eu/en/about"
        canonical="https://nvc-home4you.eu/en/about"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/за-нас' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/about' },
        ]}
      />
      <AboutPage locale="en" content={enContent} />
    </>
  )
}