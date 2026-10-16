// src/routes/bg/BgPrivacyRoute.jsx
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import PrivacyPage from '../../pages/PrivacyPage.jsx'
import bgContent from '../../content/bg/privacy.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js, as
// on every other route. Breadcrumbs as on the other pages: the home page, then this one.
export default function BgPrivacyRoute() {
  const seo = getRouteSeo(paths.privacy.bg, 'bg')

  return (
    <>
      <SEO {...seo} />
      <BreadcrumbsJSONLD
        items={[
          { name: bgContent.home, url: 'https://nvc-home4you.eu/bg' },
          { name: bgContent.title, url: seo.url },
        ]}
      />
      <PrivacyPage locale="bg" content={bgContent} />
    </>
  )
}
