// src/pages/ModularBuildsPage.jsx
import React from 'react'
import '../style/ModularBuilds.css'

function brochureUrl(file, page = 1) {
  const encoded = encodeURIComponent(file)
  return `${import.meta.env.BASE_URL}modular-builds/${encoded}#page=${page}`
}

function publicAsset(file) {
  const encoded = encodeURIComponent(file)
  return `${import.meta.env.BASE_URL}modular-builds/${encoded}`
}

export default function ModularBuildsPage({ lang, content }) {
  const products = Array.isArray(content?.products) ? content.products : []
  const fallback = publicAsset('card.svg')

  return (
    <main className="mb-page">
      <section className="mb-hero">
        <div className="container mb-hero-grid">
          <div>
            <h1 className="mb-title">{content.title}</h1>
            <p className="mb-lead">{content.heroLead}</p>
            <p className="mb-lead mb-sizes">{content.sizes}</p>
          </div>

          <div className="mb-hero-visual">
            <img
              className="mb-hero-img"
              src={content.heroImage}
              alt={content.heroAlt}
              loading="eager"
              width="800"
              height="500"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="container mb-card-grid">
          {products.map((product) => (
            <a
              key={product.key}
              id={product.key}
              className="mb-card"
              href={brochureUrl(product.brochureFile, product.brochurePage || 1)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={product.aria}
            >
              <img
                className="mb-card-media"
                src={product.image}
                alt={product.alt}
                width="960"
                height="600"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.src = fallback
                }}
              />

              <div className="mb-card-label">{product.title}</div>

              <div className="mb-card-pad">
                <div className="mb-card-kicker">{product.kicker}</div>
                <div className="mb-card-title">{product.title}</div>
                <p className="mb-card-desc">{product.desc}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="container mb-note">
          <small>{content.pdfNote}</small>
        </div>
      </section>
    </main>
  )
}
