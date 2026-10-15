// „Гаранция" on the containers and Box houses pages: the owner's terms of 2026-10-15, worded
// by each page's content file and filled with the years from shared/warranty.js, so the two
// pages, the partner page and the FAQ cannot quote different figures.
//
// The assembly block's description list (pp-terms): one row per element, its years and what
// it covers, then one line on when and under what conditions the terms apply and one on what
// they do not cover. A row whose key the module does not know is left out rather than printed
// with an empty figure. Never used on the steel-frame houses page: those are quoted per project.
import React from 'react'
import { WARRANTY_YEARS } from '../../content/shared/warranty.js'

const fill = (pattern, values) => Object.entries(values).reduce(
  (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
  String(pattern || ''),
)

/**
 * @param id         the section id, also the stem of the heading's id
 * @param content    { heading, lead?, rows: [{ key, label, text }], conditions, excluded }; a
 *                   row's {years} is filled from WARRANTY_YEARS[key]
 * @param className  the section's band, if the page wants one here
 */
export default function WarrantyTerms({ id = 'warranty', content, className }) {
  const rows = (content?.rows || []).filter((row) => WARRANTY_YEARS[row.key] != null)
  if (!rows.length) return null
  const titleId = `${id}-title`

  return (
    <section className={['pp-warranty', className].filter(Boolean).join(' ')} id={id} aria-labelledby={titleId}>
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <h2 id={titleId}>{content.heading}</h2>
            {content.lead ? <p className="hp-sub">{content.lead}</p> : null}
          </div>
        </div>

        <dl className="pp-terms" aria-labelledby={titleId}>
          {rows.map((row) => (
            <div key={row.key} data-warranty={row.key}>
              <dt>{row.label}</dt>
              <dd>{fill(row.text, { years: WARRANTY_YEARS[row.key] })}</dd>
            </div>
          ))}
        </dl>

        <p className="pp-note">{content.conditions}</p>
        <p className="pp-note">{content.excluded}</p>
      </div>
    </section>
  )
}
