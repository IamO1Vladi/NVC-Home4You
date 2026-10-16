// src/routes/el/ElPrivacyRoute.jsx
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import PrivacyPage from '../../pages/PrivacyPage.jsx'
import elContent from '../../content/el/privacy.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js, as
// on every other route. Breadcrumbs as on the other pages: the home page, then this one.
export default function ElPrivacyRoute() {
  const seo = getRouteSeo(paths.privacy.el, 'el')

  return (
    <>
      <SEO {...seo} />
      <BreadcrumbsJSONLD
        items={[
          { name: elContent.home, url: 'https://nvc-home4you.eu/el' },
          { name: elContent.title, url: seo.url },
        ]}
      />
      <PrivacyPage locale="el" content={elContent} />
    </>
  )
}
