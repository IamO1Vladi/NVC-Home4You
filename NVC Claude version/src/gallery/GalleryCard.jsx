// One model's card, as the gallery index shows it (moved here from GalleryIndexPage.jsx on
// 2026-10-17, unchanged, so the item page's "Подобни модели" draws the same card), and the
// helpers that price it. The item page's price block reads the same two helpers, so a model's
// price says the same thing on its card and on its page.
//
// A card is the photo uncovered, the model's name (its one link, stretched over the card), its
// price with what it includes, and a cue to its page.
//
// The price and its words come from the prices table's own rows (shared/prices.js
// buildPriceSections, the call /bg/ceni and the product pages make): a container's price
// includes its assembly, a Box house's does not, and a model whose assembly figure the table
// does not know says only "with VAT". A steel-frame project (prefab, 2026-10-17) is in neither
// section: its price is that project's, and without one it is "priced per project".
import React from 'react'
import { Link } from 'react-router-dom'
import { buildPriceSections } from '../content/shared/prices.js'
import { isPrefabItem } from './galleryUtils.js'
import { euro } from '../lib/euro.js'
import { cdnImage, cdnSrcSet, imageFallback } from '../lib/img.js'
import { displayTitle } from '../lib/productRows.js'

/**
 * Each item's row in the prices table, keyed by the item itself rather than its id: two items
 * can share an id (App.galleryEnquiry.test.jsx keeps a pair on purpose).
 */
export function priceEntries(items) {
  const { box, wagon } = buildPriceSections(items)
  const map = new Map()
  for (const row of box) map.set(row.item, { kind: 'box', row })
  for (const row of wagon) map.set(row.item, { kind: 'wagon', row })
  return map
}

/** One item's row in the prices table ({ kind, row }), or null. */
export function priceEntry(item) {
  return item ? priceEntries([item]).get(item) || null : null
}

/**
 * The words beside a card's price: what the price includes, as the prices table says it. A
 * container's includes its assembly; a Box house's does not when the table has its assembly
 * figure; a house that arrives ready (the capsule, in either of its categories) has none to
 * add; a steel-frame project's is that project's price; anything else says only that VAT is
 * in, rather than guess.
 */
export function priceBasis(item, entry, basis) {
  if (isPrefabItem(item) && basis.project) return basis.project
  if (entry?.kind === 'wagon') return basis.wagon
  if (entry?.kind === 'box' && entry.row.arrivesReady && basis.ready) return basis.ready
  if (entry?.kind === 'box' && entry.row.assemblyGross != null) return basis.box
  return basis.vat
}

/**
 * A card's price and the words beside it: { price, basis }, price null when the model has
 * none (then basis says why: priced per project for a steel-frame project, on request
 * otherwise). `content` is the gallery content (card.basis, detail.priceOnRequest).
 */
export function cardPrice(item, entry, content, locale) {
  const price = Number(item?.price) > 0 ? euro(item.price, locale) : null
  // With no price, a steel-frame project is priced per project, not "on request".
  const noPrice = (isPrefabItem(item) && content.card.basis.projectOnRequest) || content.detail.priceOnRequest
  return { price, basis: price ? priceBasis(item, entry, content.card.basis) : noPrice }
}

/**
 * @param item         a localized gallery item (useLocalizedGalleryItems / toLocalizedItem)
 * @param entry        its prices-table entry (priceEntries)
 * @param content      the gallery content
 * @param to           where the name links; the index's own relative slug by default
 * @param linkState    the link's router state; the index opens the model over the list
 * @param replace      replace the history entry rather than push (a model opened from the modal)
 * @param headingLevel 2 on the index; 3 (or 4 in the modal) under "Подобни модели"
 */
export default function GalleryCard({ item, entry, content, locale, location, eager, to, linkState, replace, headingLevel = 2 }) {
  const base = import.meta.env.BASE_URL || '/'
  const title = displayTitle(item.title)
  const { price, basis } = cardPrice(item, entry, content, locale)
  const Heading = headingLevel === 3 ? 'h3' : headingLevel === 4 ? 'h4' : 'h2'

  return (
    <article className="hp-card gl-card">
      {item.coverUrl ? (
        <img
          className="gl-photo"
          src={cdnImage(item.coverUrl, { width: 480 })}
          srcSet={cdnSrcSet(item.coverUrl, [240, 320, 480, 640, 800])}
          sizes="(max-width: 759px) 50vw, (max-width: 1099px) 33vw, 290px"
          alt={title}
          width="1024"
          height="1024"
          loading={eager ? 'eager' : 'lazy'}
          fetchpriority={eager ? 'high' : 'low'}
          decoding="async"
          onError={imageFallback(`${base}modular-builds/card.svg`)}
        />
      ) : (
        <div className="gl-photo" aria-hidden="true" />
      )}

      <div className="gl-body">
        <Heading className="gl-title">
          <Link
            to={to ?? item.slug}
            state={linkState === undefined ? { backgroundLocation: location } : linkState}
            replace={replace}
            className="gl-link"
          >
            {title}
          </Link>
        </Heading>
        <p className="gl-cost">
          {price ? <strong className="gl-price">{price}</strong> : null}
          <span className="gl-basis">{basis}</span>
        </p>
        {/* The link above already names the model; this only shows where the card leads. */}
        <span className="gl-go" aria-hidden="true">{content.card.more}</span>
      </div>
    </article>
  )
}
