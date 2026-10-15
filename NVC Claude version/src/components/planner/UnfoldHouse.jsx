// "How it unfolds": the Box house going from the folded box on the truck to the finished
// house, in 3D, and on request on to the version with the pitched roof and veranda.
//
// This file is the light half: the poster, the captions, the stage list, the controls and
// the clock. It is safe to import anywhere; three.js arrives only through the lazy
// UnfoldCanvas once the house nears the screen, in a browser that can draw it. Until then
// (and for good where WebGL is missing, and in the prerendered snapshot) the poster, a
// still of the finished house, stands in, and the stage list is plain text.
//
// The animation plays once, slowly, the first time the house is mostly on screen, unless
// the visitor prefers reduced motion; then the finished house just stands there and every
// control jumps instead of gliding. Only a mouse turns the house: on a phone a finger on
// it scrolls the page like anywhere else.
//
// The posters (public/planner/unfold-<37|58|73>[-roof][-dark].webp) are stills of the same
// scene, made by scripts/unfold-posters.mjs. Run it again whenever the catalogue's sizes
// or unfoldScene.js change, or the poster (also the prerendered, no-WebGL picture) will
// show a different house from the 3D.
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../../style/UnfoldHouse.css'
import {
  UNFOLD_MODEL_KEYS,
  captionValues,
  createUnfoldPlayer,
  fillText,
  lastT,
  stageCountFor,
  stageIndex,
  unfoldDims,
} from './unfoldModel.js'
import { UNFOLD_CONTENT, unfoldText } from './unfoldContent.js'
import { imageFallback } from '../../lib/img.js'

export { UNFOLD_CONTENT }

const UnfoldCanvas = React.lazy(() => import('./UnfoldCanvas.jsx'))

const SCRUB_STEPS = 1000 // range input steps per stage

// Whether WebGL really works here, asked once per page. The constructor alone is not
// enough: a blocklisted GPU, a policy or --disable-webgl keep it but refuse a context,
// and then the 3D chunk would be downloaded only to fail. The probe's context is let go
// at once, so it does not count against the browser's limit on live contexts.
let webglCache
function webglWorks() {
  if (webglCache !== undefined) return webglCache
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2') || probe.getContext('webgl')
    gl?.getExtension?.('WEBGL_lose_context')?.loseContext()
    webglCache = Boolean(gl)
  } catch {
    webglCache = false
  }
  return webglCache
}

/** For tests: forget the probe's answer. */
export function resetWebglProbe() {
  webglCache = undefined
}

/** Whether this browser should get the live 3D at all. */
function canGoLive() {
  if (typeof window === 'undefined') return false
  // the prerender script's browser: its snapshot keeps the poster and the text
  if (/NVCPrerender/.test(window.navigator?.userAgent || '')) return false
  if (typeof window.WebGLRenderingContext === 'undefined') return false
  return webglWorks()
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// The site's theme is the data-theme attribute ThemeContext writes on <html>; read it
// directly so the house also works on a page (or a test) without the provider.
function useDocumentDark() {
  const read = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
  const [dark, setDark] = useState(read)
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined
    const observer = new MutationObserver(() => setDark(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return dark
}

// Controlled when the page passes the value, otherwise kept here.
function useMaybeControlled(value, fallback, onChange) {
  const [own, setOwn] = useState(fallback)
  const current = value ?? own
  const set = useCallback((next) => {
    if (value === undefined) setOwn(next)
    onChange?.(next)
  }, [value, onChange])
  return [current, set]
}

// A failed lazy chunk (offline, a stale deploy) must not take the page down: keep the poster.
class CanvasBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { this.props.onFail?.(error) }
  render() { return this.state.failed ? null : this.props.children }
}

const pad = (n) => String(n).padStart(2, '0')

export default function UnfoldHouse({
  locale = 'bg',
  content,
  variant: variantProp,
  defaultVariant = 'base',
  onVariantChange,
  model: modelProp,
  defaultModel = '37',
  onModelChange,
  showVariantSwitch = true,
  showModelSwitch = true,
  autoplay = true,
  className = '',
}) {
  const text = useMemo(() => unfoldText(locale, content), [locale, content])
  const [variant, setVariant] = useMaybeControlled(variantProp, defaultVariant, onVariantChange)
  const [modelKey, setModelKey] = useMaybeControlled(modelProp, defaultModel, onModelChange)
  const dims = useMemo(() => unfoldDims(modelKey), [modelKey])
  const values = useMemo(() => captionValues(dims, locale), [dims, locale])
  const dark = useDocumentDark()
  const reduced = useMemo(prefersReducedMotion, [])

  const stageCount = stageCountFor(variant)
  const maxT = lastT(variant)
  // 'static': poster and text only; 'idle': poster, 3D not asked for yet; 'loading'; 'live'
  const [status, setStatus] = useState(() => (canGoLive() ? 'idle' : 'static'))
  const [stage, setStage] = useState(stageCount - 1)
  const [playing, setPlaying] = useState(false)
  // Whether the clock is at the very end: the play button offers "play again" only then,
  // not merely once the last stage's label has come up (stageIndex counts a stage from
  // the moment it begins, so the label arrives most of a stage before the end).
  const [atEnd, setAtEnd] = useState(true)
  const [turned, setTurned] = useState(false)

  const rootRef = useRef(null)
  const scrubRef = useRef(null)
  const sceneRef = useRef(null)
  const playerRef = useRef(null)
  const visibleRef = useRef(false)
  const playedRef = useRef(false)
  const wantPlayRef = useRef(false)
  const stageCountRef = useRef(stageCount)
  stageCountRef.current = stageCount
  const statusRef = useRef(status)
  statusRef.current = status

  // The scrubber moves every frame, so it is written directly rather than re-rendered.
  const showT = useCallback((T) => {
    const input = scrubRef.current
    if (input) {
      input.value = String(Math.round(T * SCRUB_STEPS))
      input.style.setProperty('--uh-p', `${((T / Math.max(1, stageCountRef.current - 1)) * 100).toFixed(2)}%`)
    }
    setStage(stageIndex(T, stageCountRef.current))
    setAtEnd(T >= stageCountRef.current - 1 - 1e-3)
  }, [])

  if (!playerRef.current) {
    playerRef.current = createUnfoldPlayer({
      maxT,
      // start on the finished house, which is what the poster shows
      initialT: maxT,
      reducedMotion: reduced,
      onFrame: (T, dt, isPlaying) => {
        const scene = sceneRef.current
        if (scene) {
          scene.setPose(T)
          // the slow turn round the house is motion too: none when the visitor asks for less
          if (isPlaying && !reduced) scene.drift(dt)
          scene.render()
        }
        showT(T)
      },
      onState: ({ playing: p }) => setPlaying(p),
    })
  }
  const player = playerRef.current

  useEffect(() => () => player.dispose(), [player])

  // Ask for the 3D a little before the house reaches the screen; play once it is mostly on.
  useEffect(() => {
    const el = rootRef.current
    if (!el || status === 'static' || typeof IntersectionObserver === 'undefined') return undefined
    const near = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setStatus((s) => (s === 'idle' ? 'loading' : s))
        near.disconnect()
      }
    }, { rootMargin: '300px 0px' })
    const seen = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      visibleRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.35
      player.setSuspended(!entry.isIntersecting)
      maybeAutoplay()
    }, { threshold: [0, 0.35, 0.6] })
    near.observe(el)
    seen.observe(el)
    return () => { near.disconnect(); seen.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === 'static'])

  function maybeAutoplay() {
    const scene = sceneRef.current
    if (!scene) return
    if (wantPlayRef.current) {
      wantPlayRef.current = false
      playedRef.current = true
      if (player.T >= player.max - 1e-4) scene.resetView()
      player.play()
      return
    }
    if (!autoplay || reduced || playedRef.current || !visibleRef.current) return
    playedRef.current = true
    // every play from the folded box starts from the usual viewpoint: the drift of an
    // earlier play would otherwise add up, until the house is seen from behind
    scene.resetView()
    player.seek(0)
    // a moment on the folded box first, so its caption is read before anything moves
    player.play(1.2)
  }

  const onReady = useCallback((scene) => {
    sceneRef.current = scene
    if (!scene) return
    scene.setPose(player.T)
    scene.render()
    setStatus('live')
    maybeAutoplay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player])
  const onFail = useCallback(() => {
    sceneRef.current = null
    setStatus('static')
  }, [])
  const onDragStart = useCallback(() => setTurned(true), [])

  useEffect(() => { sceneRef.current?.setTheme(dark) }, [dark])

  const firstModel = useRef(true)
  useEffect(() => {
    if (firstModel.current) { firstModel.current = false; return }
    const scene = sceneRef.current
    if (scene) { scene.setModel(modelKey); scene.setPose(player.T); scene.render() }
  }, [modelKey, player])

  // Picking the roof on the finished house carries the animation on into stages 7 and 8;
  // going back to the base model takes the roof and veranda away again.
  const firstVariant = useRef(true)
  useEffect(() => {
    if (firstVariant.current) { firstVariant.current = false; return }
    const max = lastT(variant)
    if (variant === 'roof') {
      const atBaseEnd = player.T >= lastT('base') - 1e-3
      player.setMax(max)
      if (atBaseEnd && !player.playing) {
        if (reduced || statusRef.current !== 'live') player.seek(max)
        else player.playTo(max)
      }
    } else {
      player.setMax(max)
    }
    showT(player.T)
  }, [variant, player, reduced, showT])

  const togglePlay = () => {
    if (status === 'idle' || status === 'loading') {
      // pressed before the 3D arrived: play as soon as it does
      wantPlayRef.current = true
      setStatus((s) => (s === 'idle' ? 'loading' : s))
      return
    }
    playedRef.current = true
    // a replay starts from the folded box, so from the usual viewpoint too (see above)
    if (!player.playing && player.T >= player.max - 1e-4) sceneRef.current?.resetView()
    player.toggle()
  }
  // Moving the house by hand counts as playing it: the autoplay must not then jump back.
  const onScrub = (e) => {
    playedRef.current = true
    player.seek(Number(e.target.value) / SCRUB_STEPS)
  }
  const goToStage = (i) => { playedRef.current = true; player.goTo(i) }
  // The range runs in thousandths of a stage for a smooth drag, which would make an arrow
  // key's step invisible; the keys go a whole stage at a time instead.
  const onScrubKey = (e) => {
    const last = stageCount - 1
    const to = {
      ArrowLeft: stage - 1,
      ArrowDown: stage - 1,
      PageDown: stage - 1,
      ArrowRight: stage + 1,
      ArrowUp: stage + 1,
      PageUp: stage + 1,
      Home: 0,
      End: last,
    }[e.key]
    if (to === undefined) return
    e.preventDefault()
    goToStage(Math.min(last, Math.max(0, to)))
  }

  const finished = !playing && atEnd
  const stages = text.stages.slice(0, stageCount)
  const current = stages[Math.min(stage, stages.length - 1)]
  const playLabel = playing ? text.pause : finished ? text.replay : text.play
  const roof = variant === 'roof'
  const posterBase = `${import.meta.env.BASE_URL}planner/unfold-${dims.key}`
  const posterSrc = `${posterBase}${roof ? '-roof' : ''}${dark ? '-dark' : ''}.webp`
  const posterAlt = fillText(roof ? text.posterAltRoof : text.posterAlt, values)
  const canvasAlt = fillText(roof ? text.canvasAltRoof : text.canvasAlt, values)
  const stageAria = (i) => fillText(text.stageAria, { n: i + 1, label: stages[i].label })
  const live = status === 'live'
  const showControls = status !== 'static'

  return (
    <figure ref={rootRef} className={`uh ${live ? 'is-live' : ''} ${className}`.trim()} data-status={status}>
      <div className="uh-caption" aria-live={playing ? 'off' : 'polite'}>
        <p className="uh-eyebrow">{text.eyebrow}</p>
        <p className="uh-step">
          <span className="uh-step-num">{fillText(text.stepCount, { n: pad(stage + 1), total: pad(stageCount) })}</span>
          <span className="uh-step-label">{current.label}</span>
        </p>
        <p className="uh-step-note">{fillText(current.note, values)}</p>
      </div>

      {(showModelSwitch || showVariantSwitch) && (
        <div className="uh-switches">
          {showModelSwitch && (
            <div className="uh-seg" role="group" aria-label={text.modelLabel}>
              {UNFOLD_MODEL_KEYS.map((key) => {
                const area = unfoldDims(key).area
                return (
                  <button key={key} type="button" className="uh-seg-btn" aria-pressed={key === modelKey} onClick={() => setModelKey(key)}>
                    {fillText(text.modelOption, { area })}
                  </button>
                )
              })}
            </div>
          )}
          {showVariantSwitch && (
            <div className="uh-seg" role="group" aria-label={text.variantLabel}>
              {['base', 'roof'].map((key) => (
                <button key={key} type="button" className="uh-seg-btn" aria-pressed={key === variant} onClick={() => setVariant(key)}>
                  {text.variants[key]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="uh-stage">
        <img
          className={`uh-poster ${live ? 'is-hidden' : ''}`}
          src={posterSrc}
          alt={live ? '' : posterAlt}
          aria-hidden={live ? 'true' : undefined}
          width="1600"
          height="1000"
          decoding="async"
          // a missing dark or roofed still falls back to the light base one of the same model
          onError={imageFallback(`${posterBase}.webp`)}
        />
        {status !== 'static' && status !== 'idle' && (
          <CanvasBoundary onFail={onFail}>
            <Suspense fallback={null}>
              <UnfoldCanvas
                modelKey={modelKey}
                dark={dark}
                T={player.T}
                label={canvasAlt}
                onReady={onReady}
                onFail={onFail}
                onDragStart={onDragStart}
              />
            </Suspense>
          </CanvasBoundary>
        )}
        {live && !turned && <p className="uh-hint">{text.dragHint}</p>}
      </div>

      {showControls ? (
        <div className="uh-bar">
          <button type="button" className="uh-play" onClick={togglePlay} aria-label={playLabel} title={playLabel}>
            {playing ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" /></svg>
            ) : finished ? (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
            )}
          </button>
          <div className="uh-track">
            <input
              ref={scrubRef}
              className="uh-scrub"
              type="range"
              min="0"
              max={maxT * SCRUB_STEPS}
              step="1"
              defaultValue={player.T * SCRUB_STEPS}
              onChange={onScrub}
              onKeyDown={onScrubKey}
              // until the 3D is here the picture is the finished house's poster, and a
              // caption that moved on its own would describe something not on screen
              disabled={!live}
              aria-label={text.scrubber}
              aria-valuetext={stageAria(Math.min(stage, stages.length - 1))}
            />
            <ol className="uh-ticks">
              {stages.map((s, i) => (
                <li key={i} style={{ left: `${(i / (stageCount - 1)) * 100}%` }}>
                  <button type="button" className={`uh-tick ${i <= stage ? 'is-on' : ''}`} onClick={() => goToStage(i)} aria-label={stageAria(i)} disabled={!live}>
                    <span aria-hidden="true">{i + 1}</span>
                    <span className="uh-sr">{s.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <ol className="uh-list">
          {stages.map((s, i) => (
            <li key={i}><strong>{s.label}</strong> {fillText(s.note, values)}</li>
          ))}
        </ol>
      )}
    </figure>
  )
}
