import React from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import SEO from '../../components/SEO.jsx'
import GalleryIndexPage from '../../pages/GalleryIndexPage.jsx'
import GalleryItemPage from '../../pages/GalleryItemPage.jsx'
import { GalleryBreadcrumbsJSONLD } from '../../components/GalleryStructuredData.jsx'

export default function GalleryRoutes({ locale, content, basePath, homeUrl, onRequestModel }) {
  const location = useLocation()
  const backgroundLocation = location.state?.backgroundLocation
  const effectiveLocation = backgroundLocation || location
  // The detail page names an item's category with the same labels the index filters show.
  const detailContent = {
    ...content.detail,
    altBase: content.altBase,
    homeUrl,
    breadcrumbs: content.breadcrumbs,
    categories: content.filters?.categories,
  }

  return (
    <>
      <Routes location={backgroundLocation || location}>
        <Route
          index
          element={(
            <>
              {/* locale: without it SEO.jsx's 'bg' default won and overrode App's og:locale,
                  so the Greek and English indexes both announced themselves as bg_BG. */}
              <SEO
                title={content.seo.title}
                description={content.seo.description}
                url={basePath + (effectiveLocation.search || '')}
                canonical={basePath + (effectiveLocation.search || '')}
                locale={locale}
                hreflangs={[
                  { hrefLang: 'bg', href: content.altBase.bg },
                  { hrefLang: 'en', href: content.altBase.en },
                  { hrefLang: 'el', href: content.altBase.el },
                ]}
              />
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
