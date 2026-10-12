import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../routes/paths.js'
import '../style/CasesPage.css'
import './Testimonials.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// A review's `product` is the KEY the review form saved ("modularBuilds"), and the words
// for it live beside that form, in each locale's cases content. Loaded lazily and only for
// this locale, so the home page does not carry the cases page's copy in three languages.
const CASES_CONTENT = import.meta.glob('../content/*/cases.js', { import: 'default' })

async function loadProductLabels(locale) {
  const load = CASES_CONTENT[`../content/${locale}/cases.js`] || CASES_CONTENT['../content/en/cases.js']
  try {
    return (await load?.())?.copy?.filters || {}
  } catch {
    // Without labels a review still shows; it just falls back to what was stored.
    return {}
  }
}

// An older review may hold free text rather than a key; that prints as it was typed.
// Own keys only, so a stored "constructor" cannot print a function.
function productLabel(labels, value) {
  return value && Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : value
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

const fill = (pattern, values) => Object.entries(values).reduce(
  (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
  String(pattern || ''),
)

// Reviews are shown in the language they were written in, so the quote and the name carry
// a lang attribute read off their script: a screen reader then switches voice, and a
// visitor on /en gets a cue that the Cyrillic quote is a Bulgarian review, not a glitch.
export function detectLang(text) {
  const s = String(text || '')
  if (/\p{Script=Cyrillic}/u.test(s)) return 'bg'
  if (/\p{Script=Greek}/u.test(s)) return 'el'
  if (/\p{Script=Latin}/u.test(s)) return 'en'
  return null
}

function Stars({ value = 0 }) {
  const rounded = clamp(Math.round(value), 0, 5)
  return (
    <div className="cs-stars" aria-label={`${rounded} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < rounded ? 'is-on' : ''}>★</span>
      ))}
    </div>
  )
}

function Tick() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
}

// The address of the feed. A product page asks the API for that product's reviews, so the
// rating and count above them are that product's too; filtering the home feed here would
// have put the site-wide "4.8 from 12" over a list of some other number of reviews.
function featuredUrl({ take, product }) {
  const query = new URLSearchParams({ take: String(take) })
  if (product) query.set('product', product)
  return `${API_BASE}/api/reviews/featured?${query}`
}

// A product page passes `product` (the key the review form saves, e.g. "modularBuilds") and
// sees only reviews of that product, at most `limit` of them; with neither, this is the home
// page's section exactly as it was. Either way it renders nothing when no review is left.
export default function Testimonials({ locale = 'en', content, product, limit }) {
  const [state, setState] = useState({ loading: true, items: [], average: 0, total: 0, productLabels: {} })
  const take = content?.take || 3

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [response, productLabels] = await Promise.all([
          fetch(featuredUrl({ take: product ? limit || take : take, product })),
          loadProductLabels(locale),
        ])
        if (!response.ok) throw new Error('Reviews API unavailable')
        const json = await response.json()
        if (!active) return
        let items = Array.isArray(json.items) ? json.items : []
        if (limit) items = items.slice(0, limit)
        setState({
          loading: false,
          items,
          average: toNumber(json.averageRating, 0),
          total: toNumber(json.totalCount, 0),
          productLabels,
        })
      } catch {
        if (active) setState({ loading: false, items: [], average: 0, total: 0, productLabels: {} })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [take, locale, product, limit])

  // One sentence under the heading: "4.8 from 12 verified reviews".
  const aggregate = useMemo(() => {
    const score = state.average ? state.average.toFixed(1) : '—'
    const pattern = content?.aggregatePattern || `{score} · ${content?.countLabel || '{count} reviews'}`
    return fill(pattern, { score, count: state.total })
  }, [content, state.average, state.total])

  // Nothing approved yet (or the API is unreachable): hide the section entirely rather
  // than render an empty widget that would weaken the page instead of adding proof.
  if (!content || state.loading || !state.items.length) return null

  const casesPath = paths.cases?.[locale] || paths.cases?.en || '/'

  return (
    <section className="testimonials" aria-label={content.heading}>
      <div className="hp-container">
        <div className="testimonials-head">
          <div>
            <h2 className="cs-h2">{content.heading}</h2>
            {content.subheading ? <p className="cs-muted mt-2">{content.subheading}</p> : null}
            {/* The label is read before the figures, not instead of them: an aria-label on
                the paragraph would have replaced "4.8 from 12 verified reviews" for a screen
                reader with the label alone. */}
            <p className="hp-agg">
              {content.aggregateAria ? <span className="visually-hidden">{content.aggregateAria}: </span> : null}
              <span className="hp-agg-star" aria-hidden="true">★</span>
              <span>{aggregate}</span>
            </p>
          </div>
        </div>

        <div className="testimonials-grid">
          {state.items.map((review) => {
            const lang = detectLang(`${review.comment || ''} ${review.name || ''}`)
            const foreign = lang && lang !== locale ? content.reviewIn?.[lang] : null
            return (
              <article className="cs-review-card" key={review.id}>
                {review.comment ? <p className="cs-body-copy" lang={lang || undefined}>“{review.comment}”</p> : null}

                <div className="cs-review-head">
                  <div>
                    <div className="cs-review-name" lang={lang || undefined}>{review.name || content.customerFallback || 'Customer'}</div>
                    {review.company ? <div className="cs-muted">{review.company}</div> : null}
                  </div>
                  <div className="cs-review-rating">
                    <Stars value={toNumber(review.rating, 0)} />
                  </div>
                </div>

                <div className="testimonials-meta cs-muted">
                  <span className="cs-chip"><Tick />{content.verified || 'Verified'}</span>
                  {[productLabel(state.productLabels, review.product), review.location].filter(Boolean).join(' · ')}
                </div>
                {foreign ? <div className="hp-review-lang">{foreign}</div> : null}
              </article>
            )
          })}
        </div>

        {content.ctaLabel ? (
          <div className="testimonials-cta">
            <Link className="hp-btn ghost" to={casesPath}>{content.ctaLabel}</Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
