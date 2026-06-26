// src/routes/el/ElModularHousesRoute.jsx
import SEO from '../../components/SEO.jsx'
import ModularHousesPage from '../../pages/ModularHousesPage.jsx'
import elContent from '../../content/el/modularHouses.js'

export default function ElModularHousesRoute() {
  return (
    <>
      <SEO
        title="Δομικά σπίτια στη Βουλγαρία | NVC Home4You"
        description="Δομικά σπίτια στη Βουλγαρία με διάφορες διαμορφώσεις, μεγέθη και επιλογές παράδοσης. Δείτε τα μοντέλα και στείλτε αίτημα."
        url="https://nvc-home4you.eu/el/domika-spitia"
        canonical="https://nvc-home4you.eu/el/domika-spitia"
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en/modular-houses' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg/modulni-kysthi' },
          { hrefLang: 'el', href: 'https://nvc-home4you.eu/el/domika-spitia' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en/modular-houses' },
        ]}
      />
      <ModularHousesPage locale="el" content={elContent} />
    </>
  )
}
