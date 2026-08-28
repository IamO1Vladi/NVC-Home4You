import React, { useEffect, useRef, useState } from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import ProcessTicker from '../components/ProcessTicker.jsx'
import '../style/SteelHouses.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { brochureUrl } from '../lib/brochure.js'

function asset(path) {
  return `${import.meta.env.BASE_URL}${path}`
}

function fillTemplate(template, value) {
  return String(template || '').replace('{idx}', value)
}

export default function SteelHousesPage({ locale, content }) {
  const { openOffer, openQuestion } = useModalActions()
  const slides = Array.isArray(content?.gallery?.slides) ? content.gallery.slides : []
  const [active, setActive] = useState(0)
  const stripRef = useRef(null)
  const fallback = asset('modular-builds/card.svg')

  const toIndex = (i) => {
    const el = stripRef.current
    if (!el) return
    const idx = Math.max(0, Math.min(slides.length - 1, i))
    const x = idx * el.clientWidth
    el.scrollTo({ left: x, behavior: 'smooth' })
    setActive(idx)
  }

  const onPrev = () => toIndex(active - 1)
  const onNext = () => toIndex(active + 1)

  useEffect(() => {
    const el = stripRef.current
    if (!el) return undefined
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / el.clientWidth)
      setActive(i)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <main className="sh-page">
      <section className="sh-hero">
        <div className="container sh-hero-grid">
          <div className="sh-hero-left">
            <h1 className="sh-title">{content.title}</h1>
            <p className="sh-lead">{content.lead}</p>

            <div className="sh-spec-band">
              {content.specs.map((spec) => (
                <div className="sh-spec" key={spec.label}>
                  <div className="sh-spec-h">{spec.label}</div>
                  <div className="sh-spec-v">{spec.value}</div>
                </div>
              ))}
            </div>

            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>{content.getOffer}</button>
              <a
                className="btn ghost"
                href={brochureUrl(content.brochureSlug, content.brochurePage, locale)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {content.brochureLabel}
              </a>
            </div>
          </div>

          <aside className="sh-card">
            <div className="sh-card-h">{content.quick.h}</div>
            <ul className="sh-card-list">
              {content.quick.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <button className="btn small" onClick={openQuestion}>{content.askQuestion}</button>
          </aside>
        </div>
      </section>

      <section>
        <div className="container">
          <ProcessTicker
            title={content.process.title}
            steps={content.process.steps}
            media={content.process.media}
            intervalMs={content.process.intervalMs || 2400}
            labels={content.process.labels}
          />
        </div>
      </section>

      {content.logistics?.enabled ? (
        <section className="sh-logi">
          <div className="container sh-logi-grid">
            <div>
              <div className="sh-logi-h">{content.logistics.h}</div>
              <p className="sh-logi-p">{content.logistics.p}</p>
              <ul className="sh-logi-list">
                {content.logistics.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="sh-logi-cta">
              <button className="btn" onClick={openOffer}>{content.logistics.cta}</button>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <div className="container">
          <div className="sh-gallery-h">{content.gallery.h}</div>

          <div className="sh-slider" aria-roledescription="carousel" aria-label={content.gallery.h}>
            <div className="sh-strip" ref={stripRef}>
              {slides.map((src, i) => (
                <figure className="sh-slide" key={src || i}>
                  <img
                    src={cdnImage(src, { width: 1200 })}
                    srcSet={cdnSrcSet(src, [600, 900, 1200, 1600])}
                    sizes="(max-width: 900px) 100vw, 900px"
                    alt={fillTemplate(content.gallery.alt, i + 1)}
                    onError={(e) => {
                      e.currentTarget.src = fallback
                    }}
                    width="1600"
                    height="1000"
                    loading="lazy"
                  />
                </figure>
              ))}
            </div>

            <div className="sh-slider-ctrls">
              <button
                className="sh-arrow"
                onClick={onPrev}
                aria-label={content.gallery.prev}
                disabled={active === 0}
              >
                ‹
              </button>

              <div className="sh-dots" role="tablist">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === active}
                    aria-label={fillTemplate(content.gallery.goto, i + 1)}
                    className={['sh-dot', i === active && 'is-active'].filter(Boolean).join(' ')}
                    onClick={() => toIndex(i)}
                  />
                ))}
              </div>

              <button
                className="sh-arrow"
                onClick={onNext}
                aria-label={content.gallery.next}
                disabled={active === slides.length - 1}
              >
                ›
              </button>
            </div>

            <div className="sh-count" aria-live="polite">{active + 1}/{slides.length}</div>
          </div>

          <div className="row mt-6" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={openOffer}>{content.getOffer}</button>
            <button className="btn ghost" onClick={openQuestion}>{content.askQuestion}</button>
          </div>
        </div>
      </section>
    </main>
  )
}
