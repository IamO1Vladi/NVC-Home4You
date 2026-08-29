import React, { useEffect, useMemo, useState } from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import CasesLightbox from '../components/CasesLightbox.jsx'
import '../style/CasesPage.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'

const FORM_INITIAL = {
  name: '',
  company: '',
  email: '',
  location: '',
  product: 'modularBuilds',
  comment: '',
  rating: 5,
}

const PRODUCT_KEYS = [
  'modularBuilds',
  'modularHouses',
  'steelHouses',
  'interiors',
  'delivery',
  'logistics',
  'other',
]

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function average(values = []) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function initials(value = '') {
  return String(value)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'NVC'
}

function normalizeCategory(value) {
  const raw = String(value || '').trim()
  const lower = raw.toLowerCase()

  if (!raw) return 'other'
  if (['modularbuilds', 'modular-builds', 'modular_builds'].includes(lower)) return 'modularBuilds'
  if (['modularhouses', 'modular-houses', 'modular_houses'].includes(lower)) return 'modularHouses'
  if (['steelhouses', 'steel-houses', 'steel_houses'].includes(lower)) return 'steelHouses'
  if (['interiors', 'interior'].includes(lower)) return 'interiors'
  if (['delivery', 'door-to-door', 'door_to_door'].includes(lower)) return 'delivery'
  if (['logistics', 'logistic'].includes(lower)) return 'logistics'

  if (lower.includes('steel')) return 'steelHouses'
  if (lower.includes('modular house')) return 'modularHouses'
  if (lower.includes('modular')) return 'modularBuilds'
  if (lower.includes('interior') || lower.includes('bath') || lower.includes('kitchen')) return 'interiors'
  if (lower.includes('deliver')) return 'delivery'
  if (lower.includes('logistic')) return 'logistics'

  return 'other'
}

function normalizeCase(item = {}, index = 0) {
  const rating = clamp(toNumber(item.rating ?? item.stars ?? item.score, 0), 0, 5)
  const location =
    item.location ||
    [item.city, item.country].filter(Boolean).join(', ') ||
    item.deliveryLocation ||
    ''

  const year = item.year || item.deliveryYear || (item.completedAt ? new Date(item.completedAt).getFullYear() : '')
  const rawImages = toArray(item.images || item.gallery || item.photos).filter(Boolean)
  const fallbackImage = item.imageUrl || item.coverUrl || item.photoUrl || ''
  const images = rawImages.length ? rawImages : (fallbackImage ? [fallbackImage] : [])

  return {
    id: item.id || item.recordId || `case-${index + 1}`,
    companyName: item.companyName || item.company || item.clientName || '',
    companyLogoUrl: item.companyLogoUrl || item.logoUrl || '',
    companyType: item.companyType || item.sector || item.industry || '',
    buyerName: item.buyerName || item.contactName || item.customerName || '',
    buyerRole: item.buyerRole || item.contactRole || '',
    category: normalizeCategory(item.category || item.categoryKey || item.productKey || item.type || item.product),
    product: item.product || item.productName || item.soldItem || item.offerName || '',
    units: item.units || item.quantity || item.qty || '',
    location,
    year: year ? String(year) : '',
    scope: item.scope || item.summary || item.description || '',
    result: item.result || item.outcome || item.installation || item.deliveryResult || '',
    quote: item.quote || item.testimonial || item.review || '',
    rating,
    featured: Boolean(item.featured || item.isFeatured),
    imageUrl: images[0] || '',
    images,
  }
}

function normalizeReview(item = {}, index = 0) {
  const status = String(item.status || '').toLowerCase()
  const approved = status === 'approved' || status === 'published' || status === ''

  return {
    id: item.id || item.recordId || `review-${index + 1}`,
    approved,
    name: item.name || item.customerName || item.reviewerName || '',
    company: item.company || item.companyName || '',
    product: item.product || item.productName || '',
    location: item.location || [item.city, item.country].filter(Boolean).join(', '),
    text: item.comment || item.review || item.message || '',
    rating: clamp(toNumber(item.rating ?? item.stars ?? item.score, 0), 0, 5),
    createdAt: item.createdAt || item.created_on || item.date || '',
  }
}

function normalizeClient(item = {}, index = 0) {
  return {
    id: item.id || item.recordId || `client-${index + 1}`,
    name: item.name || item.companyName || item.company || item.clientName || '',
    sector: item.sector || item.industry || item.companyType || '',
    country: item.country || item.location || '',
    logoUrl: item.logoUrl || item.companyLogoUrl || '',
  }
}

function normalizePayload(payload = {}) {
  const cases = toArray(payload.cases || payload.items || payload.caseStudies).map(normalizeCase)
  const reviews = toArray(payload.reviews || payload.testimonials || payload.ratings)
    .map(normalizeReview)
    .filter((review) => review.approved)
  const clients = toArray(payload.clients || payload.buyers || payload.companies).map(normalizeClient)
  const stats = payload.stats && typeof payload.stats === 'object' ? payload.stats : {}

  return { cases, reviews, clients, stats }
}

function uniqueClientsFromCases(cases = []) {
  const map = new Map()

  cases.forEach((item) => {
    if (!item.companyName) return
    if (map.has(item.companyName)) return
    map.set(item.companyName, {
      id: item.id,
      name: item.companyName,
      sector: item.companyType,
      country: item.location,
      logoUrl: item.companyLogoUrl,
    })
  })

  return Array.from(map.values())
}

function Stars({ value = 0, className = '' }) {
  const rounded = clamp(Math.round(value), 0, 5)
  return (
    <div className={['cs-stars', className].filter(Boolean).join(' ')} aria-label={`${rounded} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < rounded ? 'is-on' : ''}>★</span>
      ))}
    </div>
  )
}

export default function CasesPage({ content }) {
  const { openOffer, openQuestion } = useModalActions()
  const copy = content.copy
  const API_BASE = import.meta.env.VITE_API_BASE || ''

  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState({ cases: [], reviews: [], clients: [], stats: {} })
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(FORM_INITIAL)
  const [submitState, setSubmitState] = useState({ sending: false, success: '', error: '' })
  const [lightbox, setLightbox] = useState({ open: false, item: null, index: 0 })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const response = await fetch(API_BASE + (content.api?.casesPageEndpoint || '/api/cases-page'))
        if (!response.ok) throw new Error('Cases page API unavailable')
        const json = await response.json()
        if (!active) return
        setPayload(normalizePayload(json))
      } catch {
        if (!active) return
        setPayload({ cases: [], reviews: [], clients: [], stats: {} })
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [API_BASE, content.api])

  const clients = useMemo(() => {
    return payload.clients.length ? payload.clients : uniqueClientsFromCases(payload.cases)
  }, [payload.clients, payload.cases])

  const approvedRatings = useMemo(() => payload.reviews.map((item) => item.rating).filter(Boolean), [payload.reviews])
  const averageRating = useMemo(() => average(approvedRatings), [approvedRatings])

  const countriesServed = useMemo(() => {
    const locations = payload.cases
      .map((item) => item.location)
      .filter(Boolean)
      .map((value) => value.split(',').slice(-1)[0].trim())
    return new Set(locations).size
  }, [payload.cases])

  const statCards = useMemo(() => {
    const stats = payload.stats || {}
    return [
      {
        label: copy.stats.cases,
        value: toNumber(stats.publishedCases || stats.cases || stats.totalCases, payload.cases.length),
      },
      {
        label: copy.stats.rating,
        value: averageRating ? `${averageRating.toFixed(1)} / 5` : '—',
      },
      {
        label: copy.stats.reviews,
        value: toNumber(stats.approvedReviews || stats.reviews || stats.totalReviews, payload.reviews.length),
      },
      {
        label: copy.stats.countries,
        value: toNumber(stats.countriesServed || stats.countries || stats.countryCount, countriesServed),
      },
    ]
  }, [payload.stats, payload.cases.length, payload.reviews.length, averageRating, countriesServed, copy.stats])

  const availableFilters = useMemo(() => {
    const set = new Set(payload.cases.map((item) => item.category).filter(Boolean))
    return ['all', ...Array.from(set)]
  }, [payload.cases])

  useEffect(() => {
    if (!availableFilters.includes(filter)) setFilter('all')
  }, [availableFilters, filter])

  const filteredCases = useMemo(() => {
    if (filter === 'all') return payload.cases
    return payload.cases.filter((item) => item.category === filter)
  }, [payload.cases, filter])

  const breakdown = useMemo(() => {
    const total = payload.reviews.length || 0
    return [5, 4, 3, 2, 1].map((stars) => {
      const count = payload.reviews.filter((item) => Math.round(item.rating) === stars).length
      return {
        stars,
        count,
        width: total ? `${(count / total) * 100}%` : '0%',
      }
    })
  }, [payload.reviews])

  function openCaseGallery(item, imageIndex = 0) {
    if (!item || !item.images || !item.images.length) return
    setLightbox({ open: true, item, index: imageIndex })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitState({ sending: true, success: '', error: '' })

    const body = {
      name: form.name,
      company: form.company,
      email: form.email,
      location: form.location,
      product: form.product,
      comment: form.comment,
      rating: Number(form.rating),
    }

    try {
      const response = await fetch(API_BASE + (content.api?.reviewsEndpoint || '/api/reviews'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Review submission failed')

      setForm(FORM_INITIAL)
      setSubmitState({ sending: false, success: copy.success, error: '' })
    } catch {
      setSubmitState({ sending: false, success: '', error: copy.error })
    }
  }

  return (
    <main className="cs-page">
      <section className="cs-hero">
        <div className="container cs-hero-grid">
          <div>
            <h1 className="cs-title">{copy.heroTitle}</h1>
            <p className="cs-lead">{copy.heroLead}</p>

            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>{copy.ctaPrimary}</button>
              <button className="btn ghost" onClick={openQuestion}>{copy.ctaSecondary}</button>
            </div>
          </div>

          <aside className="cs-hero-card">
            <div className="cs-hero-card-title">{copy.panelTitle}</div>
            <ul className="cs-check-list">
              {copy.heroPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="cs-stat-grid">
            {loading
              ? Array.from({ length: 4 }).map((_, index) => (
                  <div className="card p-6 cs-skeleton" key={index} aria-hidden="true">
                    <div className="cs-skeleton-line cs-w-sm" />
                    <div className="cs-skeleton-line cs-w-lg mt-3" />
                  </div>
                ))
              : statCards.map((card) => (
                  <div className="card p-6 cs-stat-card" key={card.label}>
                    <div className="cs-stat-label">{card.label}</div>
                    <div className="cs-stat-value">{card.value}</div>
                  </div>
                ))}
          </div>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="cs-section-head">
            <div>
              <h2 className="cs-h2">{copy.buyersTitle}</h2>
              <p className="cs-muted mt-2">{copy.buyersLead}</p>
            </div>
          </div>

          {clients.length ? (
            <div className="cs-clients-grid">
              {clients.map((client) => (
                <article className="card p-6 cs-client-card" key={client.id || client.name}>
                  <div className="cs-client-mark">
                    {client.logoUrl ? (
                      <img src={cdnImage(client.logoUrl, { width: 240 })} srcSet={cdnSrcSet(client.logoUrl, [120, 240, 360])} sizes="(max-width: 600px) 35vw, 160px" alt={client.name} loading="lazy" decoding="async" />
                    ) : (
                      <span>{initials(client.name)}</span>
                    )}
                  </div>
                  <div>
                    <div className="cs-client-name">{client.name}</div>
                    {client.sector ? <div className="cs-muted">{copy.labels.sector}: {client.sector}</div> : null}
                    {client.country ? <div className="cs-chip mt-3">{client.country}</div> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card p-6 cs-empty-card">{copy.buyersEmpty}</div>
          )}
        </div>
      </section>

      <section>
        <div className="container">
          <div className="cs-section-head cs-stack-mobile">
            <div>
              <h2 className="cs-h2">{copy.casesTitle}</h2>
              <p className="cs-muted mt-2">{copy.casesLead}</p>
            </div>

            <div className="cs-filter-row" role="tablist" aria-label={copy.casesTitle}>
              {availableFilters.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  className={['cs-filter', key === filter && 'is-active'].filter(Boolean).join(' ')}
                  onClick={() => setFilter(key)}
                  aria-selected={key === filter}
                >
                  {copy.filters[key] || copy.filters.other}
                </button>
              ))}
            </div>
          </div>

          {filteredCases.length ? (
            <div className="cs-cases-grid">
              {filteredCases.map((item) => (
                <article className="card cs-case-card" key={item.id}>
                  {item.imageUrl ? (
                    <div className="cs-case-gallery">
                      <button
                        type="button"
                        className="cs-case-media cs-case-media-btn"
                        onClick={() => openCaseGallery(item, 0)}
                      >
                        <img src={cdnImage(item.imageUrl, { width: 800 })} srcSet={cdnSrcSet(item.imageUrl, [400, 600, 800, 1200])} sizes="(max-width: 900px) 100vw, 420px" alt={item.product || item.companyName || copy.casesTitle} loading="lazy" decoding="async" />
                      </button>

                      {item.images.length > 1 ? (
                        <div className="cs-case-thumbs" aria-label={copy.photosLabel}>
                          {item.images.map((image, idx) => (
                            <button
                              type="button"
                              key={`${item.id}-thumb-${idx}`}
                              className="cs-case-thumb"
                              onClick={() => openCaseGallery(item, idx)}
                              aria-label={`${copy.photosLabel} ${idx + 1}`}
                            >
                              <img src={cdnImage(image, { width: 200 })} srcSet={cdnSrcSet(image, [120, 200, 320])} sizes="84px" alt="" loading="lazy" decoding="async" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="p-6">
                    <div className="cs-case-top">
                      <div>
                        <div className="cs-case-title">{item.companyName || item.buyerName || '—'}</div>
                        {item.companyName && item.companyType ? <div className="cs-muted">{item.companyType}</div> : null}
                      </div>
                      {item.featured ? <span className="cs-badge">{copy.featured}</span> : null}
                    </div>

                    <div className="cs-chip-row mt-4">
                      {item.category ? <span className="cs-chip">{copy.filters[item.category] || copy.filters.other}</span> : null}
                      {item.year ? <span className="cs-chip">{copy.labels.year}: {item.year}</span> : null}
                      {item.units ? <span className="cs-chip">{copy.labels.units}: {item.units}</span> : null}
                    </div>

                    <div className="cs-meta-grid mt-5">
                      {item.buyerName || item.companyName ? (
                        <div>
                          <div className="cs-meta-label">{copy.labels.buyer}</div>
                          <div className="cs-meta-value">
                            {item.buyerName || item.companyName}
                            {item.companyName && item.buyerRole ? <span className="cs-inline-note"> · {item.buyerRole}</span> : null}
                          </div>
                        </div>
                      ) : null}

                      {item.product ? (
                        <div>
                          <div className="cs-meta-label">{copy.labels.product}</div>
                          <div className="cs-meta-value">{item.product}</div>
                        </div>
                      ) : null}

                      {item.location ? (
                        <div>
                          <div className="cs-meta-label">{copy.labels.location}</div>
                          <div className="cs-meta-value">{item.location}</div>
                        </div>
                      ) : null}
                    </div>

                    {item.scope ? (
                      <div className="mt-5">
                        <div className="cs-meta-label">{copy.labels.scope}</div>
                        <p className="cs-body-copy">{item.scope}</p>
                      </div>
                    ) : null}

                    {item.result ? (
                      <div className="mt-4">
                        <div className="cs-meta-label">{copy.labels.result}</div>
                        <p className="cs-body-copy">{item.result}</p>
                      </div>
                    ) : null}

                    {item.quote ? <blockquote className="cs-quote">“{item.quote}”</blockquote> : null}

                    <div className="cs-case-foot">
                      <div className="cs-rating-box">
                        <Stars value={item.rating} />
                        <span>{item.rating ? item.rating.toFixed(1) : '—'}</span>
                      </div>
                      <div className="cs-case-actions">
                        {item.images.length ? (
                          <button className="btn ghost" type="button" onClick={() => openCaseGallery(item, 0)}>
                            {copy.photosLabel} ({item.images.length})
                          </button>
                        ) : null}
                        <button className="btn ghost" type="button" onClick={openOffer}>{copy.similarCta}</button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card p-6 cs-empty-card">{copy.noCases}</div>
          )}
        </div>
      </section>

      <section>
        <div className="container cs-reviews-layout">
          <div className="card p-6">
            <h2 className="cs-h2" style={{ marginTop: 0 }}>{copy.reviewsTitle}</h2>
            <p className="cs-muted mt-2">{copy.reviewsLead}</p>

            <div className="cs-rating-summary mt-6">
              <div>
                <div className="cs-rating-value">{averageRating ? averageRating.toFixed(1) : '—'}</div>
                <Stars value={averageRating} className="mt-2" />
                <div className="cs-muted mt-2">
                  {payload.reviews.length
                    ? `${payload.reviews.length} ${copy.stats.reviews.toLowerCase()}`
                    : copy.noRatings}
                </div>
              </div>

              <div>
                <div className="cs-meta-label">{copy.breakdownTitle}</div>
                <div className="cs-breakdown mt-3">
                  {breakdown.map((item) => (
                    <div className="cs-break-row" key={item.stars}>
                      <span>{item.stars}★</span>
                      <div className="cs-break-track"><span style={{ width: item.width }} /></div>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="cs-review-grid mt-6">
              {payload.reviews.length ? (
                payload.reviews.slice(0, 6).map((review) => (
                  <article className="cs-review-card" key={review.id}>
                    <div className="cs-review-head">
                      <div>
                        <div className="cs-review-name">{review.name || copy.labels.customer}</div>
                        {review.company ? <div className="cs-muted">{review.company}</div> : null}
                      </div>
                      <div className="cs-review-rating">
                        <Stars value={review.rating} />
                        <span>{review.rating ? review.rating.toFixed(1) : '—'}</span>
                      </div>
                    </div>

                    {review.product ? (
                      <div className="cs-chip-row mt-3">
                        <span className="cs-chip">{copy.labels.purchased}: {review.product}</span>
                      </div>
                    ) : null}

                    {review.text ? <p className="cs-body-copy mt-4">{review.text}</p> : null}
                    {review.location ? <div className="cs-muted mt-3">{review.location}</div> : null}
                  </article>
                ))
              ) : null}
            </div>
          </div>

          <aside className="card p-6 cs-form-card">
            <h3 className="cs-h3">{copy.formTitle}</h3>
            <p className="cs-muted mt-2">{copy.formLead}</p>

            <form className="cs-form mt-6" onSubmit={handleSubmit}>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={copy.placeholders.name}
                required
              />
              <input
                type="text"
                value={form.company}
                onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                placeholder={copy.placeholders.company}
              />
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder={copy.placeholders.email}
                required
              />
              <input
                type="text"
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder={copy.placeholders.location}
              />
              <select
                value={form.product}
                onChange={(event) => setForm((current) => ({ ...current, product: event.target.value }))}
                aria-label={copy.placeholders.product}
              >
                {PRODUCT_KEYS.map((key) => (
                  <option key={key} value={key}>{copy.filters[key] || copy.filters.other}</option>
                ))}
              </select>

              <div>
                <div className="cs-meta-label">{copy.stats.rating}</div>
                <div className="cs-star-picker mt-3" role="radiogroup" aria-label={copy.stats.rating}>
                  {Array.from({ length: 5 }).map((_, index) => {
                    const value = index + 1
                    return (
                      <button
                        key={value}
                        type="button"
                        className={['cs-star-btn', value <= form.rating && 'is-on'].filter(Boolean).join(' ')}
                        onClick={() => setForm((current) => ({ ...current, rating: value }))}
                        aria-label={`${value} / 5`}
                        aria-pressed={value === form.rating}
                      >
                        ★
                      </button>
                    )
                  })}
                </div>
              </div>

              <textarea
                rows="5"
                value={form.comment}
                onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
                placeholder={copy.placeholders.comment}
                required
              />

              {submitState.success ? <div className="cs-alert is-success">{submitState.success}</div> : null}
              {submitState.error ? <div className="cs-alert is-error">{submitState.error}</div> : null}

              <button className="btn" type="submit" disabled={submitState.sending}>
                {submitState.sending ? copy.sending : copy.submit}
              </button>
            </form>
          </aside>
        </div>
      </section>

      {lightbox.open && lightbox.item?.images?.length ? (
        <CasesLightbox
          content={content.lightbox}
          title={lightbox.item.product || lightbox.item.companyName || copy.casesTitle}
          images={lightbox.item.images}
          index={lightbox.index}
          desc={lightbox.item.result || lightbox.item.scope || ''}
          onClose={() => setLightbox({ open: false, item: null, index: 0 })}
        />
      ) : null}
    </main>
  )
}
