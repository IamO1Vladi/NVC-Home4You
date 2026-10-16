import React from 'react'
import SEO from '../../components/SEO.jsx'
import HomePage from '../../pages/HomePage.jsx'
import bgHome from '../../content/bg/home.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js,
// the copy the SEO manifest is built from too, so the server and the page say the same thing.
export default function BgHomeRoute() {
  const seo = getRouteSeo(paths.home.bg, 'bg')

  return (
    <>
      <SEO {...seo} />
      <HomePage locale="bg" bundle={bgHome} />
    </>
  )
}
