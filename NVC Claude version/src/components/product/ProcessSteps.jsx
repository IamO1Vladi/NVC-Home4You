// "How the project goes": a numbered list of steps, each with its own picture, built to replace
// the steel page's old ProcessTicker. That one played the steps on a timer behind a play
// button, showed one caption at a time (so a crawler and a phone saw a fifth of it), broke on
// narrow screens, and paired its captions with pictures of other stages.
//
// EVERY STEP AND EVERY PICTURE IS IN THE MARKUP, ALWAYS. The list is a real <ol>; each step
// carries its own <figure>. That is the whole component on a phone (a vertical timeline, the
// picture under its words), without JavaScript, and in the prerendered snapshot.
//
// ON A WIDE SCREEN, ONCE THE SCRIPT RUNS, the pictures move into one large stage beside the
// list that stays in view (position: sticky) and shows the step being read: an
// IntersectionObserver follows the step crossing the middle of the viewport, and each step's
// title becomes a button that picks it on click or keyboard focus. Nothing advances by
// itself, so there is no play button to find; the cross-fade is a CSS transition, which the
// site's reduced-motion rule switches off. The stage repeats the pictures rather than moving
// them, so the step figures stay in the DOM (hidden on a wide screen by ProductSteel.css).
//
// The styling lives in src/style/ProductSteel.css, which the page that uses this imports.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { cdnImage, cdnSrcSet } from '../../lib/img.js'

// The width at which the stage takes over; ProductSteel.css uses the same breakpoint.
export const STAGE_QUERY = '(min-width: 900px)'

// useLayoutEffect, so a wide screen never paints the phone layout first and then jumps; a
// plain effect where there is no DOM to measure.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect

const STEP_WIDTHS = [480, 640, 800, 1200]

/**
 * @param id       the section id, also the stem of the heading's and the stage's ids
 * @param heading  the h2
 * @param sub      an optional line under it
 * @param steps    [{ title, text, image: { src, alt, caption }, link?: { to, label } }], in order;
 *                 a step's link (the steel page's delivery step to the delivery page) sits
 *                 under its words
 */
export default function ProcessSteps({ id = 'pp-process', heading, sub, steps = [] }) {
  const list = (steps || []).filter((step) => step && step.title)
  const [active, setActive] = useState(0)
  // "live" is the enhanced layout: JavaScript is running and the screen is wide enough for the
  // stage. Until then (and on a phone) the steps carry their own pictures.
  const [live, setLive] = useState(false)
  const itemsRef = useRef([])
  // Steps with no picture at all (the interiors page: its photos are in its own gallery) have
  // nothing to show on a stage, so they stay a plain list at every width: no empty stage, and
  // no title buttons that would pick a picture that is not there.
  const pictured = list.some((step) => step.image?.src)

  useBeforePaint(() => {
    if (!pictured || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(STAGE_QUERY)
    const sync = () => setLive(query.matches)
    sync()
    query.addEventListener?.('change', sync)
    return () => query.removeEventListener?.('change', sync)
  }, [pictured])

  // Follow the step the visitor is reading: the one crossing a thin band a little above the
  // middle of the viewport, where the eye is while scrolling through a list.
  useEffect(() => {
    if (!live || typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting)
        if (!hit) return
        const index = itemsRef.current.indexOf(hit.target)
        if (index >= 0) setActive(index)
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    itemsRef.current.forEach((item) => item && observer.observe(item))
    return () => observer.disconnect()
  }, [live, list.length])

  if (!list.length) return null
  const titleId = `${id}-title`
  const stageId = `${id}-stage`

  return (
    <section className={`pp-process${live ? ' pp-process--live' : ''}`} id={id} aria-labelledby={heading ? titleId : undefined}>
      <div className="hp-container">
        {heading ? (
          <div className="hp-head">
            <div>
              <h2 id={titleId}>{heading}</h2>
              {sub ? <p className="hp-sub">{sub}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="pp-process-grid">
          <ol className="pp-steps">
            {list.map((step, i) => (
              <li
                key={step.title}
                ref={(el) => { itemsRef.current[i] = el }}
                className="pp-step"
                aria-current={live && i === active ? 'step' : undefined}
              >
                <span className="pp-step-n" aria-hidden="true">{i + 1}</span>
                <div className="pp-step-body">
                  <h3 className="pp-step-title">
                    {live ? (
                      <button
                        type="button"
                        className="pp-step-btn"
                        aria-controls={stageId}
                        onClick={() => setActive(i)}
                        onFocus={() => setActive(i)}
                      >
                        {step.title}
                      </button>
                    ) : step.title}
                  </h3>
                  {step.text ? <p className="pp-step-text">{step.text}</p> : null}
                  {step.link?.to && step.link.label ? (
                    <p className="pp-links pp-step-link"><Link to={step.link.to}>{step.link.label}</Link></p>
                  ) : null}
                  {step.image?.src ? (
                    <figure className="pp-step-fig">
                      <img
                        src={cdnImage(step.image.src, { width: 800 })}
                        srcSet={cdnSrcSet(step.image.src, STEP_WIDTHS)}
                        sizes="(max-width: 899px) 100vw, 640px"
                        alt={step.image.alt || ''}
                        width="800"
                        height="671"
                        loading="lazy"
                        decoding="async"
                      />
                      {step.image.caption ? <figcaption>{step.image.caption}</figcaption> : null}
                    </figure>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          {live ? (
            <div className="pp-stage" id={stageId}>
              {list.map((step, i) => (step.image?.src ? (
                <figure
                  key={step.title}
                  className={`pp-stage-fig${i === active ? ' is-on' : ''}`}
                  aria-hidden={i === active ? undefined : 'true'}
                >
                  <img
                    src={cdnImage(step.image.src, { width: 1200 })}
                    srcSet={cdnSrcSet(step.image.src, STEP_WIDTHS)}
                    sizes="(min-width: 1200px) 620px, 52vw"
                    alt={step.image.alt || ''}
                    width="800"
                    height="671"
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>
                    <span className="pp-stage-n" aria-hidden="true">{i + 1}/{list.length}</span>
                    {step.image.caption || step.title}
                  </figcaption>
                </figure>
              ) : null))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
