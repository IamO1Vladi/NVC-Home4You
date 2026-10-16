// src/routes/en/EnPrivacyRoute.jsx
import SEO from '../../components/SEO.jsx'
import { BreadcrumbsJSONLD } from '../../components/StructuredData.jsx'
import PrivacyPage from '../../pages/PrivacyPage.jsx'
import enContent from '../../content/en/privacy.js'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

// Title, description, canonical and hreflangs (all three languages) come from routeMeta.js, as
// on every other route. Breadcrumbs as on the other pages: the home page, then this one.
export default function EnPrivacyRoute() {
  const seo = getRouteSeo(paths.privacy.en, 'en')

  return (
    <>
      <SEO {...seo} />
      <BreadcrumbsJSONLD
        items={[
          { name: enContent.home, url: 'https://nvc-home4you.eu/en' },
          { name: enContent.title, url: seo.url },
        ]}
      />
      <PrivacyPage locale="en" content={enContent} />
    </>
  )
}
