// How a house gets from the first call to handover: six steps as a plain ordered list.
//
// Static on purpose. The old version was six buttons under a progress meter that read
// "17 %" before the visitor had done anything, with only the active step's text in the
// HTML. Now every step and its sentence is in the page, prerendered, and nothing moves.
import React from 'react'

export default function Steps({ content }) {
  const items = content?.items || []
  if (!content || !items.length) return null

  return (
    <section className="hp-steps-section" aria-labelledby="hp-steps-title">
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <h2 id="hp-steps-title">{content.heading}</h2>
          </div>
        </div>
        <ol className="hp-steps">
          {items.map((item, i) => (
            <li key={item.title} className="hp-card hp-step">
              <strong><span className="hp-step-n" aria-hidden="true">{i + 1}</span>{item.title}</strong>
              <p>{item.long}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
