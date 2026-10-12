// The six catalogues, one band on the home page, so a visitor can take the whole range
// with them. The content files name each brochure by SLUG and the href is built with the
// shared brochureUrl(slug, page, locale) helper, never a file name (brochure.test.js pins
// both), so replacing a PDF in the admin panel changes nothing here. The section carries
// id="catalogues" because the strip's "see all six catalogues" line and the phone menu's
// "Catalogues (PDF)" row jump to it.
import React from 'react'
import { brochureUrl } from '../lib/brochure.js'

// One small front elevation per range, all standing on the same ground line (y=20) so the six
// read as a row of buildings: stacked modules for the general catalogue, ribs for the
// containers, a roof slab over full glazing, a mono-pitch roof over a shop window, a core box
// with its wings unfolding, a pod on legs. Keyed by slug like the hrefs; a slug with no
// drawing here gets the plain document, so a seventh catalogue never renders an empty tile.
const CATALOGUE_ICON = {
  'modular-builds': (
    <>
      <path d="M2 20h20" />
      <path d="M3 20V13h18v7M12 13v7" />
      <rect x="7.5" y="6" width="9" height="7" />
      <path d="M5.5 20v-4.5h3V20M14.5 15.5h4V18h-4zM10 8.5h4V11h-4z" />
    </>
  ),
  'standard-containers': (
    <>
      <path d="M2 20h20" />
      <rect x="3" y="8" width="18" height="12" />
      <path d="M7 10.5v7M10.5 10.5v7M14 10.5v7M17.5 10.5v7" />
    </>
  ),
  'villa-office': (
    <>
      <path d="M2 20h20" />
      <rect x="2.5" y="6" width="19" height="2.5" />
      <path d="M4 20V8.5M20 20V8.5" />
      <rect x="6.5" y="11" width="11" height="9" />
      <path d="M10.2 11v9M13.8 11v9" />
    </>
  ),
  'sloped-roof': (
    <>
      <path d="M2 20h20" />
      <path d="M2.5 9.3L21.5 5.2" />
      <path d="M4 20V9M20 20V5.5" />
      <rect x="6.5" y="12" width="7" height="5" />
      <rect x="15.5" y="12" width="2.5" height="8" />
    </>
  ),
  'box-house': (
    <>
      <path d="M2 20h20" />
      <rect x="8.5" y="6" width="7" height="14" />
      <path d="M8.5 12H3v8M15.5 12H21v8" />
      <path d="M6.5 8.5H3M4.8 6.8L3 8.5l1.8 1.7M17.5 8.5H21M19.2 6.8L21 8.5l-1.8 1.7" />
      <rect x="10.5" y="14" width="3" height="6" />
    </>
  ),
  'space-capsules': (
    <>
      <path d="M2 20h20" />
      <rect x="3" y="6" width="18" height="10" rx="5" />
      <rect x="6.5" y="8.5" width="11" height="5" rx="2.5" />
      <path d="M7 16v4M17 16v4" />
    </>
  ),
}

const DOCUMENT_ICON = (
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </>
)

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
              <span className="hp-cat-ico" aria-hidden="true">
                <svg className="hp-ico" viewBox="0 0 24 24">
                  {CATALOGUE_ICON[item.brochureSlug] || DOCUMENT_ICON}
                </svg>
                <span className="hp-cat-tag">PDF</span>
              </span>
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
