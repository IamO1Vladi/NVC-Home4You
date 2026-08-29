import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import DeliveryEstimator from '../components/DeliveryEstimator.jsx'
import '../style/Delivery.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'

export default function DeliveryPage({ content }) {
  const { openOffer, openQuestion } = useModalActions()

  const steps = useMemo(() => content?.process?.steps || [], [content])
  const segmentMs = typeof content?.process?.segmentMs === 'number' ? content.process.segmentMs : 1500
  const [active, setActive] = useState(-1)
  const timerRef = useRef(null)

  const start = (from = -1) => {
    clearInterval(timerRef.current)
    let current = from
    timerRef.current = setInterval(() => {
      current += 1
      setActive((prev) => (prev < steps.length - 1 ? prev + 1 : prev))
      if (current >= steps.length - 1) clearInterval(timerRef.current)
    }, segmentMs)
  }

  useEffect(() => {
    if (!steps.length) return undefined
    start(-1)
    return () => clearInterval(timerRef.current)
  }, [steps.length, segmentMs])

  const pause = () => clearInterval(timerRef.current)
  const resume = () => {
    if (active < steps.length - 1) start(active)
  }
  const replay = () => {
    setActive(-1)
    start(-1)
  }

  const process = content?.process || {}
  const hero = content?.hero || {}
  const chips = process?.windows?.chips || []

  return (
    <main className="arx">
      <header className="arx-hero">
        <div className="arx-hero-bg" aria-hidden="true">
          <img src={cdnImage(hero?.image?.src, { width: 1600 })} srcSet={cdnSrcSet(hero?.image?.src, [768, 1200, 1600, 2000])} sizes="100vw" alt="" loading="eager" />
        </div>

        <div className="container">
          <div className="arx-hero-inner">
            <h1 className="arx-title">{hero.title}</h1>
            <div className="arx-hero-actions">
              <button className="btn" onClick={openOffer}>{hero.getOffer}</button>
              <button className="btn ghost" onClick={openQuestion}>{hero.askQuestion}</button>
            </div>
          </div>
        </div>
      </header>

      {/* <section className="arx-body">
        <div className="container">
          <div className="arx-top">
            <p className="arx-lead">{process.lead}</p>
            <ul className="arx-bullets">
              {(process.bullets || []).map((item) => (
                <li key={item}>✅ {item}</li>
              ))}
            </ul>
            <div className="arx-controls">
              <button className="btn small ghost" onClick={replay}>{process.replay}</button>
            </div>
          </div>

          <ol className="arx-arrow" role="tablist" onMouseEnter={pause} onMouseLeave={resume}>
            {steps.map((step, i) => {
              const shape = i === steps.length - 1 ? 'is-last' : 'is-mid'
              const solid = i <= active ? 'is-solid' : 'is-ghost'
              return (
                <li
                  key={step.key || `${i}`}
                  className={['arx-seg', shape, solid].join(' ')}
                  style={{ '--delay': `${i * segmentMs}ms` }}
                  onClick={() => {
                    pause()
                    setActive(i)
                  }}
                  role="tab"
                  aria-selected={i === active}
                >
                  <div className="arx-fill" aria-hidden="true" />
                  <div className="arx-seg-content">
                    <div className="arx-num">{String(i + 1).padStart(2, '0')}</div>
                    <div className="arx-h">{step.heading}</div>
                    <div className="arx-p">
                      {step.body}
                      {step.meta ? <span className="arx-badge"> · {step.meta}</span> : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="arx-band">
            {chips.map((chip) => (
              <div key={chip} className="arx-chip"><strong>{chip}</strong></div>
            ))}
            {process?.windows?.sub ? <div className="arx-sub">{process.windows.sub}</div> : null}
          </div>
        </div>
      </section> */}

      <DeliveryEstimator content={content.estimator} />
    </main>
  )
}
