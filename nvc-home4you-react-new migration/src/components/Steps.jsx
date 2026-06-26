import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'

function fillPattern(pattern, values) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    String(pattern || ''),
  )
}

export default function Steps({ content }) {
  const [active, setActive] = useState(0)
  const items = content?.items || []
  const pct = useMemo(() => {
    if (!items.length) return 0
    return Math.round(((active + 1) / items.length) * 100)
  }, [active, items.length])

  if (!content || !items.length) return null

  return (
    <section>
      <div className="container">
        <div className="card p-6">
          <div className="between">
            <h2 style={{ margin: 0, fontSize: 'clamp(22px,3.5vw,28px)' }}>{content.heading}</h2>
            <div style={{ fontSize: 14, opacity: 0.8 }}>{content.progressLabel}: <strong aria-live="polite">{pct}%</strong></div>
          </div>
          <div className="progress mt-3" aria-hidden="true">
            <motion.div initial={{ width: '16%' }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 250, damping: 30 }} />
          </div>

          <div className="steps-grid mt-6">
            {items.map((item, i) => (
              <motion.button key={item.title} className={`step${i === active ? ' active' : ''}`} onClick={() => setActive(i)} whileTap={{ scale: 0.99 }} layout>
                <span className="bubble">{i + 1}</span>
                <strong>{item.title}</strong>
                <div style={{ opacity: 0.85, marginTop: 6 }}>{item.short}</div>
              </motion.button>
            ))}
          </div>

          <div className="card p-6 mt-6" aria-live="polite">
            <div style={{ fontSize: 12, letterSpacing: '.12em', opacity: 0.7, textTransform: 'uppercase' }}>
              {fillPattern(content.stepOfPattern, { current: active + 1, total: items.length })}
            </div>
            <div className="mt-2" style={{ fontSize: 20, fontWeight: 700 }}>
              <span className="grad-text">{items[active].title}</span>
            </div>
            <p className="mt-2" style={{ opacity: 0.9 }}>
              {items[active].long}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
