import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { paths } from '../routes/paths.js'
import '../style/CasesPage.css'
import './Testimonials.css'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
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

export default function Testimonials({ locale = 'en', content }) {
  const [state, setState] = useState({ loading: true, items: [], average: 0, total: 0 })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const take = content?.take || 3
        const response = await fetch(`${API_BASE}/api/reviews/featured?take=${take}`)
        if (!response.ok) throw new Error('Reviews API unavailable')
        const json = await response.json()
        if (!active) return
        setState({
          loading: false,
          items: Array.isArray(json.items) ? json.items : [],
          average: toNumber(json.averageRating, 0),
          total: toNumber(json.totalCount, 0),
        })
      } catch {
        if (active) setState({ loading: false, items: [], average: 0, total: 0 })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [content])

  const countLabel = useMemo(() => {
    const template = content?.countLabel || '{count} reviews'
    return template.replace('{count}', String(state.total))
  }, [content, state.total])

  // Nothing approved yet (or the API is unreachable): hide the section entirely rather
  // than render an empty widget that would weaken the page instead of adding proof.
  if (!content || state.loading || !state.items.length) return null

  const casesPath = paths.cases?.[locale] || paths.cases?.en || '/'

  return (
    <section className="testimonials" aria-label={content.heading}>
      <div className="container">
        <div className="testimonials-head">
          <div>
            <h2 className="cs-h2" style={{ margin: 0 }}>{content.heading}</h2>
            {content.subheading ? <p className="cs-muted mt-2">{content.subheading}</p> : null}
          </div>

          <div className="testimonials-aggregate" aria-label={content.aggregateAria || content.heading}>
            <div className="testimonials-score">{state.average ? state.average.toFixed(1) : '—'}</div>
            <div>
              <Stars value={state.average} />
              <div className="cs-muted mt-2">{countLabel}</div>
            </div>
          </div>
        </div>

        <div className="testimonials-grid mt-6">
          {state.items.map((review) => (
            <article className="cs-review-card" key={review.id}>
              <div className="cs-review-head">
                <div>
                  <div className="cs-review-name">{review.name || content.customerFallback || 'Customer'}</div>
                  {review.company ? <div className="cs-muted">{review.company}</div> : null}
                </div>
                <div className="cs-review-rating">
                  <Stars value={toNumber(review.rating, 0)} />
                </div>
              </div>

              {review.comment ? <p className="cs-body-copy mt-4">“{review.comment}”</p> : null}

              <div className="testimonials-meta cs-muted mt-3">
                <span className="cs-chip">{content.verified || 'Verified'}</span>
                {[review.product, review.location].filter(Boolean).join(' · ')}
              </div>
            </article>
          ))}
        </div>

        {content.ctaLabel ? (
          <div className="testimonials-cta mt-6">
            <Link className="btn ghost" to={casesPath}>{content.ctaLabel}</Link>
          </div>
        ) : null}
      </div>
    </section>
  )
}
