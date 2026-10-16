// One gallery model, as its page and as the modal over the gallery both show it (2026-10-17).
// Until then the two drew it from grey see-through panels: "Описание" twice, the request button
// below the fold, a "from" before a fixed price, the admin's raw title and the old category
// word ("ФУРГОН"), and nothing about delivery, warranty or assembly.
//
// Built on the product pages' system (HomePage.css tokens, ProductPage.css, the hp-btn and
// hp-card), so it reads in both themes like the rest of the site. What is on it, in order:
//   - the photos at their own shape (ItemPhotos): thumbnails, previous and next, the arrow keys,
//     a swipe, and a full-screen view;
//   - the category chip in the gallery filters' words, the cleaned title the gallery card shows
//     (displayTitle), and the card's own price and words (GalleryCard cardPrice), plus a Box
//     house's assembly figure where the prices table has it;
//   - the actions (ItemActions): in the summary on a wide page, a bar along the bottom of a
//     narrow one, the modal's footer;
//   - the key facts (itemFacts.js): every figure from its module;
//   - the description, the admin's sanitised rich text, tidied (tidyDescription);
//   - "Още за този модел" (itemLinks.js, unchanged) and "Подобни модели" (similarItems).
//
// The page heads it with the H1 and the visible breadcrumbs; the modal heads it with an h2 the
// dialog is labelled by, and the index keeps its own H1.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import GalleryCard, { cardPrice, priceEntry } from './GalleryCard.jsx'
import { itemFacts, itemKind, similarItems, tidyDescription } from './itemFacts.js'
import { galleryItemLinks, routerPath } from './itemLinks.js'
import {
  getItemImages,
  getCoverUrl,
  getItemSlug,
  getLocalizedDescription,
  getLocalizedTitle,
  isPrefabItem,
  toLocalizedItem,
} from './galleryUtils.js'
import { sanitizeRichText } from '../lib/sanitizeRichText.js'
import { lockScroll } from '../lib/scrollLock.js'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { displayTitle } from '../lib/productRows.js'
import { euro } from '../lib/euro.js'

const fill = (pattern, values = {}) => Object.entries(values).reduce(
  (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
  String(pattern ?? ''),
)

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/** The focusable elements inside `root` that are on screen. */
export function focusableIn(root) {
  if (!root) return []
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[hidden], [inert]')
    && (typeof el.checkVisibility === 'function' ? el.checkVisibility() : true))
}

/**
 * Tab and Shift+Tab stay inside `root`. Focus on `root` itself (the modal's sheet, which takes
 * it while the model loads and when its text is clicked) counts as outside the controls: from
 * there the browser's own Shift+Tab would leave the dialog.
 */
export function trapTab(event, root) {
  const nodes = focusableIn(root)
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (!root.contains(active) || active === root) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function Chevron({ dir }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** A horizontal swipe of more than 40px, mostly sideways: -1 (to the previous photo), 1, or 0. */
function swipeStep(start, end) {
  if (!start || !end) return 0
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

function useSwipe(onStep) {
  const start = useRef(null)
  return {
    onTouchStart: (e) => {
      const t = e.touches?.[0]
      start.current = t ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd: (e) => {
      const t = e.changedTouches?.[0]
      const step = swipeStep(start.current, t ? { x: t.clientX, y: t.clientY } : null)
      start.current = null
      if (step) onStep(step)
    },
  }
}

/**
 * The full-screen view: one photo at a time on a dark ground, with the same previous, next,
 * arrow keys and swipe. Esc closes it, and only it: its keys are caught before the gallery
 * modal's, which stays open underneath. Focus stays inside it and goes back to the button that
 * opened it.
 */
function PhotoViewer({ images, index, onIndex, alt, copy, closeLabel, onClose }) {
  const ref = useRef(null)
  const closeRef = useRef(null)
  const count = images.length
  const go = useCallback((step) => onIndex((i) => (i + step + count) % count), [onIndex, count])
  const swipe = useSwipe(go)
  // The keys read the latest props through a ref, so the listener, the scroll lock and the
  // focus hand-back are set up once for the view's whole life, not again on every photo.
  const latest = useRef({ onClose, go, count })
  latest.current = { onClose, go, count }

  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    const unlock = lockScroll()
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        latest.current.onClose()
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (latest.current.count < 2) return
        e.preventDefault()
        e.stopPropagation()
        latest.current.go(e.key === 'ArrowRight' ? 1 : -1)
      } else if (e.key === 'Tab') {
        e.stopPropagation()
        trapTab(e, ref.current)
      }
    }
    // Capture, on the window: before the gallery modal's own Escape and Tab (on the document).
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      unlock()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  const src = images[index] || images[0]
  return createPortal(
    <div className="gi-viewer" role="dialog" aria-modal="true" aria-label={fill(copy.viewer, { title: alt })} ref={ref}>
      <div className="gi-viewer-bar">
        {count > 1 ? <span className="gi-viewer-count" aria-live="polite">{fill(copy.counter, { n: index + 1, total: count })}</span> : <span />}
        <button type="button" className="gi-viewer-close" aria-label={closeLabel} onClick={onClose} ref={closeRef}>
          <CloseIcon />
        </button>
      </div>
      <div
        className="gi-viewer-stage"
        {...swipe}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <img
          key={src}
          className="gi-viewer-img"
          src={cdnImage(src, { width: 2000 })}
          srcSet={cdnSrcSet(src, [800, 1200, 1600, 2000])}
          sizes="100vw"
          alt={alt}
          decoding="async"
        />
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="gi-viewer-nav gi-viewer-nav--prev" aria-label={copy.prev} onClick={() => go(-1)}><Chevron dir="prev" /></button>
          <button type="button" className="gi-viewer-nav gi-viewer-nav--next" aria-label={copy.next} onClick={() => go(1)}><Chevron dir="next" /></button>
        </>
      ) : null}
    </div>,
    document.body,
  )
}

/**
 * The photos. The stage has one shape, 4:3, from the first paint: the widest shape the
 * gallery's photos have (all but two, 16:9, checked 2026-10-17), so a photo is never cropped and
 * only one wider than 4:3 is letterboxed; a square or portrait photo sits whole on a calm
 * neutral ground at its sides. The
 * CSS caps its height to the screen. Fixed rather than read from the photos as they load: the
 * API does not send their sizes, and a stage that took its shape on load moved the title, the
 * price and the facts under it by up to 89px on a phone (layout shift, 2026-10-17 review).
 */
export function ItemPhotos({ images, alt, copy, thumbLabel, closeLabel, eager = true, sizes }) {
  const [index, setIndex] = useState(0)
  const [viewer, setViewer] = useState(false)
  const strip = useRef(null)
  const count = images.length

  const go = useCallback((step) => setIndex((i) => (i + step + count) % count), [count])
  const swipe = useSwipe(go)

  // The current thumbnail stays in view along the strip, without scrolling the page.
  useEffect(() => {
    const row = strip.current
    const thumb = row?.querySelector(`[data-index="${index}"]`)
    if (!row || !thumb || row.scrollWidth <= row.clientWidth) return
    const left = thumb.offsetLeft - (row.clientWidth - thumb.offsetWidth) / 2
    row.scrollTo?.({ left: Math.max(0, left), behavior: 'smooth' })
  }, [index])

  function onKeyDown(e) {
    if (count < 2 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return
    e.preventDefault()
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + count) % count
    setIndex(next)
    // On a thumbnail, focus follows the photo, so the next press moves on from there.
    if (e.target?.closest?.('.gi-thumb')) strip.current?.querySelector(`[data-index="${next}"]`)?.focus()
  }

  if (!count) return null
  const current = images[index] || images[0]

  return (
    <div className="gi-media" role="group" aria-label={copy.label} onKeyDown={onKeyDown}>
      <div className="gi-stage" {...swipe}>
        <img
          key={current}
          className="gi-photo"
          src={cdnImage(current, { width: 900 })}
          srcSet={cdnSrcSet(current, [400, 640, 800, 1200, 1600])}
          sizes={sizes || '(max-width: 767px) 100vw, (max-width: 959px) 50vw, 680px'}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchpriority={eager && index === 0 ? 'high' : undefined}
          decoding="async"
          onClick={() => setViewer(true)}
        />
        {count > 1 ? (
          <>
            <button type="button" className="gi-nav gi-nav--prev" aria-label={copy.prev} onClick={() => go(-1)}><Chevron dir="prev" /></button>
            <button type="button" className="gi-nav gi-nav--next" aria-label={copy.next} onClick={() => go(1)}><Chevron dir="next" /></button>
            <span className="gi-count" aria-live="polite">{fill(copy.counter, { n: index + 1, total: count })}</span>
          </>
        ) : null}
        <button type="button" className="gi-zoom" aria-label={copy.open} onClick={() => setViewer(true)}><ExpandIcon /></button>
      </div>

      {count > 1 ? (
        <ul className="gi-thumbs" ref={strip}>
          {images.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button
                type="button"
                className="gi-thumb"
                data-index={i}
                aria-label={`${thumbLabel} ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
              >
                <img
                  src={cdnImage(src, { width: 160 })}
                  alt=""
                  width="160"
                  height="160"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {viewer ? (
        <PhotoViewer
          images={images}
          index={index}
          onIndex={setIndex}
          alt={alt}
          copy={copy}
          closeLabel={closeLabel}
          onClose={() => setViewer(false)}
        />
      ) : null}
    </div>
  )
}

/**
 * The two things to do about a model: ask for an offer (for a house like it, for a steel-frame
 * project) and ask a question. One request button per view: the offer form's tests find it by
 * its name.
 */
export function ItemActions({ item, content, onRequest, onAsk, bar = false }) {
  const prefab = isPrefabItem(item)
  return (
    <div className={bar ? 'gi-actions gi-bar' : 'gi-actions'}>
      <button type="button" className="hp-btn" onClick={onRequest}>
        {(prefab && content.requestLikeCta) || content.requestCta}
      </button>
      {onAsk && content.askCta ? (
        <button type="button" className="hp-btn ghost" onClick={onAsk}>{content.askCta}</button>
      ) : null}
    </div>
  )
}

/** A run of words with each hyphenated word ("A-Frame") kept whole on its line. */
function keepHyphens(text, key) {
  return String(text).split(/(\S+-\S+)/).map((piece, i) => (i % 2
    ? <span className="gi-keep" key={`${key}-${i}`}>{piece}</span>
    : piece))
}

/**
 * A title with each dash (– or —) kept at the end of a line, with the word before it, rather
 * than at the start of the next ("Жилищен фургон / – 6000мм"), and a hyphenated word kept whole
 * ("A- / Frame"). Spans, not no-break spaces, so the heading's name reads exactly as the title.
 */
export function titleNodes(title) {
  const text = String(title ?? '')
  // Split on the dashes, keeping them: [words, dash, words, dash, words].
  const parts = text.split(/ ([–—]) /)
  if (parts.length < 3) return /\S-\S/.test(text) ? keepHyphens(text, 'w') : text
  const nodes = []
  for (let i = 0; i < parts.length; i += 2) {
    const part = parts[i]
    const dash = parts[i + 1]
    if (dash === undefined) {
      nodes.push(...keepHyphens(part, `w${i}`))
      break
    }
    const cut = part.lastIndexOf(' ')
    if (cut >= 0) nodes.push(...keepHyphens(part.slice(0, cut + 1), `w${i}`))
    nodes.push(<span className="gi-keep" key={`d${i}`}>{cut >= 0 ? part.slice(cut + 1) : part} {dash}</span>, ' ')
  }
  return nodes
}

/** The line of the site's four product lines a model belongs to, in the gallery chips' words. */
export function itemChipLabel(item, content) {
  const kind = itemKind(item)
  return (kind && content.shown?.[kind]) || ''
}

/**
 * @param item        the raw gallery item
 * @param items       every raw gallery item, for "Подобни модели"
 * @param content     the item page's content (GalleryRoutes detailContent)
 * @param basePath    the gallery's base URL (absolute or a router path)
 * @param mode        'page' (H1, breadcrumbs, sticky summary) or 'modal' (h2, no breadcrumbs)
 * @param headingId   the title's id (the modal is labelled by it)
 * @param actions     the actions element for the summary (the page's), or null (the modal's
 *                    are in its footer)
 * @param backTo      the gallery's router path, for the breadcrumbs and the back link (page)
 * @param backgroundLocation the list under the modal, which a similar model opened from it keeps
 * @param showChip    the category chip under the title (the modal shows it in its header)
 */
export default function GalleryItemView({
  item,
  items,
  content,
  locale,
  basePath,
  mode = 'page',
  headingId,
  actions = null,
  backTo,
  backgroundLocation,
  showChip = true,
}) {
  const modal = mode === 'modal'
  const rawTitle = getLocalizedTitle(item, locale)
  // The cleaned title the gallery card shows.
  const title = displayTitle(rawTitle)
  const chip = itemChipLabel(item, content)
  const entry = useMemo(() => priceEntry(item), [item])
  const cardContent = useMemo(() => ({ card: content.card || { basis: {} }, detail: content }), [content])
  const { price, basis } = cardPrice(item, entry, cardContent, locale)
  // A Box house's assembly figure, beside its price, where the prices table has one (the
  // capsule arrives ready and has none).
  const assembly = entry?.kind === 'box' && !entry.row.arrivesReady && entry.row.assemblyGross != null && content.basisAssembly
    ? fill(content.basisAssembly, { price: euro(entry.row.assemblyGross, locale) })
    : ''
  const facts = useMemo(() => itemFacts(item, entry, content.facts, locale), [item, entry, content.facts, locale])
  const links = galleryItemLinks(item, locale, content.links)
  const similar = useMemo(() => similarItems(items, item, 3), [items, item])

  const images = useMemo(() => {
    const list = getItemImages(item)
    const cover = getCoverUrl(item)
    return list.length ? list : (cover ? [cover] : [])
  }, [item])

  const H = modal ? 'h3' : 'h2'
  const description = useMemo(() => tidyDescription(
    sanitizeRichText(getLocalizedDescription(item, locale)),
    { title: content.descriptionTitle, minLevel: modal ? 4 : 3 },
  ), [item, locale, content.descriptionTitle, modal])
  const hasDescription = Boolean(description && description.replace(/<[^>]*>/g, '').trim())

  const galleryBase = routerPath(basePath)
  const similarState = modal && backgroundLocation ? { backgroundLocation } : null

  return (
    <div className={modal ? 'gi gi--modal' : 'gi gi--page'}>
      {!modal ? (
        <div className="gi-top">
          <nav className="gi-crumbs" aria-label={content.breadcrumbsAria}>
            <ol>
              <li><Link to={routerPath(content.homeUrl) || '/'}>{content.breadcrumbs?.home}</Link></li>
              <li><Link to={backTo}>{content.breadcrumbs?.gallery}</Link></li>
              <li aria-current="page"><span>{title}</span></li>
            </ol>
          </nav>
          <Link className="gdetail-back" to={backTo}>{content.backToGallery}</Link>
        </div>
      ) : null}

      <div className="gi-layout">
        <div className="gi-media-col">
          <ItemPhotos
            key={images.join('|')}
            images={images}
            alt={rawTitle}
            copy={content.photos || {}}
            thumbLabel={content.imageThumb}
            closeLabel={content.closeLabel}
            sizes={modal ? '(max-width: 767px) 100vw, (max-width: 959px) 50vw, 620px' : undefined}
          />
        </div>

        <div className="gi-summary">
          {showChip && chip ? <span className="gi-chip">{chip}</span> : null}
          {modal ? (
            <h2 className="gi-title" id={headingId} tabIndex={-1} data-autofocus>{titleNodes(title)}</h2>
          ) : (
            <h1 className="gi-title" id={headingId}>{titleNodes(title)}</h1>
          )}
          <p className="gi-cost">
            {/* The spaces keep the words apart in the text a screen reader or a copy reads; the
                flex row ignores them. */}
            {price ? <><strong className="gi-price">{price}</strong>{' '}</> : null}
            <span className="gi-basis">{basis}</span>
            {assembly ? <>{' '}<span className="gi-extra">{assembly}</span></> : null}
          </p>
          {actions}
          {facts.length ? (
            <dl className="gi-facts">
              {facts.map((fact) => (
                <div key={fact.key} className="gi-fact" data-fact={fact.key}>
                  <dt>{fact.label}</dt>
                  <dd>
                    {fact.value ? <span className="gi-fact-value">{fact.value}</span> : null}
                    {fact.note ? <span className="gi-fact-note">{fact.note}</span> : null}
                    {fact.link ? <Link className="gi-fact-link" to={fact.link.to}>{fact.link.label}</Link> : null}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="gi-details">
          {hasDescription ? (
            <div className="gi-section gi-description">
              <H className="gi-h2">{content.descriptionTitle}</H>
              <div className="gdetail-richtext" dangerouslySetInnerHTML={{ __html: description }} />
            </div>
          ) : null}

          {/* Onward from this model: its product page, its price with assembly, the configurator
              on it and the delivery calculator (itemLinks.js). Real links in the markup, so the
              prerender carries them. */}
          {links.length ? (
            <div className="gi-section gdetail-more">
              <H className="gi-h2" id={`gdetail-more-${item.id}`}>{content.links?.heading}</H>
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

      {/* Under the grid, not in it: the sticky summary (and the phone's bar) stop where the
          model's own content ends. */}
      {similar.length && content.similar?.heading ? (
        <div className="gi-similar" role="region" aria-labelledby={`gi-similar-${item.id}`}>
          <H className="gi-h2" id={`gi-similar-${item.id}`}>{content.similar.heading}</H>
          <ul className="gi-similar-grid">
            {similar.map((other, index) => {
              const localized = toLocalizedItem(other, locale, basePath)
              return (
                <li key={`${other.id}-${index}`}>
                  <GalleryCard
                    item={localized}
                    entry={priceEntry(other)}
                    content={cardContent}
                    locale={locale}
                    to={`${galleryBase}/${getItemSlug(other, locale)}`}
                    linkState={similarState}
                    replace={modal}
                    headingLevel={modal ? 4 : 3}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
