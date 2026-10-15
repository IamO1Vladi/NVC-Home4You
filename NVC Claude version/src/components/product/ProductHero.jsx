// A product page's first screen: what the page sells, what it costs from, and the two
// things a visitor can do about it, beside one real photograph.
//
// Built on the home page's parts (hp-eyebrow, hp-lead, hp-cta-row, hp-btn, hp-facts) so the
// three product pages read as the same site, but not as a full-bleed slideshow: a product
// page has one photo and a spec or two, so the hero is two plain columns that stack on a
// phone. The photo goes above the words there, as on home; any other right-hand column (the
// steel page's "decided per project" card) stays below them, since it is read after the heading.
//
// THE PHOTO IS OPTIONAL AND THAT IS A FEATURE. The steel page has no real build to show and
// a stock render would be the fake the audit removed, so without a photo the right column
// is whatever the page passes as children, and with neither the copy takes the width. A
// photo may carry a caption chip ("58 m² with veranda · Paralia Kariani, Greece · 2026")
// that says where the house actually stands.
//
// The price arrives formatted: the page computes it from the gallery rows (lowest() in
// src/lib/productRows.js) and passes euro(value, locale) with the words that say what the
// figure includes. While the gallery loads there is no figure and no line, rather than a
// stale one; the prerender waits for the gallery, so the snapshot has it.
import React from 'react'
import Action from './Action.jsx'
import { cdnImage, cdnSrcSet, imageFallback } from '../../lib/img.js'

function Tick() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
}

/**
 * @param titleId   the H1's id, which the section is labelled by
 * @param eyebrow   small line above the H1
 * @param title     the H1, plain text
 * @param lead      one or two sentences under it
 * @param price     { value, prefix?, caption? } with value already formatted, or null
 * @param primary   { label, onClick | href | to }, the solid button
 * @param secondary the same shape, the ghost button
 * @param facts     short strings, each with a tick
 * @param photo     { url, alt, caption?, position?, fallback?, srcSet? } or null; srcSet is for a
 *                  static photo under /public, which has no resizer behind it (the About page's
 *                  crane lift in its 800 and 1500 wide crops)
 * @param children  more of the right-hand column (the steel page's card), under the photo if there is one
 */
export default function ProductHero({
  titleId = 'pp-hero-title',
  eyebrow,
  title,
  lead,
  price,
  primary,
  secondary,
  facts,
  photo,
  children,
}) {
  const hasPhoto = Boolean(photo?.url)
  const aside = children || null
  const solo = !hasPhoto && !aside
  // The words span two rows only when a photo AND an aside share the right column. With one
  // of them alone the second row is empty, and spanning it left a band of blank page under
  // the hero as tall as the words overhang the photo.
  const stacked = hasPhoto && aside

  const classes = ['pp-hero']
  if (solo) classes.push('pp-hero--solo')
  if (stacked) classes.push('pp-hero--stacked')

  return (
    <section className={classes.join(' ')} aria-labelledby={titleId}>
      <div className="hp-container pp-hero-grid">
        <div className="pp-hero-copy">
          {eyebrow ? <span className="hp-eyebrow">{eyebrow}</span> : null}
          <h1 id={titleId} className="pp-title">{title}</h1>
          {lead ? <p className="hp-lead">{lead}</p> : null}

          {price?.value ? (
            <p className="pp-price">
              {price.prefix ? <small>{price.prefix}</small> : null}
              {price.prefix ? ' ' : null}
              <strong>{price.value}</strong>
              {price.caption ? <span className="pp-price-caption">{price.caption}</span> : null}
            </p>
          ) : null}

          {primary || secondary ? (
            <div className="hp-cta-row">
              <Action action={primary} className="hp-btn" />
              <Action action={secondary} className="hp-btn ghost" />
            </div>
          ) : null}

          {Array.isArray(facts) && facts.length ? (
            <ul className="hp-facts">
              {facts.map((fact) => <li key={fact}><Tick />{fact}</li>)}
            </ul>
          ) : null}
        </div>

        {hasPhoto ? (
          <figure className="pp-hero-media">
            <img
              src={cdnImage(photo.url, { width: 800 })}
              srcSet={photo.srcSet || cdnSrcSet(photo.url, [480, 640, 800, 1200, 1600])}
              sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 600px"
              alt={photo.alt || ''}
              width="1200"
              height="900"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              style={photo.position ? { objectPosition: photo.position } : undefined}
              onError={imageFallback(photo.fallback)}
            />
            {photo.caption ? <figcaption className="pp-hero-chip">{photo.caption}</figcaption> : null}
          </figure>
        ) : null}

        {aside ? <div className="pp-hero-aside">{aside}</div> : null}
      </div>
    </section>
  )
}
