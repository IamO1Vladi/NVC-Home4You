import React, { useEffect, useMemo, useRef, useState } from 'react'
import './ProcessTicker.css'

/**
 * ProcessTicker
 * - Auto-plays through steps (loop)
 * - media[] renders an image that fades with each step
 * - Pauses when scrolled off-screen; Reduced Motion respected
 * - Keyboard: ← / → to step, Space to play/pause
 * - labels prop localizes the control/ARIA text
 */
export default function ProcessTicker({
  title = 'Process',
  steps = [],
  media = [],
  intervalMs = 3200,
  startPaused = false,
  labels = {},
}) {
  const rootRef = useRef(null)
  const [active, setActive] = useState(0)
  const [playing, setPlaying] = useState(!startPaused)

  const {
    playText = 'Play',
    pauseText = 'Pause',
    playAriaLabel = 'Play animation',
    pauseAriaLabel = 'Pause animation',
    progressAriaLabel = 'Process progress',
    stepsAriaLabel = 'Process steps',
    illustrationAriaLabel = 'Process illustration',
  } = labels || {}

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  useEffect(() => {
    media?.forEach((m) => {
      if (m?.src) {
        const image = new Image()
        image.src = m.src
      }
    })
  }, [media])

  useEffect(() => {
    if (reduceMotion || !playing || steps.length < 2) return undefined
    const timer = setInterval(() => setActive((i) => (i + 1) % steps.length), intervalMs)
    return () => clearInterval(timer)
  }, [playing, steps.length, intervalMs, reduceMotion])

  useEffect(() => {
    const el = rootRef.current
    if (!el || !('IntersectionObserver' in window)) return undefined
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setPlaying(false)
    }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      setActive((i) => Math.min(i + 1, steps.length - 1))
      setPlaying(false)
    }
    if (e.key === 'ArrowLeft') {
      setActive((i) => Math.max(i - 1, 0))
      setPlaying(false)
    }
    if (e.code === 'Space') {
      setPlaying((p) => !p)
      e.preventDefault()
    }
  }

  const pct = steps.length ? Math.round(((active + 1) / steps.length) * 100) : 0
  const hasMedia = Array.isArray(media) && media.length > 0

  return (
    <section className="ptk" ref={rootRef} aria-labelledby="ptk-title" onKeyDown={onKeyDown}>
      <div className="ptk-head">
        <h2 id="ptk-title" className="ptk-title">{title}</h2>
        <div className="ptk-ctrls">
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={playing ? pauseAriaLabel : playAriaLabel}
          >
            {playing ? pauseText : playText}
          </button>
        </div>
      </div>

      <div className="visually-hidden" aria-live="polite">
        {steps[active] || ''}
      </div>

      <div
        className="ptk-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={progressAriaLabel}
      >
        <div className="ptk-fill" style={{ width: `${pct}%` }} />
        <div className="ptk-ticks">
          {steps.map((_, i) => (
            <span key={i} className={['ptk-tick', i <= active && 'is-done'].filter(Boolean).join(' ')} />
          ))}
        </div>
      </div>

      <div className="ptk-steps" role="tablist" aria-label={stepsAriaLabel}>
        {steps.map((label, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === active}
            className={['ptk-step', i === active && 'is-active'].filter(Boolean).join(' ')}
            onClick={() => {
              setActive(i)
              setPlaying(false)
            }}
          >
            <span className="ptk-step-index">{String(i + 1).padStart(2, '0')}</span>
            <span className="ptk-step-label">{label}</span>
          </button>
        ))}
      </div>

      {hasMedia && (
        <div className="ptk-media" aria-label={illustrationAriaLabel}>
          <div className="ptk-media-viewport">
            {media.map((m, i) => (
              <figure
                key={i}
                className={['ptk-shot', i === active && 'is-active'].filter(Boolean).join(' ')}
              >
                <img
                  src={m?.src}
                  alt={m?.alt || steps[i] || `Step ${i + 1}`}
                  onError={(e) => {
                    e.currentTarget.src = `${import.meta.env.BASE_URL}modular-builds/card.svg`
                  }}
                  width="1600"
                  height="900"
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
          <div className="ptk-count" aria-live="polite">{active + 1}/{steps.length}</div>
        </div>
      )}
    </section>
  )
}
