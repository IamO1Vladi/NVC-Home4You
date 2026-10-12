// One product on a product page: its photo, its name, its price, the one thing that sets it
// apart from the card beside it, and the two things to do about it.
//
// The home strip's card (.hp-card, the 4:3 photo, the big tabular price with its small
// caption) so a model looks the same on home and on its own page, with two differences the
// job asks for. The card is not one big link: it holds a button that opens the offer form
// with this model attached (requestModel), and a button inside a link is invalid and
// unusable by keyboard. And the price is always printed, with the words that say what it
// includes; the old pages hid specs behind hover and showed no prices at all.
//
// id="item-<galleryId>" is the anchor, as on /bg/ceni, so a link or a search result can
// land on one card. `wide` is for a one-off that is not one of a series (the capsule): the
// photo beside the text on a wide screen, its facts in two columns.
//
// On a phone the card is one column, unlike the home strip's photo-beside-words row: a
// product title here is the gallery's full name ("Жилищен фургон - 6000мм*3000мм"), which
// wrapped over four lines beside a thumbnail. So the photo spans the card (sizes="100vw"),
// the price and its caption share a line when they fit, and the button and the details
// link each take the card's width.
import React from 'react'
import Action from './Action.jsx'
import { cdnImage, cdnSrcSet, imageFallback } from '../../lib/img.js'

// Six cards each saying "Details →" are six identical links to a screen reader listing
// them, so each action also names its model, visibly only in the card around it.
function named(action, title) {
  if (!action?.label || !title || action.ariaLabel) return action
  return { ...action, label: <>{action.label}<span className="visually-hidden">: {title}</span></> }
}

/**
 * @param id           the gallery id; the card's anchor is item-<id>
 * @param title        the gallery title, as the visitor's language has it
 * @param headingLevel 3 under a section's h2 (default); 2 if the card stands alone
 * @param photo        { url, alt?, position? }; alt defaults to the title
 * @param price        { value, prefix?, caption? } with value already formatted
 * @param difference   one line: what this one has that the others do not
 * @param lines        more short lines (sizes, the assembly figure), shown as a list
 * @param primary      { label, onClick | href | to }, the solid button
 * @param details      { label, to | href }, the quieter "details" link
 * @param wide         one product rather than one of a series
 */
export default function UnitCard({
  id,
  title,
  headingLevel = 3,
  photo,
  price,
  difference,
  lines,
  primary,
  details,
  wide = false,
}) {
  const Heading = headingLevel === 2 ? 'h2' : headingLevel === 4 ? 'h4' : 'h3'
  const base = import.meta.env.BASE_URL || '/'
  const cardFallback = `${base}modular-builds/card.svg`
  const src = photo?.url || ''
  const extra = Array.isArray(lines) ? lines.filter(Boolean) : []

  return (
    <article className={`hp-card pp-unit${wide ? ' pp-unit--wide' : ''}`} id={id != null ? `item-${id}` : undefined}>
      {src ? (
        <img
          className="pp-unit-photo"
          src={cdnImage(src, { width: wide ? 800 : 640 })}
          srcSet={cdnSrcSet(src, [320, 480, 640, 800, 1200])}
          sizes={wide
            ? '(max-width: 719px) 100vw, (max-width: 979px) 50vw, 560px'
            : '(max-width: 639px) 100vw, (max-width: 979px) 50vw, 384px'}
          alt={photo.alt ?? title ?? ''}
          loading="lazy"
          decoding="async"
          width="1200"
          height="900"
          style={photo.position ? { objectPosition: photo.position } : undefined}
          onError={imageFallback(cardFallback)}
        />
      ) : null}

      <div className="pp-unit-body">
        <Heading className="pp-unit-title">{title}</Heading>
        {price?.value || price?.caption ? (
          <div className="pp-unit-cost">
            {price?.value ? (
              <p className="pp-unit-price">
                {price.prefix ? <small>{price.prefix} </small> : null}
                {price.value}
              </p>
            ) : null}
            {price?.caption ? <p className="pp-unit-caption">{price.caption}</p> : null}
          </div>
        ) : null}
        {difference ? <p className="pp-unit-diff">{difference}</p> : null}
        {extra.length ? (
          <ul className="pp-unit-lines">
            {extra.map((line, i) => <li key={typeof line === 'string' ? line : i}>{line}</li>)}
          </ul>
        ) : null}
      </div>

      {primary || details ? (
        <div className="pp-unit-actions">
          <Action action={named(primary, title)} className="hp-btn" />
          <Action action={named(details, title)} className="pp-unit-more" />
        </div>
      ) : null}
    </article>
  )
}
