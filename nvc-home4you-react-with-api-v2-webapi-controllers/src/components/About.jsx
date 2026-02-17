import React, { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'
import SEO from './SEO.jsx'

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

export default function About() {
  const { t, dict } = useI18n()
  const [year] = useState(() => new Date().getFullYear())
  const heroRef = useRef(null)
  const heroInView = useInView(heroRef, { amount: 0.3, once: true })
  const timelineRef = useRef(null)
  const timelineInView = useInView(timelineRef, { amount: 0.3, once: true })

  const principles = (dict.about && dict.about.principles) || []
  const timeline = (dict.about && dict.about.timeline) || []

  const [activeIdx, setActiveIdx] = useState(0)
  const safeIdx = timeline.length ? Math.min(activeIdx, timeline.length - 1) : 0
  const activeItem = timeline.length ? timeline[safeIdx] : null

  const currentYear = new Date().getFullYear()
  const timelineLead = t('about.timelineLead') || t('about.missionP')
  const doneLabel = t('about.done') || 'Completed'
  const plannedLabel = t('about.planned') || 'Planned'

  return (
    <main className="arx">
      <SEO
        title="NVC Home4You - Контейнери за живеене, сглобяеми къщи и модулни къщи"
        description="Контейнери за живеене, модулни и сглобяеми къщи на най-добра цена в България. Предлагаме готови и индивидуални решения с бърза доставка и пълно съдействие."
        image="../../public/logo3"
        url="https://nvc-home4you.eu/about"
        hreflangs={[
          { hrefLang: 'bg', href: 'https://nvc-home4you.eu/about' },
          { hrefLang: 'en', href: 'https://nvc-home4you.eu/about' },
        ]}
      />

      <section>
        <div className="container">
          {/* HERO CARD */}
          <motion.div
            ref={heroRef}
            className="card about-hero-card"
            initial={{ opacity: 0, y: 24 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="about-hero-main">
              <div className="about-hero-eyebrow">{t('about.heading')}</div>
              <h1 className="about-hero-title">{t('about.missionH')}</h1>
              <p className="about-hero-lead">{t('about.missionP')}</p>

              <div className="about-hero-badges">
                <span className="about-badge">
                  <span className="about-badge-dot" />
                  {t('brand.motto')}
                </span>
                <span className="about-badge">
                  <span className="about-badge-dot" />
                  {t('about.timelineH')} · {year}
                </span>
              </div>
            </div>

            <div className="about-hero-panel">
              <div>
                <div className="about-panel-label">
                  {t('about.principlesH')}
                </div>
                <ul className="about-panel-list">
                  <li>{t('about.missionl1')}</li>
                  <li>{t('about.missionl2')}</li>
                  <li>{t('about.missionl3')}</li>
                </ul>
              </div>

              <div className="about-hero-stats">
                <div className="stat-card">
                  <div className="stat-number">40+</div>
                  <div className="stat-label"> {t('about.principlesh1')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">6</div>
                  <div className="stat-label">{t('about.principlesh2')}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">8</div>
                  <div className="stat-label">{t('about.principlesh3')}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* MISSION & PRINCIPLES */}
          <div className="about-body-grid mt-6">
            <div className="card p-6">
              <h3 className="grad-text" style={{ margin: 0, marginBottom: 8 }}>
                {t('about.storyH')}
              </h3>
              <p style={{ opacity: 0.9 }}>{t('about.storyP')}</p>
             
            </div>

            <aside className="card p-6 about-principles">
              <h4 className="grad-text" style={{ margin: 0, marginBottom: 8 }}>
                {t('about.principlesH')}
              </h4>
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
                <h3 style={{ margin: 0 }}>{t('about.timelineH')}</h3>
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
              aria-label={t('about.timelineH')}
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
              <motion.div
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
              </motion.div>
            )}
          </section>

          {/* FOOTER */}
          <footer
            style={{
              borderTop: '1px solid #ffffff1a',
              color: '#cbd5e1',
              textAlign: 'center',
              padding: '18px 0',
              marginTop: 24,
            }}
          >
            © <span>{year}</span> NVC Home4You — {t('brand.motto')}
          </footer>
        </div>
      </section>
    </main>
  )
}
