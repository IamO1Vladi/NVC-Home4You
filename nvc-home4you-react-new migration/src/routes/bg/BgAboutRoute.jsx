// src/routes/Bg/BgAboutRoute.jsx
import SEO from '../../components/SEO.jsx'
import AboutPage from '../../pages/AboutPage.jsx'
import bgContent from '../../content/bg/about.js'


export default function BgAboutRoute() {
  return (
    <>
        <SEO
        title="NVC Home4You - About us"
        description="Модулни и сглобяеми къщи с бърза доставка и гарантирано качество. Научете повече за NVC Home4You и нашия процес от идея до монтаж"
        image="../../public/logo3"
        url="https://nvc-home4you.eu/bg/за-нас"
        canonical="https://nvc-home4you.eu/bg/за-нас"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/за-нас' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/about' },
        ]}
      />
      <AboutPage locale="bg" content={bgContent} />
    </>
  )
}