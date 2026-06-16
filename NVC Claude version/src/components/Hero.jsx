import React from 'react'
import { m } from 'framer-motion'
import HeroShowcase from './HeroShowcase.jsx'
import { paths } from '../routes/paths.js'

export default function Hero({ locale = 'en', content, onOpenOffer, onOpenQuestion }) {
  if (!content) return null

  const slides = (content.showcase?.slides || []).map((slide) => ({
    ...slide,
    to: slide.pathKey ? (paths[slide.pathKey]?.[locale] || '/') : slide.to,
  }))

  return (
    <section className="hero">
      <div className="container">
        <div className="hero-grid">
          <div>
            <m.h1
              style={{ fontSize: 'clamp(32px,5vw,70px)', lineHeight: 1.05, margin: 0 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span
                dangerouslySetInnerHTML={{
                  __html: String(content.title || '')
                    .replace('<g>', '<span class="grad-text">')
                    .replace('</g>', '</span>'),
                }}
              />
            </m.h1>

            <m.p
              className="mt-5"
              style={{ maxWidth: 640, color: 'var(--muted)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.5 }}
            >
              {content.lead}
            </m.p>

            <div className="row mt-6">
              <m.button className="btn" onClick={onOpenOffer} whileTap={{ scale: 0.98 }}>
                {content.primaryCta}
              </m.button>
              <m.button className="btn ghost" onClick={onOpenQuestion} whileTap={{ scale: 0.98 }}>
                {content.secondaryCta}
              </m.button>
            </div>

            {Array.isArray(content.badges) && content.badges.length ? (
              <ul className="hero-trust" aria-label={content.motto || ''}>
                {content.badges.map((b) => (
                  <li key={b} className="hero-trust-chip"><span aria-hidden="true">✓</span>{b}</li>
                ))}
              </ul>
            ) : content.motto ? (
              <div className="mt-4" style={{ opacity: 0.7 }}>{content.motto}</div>
            ) : null}
          </div>

          <div>
            <div className="hero-visual">
              <HeroShowcase
                slides={slides}
                durationMs={5600}
                size={560}
                openLabel={content.showcase?.openLabel}
                slidesLabel={content.showcase?.slidesLabel}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
