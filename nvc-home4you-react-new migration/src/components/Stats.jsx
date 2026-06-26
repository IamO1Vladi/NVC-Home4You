import React from 'react'
import { useInView } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import useCountUp from '../hooks/useCountUp.js'
import { getLocaleFromPath } from '../routes/paths.js'
import { getHomeContent } from '../content/home/index.js'

function resolveLocale(pathname) {
  const fromPath = getLocaleFromPath(pathname)
  if (fromPath) return fromPath
  if (typeof document !== 'undefined') {
    const lang = String(document.documentElement.lang || '').toLowerCase()
    if (lang.startsWith('bg')) return 'bg'
  }
  return 'en'
}

function StatCard({ label, value, inView }) {
  const numRef = React.useRef(null)
  useCountUp(numRef, value, inView, { duration: 1.2 })

  return (
    <div className="card p-6 stat-card">
      <div className="stat-number" ref={numRef} aria-hidden="true">0</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

export default function Stats({ locale: incomingLocale, content: incomingContent }) {
  const location = useLocation()
  const locale = incomingLocale || resolveLocale(location.pathname)
  const content = incomingContent || getHomeContent(locale)?.home?.stats
  const hostRef = React.useRef(null)
  const inView = useInView(hostRef, { once: true, amount: 0.4 })

  if (!content || !Array.isArray(content.items) || !content.items.length) return null

  return (
    <section aria-labelledby="stats-title">
      <div className="container">
        <h2 id="stats-title" style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,28px)' }}>{content.heading}</h2>
        <div className="grid cols-2 md-cols-3 mt-6" ref={hostRef}>
          {content.items.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  )
}
