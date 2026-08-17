import React from 'react'
import SEO from '../../components/SEO.jsx'
import HomePage from '../../pages/HomePage.jsx'
import enHome from '../../content/en/home.js'

export default function EnHomeRoute() {
  return (
    <>
      <SEO
        title="Modular builds, modular houses and prefab homes | NVC Home4You"
        description="Modular builds, modular houses and prefab homes in Bulgaria and Europe. Explore models, delivery and custom solutions from NVC Home4You."
        url="https://nvc-home4you.eu/en"
        canonical="https://nvc-home4you.eu/en"
        locale="en"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en' },
        ]}
      />
      <HomePage locale="en" bundle={enHome} />
    </>
  )
}
