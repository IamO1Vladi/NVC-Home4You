import React from 'react'
import { useModalActions } from '../context/ModalActions.jsx'
import '../style/Interiors.css'
import { cdnImage, cdnSrcSet } from '../lib/img.js'
import { brochureUrl } from '../lib/brochure.js'

function asset(path) {
  return `${import.meta.env.BASE_URL}${path}`
}

function buildInitialScope(content) {
  const keys = [
    ...(content?.bath?.options || []).map((item) => item.key),
    ...(content?.kitchen?.options || []).map((item) => item.key),
  ]
  return Object.fromEntries(Array.from(new Set(keys)).map((key) => [key, false]))
}

function getLevel(score, levels) {
  const low = levels?.low || {}
  const medium = levels?.medium || {}
  const high = levels?.high || {}

  if (typeof low.maxScore === 'number' && score <= low.maxScore) return low
  if (typeof medium.maxScore === 'number' && score <= medium.maxScore) return medium
  return high
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      className={['ir-chip', active && 'is-active'].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function BeforeAfter({ before, after, altBefore, altAfter, labels, initial = 50 }) {
  const [pct, setPct] = React.useState(initial)
  const ref = React.useRef(null)
  const fallback = asset('modular-builds/card.svg')

  const setFromClientX = (clientX) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const x = Math.min(Math.max(clientX - box.left, 0), box.width)
    setPct(Math.round((x / box.width) * 100))
  }

  const startDrag = (ev) => {
    ev.preventDefault()
    const move = (e) => setFromClientX((e.touches?.[0] || e).clientX)
    const stop = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
  }

  return (
    <div className="ir-ba" ref={ref} aria-label={labels.comparisonAria}>
      <img
        className="ir-ba-img ir-ba-after"
        src={cdnImage(after, { width: 1200 })}
        srcSet={cdnSrcSet(after, [600, 900, 1200, 1600])}
        sizes="(max-width: 900px) 100vw, 860px"
        alt={altAfter}
        onError={(e) => { e.currentTarget.src = fallback }}
      />

      <img
        className="ir-ba-img ir-ba-before"
        style={{ '--pct': `${pct}%` }}
        src={cdnImage(before, { width: 1200 })}
        srcSet={cdnSrcSet(before, [600, 900, 1200, 1600])}
        sizes="(max-width: 900px) 100vw, 860px"
        alt={altBefore}
        onError={(e) => { e.currentTarget.src = fallback }}
      />

      <div
        className="ir-ba-handle"
        style={{ left: `${pct}%` }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={labels.revealLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setPct((p) => Math.max(0, p - 5))
          if (e.key === 'ArrowRight') setPct((p) => Math.min(100, p + 5))
        }}
      >
        <span className="ir-ba-line" />
        <span className="ir-ba-knob" />
      </div>

      <input
        className="ir-ba-range"
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        aria-label={labels.rangeLabel}
      />

      <div className="ir-ba-tags">
        <span className="ir-tag">{labels.before}</span>
        <span className="ir-tag">{labels.after}</span>
      </div>
    </div>
  )
}

export default function InteriorsPage({ content }) {
  const { openOffer, openQuestion } = useModalActions()
  const [tab, setTab] = React.useState('bath')
  const [scope, setScope] = React.useState(() => buildInitialScope(content))

  const activeTab = tab === 'bath' ? content.bath : content.kitchen
  const score = React.useMemo(() => {
    const base = typeof content?.calculator?.baseScore === 'number' ? content.calculator.baseScore : 1
    return (activeTab?.options || []).reduce((sum, item) => (
      sum + (scope[item.key] ? (Number(item.weight) || 0) : 0)
    ), base)
  }, [activeTab, content, scope])

  const calcLevel = getLevel(score, content.calculator.levels)
  const quick = content.hero.quick
  const comparisonLabels = content.beforeAfterLabels

  return (
    <main className="ir">
      <section className="ir-hero">
        <div className="container ir-hero-grid">
          <div>
            <h1 className="ir-title">{content.title}</h1>
            <p className="ir-lead">{content.lead}</p>
            <div className="row mt-6">
              <button className="btn" onClick={openOffer}>{content.getOffer}</button>
              <button className="btn ghost" onClick={openQuestion}>{content.askQuestion}</button>
            </div>
          </div>

          <aside className="ir-card">
            <div className="ir-card-h">{quick.h}</div>
            <ul className="ir-card-list">
              {quick.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <a
              className="ir-card-link"
              href={brochureUrl(quick.brochureFile, quick.brochurePage)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {quick.brochureLabel}
            </a>
          </aside>
        </div>
      </section>

      <section>
        <div className="container">
          <div className="ir-tabs" role="tablist" aria-label={content.tabs.label}>
            <button
              className={['ir-tab', tab === 'bath' && 'is-active'].filter(Boolean).join(' ')}
              role="tab"
              aria-selected={tab === 'bath'}
              onClick={() => setTab('bath')}
            >
              {content.tabs.bath}
            </button>
            <button
              className={['ir-tab', tab === 'kitchen' && 'is-active'].filter(Boolean).join(' ')}
              role="tab"
              aria-selected={tab === 'kitchen'}
              onClick={() => setTab('kitchen')}
            >
              {content.tabs.kitchen}
            </button>
          </div>

          <div className="ir-pane">
            <h2 className="ir-h2">{activeTab.h}</h2>
            <p className="ir-muted">{activeTab.p}</p>
            <div className="ir-grid">
              <div className="ir-col">
                <div className="ir-sub">{content.calculator.heading}</div>
                <div className="ir-chiprow">
                  {activeTab.options.map((item) => (
                    <Chip
                      key={item.key}
                      active={Boolean(scope[item.key])}
                      onClick={() => setScope((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    >
                      {item.label}
                    </Chip>
                  ))}
                </div>

                <div className="ir-result">
                  <div><strong>{content.calculator.complexityLabel}</strong>: {calcLevel.label}</div>
                  <div><strong>{content.calculator.timelineLabel}</strong>: {calcLevel.timeline}</div>
                  <div className="row mt-3">
                    <button className="btn" onClick={openOffer}>{content.calculator.cta}</button>
                  </div>
                </div>
              </div>

              <div className="ir-col">
                <BeforeAfter
                  before={activeTab.beforeAfter.before}
                  after={activeTab.beforeAfter.after}
                  altBefore={activeTab.beforeAfter.altBefore}
                  altAfter={activeTab.beforeAfter.altAfter}
                  labels={comparisonLabels}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="container ir-why">
          <div className="ir-why-h">{content.why.h}</div>
          <ul className="ir-why-list">
            {content.why.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>
    </main>
  )
}
