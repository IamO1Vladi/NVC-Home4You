import React from 'react'
import SEO from '../../components/SEO.jsx'
import HomePage from '../../pages/HomePage.jsx'
import bgHome from '../../content/bg/home.js'

export default function BgHomeRoute() {
  return (
    <>
      <SEO
        title="Контейнери за живеене, модулни и сглобяеми къщи | NVC Home4You"
        description="Контейнери за живеене, модулни и сглобяеми къщи в България. Разгледайте модели, доставка и индивидуални решения от NVC Home4You."
        url="https://nvc-home4you.eu/bg"
        canonical="https://nvc-home4you.eu/bg"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en' },
        ]}
      />
      <HomePage locale="bg" bundle={bgHome} />
    </>
  )
}
