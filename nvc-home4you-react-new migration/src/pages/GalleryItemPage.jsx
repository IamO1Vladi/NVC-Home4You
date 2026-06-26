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
} from '../gallery/galleryUtils.js'

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
          {current ? <img src={current} alt={title} className="gdetail-mainimg" loading="eager" /> : null}
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
                <img src={src} alt="" loading="lazy" />
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
          <button className="btn" onClick={() => {onRequestModel?.({ id: item.id, title }); onClose()}}>{content.requestCta}</button>
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

  const productId = String(item.id || getItemSlug(item, locale) || slug || '')
  if (!productId) return

  const eventKey = `${locale}:${productId}:${url}`
  if (trackedViewContentRef.current.has(eventKey)) return
  trackedViewContentRef.current.add(eventKey)

  const metaPayload = {
    content_ids: [productId],
    content_type: 'product',
    content_name: getLocalizedTitle(item, locale),
    content_category: item.category || 'Gallery product',
    currency: getCurrency(item, locale) || 'EUR',
  }

  if (typeof item.price === 'number') {
    metaPayload.value = item.price
  }

  window.fbq('track', 'ViewContent', metaPayload)
}, [item, locale, slug, url])

  const otherLocale = locale === 'bg' ? 'en' : 'bg'
  const alternateUrl = item ? `${otherLocale === 'bg' ? content.altBase.bg : content.altBase.en}/${getItemSlug(item, otherLocale)}` : null

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
        hreflangs={item && alternateUrl ? [
          { hrefLang: locale, href: url },
          { hrefLang: otherLocale, href: alternateUrl },
        ] : undefined}
      />
      {panel}
    </main>
  )
}
