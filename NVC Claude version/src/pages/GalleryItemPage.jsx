import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import SEO from '../components/SEO.jsx'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../style/Gallery.css'
import GalleryModal, { GalleryRichText } from '../components/GalleryModal.jsx'
import { GalleryBreadcrumbsJSONLD, GalleryProductJSONLD } from '../components/GalleryStructuredData.jsx'
import {
  blockText,
  snippet,
  useGalleryItems,
  findItemBySlug,
  getLocalizedTitle,
  getLocalizedDescription,
  getCoverUrl,
  getItemImages,
  getCurrency,
  getCategoryLabels,
  formatGalleryPrice,
  getItemSlug,
  getMetaContentId,
  buildMetaProductPayload,
  isPrefabItem,
} from '../gallery/galleryUtils.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { paths } from '../routes/paths.js'
import { galleryItemLinks, routerPath } from '../gallery/itemLinks.js'
import { absoluteUrl } from '../lib/productRows.js'

function ProductBody({ item, content, locale, onRequestModel, onClose }) {
  const [activeImage, setActiveImage] = useState(0)
  const title = getLocalizedTitle(item, locale)
  const description = getLocalizedDescription(item, locale)
  const images = getItemImages(item)
  const cover = getCoverUrl(item)
  const currency = getCurrency(item, locale)
  const displayImages = images.length ? images : (cover ? [cover] : [])
  const current = displayImages[activeImage] || displayImages[0] || ''

  // A steel-frame project already built (prefab, 2026-10-17) is not a model with a "from"
  // price: its price is what that project cost, a house like it is priced per project, and
  // the enquiry is for a house like it (the owner: every steel house is its own project).
  const prefab = isPrefabItem(item)
  const price = typeof item?.price === 'number' ? formatGalleryPrice(item.price, currency, locale) : null
  let priceText = price ? `${content.pricePrefix}${price}` : content.priceOnRequest
  if (prefab && price && content.projectPrice) priceText = content.projectPrice.replace('{price}', price)
  else if (prefab && !price && content.priceByProject) priceText = content.priceByProject
  const categoryText = getCategoryLabels(item?.category, content.categories).join(' · ')
  const links = galleryItemLinks(item, locale, content.links)

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
        {/* A project's price carries its note ("· с ДДС, за този проект"), too long to sit
            beside the title on a laptop: that row wraps the pill under the title instead. */}
        <div className={['gdetail-titleRow', prefab && price && 'gdetail-titleRow--wrap'].filter(Boolean).join(' ')}>
          <div>
            <h1 className="gdetail-title">{title}</h1>
            {categoryText ? <div className="gdetail-kicker">{categoryText}</div> : null}
          </div>
          <div className="gdetail-price">{priceText}</div>
        </div>

        {description ? (
          <div className="gdetail-section">
            <h2 className="gdetail-sectionTitle">{content.descriptionTitle}</h2>
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
              onRequestModel?.({
                id: item.id,
                // What the visitor reads in the offer form, in their own language.
                title,
                // What the lead carries for staff, who read Bulgarian whatever language the
                // visitor browsed in. The public id alone does not name the house for
                // staff, so the enquiry also gives its Bulgarian name and the page
                // where staff can see it. Both helpers fall back exactly as the Bulgarian
                // gallery itself does for an item with no Bulgarian fields, so the path is
                // always one that gallery resolves.
                titleBg: getLocalizedTitle(item, 'bg'),
                path: `${paths.gallery.bg}/${getItemSlug(item, 'bg')}`,
                catalogId: getMetaContentId(item),
                // The offer form names it as "a house like" this one.
                ...(prefab ? { like: true } : {}),
              })
              onClose()
            }}
          >
            {(prefab && content.requestLikeCta) || content.requestCta}
          </button>
        </div>

        {/* Onward from this model: its product page, its price with assembly, the configurator
            on it and the delivery calculator (src/gallery/itemLinks.js). Real links in the
            markup, so the prerender carries them. */}
        {links.length ? (
          <div className="gdetail-section gdetail-more">
            <h2 className="gdetail-sectionTitle" id={`gdetail-more-${item.id}`}>{content.links?.heading}</h2>
            <ul className="gdetail-links" aria-labelledby={`gdetail-more-${item.id}`}>
              {links.map((link) => (
                <li key={link.key} data-link={link.key}>
                  <Link to={link.to}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
  const descriptionText = item ? blockText(getLocalizedDescription(item, locale)) : content.notFoundText
  const url = item ? `${basePath}/${getItemSlug(item, locale)}` : basePath
  // The back link is a router path. listPath is the absolute gallery URL the breadcrumbs'
  // markup needs, and a <Link> to it sent every other host (a preview, the dev server) to
  // production.
  const backTo = routerPath(listPath)

  const trackedViewContentRef = useRef(new Set())

  // What had focus when the product modal opened: the gallery card, as GalleryModal never
  // moves focus itself. See closeForOffer below.
  const openerRef = useRef(null)
  useLayoutEffect(() => {
    if (modal) openerRef.current = document.activeElement
  }, [modal])

  // "Request an offer" opens the offer form and then closes this modal. The form records the
  // focused element as the place to hand focus back to, and navigate(-1) is about to unmount
  // this modal and its button with it, so the card the visitor came from takes focus first;
  // closing the form then lands keyboard users back on it instead of at the top of the page.
  const closeForOffer = () => {
    if (!modal) return
    if (openerRef.current?.isConnected) openerRef.current.focus()
    navigate(-1)
  }

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
          <GalleryProductJSONLD item={item} locale={locale} url={url} categoryLabels={content.categories} />
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
            <Link className="gdetail-back" to={backTo}>{content.backToGallery}</Link>
          </div>
        )}

        {loading && <div className="gdetail-state">{content.loading}</div>}
        {!loading && error && <div className="gdetail-state">{content.error}</div>}
        {!loading && !error && !item && (
          <div className="gdetail-state">
            <h1 className="gdetail-title">{content.notFoundTitle}</h1>
            <p className="gdetail-copy">{content.notFoundText}</p>
            {!modal && <Link className="btn mt-3" to={backTo}>{content.backToGallery}</Link>}
          </div>
        )}
        {!loading && !error && item && <ProductBody item={item} content={content} locale={locale} onRequestModel={onRequestModel} onClose={closeForOffer} />}
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

  // The head, once the gallery has answered. Until then (and if it fails) the page keeps the
  // tags the server put in for this product (GallerySeoService), which react-helmet replaces
  // when this renders (they are marked data-rh), rather than a "not found" title and a
  // canonical to the gallery for as long as the list loads. A product the gallery does not hold
  // is noindex, as the server's 404 for it already says. The share card is the product's own
  // photo and an og:type of product, as the server's tags have it; the photo's size is not
  // known here, so no width or height is claimed for it.
  const cover = item ? getCoverUrl(item) : ''
  const head = !loading && !error ? (
    <SEO
      title={item ? `${title} | NVC Home4You` : `${content.notFoundTitle} | NVC Home4You`}
      description={snippet(descriptionText || content.notFoundText, 155)}
      url={url}
      canonical={url}
      locale={locale}
      hreflangs={hreflangs}
      noindex={!item}
      type={item ? 'product' : 'website'}
      {...(cover ? { image: absoluteUrl(cover), imageWidth: null, imageHeight: null, imageType: null } : {})}
    />
  ) : null

  return (
    <main className="arx gdetail-page">
      {head}
      {panel}
    </main>
  )
}
