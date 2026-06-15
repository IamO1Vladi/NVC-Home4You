// src/routes/en/EnModularHousesRoute.jsx
import SEO from '../../components/SEO.jsx'
import ModularHousesPage from '../../pages/ModularHousesPage.jsx'
import enContent from '../../content/en/modularHouses.js'

export default function EnModularHousesRoute() {
  return (
    <>
      <SEO
        title="Modular houses in Bulgaria | NVC Home4You"
        description="Modular homes in Bulgaria with different configurations, sizes and delivery options. Browse the models and send an inquiry."
        url="https://nvc-home4you.eu/en/modular-houses"
        canonical="https://nvc-home4you.eu/en/modular-houses"
        locale="en"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/modular-houses' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/modulni-kysthi' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/modular-houses' },
        ]}
      />
      <ModularHousesPage locale="en" content={enContent} />
    </>
  )
}