import React, { useEffect, useMemo, useRef, useState } from 'react'
import SEO from '../components/SEO.jsx'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../style/Gallery.css'
import GalleryModal, { GalleryRichText } from '../components/GalleryModal.jsx'
import { GalleryBreadcrumbsJSONLD, GalleryProductJSONLD } from '../components/GalleryStructuredData.jsx'
import {
  htmlToText,
  snippet,
  useGalleryItems,
  findItemBySlug,
  getLocalizedTitle,
  getLocalizedDescription,
  getCoverUrl,
  getItemImages,
  getCurrency,
  getItemSlug,
  getMetaContentId,
  buildMetaProductPayload,
} from '../gallery/galleryUtils.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'

function ProductBody({ item, content, locale, onRequestModel, onClose }) {
  const [activeImage, setActiveImage] = useState(0)
  const title = getLocalizedTitle(item, locale)
  const description = getLocalizedDescription(item, locale)
  const images = getItemImages(item)
  const cover = getCoverUrl(item)
  const currency = getCurrency(item, locale)
  const displayImages = images.length ? images : (cover ? [cover] : [])
  const current = displayImages[activeImage] || displayImages[0] || ''

  const priceText = typeof item?.price === 'number'
    ? `${content.pricePrefix}${currency === 'EUR' ? '€' : ''}${item.price.toLocaleString()}${currency !== 'EUR' ? ` ${currency}` : ''}`
    : content.priceOnRequest

  return (
    <div className="gdetail-grid">
      <div className="gdetail-mediaCard">
        <div className="gdetail-mediaFrame">
          {current ? <img src={cdnImage(current, { width: 900 })} srcSet={cdnSrcSet(current, [400, 600, 800, 1200])} sizes="(max-width: 900px) 100vw, 600px" alt={title} className="gdetail-mainimg" loading="eager" fetchpriority="high" decoding="async" /> : null}
        </div>
        {displayImages.length > 1 && (
          <div className="gdetail-thumbs">
            {displayImages.map((src, index) => (
              <button
                key={`${src}-${index}`}
                type="button"
                className={['gthumb', index === activeImage && 'is-active'].filter(Boolean).join(' ')}
                onClick={() => setActiveImage(index)}
                aria-label={`${content.imageThumb} ${index + 1}`}
              >
                <img src={cdnImage(src, { width: 160 })} srcSet={cdnSrcSet(src, [120, 160, 240])} sizes="80px" alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="gdetail-card">
        <div className="gdetail-titleRow">
          <div>
            <h1 className="gdetail-title">{title}</h1>
            {item.category ? <div className="gdetail-kicker">{item.category}</div> : null}
          </div>
          <div className="gdetail-price">{priceText}</div>
        </div>

        {description ? (
          <div className="gdetail-section">
            <div className="gdetail-sectionTitle">{content.descriptionTitle}</div>
            <GalleryRichText description={description} />
          </div>
        ) : null}

        <div className="gdetail-actions">
          <button
            className="btn"
            onClick={() => {
              if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
                const payload = buildMetaProductPayload(item, locale)
                if (payload) window.fbq('track', 'AddToCart', payload)
              }
              onRequestModel?.({ id: item.id, title, catalogId: getMetaContentId(item) })
              onClose()
            }}
          >
            {content.requestCta}
          </button>
        </div>
      </div>
    </div>
  )
}
export default function GalleryItemPage({ locale, content, basePath, listPath, modal = false, onRequestModel }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { items, loading, error } = useGalleryItems()

  const item = useMemo(() => findItemBySlug(items, slug, locale), [items, slug, locale])
  const title = item ? getLocalizedTitle(item, locale) : content.notFoundTitle
  const descriptionText = item ? htmlToText(getLocalizedDescription(item, locale)) : content.notFoundText
  const url = item ? `${basePath}/${getItemSlug(item, locale)}` : basePath

  const trackedViewContentRef = useRef(new Set())

useEffect(() => {
  if (!item || typeof window === 'undefined' || typeof window.fbq !== 'function') return

  const metaPayload = buildMetaProductPayload(item, locale)
  const productId = metaPayload?.content_ids?.[0]
  if (!productId) return

  const eventKey = `${locale}:${productId}:${url}`
  if (trackedViewContentRef.current.has(eventKey)) return
  trackedViewContentRef.current.add(eventKey)

  window.fbq('track', 'ViewContent', metaPayload)
}, [item, locale, slug, url])

  // Emit hreflang alternates for every locale we have a gallery base path for, plus x-default → en.
  const hreflangs = useMemo(() => {
    if (!item) return undefined
    const bases = content.altBase || {}
    const links = ['bg', 'en', 'el']
      .filter((loc) => bases[loc])
      .map((loc) => ({ hrefLang: loc, href: `${bases[loc]}/${getItemSlug(item, loc)}` }))
    if (bases.en) links.push({ hrefLang: 'x-default', href: `${bases.en}/${getItemSlug(item, 'en')}` })
    return links.length ? links : undefined
  }, [item, content.altBase])

  const panel = (
    <>
      {!modal && (
        <>
          <GalleryProductJSONLD item={item} locale={locale} url={url} />
          <GalleryBreadcrumbsJSONLD
            items={[
              { name: content.breadcrumbs.home, url: content.homeUrl },
              { name: content.breadcrumbs.gallery, url: listPath },
              ...(item ? [{ name: title, url }] : []),
            ]}
          />
        </>
      )}
      <div className={modal ? 'gdetail-panel gdetail-panel--modal' : 'gdetail-panel'}>
        {!modal && (
          <div className="gdetail-head">
            <Link className="gdetail-back" to={listPath}>{content.backToGallery}</Link>
          </div>
        )}

        {loading && <div className="gdetail-state">{content.loading}</div>}
        {!loading && error && <div className="gdetail-state">{content.error}</div>}
        {!loading && !error && !item && (
          <div className="gdetail-state">
            <h1 className="gdetail-title">{content.notFoundTitle}</h1>
            <p className="gdetail-copy">{content.notFoundText}</p>
            {!modal && <Link className="btn mt-3" to={listPath}>{content.backToGallery}</Link>}
          </div>
        )}
        {!loading && !error && item && <ProductBody item={item} content={content} locale={locale} onRequestModel={onRequestModel} onClose={ () => (modal && navigate(-1))} />}
      </div>
    </>
  )

  if (modal) {
    return (
      <GalleryModal open onClose={() => navigate(-1)} closeLabel={content.closeLabel}>
        {panel}
      </GalleryModal>
    )
  }

  return (
    <main className="arx gdetail-page">
      <SEO
        title={item ? `${title} | NVC Home4You` : `${content.notFoundTitle} | NVC Home4You`}
        description={snippet(descriptionText || content.notFoundText, 155)}
        url={url}
        canonical={url}
        locale={locale}
        hreflangs={hreflangs}
      />
      {panel}
    </main>
  )
}
