import React from 'react'
import { m } from 'framer-motion'

function Icon({ name }) {
  const common = { width: 24, height: 24, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }
  switch (name) {
    case 'qa': return (<svg {...common} viewBox="0 0 24 24"><path d="M4 4h16v12H7l-3 3V4z" /><path d="M9 9h6M9 6h9" /></svg>)
    case 'paper': return (<svg {...common} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16l4-4h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" /></svg>)
    case 'truck': return (<svg {...common} viewBox="0 0 24 24"><path d="M3 6h11v7H3zM14 9h5l2 3v4h-7z" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="17.5" cy="18.5" r="1.5" /></svg>)
    default: return (<svg {...common} viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>)
  }
}

export default function WhyUs({ content }) {
  if (!content) return null

  return (
    <section>
      <div className="container">
        <div className="between">
          <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,28px)' }}>{content.heading}</h2>
          <div style={{ opacity: 0.75 }}>{content.subheading}</div>
        </div>
        <div className="grid cols-2 md-cols-3 mt-6">
          {content.items.map((item) => (
            <m.div key={item.title} className="card p-6 feature-card" whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}>
              <div className="feature-icon"><Icon name={item.icon} /></div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{item.title}</div>
              <div style={{ opacity: 0.8, marginTop: 6 }}>{item.desc}</div>
            </m.div>
          ))}
        </div>
      </div>
    </section>
  )
}
