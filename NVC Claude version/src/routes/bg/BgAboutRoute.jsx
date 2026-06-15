// src/routes/Bg/BgAboutRoute.jsx
import SEO from '../../components/SEO.jsx'
import AboutPage from '../../pages/AboutPage.jsx'
import bgContent from '../../content/bg/about.js'


export default function BgAboutRoute() {
  return (
    <>
        <SEO
        title="За нас | NVC Home4You"
        description="Научете повече за NVC Home4You — нашия екип, майсторство и подход към модулното и сглобяемо строителство в ЕС."
        url="https://nvc-home4you.eu/bg/za-nas"
        canonical="https://nvc-home4you.eu/bg/za-nas"
        locale="bg"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/za-nas' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/about' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/about' },
        ]}
      />
      <AboutPage locale="bg" content={bgContent} />
    </>
  )
}