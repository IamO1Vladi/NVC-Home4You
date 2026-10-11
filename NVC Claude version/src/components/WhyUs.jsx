// Three reasons, each a claim the site already publishes elsewhere: no hidden costs, a
// real person answers, delivered across the EU. Static cards, no framer-motion.
import React from 'react'

function Icon({ name }) {
  switch (name) {
    case 'qa':
      return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h6" /></svg>
    case 'person':
      return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
    case 'truck':
      return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
    default:
      return <svg className="hp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
  }
}

export default function WhyUs({ content }) {
  const items = content?.items || []
  if (!content || !items.length) return null

  return (
    <section className="hp-why-section" aria-labelledby="hp-why-title">
      <div className="hp-container">
        <div className="hp-head">
          <div>
            <h2 id="hp-why-title">{content.heading}</h2>
            {content.subheading ? <p className="hp-sub">{content.subheading}</p> : null}
          </div>
        </div>
        <div className="hp-why">
          {items.map((item) => (
            <div key={item.title} className="hp-card hp-why-card">
              <Icon name={item.icon} />
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
