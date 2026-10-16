import React from 'react'
import SEO from '../../components/SEO.jsx'
import HomePage from '../../pages/HomePage.jsx'
import elHome from '../../content/el/home.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js,
// the copy the SEO manifest is built from too, so the server and the page say the same thing.
export default function ElHomeRoute() {
  const seo = getRouteSeo(paths.home.el, 'el')

  return (
    <>
      <SEO {...seo} />
      <HomePage locale="el" bundle={elHome} />
    </>
  )
}
