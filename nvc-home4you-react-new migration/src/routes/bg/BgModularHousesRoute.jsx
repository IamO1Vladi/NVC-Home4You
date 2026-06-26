// src/routes/bg/BgModularHousesRoute.jsx
import SEO from '../../components/SEO.jsx'
import ModularHousesPage from '../../pages/ModularHousesPage.jsx'
import bgContent from '../../content/bg/modularHouses.js'

export default function BgModularHousesRoute() {
  return (
    <>
      <SEO
        title="Модулни къщи в България | NVC Home4You"
        description="Модулни къщи в България с различни конфигурации, размери и възможности за доставка. Разгледайте моделите и изпратете запитване."
        url="https://nvc-home4you.eu/bg/модулни-къщи"
        canonical="https://nvc-home4you.eu/bg/модулни-къщи"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/модулни-къщи' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/modular-houses' },
        ]}
      />
      <ModularHousesPage locale="bg" content={bgContent} />
    </>
  )
}