import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import LogisticsWorld from '../components/LogisticsWorld.jsx'
import '../style/Logistics.css'

export default function LogisticsPage({ content }) {
  const { openQuestion } = useModalActions()

  const process = content?.process || {}
  const steps = useMemo(() => process.steps || [], [process])
  const segmentMs = typeof process.segmentMs === 'number' ? process.segmentMs : 1500
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

  const hero = content?.hero || {}
  const tiles = content?.tiles || []
  const chips = process?.windows?.chips || []

  return (
    <main className="glb">
      <header className="glb-hero" role="banner">
        <div className="glb-hero-bg" aria-hidden="true">
          <img src={hero?.image?.src} alt="" loading="eager" />
        </div>

        <div className="container glb-hero-inner">
          <div>
            <h1 className="glb-title">{hero.title}</h1>
            <p className="glb-lead">{hero.lead}</p>
            <div className="row mt-3">
              <button className="btn" onClick={openQuestion}>{hero.button}</button>
            </div>
          </div>
        </div>
      </header>

      <section className="arx-body">
        <div className="container">
          <div className="arx-top">
            <p className="arx-lead">{process.lead}</p>
            <div className="arx-controls">
              <button className="btn small ghost" onClick={replay}>{process.replay}</button>
            </div>
          </div>

          <ol className="arx-arrow" onMouseEnter={pause} onMouseLeave={resume}>
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
      </section>

      <section className="glb-world">
        <div className="container">
          <LogisticsWorld content={content?.map?.world} height="560px" />
          <div className="glb-note">{content?.map?.note}</div>
        </div>
      </section>

      <section className="glb-tiles">
        <div className="container">
          <div className="glb-tiles-grid">
            {tiles.map((tile) => (
              <article
                key={tile.id}
                className="glb-tile"
                style={{ '--bg': `url(${tile.img})` }}
                aria-label={tile.title}
              >
                <div className="glb-tile-overlay">
                  <h3>{tile.title}</h3>
                  <p>{tile.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
