import React from 'react'
import SEO from '../../components/SEO.jsx'
import { LocalBusinessJSONLD } from '../../components/StructuredData.jsx'
import HomePage from '../../pages/HomePage.jsx'
import elHome from '../../content/el/home.js'

export default function ElHomeRoute() {
  return (
    <>
      <LocalBusinessJSONLD />
      <SEO
        title="Δομικές κατασκευές, δομικά σπίτια και προκατασκευασμένα σπίτια | NVC Home4You"
        description="Δομικές κατασκευές, δομικά σπίτια και προκατασκευασμένα σπίτια σε Βουλγαρία και Ευρώπη. Δείτε μοντέλα, παράδοση και εξατομικευμένες λύσεις από την NVC Home4You."
        url="https://nvc-home4you.eu/el"
        canonical="https://nvc-home4you.eu/el"
        locale="el"
        hreflangs={[
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/en' },
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/bg' },
          { hrefLang: 'el', href: 'https://nvc-home4you.eu/el' },
          { hrefLang: 'x-default', href: 'https://nvc-home4you.eu/en' },
        ]}
      />
      <HomePage locale="el" bundle={elHome} />
    </>
  )
}
