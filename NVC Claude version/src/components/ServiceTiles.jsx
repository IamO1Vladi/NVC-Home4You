import React from 'react'
import { Link } from 'react-router-dom'
import './ServiceTiles.css'
import { paths } from '../routes/paths.js'

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 3 3 10v11h6v-6h6v6h6V10z" />
    </svg>
  )
}
function IconLayers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 3 2 8l10 5 10-5-10-5Zm0 8L2 16l10 5 10-5-10-5Z" />
    </svg>
  )
}
function IconSteel() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
    </svg>
  )
}
function IconInterior() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M3 3h18v4H3zM3 9h8v12H3zM13 9h8v8h-8z" />
    </svg>
  )
}

function iconFor(key) {
  switch (key) {
    case 'home': return <IconHome />
    case 'layers': return <IconLayers />
    case 'steel': return <IconSteel />
    case 'interior': return <IconInterior />
    default: return <IconLayers />
  }
}

export default function ServiceTiles({ locale = 'en', content }) {
  const asset = (p) => `${import.meta.env.BASE_URL}${p}`
  const fallback = asset('modular-builds/card.svg')

  if (!content) return null

  const onMove = (e) => {
    const card = e.currentTarget
    const r = card.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    card.style.setProperty('--mx', `${x}%`)
    card.style.setProperty('--my', `${y}%`)
  }

  return (
    <section className="svx" aria-label={content.ariaLabel}>
      <div className="container">
        <div className="svx-head">
          <h2 className="svx-title">{content.heading}</h2>
          <p className="svx-sub">{content.subheading}</p>
        </div>

        <div className="svx-grid">
          {content.items.map((item) => (
            <Link
              key={item.key}
              to={paths[item.pathKey]?.[locale] || '/'}
              className="svx-card"
              onMouseMove={onMove}
              aria-label={item.title}
            >
              <img
                className="svx-img"
                src={item.img}
                alt={item.title}
                onError={(e) => { e.currentTarget.src = fallback }}
                width="1600"
                height="1000"
                loading="lazy"
              />
              <div className="svx-bl-label">{item.title}</div>

              <div className="svx-info">
                <div className="svx-icon">{iconFor(item.icon)}</div>
                <h3 className="svx-h">{item.title}</h3>
                <p className="svx-p">{item.desc}</p>
                <span className="svx-cta">{content.button}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
