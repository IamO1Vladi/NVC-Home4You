import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import SEO from '../../components/SEO.jsx'
import GalleryIndexPage from '../../pages/GalleryIndexPage.jsx'
import GalleryItemPage from '../../pages/GalleryItemPage.jsx'
import { GalleryBreadcrumbsJSONLD } from '../../components/GalleryStructuredData.jsx'
import { paths } from '../paths.js'
import { getRouteSeo } from '../../seo/routeMeta.js'

export default function GalleryRoutes({ locale, content, basePath, homeUrl, onRequestModel }) {
  const location = useLocation()
  const backgroundLocation = location.state?.backgroundLocation
  const indexSeo = getRouteSeo(paths.gallery[locale] || paths.gallery.en, locale)
  // The detail page names an item's category with the same labels the index filters show:
  // `categories` (the singular names) in its Product markup, `shown` (the chips' words) on the
  // page. Its price reads the index cards' words (`card`), so a model's price says the same
  // thing on its card and on its page.
  const detailContent = {
    ...content.detail,
    altBase: content.altBase,
    homeUrl,
    breadcrumbs: content.breadcrumbs,
    categories: content.filters?.categories,
    shown: content.filters?.shown,
    card: content.card,
  }

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route
          index
          element={(
            <>
              {/* The head from routeMeta.js, as on every other route: one title per locale, the
                  locale's og:locale, and the full bg/en/el/x-default cluster. The canonical is
                  the bare gallery URL whatever the query: a filter (?cat=wagon, linked from the
                  product pages), a page (?p=2) or a tracking tag (?utm_source=…, ?fbclid=…) is
                  the same list, not a page of its own, and the alternates only name the bare
                  URLs, so a self-canonical with a query had no hreflang cluster to belong to. */}
              <SEO {...indexSeo} />

              <GalleryBreadcrumbsJSONLD
                items={[
                  { name: content.breadcrumbs.home, url: homeUrl },
                  { name: content.breadcrumbs.gallery, url: basePath },
                ]}
              />
              <GalleryIndexPage locale={locale} content={content} basePath={basePath} />
            </>
          )}
        />
        <Route
          path=":slug"
          element={(
            <GalleryItemPage
              locale={locale}
              content={detailContent}
              basePath={basePath}
              listPath={basePath}
              onRequestModel={onRequestModel}
            />
          )}
        />
      </Routes>

      {backgroundLocation && (
        <Routes>
          <Route
            path=":slug"
            element={(
              <GalleryItemPage
                locale={locale}
                content={detailContent}
                basePath={basePath}
                listPath={basePath + (backgroundLocation.search || '')}
                modal
                onRequestModel={onRequestModel}
              />
            )}
          />
        </Routes>
      )}
    </>
  )
}
