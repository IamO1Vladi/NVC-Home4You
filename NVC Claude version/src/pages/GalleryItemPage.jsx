// One gallery model: its own page on a direct load (/bg/galeriq/<slug>), or the route modal
// over the gallery index when a card is opened from it (GalleryRoutes.jsx,
// state.backgroundLocation). Both draw the same view (src/gallery/GalleryItemView.jsx); this
// file adds what belongs to each: the page's head, its Product and BreadcrumbList markup and
// its H1; the modal's dialog shell, its footer of actions and its way back to the card.
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import SEO from '../components/SEO.jsx'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/Gallery.css'
import GalleryModal from '../components/GalleryModal.jsx'
import { GalleryBreadcrumbsJSONLD, GalleryProductJSONLD } from '../components/GalleryStructuredData.jsx'
import GalleryItemView, { ItemActions, itemChipLabel } from '../gallery/GalleryItemView.jsx'
import {
  blockText,
  snippet,
  useGalleryItems,
  findItemBySlug,
  getLocalizedTitle,
  getLocalizedDescription,
  getCoverUrl,
  getItemSlug,
  getMetaContentId,
  buildMetaProductPayload,
  isPrefabItem,
} from '../gallery/galleryUtils.js'
import { paths } from '../routes/paths.js'
import { routerPath } from '../gallery/itemLinks.js'
import { absoluteUrl } from '../lib/productRows.js'
import { useModalActions } from '../context/ModalActions.jsx'

export default function GalleryItemPage({ locale, content, basePath, listPath, modal = false, onRequestModel }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { items, loading, error } = useGalleryItems()
  const { openQuestion } = useModalActions()

  const item = useMemo(() => findItemBySlug(items, slug, locale), [items, slug, locale])
  const title = item ? getLocalizedTitle(item, locale) : content.notFoundTitle
  const descriptionText = item ? blockText(getLocalizedDescription(item, locale)) : content.notFoundText
  const url = item ? `${basePath}/${getItemSlug(item, locale)}` : basePath
  // The back link is a router path. listPath is the absolute gallery URL the breadcrumbs'
  // markup needs, and a <Link> to it sent every other host (a preview, the dev server) to
  // production.
  const backTo = routerPath(listPath)
  const headingId = modal ? 'gi-modal-title' : 'gi-page-title'

  const trackedViewContentRef = useRef(new Set())

  // What had focus when the product modal opened: the gallery card. The modal moves focus into
  // itself, and this is where it goes back to (see the cleanup below and closeForOffer).
  // Only an element outside the modal counts: under StrictMode the effects run twice, and the
  // second pass would otherwise record the modal's own heading, which the modal has focused by
  // then. A browser that does not focus a clicked link (Safari) leaves the body focused; then
  // the card is found by its link.
  const openerRef = useRef(null)
  useLayoutEffect(() => {
    if (!modal || openerRef.current) return
    const active = document.activeElement
    if (active && active !== document.body && !active.closest?.('.gmodal-portal')) openerRef.current = active
  }, [modal])
  const slugRef = useRef(slug)
  const opener = () => {
    if (openerRef.current?.isConnected) return openerRef.current
    const first = slugRef.current
    return [...document.querySelectorAll('a.gl-link')].find((a) => {
      try {
        return decodeURIComponent(a.getAttribute('href') || '').endsWith(`/${first}`)
      } catch {
        return false
      }
    }) || null
  }

  // Esc, the close button or the backdrop: the modal is gone, and focus with it, so the card the
  // visitor came from takes it back. Not when the offer or question form has it: that form
  // opened as this modal closed, and hands focus back to the card itself when it closes.
  useEffect(() => {
    if (!modal) return undefined
    return () => {
      const active = document.activeElement
      const lost = !active || active === document.body || !active.isConnected
      if (!lost) return
      // After the modal is gone, as a StrictMode re-run unmounts it for a moment too.
      const card = opener()
      if (card && !document.querySelector('.gmodal-portal')) card.focus({ preventScroll: true })
    }
  }, [modal]) // eslint-disable-line react-hooks/exhaustive-deps

  // "Request an offer" opens the offer form and then closes this modal. The form records the
  // focused element as the place to hand focus back to, and navigate(-1) is about to unmount
  // this modal and its button with it, so the card the visitor came from takes focus first;
  // closing the form then lands keyboard users back on it instead of at the top of the page.
  const closeForOffer = () => {
    if (!modal) return
    opener()?.focus()
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

  const requestOffer = () => {
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
      ...(isPrefabItem(item) ? { like: true } : {}),
    })
    closeForOffer()
  }

  // The site's question form, as on the product pages. From the modal it closes the modal, as
  // the offer form does: the forms open under it.
  const askQuestion = () => {
    openQuestion?.()
    closeForOffer()
  }

  const actions = item ? (
    <ItemActions item={item} content={content} onRequest={requestOffer} onAsk={askQuestion} bar={!modal} />
  ) : null

  const Heading = modal ? 'h2' : 'h1'
  let body
  if (loading) {
    body = <div className="hp-card gdetail-state" id={modal ? headingId : undefined} role="status">{content.loading}</div>
  } else if (error) {
    body = <div className="hp-card gdetail-state" id={modal ? headingId : undefined} role="alert">{content.error}</div>
  } else if (!item) {
    body = (
      <div className="hp-card gdetail-state">
        <Heading className="gi-title" id={headingId} tabIndex={modal ? -1 : undefined} data-autofocus={modal ? '' : undefined}>{content.notFoundTitle}</Heading>
        <p className="gdetail-copy">{content.notFoundText}</p>
        {!modal && <Link className="hp-btn ghost" to={backTo}>{content.backToGallery}</Link>}
      </div>
    )
  } else {
    body = (
      <GalleryItemView
        item={item}
        items={items}
        content={content}
        locale={locale}
        basePath={basePath}
        mode={modal ? 'modal' : 'page'}
        headingId={headingId}
        actions={modal ? null : actions}
        backTo={backTo}
        backgroundLocation={location.state?.backgroundLocation}
        showChip={!modal}
      />
    )
  }

  if (modal) {
    const chip = item ? itemChipLabel(item, content) : ''
    return (
      <GalleryModal
        open
        onClose={() => navigate(-1)}
        closeLabel={content.closeLabel}
        labelledBy={headingId}
        head={chip ? <span className="gi-chip">{chip}</span> : null}
        footer={actions}
        resetKey={slug}
      >
        {body}
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
    <main className="hp pp gi-page">
      {head}
      <GalleryProductJSONLD item={item} locale={locale} url={url} categoryLabels={content.categories} />
      <GalleryBreadcrumbsJSONLD
        items={[
          { name: content.breadcrumbs.home, url: content.homeUrl },
          { name: content.breadcrumbs.gallery, url: listPath },
          ...(item ? [{ name: title, url }] : []),
        ]}
      />
      <div className="hp-container">
        {item ? body : (
          <>
            <div className="gi-top">
              <Link className="gdetail-back" to={backTo}>{content.backToGallery}</Link>
            </div>
            {body}
          </>
        )}
      </div>
    </main>
  )
}
