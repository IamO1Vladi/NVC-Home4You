// The six catalogues, one band on the home page, so a visitor can take the whole range
// with them. The content files name each brochure by SLUG and the href is built with the
// shared brochureUrl(slug, page, locale) helper, never a file name (brochure.test.js pins
// both), so replacing a PDF in the admin panel changes nothing here. The section carries
// id="catalogues" because the strip's "see all six catalogues" line and the phone menu's
// "Catalogues (PDF)" row jump to it.
import React from 'react'
import { brochureUrl } from '../lib/brochure.js'

export default function Catalogues({ locale = 'en', content }) {
  const items = Array.isArray(content?.items) ? content.items.filter((item) => item?.brochureSlug) : []
  if (!content || !items.length) return null

  return (
    <section className="hp-catalogues" id="catalogues" aria-labelledby="hp-catalogues-title">
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <h2 id="hp-catalogues-title">{content.heading}</h2>
            {content.subheading ? <p className="hp-sub">{content.subheading}</p> : null}
          </div>
        </div>

        <div className="hp-cats">
          {items.map((item) => (
            <a
              key={item.brochureSlug}
              className="hp-card hp-cat"
              href={brochureUrl(item.brochureSlug, 1, locale)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="hp-doc" aria-hidden="true">PDF</span>
              <span>
                <strong>{item.label}</strong>
                {item.note ? <span>{item.note}</span> : null}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
