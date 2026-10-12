// The home page's first screen: the slogan, the price and the place, over one photograph.
//
// The copy is static content so it prerenders whole; only the price is live. The owner's
// rule (2026-10-12): the first sentence quotes the cheapest thing sold, which is the
// cheapest container, VAT and assembly in. That figure is the gallery's own, read off the
// "from" of /api/home/photos (useHomeFrom), the call the page makes for its photos anyway,
// so it is the figure on that container's gallery card and moves when staff change it. Until
// it is known — first visit with nothing seeded, an older API, a failure — the hero prints
// leadNoPrice, the same sentence without a figure, rather than a number typed into the copy
// or €0. The strip below keeps quoting the Box models from its own helpers. The emphasised
// word in the slogan arrives as <g>…</g> in the content and becomes the accent-coloured span.
//
// The numerals are role=tab buttons that pick a slide and stop the crossfade for good;
// focus inside them pauses it while it lasts. The caption beside them links to the product
// page of the photo on screen. No framer-motion: nothing here moves unless the visitor
// moves it, bar the one slow crossfade in HeroShowcase.
import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import HeroShowcase from './HeroShowcase.jsx'
import { paths } from '../routes/paths.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { useHomeFrom } from '../lib/homePhotos.js'

const fill = (pattern, values) => Object.entries(values).reduce(
  (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
  String(pattern || ''),
)

// The lead with its {price} wrapped in <strong>, as React nodes rather than HTML. Without a
// price it prints the fallback, which has no {price} in it; with no fallback either, nothing.
function Lead({ pattern, fallback, price }) {
  const text = price ? pattern : fallback
  if (!text) return null
  const parts = String(text).split('{price}')
  return (
    <p className="hp-lead">
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 ? <strong>{price}</strong> : null}
        </React.Fragment>
      ))}
    </p>
  )
}

function Tick() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
}

export default function Hero({ locale = 'en', content, slides, onOpenOffer }) {
  const [idx, setIdx] = useState(0)
  const [stopped, setStopped] = useState(false)
  const [focused, setFocused] = useState(false)
  const from = useHomeFrom()

  const list = Array.isArray(slides) && slides.length ? slides : (content?.showcase?.slides || [])
  const total = list.length

  // A shorter deck from the API must not leave the index past its end.
  useEffect(() => {
    if (idx >= total) setIdx(0)
  }, [idx, total])

  const advance = useCallback(() => {
    setIdx((i) => (total ? (i + 1) % total : 0))
  }, [total])

  if (!content) return null

  const price = from.wagon == null ? null : euro(from.wagon, locale)
  const current = list[idx] || list[0]
  const currentLabel = current?.label || current?.alt || ''
  const currentTo = current?.pathKey ? (paths[current.pathKey]?.[locale] || paths[current.pathKey]?.en) : null

  return (
    <section className="hp-hero" aria-labelledby="hp-slogan">
      <HeroShowcase
        slides={list}
        index={idx}
        onAdvance={advance}
        intervalMs={7000}
        paused={stopped || focused}
      />

      <div className="hp-container hp-hero-inner">
        <div className="hp-hero-copy">
          {content.eyebrow ? <span className="hp-hero-eyebrow">{content.eyebrow}</span> : null}

          <h1
            id="hp-slogan"
            className="hp-slogan"
            dangerouslySetInnerHTML={{
              __html: String(content.title || '')
                .replace('<g>', '<span class="hp-em">')
                .replace('</g>', '</span>'),
            }}
          />

          <Lead pattern={content.lead} fallback={content.leadNoPrice} price={price} />

          <div className="hp-cta-row">
            <button type="button" className="hp-btn" onClick={onOpenOffer}>{content.primaryCta}</button>
            <a className="hp-btn ghost" href="#prices">{content.pricesCta}</a>
          </div>

          {Array.isArray(content.facts) && content.facts.length ? (
            <ul className="hp-facts">
              {content.facts.map((fact) => (
                <li key={fact}><Tick />{fact}</li>
              ))}
            </ul>
          ) : null}

          {total > 1 ? (
            <div className="hp-nums-row">
              <div
                className="hp-nums"
                role="tablist"
                aria-label={content.slidesLabel || content.showcase?.slidesLabel || ''}
                onFocus={() => setFocused(true)}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false) }}
              >
                {list.map((s, i) => (
                  <button
                    key={`${s.src}-${i}`}
                    type="button"
                    role="tab"
                    className="hp-num"
                    aria-selected={i === idx}
                    aria-label={fill(content.photoLabelPattern || 'Photo {n} of {total}: {label}', {
                      n: i + 1,
                      total,
                      label: s.label || s.alt || '',
                    })}
                    onClick={() => { setStopped(true); setIdx(i) }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </button>
                ))}
              </div>
              {currentTo && currentLabel ? (
                <Link className="hp-now" to={currentTo}>{currentLabel} →</Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
