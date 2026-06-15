// src/routes/bg/BgModularHousesRoute.jsx
import SEO from '../../components/SEO.jsx'
import ModularHousesPage from '../../pages/ModularHousesPage.jsx'
import bgContent from '../../content/bg/modularHouses.js'

export default function BgModularHousesRoute() {
  return (
    <>
      <SEO
        title="Модулни къщи в България | NVC Home4You"
        description="Модулни къщи до ключ, изработени по поръчка и доставени в България и ЕС. Разгледайте проекти, размери и довършителни решения."
        url="https://nvc-home4you.eu/bg/modulni-kysthi"
        canonical="https://nvc-home4you.eu/bg/modulni-kysthi"
        locale="bg"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/modulni-kysthi' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/modular-houses' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/modular-houses' },
        ]}
      />
      <ModularHousesPage locale="bg" content={bgContent} />
    </>
  )
}