// Everything about the unfolding Box house that is plain arithmetic: its sizes, the
// panel thicknesses that make it fold into the catalogue's transport width, the order of
// the stages and how far each part has moved at a given moment, and the little player
// that walks through them. No three.js here, so all of it runs (and is tested) in jsdom;
// unfoldScene.js only turns these numbers into meshes.
//
// Time is measured in STAGES: T = 0 is the folded box, T = 5 the finished base house and
// T = 7 the house with its pitched roof and veranda. Stage k (0-based) plays while T moves
// from k - 1 to k, so the scrubber, the stage ticks and the captions all share one scale.
import { getBoxConfiguratorCatalog } from '../../content/shared/boxConfiguratorCatalog.js'

export const UNFOLD_MODEL_KEYS = ['37', '58', '73']
export const UNFOLD_VARIANTS = ['base', 'roof']

// The base house ends at stage 6 (T = 5); the roof and veranda add stages 7 and 8.
export const BASE_STAGE_COUNT = 6
export const ROOF_STAGE_COUNT = 8
export const stageCountFor = (variant) => (variant === 'roof' ? ROOF_STAGE_COUNT : BASE_STAGE_COUNT)
export const lastT = (variant) => stageCountFor(variant) - 1

// "5900x6260x2500" -> [5.9, 6.26, 2.5]
const metres = (text) => String(text).split(/x/i).map((part) => Number(part) / 1000)

let catalogMemo = null
function catalog() {
  // The catalogue builds every option list on each call; the sizes never change at runtime.
  if (!catalogMemo) catalogMemo = getBoxConfiguratorCatalog('en')
  return catalogMemo
}

/**
 * The house's real sizes, read from the configurator catalogue rather than typed in here,
 * so a new catalogue edition moves the 3D house with it. Lengths are in metres.
 */
export function unfoldDims(modelKey = '37') {
  const { models, terraceOptions } = catalog()
  const model = models.find((m) => m.key === String(modelKey)) || models[0]
  const [length, width, height] = metres(model.dimensionsOpen)
  const [, foldedWidth] = metres(model.dimensionsFolded)
  // The standard deck on the short side is the one in the base price ("6230 × 2000 mm").
  const standard = terraceOptions.find((o) => o.key === 'standard') || terraceOptions[0]
  const [terraceWidthMm, terraceDepthMm] = (standard.note.match(/\d+/g) || ['6230', '2000']).map(Number)
  // The roof-and-veranda house's veranda is printed on its spec cards (brochure pages 5, 11
  // and 18) as the house's open width by the same 2000 mm depth: 6260 × 2000, not the flat
  // house's 6230 × 2000 deck. Both numbers come from the catalogue row, none is typed here.
  const verandaWidthMm = Math.round(width * 1000)
  return {
    key: model.key,
    area: model.area,
    length,
    width,
    height,
    foldedWidth,
    terrace: { width: terraceWidthMm / 1000, depth: terraceDepthMm / 1000, widthMm: terraceWidthMm, depthMm: terraceDepthMm },
    veranda: { widthMm: verandaWidthMm, depthMm: terraceDepthMm },
  }
}

/**
 * The cross-section that folds. x runs along the house, y up, z across it (wings at ±z).
 *
 * The two wing floors hinge up beside the core, their outer walls fold down onto them and
 * the wing roofs hang down outside everything; the outermost face of that stack is the
 * wing roof's hinge, so the hinge sits at half the catalogue's folded width. The panel
 * thicknesses are chosen so the folded wall clears both the sill below and the roof above
 * in that width; `checks` lists each clearance so a test can hold every model to it.
 */
export function unfoldGeometry(dims) {
  const L = dims.length
  const H = dims.height
  const HALF = dims.width / 2
  const tf = 0.12 // floor panel
  const tr = 0.09 // roof panel
  const tw = 0.07 // outer wall
  const te = 0.06 // end wall
  const Y0 = tf // floor top
  const roofUnder = H - tr
  const ext = te + tw / 2 // wall hinge height above the floor top
  const Zh = dims.foldedWidth / 2 // wing roof hinge = outer face of the folded box
  const Pz = Zh - tf - tr // wing floor hinge
  const c = Pz - te - tw // core half-width
  const Wf = HALF - Pz - tw / 2 // wing floor depth
  const overhang = 0.05
  const Wr = Pz + Wf + tw / 2 + overhang - Zh // wing roof depth
  const HwUp = roofUnder - 0.005 - (Y0 + ext) // wall height above its hinge
  const Hwt = HwUp + ext
  const We = Pz + Wf - tw / 2 - c // end wall reach
  const He = HwUp + ext - 0.01
  const sillTop = 0.09

  const folded = { wallLow: Y0 + Wf - HwUp, wallHigh: Y0 + Wf + ext, floorTop: Y0 + Wf }
  const checks = [
    { name: 'folded wall clears the sill', ok: folded.wallLow >= sillTop },
    { name: 'folded wall clears the core roof', ok: folded.wallHigh <= roofUnder },
    { name: 'standing floor clears the core roof', ok: folded.floorTop <= roofUnder },
    { name: 'end walls fit side by side when folded', ok: 2 * We < L },
    { name: 'open wing roof reaches past the outer wall', ok: Zh + Wr >= Pz + Wf + tw / 2 },
    { name: 'folded wing roof hangs clear of the ground', ok: H - Wr >= sillTop },
    { name: 'opens to the catalogue width', ok: Math.abs(Pz + Wf + tw / 2 - HALF) < 1e-9 },
  ]

  // The pitched roof of the "with roof and veranda" version: a steel frame resting on the
  // flat roof, its eaves beams along both long edges and a tie beam at each truss, carrying
  // two sloped 50 mm panels that run on over the veranda to posts at its outer edge.
  const pitch = (15 * Math.PI) / 180
  const beam = 0.12 // height of the eaves beams and tie beams
  const eaveY = H + beam // where the panels rest at the wall line
  const ridgeUnder = eaveY + HALF * Math.tan(pitch)
  const roofT = 0.05
  const sideOverhang = 0.22
  const backOverhang = 0.25
  const deckDepth = dims.terrace.depth
  const postX = L / 2 + deckDepth - 0.06
  const roofFrame = {
    pitch,
    beam,
    eaveY,
    ridgeUnder,
    thickness: roofT,
    run: HALF + sideOverhang, // horizontal reach from the ridge to the eaves edge
    x0: -L / 2 - backOverhang,
    x1: L / 2 + deckDepth + 0.15,
    postX,
    postSize: 0.08,
    // posts at the deck's outer corners and either side of the entrance, which is as wide as
    // the glazed door in the core
    postZ: [HALF - 0.06, c + 0.16],
    ridgeTop: ridgeUnder + roofT / Math.cos(pitch),
    // how far above its place the frame starts when it is lowered on in stage 7
    drop: 2.4,
  }

  const deck = {
    x0: L / 2,
    x1: L / 2 + deckDepth,
    halfWidth: dims.terrace.width / 2,
    top: Y0, // flush with the house floor
    railHeight: 0.95,
  }

  return {
    L, H, HALF, tf, tr, tw, te, Y0, roofUnder, ext, Zh, Pz, c, Wf, Wr, HwUp, Hwt, We, He,
    overhang, sillTop, post: 0.12, notchW: 0.11, notchH: 0.055,
    folded, checks, roofFrame, deck,
    // in front of the deck (the base house has its standard terrace too), off to one side
    // of the step at its edge
    figureBase: { x: L / 2 + deckDepth + 0.8, z: -2.7 },
    // beyond the veranda's far corner: seen from the usual viewpoint the person stands
    // clear of the railing instead of in front of its corner post
    figureRoof: { x: L / 2 + deckDepth + 1.1, z: -3.5 },
  }
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x))
// ease-in-out cubic: panels start and stop gently, as a crane-lowered panel would
export const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
// a sub-range [a, b] of one stage, eased
const part = (s, a, b) => ease(clamp01((s - a) / (b - a)))

/**
 * How far every moving part has got at time T, each 0..1. Stage i runs while T goes from
 * i to i + 1 (here 0-based); a short pause at each end of a stage lets the eye settle.
 */
export function poseAt(T) {
  const s = (i) => clamp01(T - i)
  const stage = (i) => part(s(i), 0.08, 0.92)
  const s6 = s(4)
  const s7 = s(5)
  const s8 = s(6)
  return {
    roof: stage(0),
    floor: stage(1),
    wall: stage(2),
    end: stage(3),
    // stage 6, the finished house: the glazing settles, then the standard terrace -- which
    // is in the base price, so the 3D shows it as the plan cards and the editor do -- slides
    // out of the glazed end, and the step at its edge settles in last (each part starts
    // once the one before it has finished, so nothing passes through anything)
    finish: part(s6, 0.08, 0.5),
    deck: part(s6, 0.5, 0.86),
    stepIn: part(s6, 0.88, 0.98),
    // stage 7: the person steps out of the veranda's way, then the roof comes down
    figure: part(s7, 0.04, 0.4),
    roofFrame: part(s7, 0.12, 0.94),
    // stage 8: under the roof the deck becomes a veranda: the railings rise out of it
    rail: part(s8, 0.1, 0.9),
  }
}

/** The stage being performed (or reached): a stage counts once its motion has begun. */
export function stageIndex(T, stageCount = ROOF_STAGE_COUNT) {
  if (T <= 1e-4) return 0
  let i = 0
  for (let k = 0; k < stageCount - 1; k++) if (T > k + 0.05) i = k + 1
  return i
}

/** "{area} m²" style placeholders, filled from the catalogue numbers. */
export function fillText(text, values) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (m, key) => (values[key] ?? m))
}

// Metres with two decimals, as the planner's editor and offer write them ("9,00 × 6,26").
const num = (value, locale) =>
  new Intl.NumberFormat(locale === 'bg' ? 'bg-BG' : locale === 'el' ? 'el-GR' : 'en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)

// A size never breaks across two lines of the caption: no-break spaces round the ×.
const times = (a, b) => `${a}\u00a0×\u00a0${b}`

/** The values the captions may quote, formatted for the visitor's language. */
export function captionValues(dims, locale = 'bg') {
  return {
    area: String(dims.area),
    length: num(dims.length, locale),
    width: num(dims.width, locale),
    foldedWidth: num(dims.foldedWidth, locale),
    // millimetres stay as the catalogue prints them, without a thousands separator
    terrace: times(dims.terrace.widthMm, dims.terrace.depthMm),
    veranda: times(dims.veranda.widthMm, dims.veranda.depthMm),
  }
}

/**
 * The clock behind the animation: play, pause, seek and glide to a stage, calling
 * onFrame(T, dt, playing) for every frame it needs and nothing in between, so the 3D
 * scene draws only while something moves. requestFrame/now are injectable for tests.
 */
export function createUnfoldPlayer({
  onFrame,
  onState,
  secondsPerStage = 2.4,
  maxT = lastT('base'),
  initialT = 0,
  reducedMotion = false,
  requestFrame = (cb) => window.requestAnimationFrame(cb),
  cancelFrame = (id) => window.cancelAnimationFrame(id),
  now = () => performance.now(),
} = {}) {
  let max = maxT
  let T = Math.min(max, Math.max(0, initialT))
  let playing = false
  let tween = null
  let frameId = null
  let last = 0
  let suspended = false // off screen: keep the state, skip the frames
  let hold = 0 // seconds to wait before T starts moving (a beat on the folded box)

  const emit = () => onState?.({ T, playing, max })
  const schedule = () => {
    if (frameId != null || suspended) return
    frameId = requestFrame(tick)
  }

  function tick(time) {
    frameId = null
    const dt = last ? Math.min(0.1, (time - last) / 1000) : 0
    last = time
    let again = false
    if (playing && hold > 0) {
      hold -= dt
      again = true
    } else if (playing) {
      T = Math.min(max, T + dt / secondsPerStage)
      if (T >= max) { playing = false; emit() } else again = true
    } else if (tween) {
      const k = clamp01((now() - tween.start) / tween.duration)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      T = tween.from + (tween.to - tween.from) * e
      if (k >= 1) tween = null
      else again = true
    }
    onFrame?.(T, dt, playing)
    if (again) schedule()
    else last = 0
  }

  const api = {
    get T() { return T },
    get playing() { return playing },
    get max() { return max },
    /** Play from here (from the start when at the end); `holdSeconds` waits first. */
    play(holdSeconds = 0) {
      if (T >= max - 1e-4) T = 0
      hold = holdSeconds
      tween = null
      playing = true
      last = 0
      emit()
      schedule()
    },
    /** Play on from wherever the house is now, up to `to` (used after picking the roof). */
    playTo(to) {
      max = Math.max(max, to)
      hold = 0
      tween = null
      playing = true
      last = 0
      emit()
      schedule()
    },
    pause() {
      if (!playing) return
      playing = false
      emit()
    },
    toggle() { (playing ? api.pause : api.play)() },
    /** Jump straight to T (the scrubber). */
    seek(t) {
      playing = false
      tween = null
      T = Math.min(max, Math.max(0, t))
      emit()
      onFrame?.(T, 0, false)
    },
    /** Glide to T (a stage tick); a jump when the visitor prefers reduced motion. */
    goTo(t) {
      const to = Math.min(max, Math.max(0, t))
      if (reducedMotion) { api.seek(to); return }
      playing = false
      tween = { from: T, to, start: now(), duration: 500 + 700 * Math.min(3, Math.abs(to - T)) }
      emit()
      schedule()
    },
    setMax(m) {
      max = m
      if (T > max) api.goTo(max)
      else emit()
    },
    /** Stop asking for frames while the house is off screen; pick up again on return. */
    setSuspended(value) {
      suspended = value
      if (value) {
        if (frameId != null) cancelFrame(frameId)
        frameId = null
        last = 0
      } else if (playing || tween) schedule()
    },
    dispose() {
      if (frameId != null) cancelFrame(frameId)
      frameId = null
      playing = false
      tween = null
    },
  }
  return api
}
