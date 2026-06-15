// src/routes/en/EnAboutRoute.jsx
import SEO from '../../components/SEO.jsx'
import AboutPage from '../../pages/AboutPage.jsx'
import enContent from '../../content/en/about.js'

export default function EnAboutRoute() {
  return (
    <>
        <SEO
        title="About Us | NVC Home4You"
        description="Learn about NVC Home4You — our team, craftsmanship and approach to modular and prefab home building across the EU."
        url="https://nvc-home4you.eu/en/about"
        canonical="https://nvc-home4you.eu/en/about"
        locale="en"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/about' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/za-nas' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/about' },
        ]}
      />
      <AboutPage locale="en" content={enContent} />
    </>
  )
}