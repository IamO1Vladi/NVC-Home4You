// "Looking for something else?": the other product pages, one card each, so a visitor who
// landed on the wrong one of the three is one tap from the right one.
//
// Each card is a single link (it has nothing else to do), with the page's name, one line
// about it and, when the page passes it, the live "from" price of that line, worded with
// what it includes ("from €4,300 incl. VAT and assembly"). The price string is computed by
// the page from the same gallery rows the other page's cards render (src/lib/productRows.js),
// never typed here, so a sibling card cannot quote a figure the page it opens does not show.
import React from 'react'
import { Link } from 'react-router-dom'

/**
 * @param id       the section id, also the stem of the heading's id
 * @param heading  the h2 over the cards
 * @param lead     an optional line under it
 * @param items    [{ to, label, desc?, price? }]; `to` is a router path in this locale
 * @param go       the small "see →" line at the foot of each card
 */
export default function SiblingLinks({ id = 'pp-siblings', heading, lead, items = [], go }) {
  const list = (items || []).filter((item) => item && item.to && item.label)
  if (!list.length) return null
  const titleId = `${id}-title`

  return (
    <section className="pp-siblings" id={id} aria-labelledby={heading ? titleId : undefined}>
      <div className="hp-container">
        {heading ? (
          <div className="hp-head">
            <div>
              <h2 id={titleId}>{heading}</h2>
              {lead ? <p className="hp-sub">{lead}</p> : null}
            </div>
          </div>
        ) : null}
        <ul className="pp-sibs">
          {list.map((item) => (
            <li key={item.to}>
              <Link className="hp-card pp-sib" to={item.to}>
                <strong className="pp-sib-label">{item.label}</strong>
                {item.desc ? <span className="pp-sib-desc">{item.desc}</span> : null}
                {item.price ? <span className="pp-sib-price">{item.price}</span> : null}
                {go ? <span className="pp-sib-go" aria-hidden="true">{go}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
