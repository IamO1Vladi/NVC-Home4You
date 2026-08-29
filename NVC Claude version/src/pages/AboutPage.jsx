import React, { useRef, useState } from 'react'
import { m, useInView } from 'framer-motion'

function PrincipleIcon({ index }) {
  const i = index % 3
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
  }

  if (i === 0) {
    // Quality / trust
    return (
      <svg {...common}>
        <path d="M12 2 4 6v6c0 5 4 8 8 10 4-2 8-5 8-10V6l-8-4Z" />
        <path d="M9 11l2 2 4-4" />
      </svg>
    )
  }
  if (i === 1) {
    // Speed / process
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  // Support / partnership
  return (
    <svg {...common}>
      <path d="M7 11a3 3 0 1 1 4-2.83" />
      <path d="M17 11a3 3 0 1 0-4-2.83" />
      <path d="M5 20c0-2.2 2.2-4 5-4h4c2.8 0 5 1.8 5 4" />
    </svg>
  )
}

export default function AboutPage({locale, content}) {
  const [year] = useState(() => new Date().getFullYear())
  const heroRef = useRef(null)
  const heroInView = useInView(heroRef, { amount: 0.3, once: true })
  const timelineRef = useRef(null)
  const timelineInView = useInView(timelineRef, { amount: 0.3, once: true })

  const principles = (content && content.principles) || []
  const timeline = (content && content.timeline) || []

  const [activeIdx, setActiveIdx] = useState(0)
  const safeIdx = timeline.length ? Math.min(activeIdx, timeline.length - 1) : 0
  const activeItem = timeline.length ? timeline[safeIdx] : null

  const currentYear = new Date().getFullYear()
  const timelineLead = content.timelineLead || content.missionP
  const doneLabel = content.done || 'Completed'
  const plannedLabel = content.planned || 'Planned'

  return (
    <main className="arx">
   

      <section>
        <div className="container">
          {/* HERO CARD */}
          <m.div
            ref={heroRef}
            className="card about-hero-card"
            initial={{ opacity: 0, y: 24 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="about-hero-main">
              <div className="about-hero-eyebrow">{content.heading}</div>
              <h1 className="about-hero-title">{content.missionH}</h1>
              <p className="about-hero-lead">{content.missionP}</p>

              <div className="about-hero-badges">
                <span className="about-badge">
                  <span className="about-badge-dot" />
                  {content.brand.motto}
                </span>
                <span className="about-badge">
                  <span className="about-badge-dot" />
                  {content.timelineH} · {year}
                </span>
              </div>
            </div>

            <div className="about-hero-panel">
              <div>
                <div className="about-panel-label">
                  {content.principlesH}
                </div>
                <ul className="about-panel-list">
                  <li>{content.missionl1}</li>
                  <li>{content.missionl2}</li>
                  <li>{content.missionl3}</li>
                </ul>
              </div>

              <div className="about-hero-stats">
                <div className="stat-card">
                  <div className="stat-number">40+</div>
                  <div className="stat-label"> {content.principlesh1}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">6</div>
                  <div className="stat-label">{content.principlesh2}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">8</div>
                  <div className="stat-label">{content.principlesh3}</div>
                </div>
              </div>
            </div>
          </m.div>

          {/* MISSION & PRINCIPLES */}
          <div className="about-body-grid mt-6">
            <div className="card p-6">
              <h2 className="grad-text" style={{ margin: 0, marginBottom: 8, fontSize: '1.17em' }}>
                {content.storyH}
              </h2>
              <p style={{ opacity: 0.9 }}>{content.storyP}</p>
             
            </div>

            <aside className="card p-6 about-principles">
              <h3 className="grad-text" style={{ margin: 0, marginBottom: 8, fontSize: '1em' }}>
                {content.principlesH}
              </h3>
              <ul className="about-pill-list">
                {principles.map((p, i) => (
                  <li key={p} className="about-pill-item">
                    <span className="about-pill-icon">
                      <PrincipleIcon index={i} />
                    </span>
                    <span className="about-pill-text">{p}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          {/* TIMELINE AS "CALENDAR STRIP" */}
          <section
            className="about-timeline-section mt-8"
            ref={timelineRef}
          >
            <div className="about-timeline-head">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.17em' }}>{content.timelineH}</h2>
                <p
                  className="mt-2"
                  style={{ opacity: 0.85, maxWidth: 520 }}
                >
                  {timelineLead}
                </p>
              </div>
              <div className="about-timeline-legend">
                <span className="time-badge is-past">{doneLabel}</span>
                <span className="time-badge is-future">{plannedLabel}</span>
              </div>
            </div>

            {/* Year strip like a calendar row */}
            <div
              className="about-year-strip"
              role="tablist"
              aria-label={content.timelineH}
            >
              {timeline.map((r, i) => {
                const yNum = Number(r.y)
                const isFuture =
                  Number.isFinite(yNum) && yNum > currentYear
                return (
                  <button
                    key={r.y}
                    type="button"
                    role="tab"
                    aria-selected={i === safeIdx}
                    className={
                      'about-year-chip ' +
                      (i === safeIdx ? 'is-active ' : '') +
                      (isFuture ? 'is-future' : 'is-past')
                    }
                    onClick={() => setActiveIdx(i)}
                  >
                    {r.y}
                  </button>
                )
              })}
            </div>

            {/* Active year detail card */}
            {activeItem && (
              <m.div
                key={activeItem.y}
                className="about-year-detail card"
                initial={{ opacity: 0, y: 16 }}
                animate={
                  timelineInView
                    ? { opacity: 1, y: 0 }
                    : { opacity: 1, y: 0 }
                }
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <div className="about-year-detail-head">
                  <div className="about-year-detail-year">
                    {activeItem.y}
                  </div>
                  <div className="about-year-detail-status">
                    {(() => {
                      const yNum = Number(activeItem.y)
                      const isFuture =
                        Number.isFinite(yNum) && yNum > currentYear
                      const label = isFuture ? plannedLabel : doneLabel
                      const cls = isFuture ? 'is-future' : 'is-past'
                      return (
                        <span className={'time-badge ' + cls}>{label}</span>
                      )
                    })()}
                  </div>
                </div>
                <div className="about-year-detail-title grad-text">
                  {activeItem.h}
                </div>
                <p className="about-year-detail-desc">{activeItem.p}</p>
              </m.div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}
