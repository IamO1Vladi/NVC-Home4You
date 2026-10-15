// The floor planner's rules, as pure functions: the models and their locked
// bathroom, snapping, the no-overlap rule for rooms, walls and the doors and
// windows hosted on them, and normalizePlan, which every plan passes through
// whether it comes from a drag, from localStorage, from a layout file or from a
// template. The editor (src/components/planner/) owns the React state; this
// module owns the rules, so they are testable without mounting the canvas.
//
// Coordinates are metres in the plan's own space, the same numbers the SVG
// draws in. The origin (0, 0) is the top-left outer corner; x runs right along
// the model's widthM, y runs down along its depthM. For a Box house widthM is
// the side the house unfolds across (the catalogue's 6260 mm) and depthM is its
// length (5900 / 9000 / 11800 mm, the side that grows from 37 to 58 to 73 m²).
// The locked bathroom sits against the top outer wall (y = 0) where the
// catalogue drawing puts it; the front door is on the bottom outer wall (y = depthM).

import LZString from 'lz-string'
import { EDITOR_TEXT } from '../components/planner/editorContent.js'
import bgPlannerContent from '../content/bg/floorPlanner.js'
import elPlannerContent from '../content/el/floorPlanner.js'
import enPlannerContent from '../content/en/floorPlanner.js'
import { PLANNER_MODELS } from '../content/shared/plannerModels.js'

// -------------------------- Models -------------------------------------------
// The models are the catalogue's (src/content/shared/plannerModels.js): the owner
// chose the brochure's footprints over the planner's old measured ones (2026-10-15),
// so the planner and the product pages quote one house. `kind: 'box'` is what gives
// a model its locked bathroom and doors; a Box model carries the bathroom rectangle
// and the two doors from the catalogue drawing (`bathroom`, `bathroomDoor`,
// `frontDoor`). Containers first, as the planner has always listed them.
export const MODELS = PLANNER_MODELS

// The footprints the planner used before it read the catalogue. Only the storage
// migration needs them: a plan saved in a visitor's browser was drawn on these.
export const LEGACY_FOOTPRINTS = {
  b37: { widthM: 6.442, depthM: 5.77 },
  b57: { widthM: 6.41, depthM: 9.0 },
  b73: { widthM: 6.41, depthM: 11.39 },
}

// Finishes (room textures)
// - tileM controls the repeat size (in meters)
// - base + overlay guarantee a “nice enough” material even if the image fails to load
export const FINISHES = [
  { key: 'wood', label: 'Wood', tex: 'flooring/wood.webp', tileM: 0.62, base: '#7a4f2b', overlay: 'planks', rot: 0 },
  { key: 'laminate', label: 'Laminate', tex: 'flooring/laminate.webp', tileM: 0.55, base: '#6b4a2f', overlay: 'planks', rot: 90 },
  { key: 'spc', label: 'SPC', tex: 'flooring/spc.webp', tileM: 0.48, base: '#635b54', overlay: 'planks', rot: 0 },
  { key: 'tile', label: 'Tile', tex: 'flooring/tile.webp', tileM: 0.36, base: '#d1d5db', overlay: 'grid', rot: 0 },
  { key: 'pvc', label: 'PVC', tex: 'flooring/pvc.webp', tileM: 0.44, base: '#cbd5e1', overlay: 'grid', rot: 0 },
  { key: 'concrete', label: 'Concrete', tex: 'flooring/concrete.webp', tileM: 0.95, base: '#6b7280', overlay: 'speckle', rot: 0 },
]

export const ROOM_TYPES = [
  { key: 'living', label: 'Living' },
  { key: 'bed', label: 'Bedroom' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'bath', label: 'Bathroom' },
  { key: 'office', label: 'Office' },
  { key: 'storage', label: 'Storage' },
  // The catalogue's hall: the A5/A6, B5/B6 and C5/C6 bedrooms open off it.
  { key: 'corridor', label: 'Corridor' },
]

export const DEFAULT_DOOR_W_M = 0.9
export const DEFAULT_WINDOW_W_M = 0.96
export const DEFAULT_WINDOW_H_M = 1.8

// The smallest room (either side) and the shortest interior wall a drag may create.
export const MIN_ROOM_SIDE_M = 0.6
export const MIN_WALL_LEN_M = 0.6

export const HISTORY_LIMIT = 20

// One key for all three locales and every model: { [modelKey]: plan }.
export const STORAGE_KEY = 'floorplanner.v4'
// Read once when STORAGE_KEY is empty, so plans from older builds are not lost.
export const LEGACY_STORAGE_KEYS = ['floorplanner.v3', 'floorplanner.v2']

// -------------------------- Room names ---------------------------------------
// A room's DEFAULT name is not stored. A new room keeps `label: null`, and every view
// resolves the name from the room's type in the page's own language. Plans live in one
// localStorage key shared by /bg, /en and /el, and travel in downloaded layout files, so a
// default stored as text — as it used to be — put "Bedroom" or "Спалня" on the Greek page.
// For the same reason a label that is merely some locale's default name for its type is
// read back as "no name"; anything else is a name the visitor typed, and is kept as typed.
const DEFAULT_ROOM_NAMES = Object.fromEntries(
  ROOM_TYPES.map(({ key, label }) => [
    key,
    new Set(
      [
        label,
        ...[bgPlannerContent, enPlannerContent, elPlannerContent].map((c) => c?.planner?.roomTypes?.[key]),
        ...Object.values(EDITOR_TEXT).map((t) => t.roomTypes?.[key]),
      ]
        .filter((name) => typeof name === 'string')
    ),
  ])
)

export function isDefaultRoomName(type, label) {
  if (label == null) return true
  const name = String(label).trim()
  return !name || Boolean(DEFAULT_ROOM_NAMES[type]?.has(name))
}

// For plans read back from storage or a layout file: default-named rooms lose the stored
// text, so their names follow the page's language. Not applied while the visitor types —
// clearing the name field must leave it empty, not snap back to the default.
export function withResolvedRoomNames(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.rooms)) return plan
  return {
    ...plan,
    rooms: plan.rooms.map((r) =>
      r && r.label != null && isDefaultRoomName(r.type, r.label) ? { ...r, label: null } : r
    ),
  }
}

// -------------------------- Utilities ----------------------------------------
export const uid = () => Math.random().toString(36).slice(2, 10)

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

export function snap(v, step) {
  return Math.round(v / step) * step
}

export function round(v, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}

export function fmtAreaM2(area) {
  const s = area.toFixed(2)
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

export function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

// Touching edges do not count: two rooms may share a wall.
export function rectsOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

function overlap1D(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

function rangesOverlap(a0, a1, b0, b1, minOverlap = 0) {
  return overlap1D(a0, a1, b0, b1) > minOverlap
}

/**
 * The no-overlap rule for rooms. True when `rect` overlaps any room other than
 * `ignoreRoomId` — the locked bathroom included, which is how it stays clear.
 */
export function roomOverlapsAny(rooms, rect, ignoreRoomId = null) {
  return (rooms || []).some((r) => r && r.id !== ignoreRoomId && rectsOverlap(rect, r))
}

export function clonePlan(p) {
  try {
    // structuredClone is available in modern browsers; fallback to JSON for older.
    // Plans are plain data (no functions), so JSON is safe.
    // eslint-disable-next-line no-undef
    return typeof structuredClone === 'function' ? structuredClone(p) : JSON.parse(JSON.stringify(p))
  } catch {
    return JSON.parse(JSON.stringify(p))
  }
}

function axisAligned(wall, eps = 1e-6) {
  const a = wall?.a
  const b = wall?.b
  if (!a || !b) return null
  if (Math.abs(a.x - b.x) < eps) return 'v'
  if (Math.abs(a.y - b.y) < eps) return 'h'
  return null
}

// -------------------------- Snapping -----------------------------------------
export function snapRoomPosition(model, plan, roomId, x, y, w, h, gridM, snapTolM = null) {
  const tol = snapTolM ?? Math.max(0.12, gridM * 0.75)
  const minOverlap = Math.max(0.05, gridM * 0.5)

  let bestDx = 0
  let bestDy = 0
  let bestAbsDx = tol + 1e-9
  let bestAbsDy = tol + 1e-9

  const left = x
  const right = x + w
  const top = y
  const bottom = y + h

  const considerDx = (dx) => {
    const ad = Math.abs(dx)
    if (ad < bestAbsDx) {
      bestAbsDx = ad
      bestDx = dx
    }
  }
  const considerDy = (dy) => {
    const ad = Math.abs(dy)
    if (ad < bestAbsDy) {
      bestAbsDy = ad
      bestDy = dy
    }
  }

  // ---- Snap to container boundaries ----
  considerDx(0 - left)
  considerDx(model.widthM - right)
  considerDy(0 - top)
  considerDy(model.depthM - bottom)

  // ---- Snap to other room edges ----
  for (const r of plan.rooms || []) {
    if (!r || r.id === roomId) continue
    const rLeft = r.x
    const rRight = r.x + r.w
    const rTop = r.y
    const rBottom = r.y + r.h

    const yOverlapOk = rangesOverlap(top, bottom, rTop, rBottom, minOverlap)
    const xOverlapOk = rangesOverlap(left, right, rLeft, rRight, minOverlap)

    if (yOverlapOk) {
      considerDx(rLeft - left)
      considerDx(rRight - left)
      considerDx(rLeft - right)
      considerDx(rRight - right)
    }
    if (xOverlapOk) {
      considerDy(rTop - top)
      considerDy(rBottom - top)
      considerDy(rTop - bottom)
      considerDy(rBottom - bottom)
    }
  }

  // ---- Snap to walls (outer + interior) ----
  for (const wall of plan.walls || []) {
    if (!wall || (wall.kind !== 'outer' && wall.kind !== 'interior')) continue
    const ax = axisAligned(wall)
    if (!ax) continue
    if (ax === 'v') {
      const wx = wall.a.x
      const wTop = Math.min(wall.a.y, wall.b.y)
      const wBottom = Math.max(wall.a.y, wall.b.y)
      const overlapOk = rangesOverlap(top, bottom, wTop, wBottom, minOverlap)
      if (!overlapOk) continue
      considerDx(wx - left)
      considerDx(wx - right)
    } else {
      const wy = wall.a.y
      const wLeft = Math.min(wall.a.x, wall.b.x)
      const wRight = Math.max(wall.a.x, wall.b.x)
      const overlapOk = rangesOverlap(left, right, wLeft, wRight, minOverlap)
      if (!overlapOk) continue
      considerDy(wy - top)
      considerDy(wy - bottom)
    }
  }

  const nx = x + (bestAbsDx <= tol ? bestDx : 0)
  const ny = y + (bestAbsDy <= tol ? bestDy : 0)
  return {
    x: clamp(nx, 0, model.widthM - w),
    y: clamp(ny, 0, model.depthM - h),
  }
}

// Snap active rect edges (used for room resize)
export function snapRoomRectEdges(model, plan, roomId, edges, active, gridM, snapTolM = null) {
  const tol = snapTolM ?? Math.max(0.12, gridM * 0.75)
  const minOverlap = Math.max(0.05, gridM * 0.5)

  let { left, right, top, bottom } = edges
  const { moveLeft, moveRight, moveTop, moveBottom } = active

  const snapToTargets = (v, targets) => {
    let best = v
    let bestAbs = tol + 1e-9
    for (const t of targets) {
      const d = t - v
      const ad = Math.abs(d)
      if (ad < bestAbs) {
        bestAbs = ad
        best = t
      }
    }
    return best
  }

  const collectXTargets = (y0, y1) => {
    const targets = [0, model.widthM]

    // Other room edges
    for (const r of plan.rooms || []) {
      if (!r || r.id === roomId) continue
      const rTop = r.y
      const rBottom = r.y + r.h
      if (!rangesOverlap(y0, y1, rTop, rBottom, minOverlap)) continue
      targets.push(r.x)
      targets.push(r.x + r.w)
    }

    // Walls (outer + interior)
    for (const wall of plan.walls || []) {
      if (!wall || (wall.kind !== 'outer' && wall.kind !== 'interior')) continue
      if (axisAligned(wall) !== 'v') continue
      const wTop = Math.min(wall.a.y, wall.b.y)
      const wBottom = Math.max(wall.a.y, wall.b.y)
      if (!rangesOverlap(y0, y1, wTop, wBottom, minOverlap)) continue
      targets.push(wall.a.x)
    }

    return targets
  }

  const collectYTargets = (x0, x1) => {
    const targets = [0, model.depthM]

    // Other room edges
    for (const r of plan.rooms || []) {
      if (!r || r.id === roomId) continue
      const rLeft = r.x
      const rRight = r.x + r.w
      if (!rangesOverlap(x0, x1, rLeft, rRight, minOverlap)) continue
      targets.push(r.y)
      targets.push(r.y + r.h)
    }

    // Walls (outer + interior)
    for (const wall of plan.walls || []) {
      if (!wall || (wall.kind !== 'outer' && wall.kind !== 'interior')) continue
      if (axisAligned(wall) !== 'h') continue
      const wLeft = Math.min(wall.a.x, wall.b.x)
      const wRight = Math.max(wall.a.x, wall.b.x)
      if (!rangesOverlap(x0, x1, wLeft, wRight, minOverlap)) continue
      targets.push(wall.a.y)
    }

    return targets
  }

  // Snap X edges first, then Y (using updated X span).
  if (moveLeft) left = snapToTargets(left, collectXTargets(top, bottom))
  if (moveRight) right = snapToTargets(right, collectXTargets(top, bottom))
  if (moveTop) top = snapToTargets(top, collectYTargets(left, right))
  if (moveBottom) bottom = snapToTargets(bottom, collectYTargets(left, right))

  return { left, right, top, bottom }
}

/**
 * Where a room lands while one of its 8 handles (n, ne, e, se, s, sw, w, nw) is
 * dragged by (dx, dy) metres from `room0`: grid snap, then edge snap, then
 * clamped to the model with a 0.6 m minimum. The no-overlap check is the
 * caller's, as it decides what to show while the candidate collides.
 */
export function resizeRoomRect(model, plan, roomId, room0, handle, dx, dy, { gridM, snapGrid, snapAlign }) {
  const h = handle || 'se'
  const moveLeft = h.includes('w')
  const moveRight = h.includes('e')
  const moveTop = h.includes('n')
  const moveBottom = h.includes('s')

  const minW = MIN_ROOM_SIDE_M
  const minH = MIN_ROOM_SIDE_M

  const left0 = room0.x
  const right0 = room0.x + room0.w
  const top0 = room0.y
  const bottom0 = room0.y + room0.h

  let left = left0
  let right = right0
  let top = top0
  let bottom = bottom0

  if (moveLeft) left = left0 + dx
  if (moveRight) right = right0 + dx
  if (moveTop) top = top0 + dy
  if (moveBottom) bottom = bottom0 + dy

  if (snapGrid) {
    if (moveLeft) left = snap(left, gridM)
    if (moveRight) right = snap(right, gridM)
    if (moveTop) top = snap(top, gridM)
    if (moveBottom) bottom = snap(bottom, gridM)
  }

  if (snapAlign) {
    const s = snapRoomRectEdges(
      model,
      plan,
      roomId,
      { left, right, top, bottom },
      { moveLeft, moveRight, moveTop, moveBottom },
      gridM
    )
    left = s.left
    right = s.right
    top = s.top
    bottom = s.bottom
  }

  // Clamp within bounds + min size (respecting which edges are moving)
  // X
  if (!moveRight) right = right0
  if (!moveLeft) left = left0
  if (moveLeft) left = clamp(left, 0, right - minW)
  if (moveRight) right = clamp(right, left + minW, model.widthM)
  // Y
  if (!moveBottom) bottom = bottom0
  if (!moveTop) top = top0
  if (moveTop) top = clamp(top, 0, bottom - minH)
  if (moveBottom) bottom = clamp(bottom, top + minH, model.depthM)

  return { x: left, y: top, w: right - left, h: bottom - top }
}

// -------------------------- Wall geometry ------------------------------------
function normPt(p) {
  const x = Math.round(p.x * 1000) / 1000
  const y = Math.round(p.y * 1000) / 1000
  return { x, y }
}

export function wallKey(a, b) {
  const A = normPt(a)
  const B = normPt(b)
  const leftFirst = A.x < B.x || (A.x === B.x && A.y <= B.y)
  const p1 = leftFirst ? A : B
  const p2 = leftFirst ? B : A
  return `${p1.x},${p1.y}_${p2.x},${p2.y}`
}

export function distPointToSeg(p, a, b) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = p.x - a.x
  const apy = p.y - a.y
  const ab2 = abx * abx + aby * aby
  if (ab2 < 1e-9) return { d: Math.hypot(apx, apy), t: 0 }
  let t = (apx * abx + apy * aby) / ab2
  t = clamp(t, 0, 1)
  const qx = a.x + abx * t
  const qy = a.y + aby * t
  return { d: Math.hypot(p.x - qx, p.y - qy), t }
}

function unit(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len, len }
}

// t is the unit vector from a to b, n its left-hand normal. Outer walls run
// clockwise and room-edge walls likewise, so n points into the building / room.
export function wallGeom(wall) {
  const a = wall.a
  const b = wall.b
  const u = unit(a, b)
  const t = { x: u.x, y: u.y }
  const n = { x: -t.y, y: t.x }
  return { a, b, t, n, len: u.len }
}

export function constrainAxis(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) return { x: b.x, y: a.y }
  return { x: a.x, y: b.y }
}

// -------------------------- Walls --------------------------------------------
export function outerWalls(model) {
  const w = model.widthM
  const d = model.depthM
  // Orientation so wall normal points inside the building
  return [
    { id: 'outer_top', kind: 'outer', locked: true, a: { x: 0, y: 0 }, b: { x: w, y: 0 } },
    { id: 'outer_right', kind: 'outer', locked: true, a: { x: w, y: 0 }, b: { x: w, y: d } },
    { id: 'outer_bottom', kind: 'outer', locked: true, a: { x: w, y: d }, b: { x: 0, y: d } },
    { id: 'outer_left', kind: 'outer', locked: true, a: { x: 0, y: d }, b: { x: 0, y: 0 } },
  ]
}

export function normalizeWallsKeepAll(walls) {
  const out = []
  for (const w of walls || []) {
    if (!w?.a || !w?.b) continue
    const a = { x: Number(w.a.x), y: Number(w.a.y) }
    const b = { x: Number(w.b.x), y: Number(w.b.y) }
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue
    const kind = w.kind || (w.locked ? 'outer' : 'interior')
    out.push({
      id: w.id || uid(),
      kind,
      locked: !!w.locked,
      a,
      b,
      key: w.key || wallKey(a, b),
      rel: w.rel,
    })
  }
  return out
}

function ensureOuterWalls(model, walls) {
  const ow = outerWalls(model).map((w) => ({ ...w, key: wallKey(w.a, w.b) }))
  const existing = normalizeWallsKeepAll(walls || [])

  // Keep all non-outer walls; always replace outer walls by id.
  const kept = existing.filter((w) => !String(w.id).startsWith('outer_'))
  for (const w of ow) kept.push({ ...w })
  return normalizeWallsKeepAll(kept)
}

function roomEdgeWallsForRoom(room) {
  // Orientation makes wall normal point INTO the room.
  const x = room.x
  const y = room.y
  const w = room.w
  const h = room.h
  return [
    { edge: 'top', a: { x, y }, b: { x: x + w, y } },
    { edge: 'right', a: { x: x + w, y }, b: { x: x + w, y: y + h } },
    { edge: 'bottom', a: { x: x + w, y: y + h }, b: { x, y: y + h } },
    { edge: 'left', a: { x, y: y + h }, b: { x, y } },
  ]
}

function ensureRoomEdgeWalls(model, rooms, walls) {
  // Remove prior derived room-edge walls, then regenerate.
  const base = (walls || []).filter((w) => w?.kind !== 'roomEdge' && w?.rel?.type !== 'roomEdge')
  const out = [...base]
  for (const r of rooms || []) {
    if (!r?.id) continue
    for (const e of roomEdgeWallsForRoom(r)) {
      const a = { x: clamp(e.a.x, 0, model.widthM), y: clamp(e.a.y, 0, model.depthM) }
      const b = { x: clamp(e.b.x, 0, model.widthM), y: clamp(e.b.y, 0, model.depthM) }
      out.push({
        id: `re_${r.id}_${e.edge}`,
        kind: 'roomEdge',
        locked: true,
        a,
        b,
        key: wallKey(a, b),
        rel: { type: 'roomEdge', roomId: r.id, edge: e.edge },
      })
    }
  }
  return normalizeWallsKeepAll(out)
}

// Render-only wall segments: a room edge that lies on an outer wall, or on
// another room's edge, is drawn once (dedupe by key).
export function wallSegments(walls) {
  const map = new Map()
  for (const w of walls || []) {
    const k = w.key || wallKey(w.a, w.b)
    const cur = map.get(k)
    if (!cur) map.set(k, { key: k, a: w.a, b: w.b, group: [w] })
    else cur.group.push(w)
  }
  const out = []
  for (const seg of map.values()) {
    const group = seg.group
    const hasOuter = group.some((w) => w.kind === 'outer')
    const hasUser = group.some((w) => w.kind === 'interior' && !w.locked)
    const rep = group.find((w) => w.kind === 'interior' && !w.locked) || group.find((w) => w.kind === 'outer') || group[0]
    out.push({
      key: seg.key,
      a: seg.a,
      b: seg.b,
      kind: hasOuter ? 'outer' : hasUser ? 'interior' : 'roomEdge',
      repWallId: rep?.id,
      repKind: rep?.kind,
    })
  }
  return out
}

// -------------------------- Fixed bathroom / doors (box houses) --------------
// The bathroom cannot be moved in a Box house: it is plumbed in at the factory.
// The planner draws it as a locked room with the fixed id below, and normalizePlan
// puts it back exactly here whatever a stored plan, a file or a template says.
export const FIXED_BATHROOM_ID = 'bathroom_fixed'
export const FIXED_BATHROOM_DOOR_ID = 'entrance_fixed'
export const FIXED_FRONT_DOOR_ID = 'entrance_front_fixed'

// The fallback for a Box model that carries no `bathroom` of its own: the planner's
// first, measured bathroom, centred on the old footprints. Every catalogue model in
// MODELS has its own rectangle now, so this only serves hand-built models.
const FIXED_BATHROOM_BY_MODEL = {
  // Based on the CAT measurements you provided:
  // - 37 m²: centered on the 6442 mm side with 2420 mm to each side => 1602 × 2100 mm
  // - 57/58 and 73 m²: centered on the 6410 mm side with 2435 mm to each side => 1540 × 3000 mm
  b37: { sideGapM: 2.42, depthM: 2.1 },
  b57: { sideGapM: 2.435, depthM: 3.0 },
  b73: { sideGapM: 2.435, depthM: 3.0 },
}

function isFiniteRect(r) {
  return !!r && [r.x, r.y, r.w, r.h].every((v) => Number.isFinite(Number(v)))
}

export function fixedBathroomSpec(model) {
  // A model that carries its own bathroom rectangle (from the catalogue drawings)
  // wins over the table; it is still kept inside the footprint.
  if (isFiniteRect(model.bathroom)) {
    const w = clamp(Number(model.bathroom.w), 0.9, model.widthM)
    const h = clamp(Number(model.bathroom.h), 0.9, model.depthM)
    return {
      w,
      h,
      x: clamp(Number(model.bathroom.x), 0, model.widthM - w),
      y: clamp(Number(model.bathroom.y), 0, model.depthM - h),
    }
  }
  const spec = FIXED_BATHROOM_BY_MODEL[model.key]
  const sideGapM = spec?.sideGapM ?? 0
  const w = clamp(round(model.widthM - sideGapM * 2, 3), 0.9, model.widthM)
  const h = clamp(spec?.depthM ?? 1.378, 0.9, model.depthM)
  return {
    w,
    h,
    x: round((model.widthM - w) / 2, 3),
    y: 0,
  }
}

export function fixedBathroom(model) {
  const { x, y, w, h } = fixedBathroomSpec(model)
  return {
    id: FIXED_BATHROOM_ID,
    type: 'bath',
    label: null,
    x,
    y,
    w,
    h,
    finish: 'tile',
    locked: true,
  }
}

function fixedBathroomDoor(model) {
  // Door stays on the bathroom's inside/bottom wall, anchored to the right side.
  return {
    id: FIXED_BATHROOM_DOOR_ID,
    kind: 'door',
    widthM: DEFAULT_DOOR_W_M,
    host: { type: 'wall', wallId: `re_${FIXED_BATHROOM_ID}_bottom`, at: DEFAULT_DOOR_W_M / 2 },
    hinge: 'start',
    openTo: 'pos',
    locked: true,
    ...doorOverride(model.bathroomDoor),
  }
}

function fixedFrontDoor(model) {
  // Permanent front door on the opposite outer wall, aligned with the bathroom centerline.
  // outer_bottom runs right to left, so `at` is measured from the right-hand corner.
  const bath = fixedBathroom(model)
  const centerX = bath.x + bath.w / 2
  const atM = round(model.widthM - centerX, 3)
  return {
    id: FIXED_FRONT_DOOR_ID,
    kind: 'door',
    widthM: DEFAULT_DOOR_W_M,
    host: { type: 'wall', wallId: 'outer_bottom', at: atM },
    hinge: 'start',
    openTo: 'pos',
    locked: true,
    ...doorOverride(model.frontDoor),
  }
}

// A model's `bathroomDoor` / `frontDoor`: { wallId?, at?, widthM?, hinge?, openTo?, leaves? }.
function doorOverride(o) {
  if (!o || typeof o !== 'object') return {}
  const out = {}
  if (Number.isFinite(Number(o.widthM)) && o.widthM != null) out.widthM = Number(o.widthM)
  if (o.hinge === 'start' || o.hinge === 'end') out.hinge = o.hinge
  if (o.openTo === 'pos' || o.openTo === 'neg') out.openTo = o.openTo
  // The entrance is a double door: two leaves, drawn hinged at both jambs.
  if (o.leaves === 2) out.leaves = 2
  if (typeof o.wallId === 'string' || o.at != null) {
    out.host = {
      type: 'wall',
      wallId: typeof o.wallId === 'string' ? o.wallId : undefined,
      at: Number(o.at ?? 0),
    }
  }
  return out
}

function fixedBoxOpenings(model) {
  const doors = [fixedBathroomDoor(model), fixedFrontDoor(model)]
  // A partial host override keeps the default wall when it names none.
  const defaults = { [FIXED_BATHROOM_DOOR_ID]: `re_${FIXED_BATHROOM_ID}_bottom`, [FIXED_FRONT_DOOR_ID]: 'outer_bottom' }
  return doors.map((d) => (d.host.wallId ? d : { ...d, host: { ...d.host, wallId: defaults[d.id] } }))
}

// -------------------------- Plan creation / normalization --------------------
export function makeDefaultPlan(model) {
  const rooms = []
  const openings = []
  let walls = ensureOuterWalls(model, [])

  if (model.kind === 'box') {
    rooms.push(fixedBathroom(model))
    openings.push(...fixedBoxOpenings(model))
  }
  walls = ensureRoomEdgeWalls(model, rooms, walls)
  return { rooms, walls, openings }
}

/**
 * Every plan passes through here: stored, loaded, templated or just edited.
 * - outer walls are regenerated from the model, room-edge walls from the rooms;
 * - a Box house gets its locked bathroom and doors back, in their fixed place,
 *   and any other locked item from the input is dropped;
 * - rooms are clamped into the footprint (overlaps are NOT resolved here: the
 *   editor refuses them while drawing, moving and resizing — see validatePlan);
 * - doors and windows must sit on a wall that exists, windows on an outer wall
 *   only, and two openings on one wall are pushed apart or the later one dropped.
 */
export function normalizePlan(model, plan) {
  const base = plan && typeof plan === 'object' ? plan : {}
  const baseRooms = Array.isArray(base.rooms) ? base.rooms : []
  const baseOpenings = Array.isArray(base.openings) ? base.openings : []
  const baseWalls = Array.isArray(base.walls) ? base.walls : []

  let walls = ensureOuterWalls(model, baseWalls)

  let rooms = baseRooms
  let openings = baseOpenings

  // Ensure fixed bathroom + doors for box houses
  if (model.kind === 'box') {
    const bath = fixedBathroom(model)
    const fixedOpenings = fixedBoxOpenings(model)
    const fixedOpeningIds = new Set(fixedOpenings.map((o) => o.id))

    rooms = [bath, ...baseRooms.filter((r) => r?.id !== bath.id && !r?.locked)]

    // Upgrade legacy outer-host => wall-host
    openings = baseOpenings
      .map((o) => {
        if (!o || o.locked) return o
        if (o.host?.type === 'outer') {
          return { ...o, host: { type: 'wall', wallId: `outer_${o.host.wall}`, at: o.host.atM ?? 0 } }
        }
        return o
      })
      .filter(Boolean)

    openings = [...fixedOpenings, ...openings.filter((o) => o && !fixedOpeningIds.has(o.id) && !o.locked)]
  } else {
    openings = baseOpenings
      .map((o) => {
        if (!o) return o
        if (o.host?.type === 'outer') {
          return { ...o, host: { type: 'wall', wallId: `outer_${o.host.wall}`, at: o.host.atM ?? 0 } }
        }
        return o
      })
      .filter(Boolean)
  }

  // Clamp rooms to bounds
  rooms = (rooms || [])
    .filter(Boolean)
    .map((r) => {
      const x = clamp(Number(r.x), 0, model.widthM)
      const y = clamp(Number(r.y), 0, model.depthM)
      const w = clamp(Number(r.w), 0, model.widthM - x)
      const h = clamp(Number(r.h), 0, model.depthM - y)
      return { ...r, x, y, w, h }
    })

  walls = ensureRoomEdgeWalls(model, rooms, walls)

  // Openings: must reference existing walls; clamp at; windows only on outer.
  const byId = new Map(walls.map((w) => [w.id, w]))
  openings = (openings || [])
    .filter(Boolean)
    .filter((o) => (o.locked ? true : o.host?.type === 'wall' && byId.has(o.host.wallId)))
    .map((o) => {
      if (!o.host || o.host.type !== 'wall') return o
      const wall = byId.get(o.host.wallId)
      if (!wall) return o
      const g = wallGeom(wall)
      const at = clamp(Number(o.host.at ?? 0), 0, g.len)
      return { ...o, host: { ...o.host, at } }
    })
    .filter((o) => {
      if (o.locked) return true
      if (o.kind === 'window') {
        const wall = byId.get(o.host.wallId)
        return wall?.kind === 'outer'
      }
      return true
    })

  openings = normalizeOpeningsNoOverlap(walls, openings)

  return { rooms, walls, openings }
}

/**
 * What normalizePlan would silently fix or drop in `plan`, for template data and
 * its tests. Returns [] for a plan that loads exactly as written; otherwise
 * entries like { code: 'room-overlap', ids: [a, b] }. Codes: room-overlap
 * (with the locked bathroom too), room-out-of-bounds, room-too-small,
 * room-locked-replaced (a template may not bring its own locked rooms),
 * opening-dropped, opening-moved.
 */
export function validatePlan(model, plan) {
  const problems = []
  const rooms = Array.isArray(plan?.rooms) ? plan.rooms.filter(Boolean) : []
  const eps = 1e-6
  const norm = normalizePlan(model, plan)

  for (const r of rooms) {
    if (r.locked || r.id === FIXED_BATHROOM_ID) {
      if (model.kind === 'box') problems.push({ code: 'room-locked-replaced', ids: [r.id] })
      continue
    }
    const out =
      r.x < -eps || r.y < -eps || r.x + r.w > model.widthM + eps || r.y + r.h > model.depthM + eps
    if (out) problems.push({ code: 'room-out-of-bounds', ids: [r.id] })
    if (r.w < MIN_ROOM_SIDE_M - eps || r.h < MIN_ROOM_SIDE_M - eps) problems.push({ code: 'room-too-small', ids: [r.id] })
  }

  // Overlaps are checked on the normalized rooms, so the bathroom is in place.
  const normRooms = norm.rooms
  for (let i = 0; i < normRooms.length; i++) {
    for (let j = i + 1; j < normRooms.length; j++) {
      if (rectsOverlap(normRooms[i], normRooms[j])) problems.push({ code: 'room-overlap', ids: [normRooms[i].id, normRooms[j].id] })
    }
  }

  const kept = new Map(norm.openings.map((o) => [o.id, o]))
  for (const o of Array.isArray(plan?.openings) ? plan.openings.filter(Boolean) : []) {
    if (o.locked) continue
    const after = kept.get(o.id)
    if (!after) problems.push({ code: 'opening-dropped', ids: [o.id] })
    else if (Math.abs(Number(o.host?.at ?? 0) - after.host.at) > 1e-3) problems.push({ code: 'opening-moved', ids: [o.id] })
  }

  return problems
}

// -------------------------- Open spaces ---------------------------------------
// A catalogue living room is L-shaped around the bathroom, and the planner's rooms
// are rectangles, so a template splits one open space into rectangles that share a
// `space` id (src/content/shared/plannerModels.js). They are one room to the visitor:
// one name, one area, no wall drawn between them. A room without `space` is its own.

// Which type names an open space: a living room wins over the hall or a workspace
// that is open to it, otherwise the largest rectangle's type does.
const SPACE_TYPE_ORDER = ['living', 'kitchen', 'bed', 'office', 'storage', 'bath', 'corridor']

/**
 * The plan's rooms grouped into what the visitor calls rooms:
 * [{ key, ids, rooms, primary, type, kitchen, locked, areaM2 }], in plan order.
 * `primary` is the rectangle that carries the group's name and label (the largest
 * of the naming type); `areaM2` is the sum, rounded to 2 decimals.
 */
export function roomGroups(rooms) {
  const groups = new Map()
  for (const r of (rooms || []).filter(Boolean)) {
    const key = r.space ? `space:${r.space}` : `room:${r.id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  return [...groups.entries()].map(([key, list]) => {
    const rank = (t) => {
      const i = SPACE_TYPE_ORDER.indexOf(t)
      return i < 0 ? SPACE_TYPE_ORDER.length : i
    }
    const type = [...list].sort((a, b) => rank(a.type) - rank(b.type))[0].type
    const primary = list
      .filter((r) => r.type === type)
      .sort((a, b) => b.w * b.h - a.w * a.h)[0]
    return {
      key,
      ids: list.map((r) => r.id),
      rooms: list,
      primary,
      type,
      kitchen: list.some((r) => r.kitchen),
      locked: list.some((r) => r.locked),
      areaM2: round(list.reduce((sum, r) => sum + r.w * r.h, 0), 2),
    }
  })
}

/**
 * Whether the plan is a container still as it arrives: one space nobody has divided or
 * named. That space is the whole unit, not a living room — a container comes with a
 * bathroom nobody has drawn yet, so calling it "Дневна" would say more than anyone knows.
 * The editor, the phone preview and the offer text all name it from this one rule.
 */
export function isContainerShell(model, plan) {
  if (!model || model.kind === 'box' || !plan?.rooms?.length) return false
  if (plan.rooms.some((r) => r.label)) return false
  return planSummary(model, plan).rooms.length === 1
}

/**
 * The plan reduced to what a summary, an offer or analytics needs.
 * Areas are m², rounded to 2 decimals; the locked bathroom is in `rooms`.
 * Rooms are the visitor's rooms: the rectangles of one open space are ONE entry,
 * with `id` the first rectangle's id, `parts` all of them and the summed area.
 */
export function planSummary(model, plan) {
  const groups = roomGroups(plan?.rooms)
  const rooms = groups.map((g) => ({
    id: g.ids[0],
    type: g.type,
    label: g.primary.label ?? null,
    locked: g.locked,
    areaM2: g.areaM2,
    parts: g.ids,
    kitchen: g.kitchen,
  }))
  const openings = (plan?.openings || []).filter(Boolean)
  return {
    modelKey: model.key,
    widthM: model.widthM,
    depthM: model.depthM,
    footprintM2: round(model.widthM * model.depthM, 2),
    rooms,
    totalRoomsM2: round(rooms.reduce((sum, r) => sum + r.areaM2, 0), 2),
    bedrooms: rooms.filter((r) => r.type === 'bed').length,
    doors: openings.filter((o) => o.kind === 'door').length,
    windows: openings.filter((o) => o.kind === 'window').length,
  }
}

// The stretches of `seg` (an axis-aligned segment) left after removing `cuts`, which
// are [from, to] ranges along the same line.
function subtractSpans(from, to, cuts) {
  let pieces = [[from, to]]
  for (const [c0, c1] of cuts) {
    pieces = pieces.flatMap(([p0, p1]) => {
      if (c1 <= p0 + 1e-6 || c0 >= p1 - 1e-6) return [[p0, p1]]
      const out = []
      if (c0 > p0 + 1e-6) out.push([p0, c0])
      if (c1 < p1 - 1e-6) out.push([c1, p1])
      return out
    })
  }
  return pieces.filter(([p0, p1]) => p1 - p0 > 1e-6)
}

/**
 * The wall segments to DRAW: wallSegments(), minus the stretches where two
 * rectangles of one open space meet (no wall stands there). Each piece keeps its
 * segment's kind and representative wall; a cut segment's pieces get keys `key#n`.
 * Outer and user-drawn walls are never cut.
 */
export function visibleWallSegments(plan) {
  const segments = wallSegments(plan?.walls)
  const rooms = (plan?.rooms || []).filter((r) => r?.space)
  const cutsV = [] // { x, from, to }
  const cutsH = [] // { y, from, to }
  const eps = 1e-6
  for (let i = 0; i < rooms.length; i++) {
    for (let j = 0; j < rooms.length; j++) {
      const a = rooms[i]
      const b = rooms[j]
      if (i === j || a.space !== b.space) continue
      if (Math.abs(a.x + a.w - b.x) < eps) {
        const from = Math.max(a.y, b.y)
        const to = Math.min(a.y + a.h, b.y + b.h)
        if (to - from > eps) cutsV.push({ x: b.x, from, to })
      }
      if (Math.abs(a.y + a.h - b.y) < eps) {
        const from = Math.max(a.x, b.x)
        const to = Math.min(a.x + a.w, b.x + b.w)
        if (to - from > eps) cutsH.push({ y: b.y, from, to })
      }
    }
  }
  if (!cutsV.length && !cutsH.length) return segments

  const out = []
  for (const seg of segments) {
    if (seg.kind !== 'roomEdge') {
      out.push(seg)
      continue
    }
    const vertical = Math.abs(seg.a.x - seg.b.x) < eps
    const horizontal = Math.abs(seg.a.y - seg.b.y) < eps
    let pieces = null
    if (vertical) {
      const cuts = cutsV.filter((c) => Math.abs(c.x - seg.a.x) < eps).map((c) => [c.from, c.to])
      if (cuts.length) {
        pieces = subtractSpans(Math.min(seg.a.y, seg.b.y), Math.max(seg.a.y, seg.b.y), cuts).map(([p0, p1]) => ({
          a: { x: seg.a.x, y: p0 },
          b: { x: seg.a.x, y: p1 },
        }))
      }
    } else if (horizontal) {
      const cuts = cutsH.filter((c) => Math.abs(c.y - seg.a.y) < eps).map((c) => [c.from, c.to])
      if (cuts.length) {
        pieces = subtractSpans(Math.min(seg.a.x, seg.b.x), Math.max(seg.a.x, seg.b.x), cuts).map(([p0, p1]) => ({
          a: { x: p0, y: seg.a.y },
          b: { x: p1, y: seg.a.y },
        }))
      }
    }
    if (!pieces) out.push(seg)
    else pieces.forEach((p, n) => out.push({ ...seg, key: `${seg.key}#${n}`, a: p.a, b: p.b }))
  }
  return out
}

/**
 * Reads a downloaded layout file (or a template) into { modelKey, plan }, or null.
 * Accepts { modelKey, plan: { rooms, walls, openings } } — the model is kept only
 * when it is one of `models` — or a bare { rooms, walls, openings }, which goes
 * onto `currentModelKey`.
 */
export function parseLayout(parsed, models, currentModelKey) {
  let targetModelKey = currentModelKey
  let nextPlan = null

  if (parsed && typeof parsed === 'object') {
    if (parsed.plan && typeof parsed.plan === 'object') {
      nextPlan = parsed.plan
      if (typeof parsed.modelKey === 'string' && models.some((m) => m.key === parsed.modelKey)) {
        targetModelKey = parsed.modelKey
      }
    } else if (Array.isArray(parsed.rooms) || Array.isArray(parsed.walls) || Array.isArray(parsed.openings)) {
      nextPlan = parsed
    }
  }

  return nextPlan ? { modelKey: targetModelKey, plan: nextPlan } : null
}

// -------------------------- Opening resolution / glyph -----------------------
export function resolveOpening(model, plan, opening) {
  const w = openingWidthM(opening)
  const walls = plan.walls || []
  const spanOnWall = (geom, at) => {
    const half = w / 2
    const atClamped = clamp(at, half, geom.len - half)
    const a = { x: geom.a.x + geom.t.x * (atClamped - half), y: geom.a.y + geom.t.y * (atClamped - half) }
    const b = { x: geom.a.x + geom.t.x * (atClamped + half), y: geom.a.y + geom.t.y * (atClamped + half) }
    return { at: atClamped, a, b }
  }

  if (opening.host?.type === 'wall') {
    const wall = walls.find((x) => x.id === opening.host.wallId)
    if (wall) {
      const geom = wallGeom(wall)
      const at = clamp(opening.host.at ?? 0, 0, geom.len)
      const span = spanOnWall(geom, at)
      return { geom, at: span.at, widthM: w, a: span.a, b: span.b }
    }
  }

  // Fallback
  const top = walls.find((x) => x.id === 'outer_top')
  const geom = top
    ? wallGeom(top)
    : { a: { x: 0, y: 0 }, b: { x: model.widthM, y: 0 }, t: { x: 1, y: 0 }, n: { x: 0, y: 1 }, len: model.widthM }
  const span = spanOnWall(geom, 0.8)
  return { geom, at: span.at, widthM: w, a: span.a, b: span.b }
}

function spaceAt(rooms, x, y) {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const r = rooms[i]
    if (rectContains(r, x, y)) return r
  }
  return null
}

// The rooms either side of a door: `pos` on the wall normal's side, `neg` on the
// other; null means outside.
export function openingSpaces(model, plan, opening) {
  const { geom, at } = resolveOpening(model, plan, opening)
  const center = { x: geom.a.x + geom.t.x * at, y: geom.a.y + geom.t.y * at }
  const eps = 0.06
  const pos = spaceAt(plan.rooms, center.x + geom.n.x * eps, center.y + geom.n.y * eps)
  const neg = spaceAt(plan.rooms, center.x - geom.n.x * eps, center.y - geom.n.y * eps)
  return { pos, neg }
}

// -------------------------- Picking ------------------------------------------
function wallPickPriority(w) {
  if (w.kind === 'outer') return 0
  if (w.kind === 'interior') return 1
  return 2
}

export function pickWall(walls, pt, tolM = 0.22, filterFn = null) {
  let best = null
  for (const w of walls || []) {
    if (!w?.a || !w?.b) continue
    if (filterFn && !filterFn(w)) continue
    const { d, t } = distPointToSeg(pt, w.a, w.b)
    if (d > tolM) continue
    const g = wallGeom(w)
    const candidate = { d, pr: wallPickPriority(w), wallId: w.id, at: g.len * t }
    if (!best) best = candidate
    else if (candidate.d < best.d - 1e-9) best = candidate
    else if (Math.abs(candidate.d - best.d) <= 1e-9 && candidate.pr < best.pr) best = candidate
  }
  return best
}

export function boundaryOuterWallId(model, wall) {
  // If the segment lies on the model boundary, return the matching outer wall id.
  const eps = 1e-4
  const a = wall.a
  const b = wall.b
  const w = model.widthM
  const d = model.depthM
  const horizontal = Math.abs(a.y - b.y) < eps
  const vertical = Math.abs(a.x - b.x) < eps
  if (horizontal) {
    if (Math.abs(a.y - 0) < eps && Math.abs(b.y - 0) < eps) return 'outer_top'
    if (Math.abs(a.y - d) < eps && Math.abs(b.y - d) < eps) return 'outer_bottom'
  }
  if (vertical) {
    if (Math.abs(a.x - 0) < eps && Math.abs(b.x - 0) < eps) return 'outer_left'
    if (Math.abs(a.x - w) < eps && Math.abs(b.x - w) < eps) return 'outer_right'
  }
  return null
}

export function openingWidthM(opening) {
  const fallback = opening?.kind === 'window' ? DEFAULT_WINDOW_W_M : DEFAULT_DOOR_W_M
  return clamp(Number(opening?.widthM ?? fallback), 0.6, 2.2)
}

export function findNearestOpeningAt(plan, wallId, desiredAt, widthM, ignoreOpeningId = null) {
  const wall = (plan?.walls || []).find((w) => w.id === wallId)
  if (!wall) return null

  const g = wallGeom(wall)
  if (g.len <= 1e-9) return null

  const widthOnWall = Math.min(clamp(Number(widthM), 0.1, Math.max(0.1, g.len)), g.len)
  const half = widthOnWall / 2
  const minAt = half
  const maxAt = g.len - half
  const target = clamp(Number(desiredAt ?? minAt), minAt, maxAt)

  const blocked = []
  for (const other of plan?.openings || []) {
    if (!other || other.id === ignoreOpeningId) continue
    if (other.host?.type !== 'wall' || other.host.wallId !== wallId) continue

    const otherWidth = Math.min(openingWidthM(other), g.len)
    const otherHalf = otherWidth / 2
    const otherAt = clamp(Number(other.host.at ?? 0), otherHalf, g.len - otherHalf)
    const clearance = (widthOnWall + otherWidth) / 2
    blocked.push({ start: otherAt - clearance, end: otherAt + clearance })
  }

  if (!blocked.length) return target

  blocked.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged = []
  for (const block of blocked) {
    const start = Math.max(minAt, block.start)
    const end = Math.min(maxAt, block.end)
    if (end < minAt || start > maxAt) continue

    const last = merged[merged.length - 1]
    if (!last || start > last.end) merged.push({ start, end })
    else last.end = Math.max(last.end, end)
  }

  const valid = []
  let cursor = minAt
  for (const block of merged) {
    if (block.start > cursor) valid.push({ start: cursor, end: block.start })
    cursor = Math.max(cursor, block.end)
  }
  if (cursor < maxAt) valid.push({ start: cursor, end: maxAt })
  if (!valid.length) return null

  let bestAt = null
  let bestDist = Infinity
  for (const range of valid) {
    const candidate = clamp(target, range.start, range.end)
    const dist = Math.abs(candidate - target)
    if (dist < bestDist - 1e-9) {
      bestDist = dist
      bestAt = candidate
    }
  }

  return bestAt == null ? null : clamp(bestAt, minAt, maxAt)
}

function normalizeOpeningsNoOverlap(walls, openings) {
  const accepted = []
  const ordered = (openings || [])
    .map((opening, index) => ({ opening, index }))
    .sort((a, b) => Number(!!b.opening?.locked) - Number(!!a.opening?.locked) || a.index - b.index)

  for (const entry of ordered) {
    const opening = entry.opening
    if (!opening?.host || opening.host.type !== 'wall') continue

    const widthM = openingWidthM(opening)
    const at = findNearestOpeningAt(
      { walls, openings: accepted.map((item) => item.opening) },
      opening.host.wallId,
      opening.host.at,
      widthM
    )
    if (at == null) continue

    accepted.push({
      index: entry.index,
      opening: {
        ...opening,
        widthM,
        host: { ...opening.host, at },
      },
    })
  }

  return accepted.sort((a, b) => a.index - b.index).map((entry) => entry.opening)
}

// A room edge that lies on the footprint's boundary hosts its door or window on
// the matching outer wall instead, so a window "on the room's outside edge" is
// a window in the outer wall, as the visitor meant.
function hostOnWall(model, plan, hit, pt) {
  const hostWall = plan.walls.find((w) => w.id === hit.wallId)
  if (!hostWall) return null
  let wall = hostWall
  let at = hit.at
  const boundaryId = boundaryOuterWallId(model, hostWall)
  if (boundaryId && hostWall.kind !== 'outer') {
    const outer = plan.walls.find((w) => w.id === boundaryId)
    if (outer) {
      wall = outer
      at = wallGeom(outer).len * distPointToSeg(pt, outer.a, outer.b).t
    }
  }
  return { wall, at }
}

/**
 * The door or window the Door / Window tool would place for a click at `pt`:
 * { opening }, or { reason } when it places nothing, so the editor can say why:
 * 'no-wall' (no wall near enough), 'window-interior' (a window wants an outer
 * wall and the nearest is inside), 'wall-full' (no free stretch left). The
 * opening swings towards the side that was clicked.
 */
export function placeOpeningResult(model, plan, kind, pt, id = uid()) {
  const isWindow = kind === 'window'
  const hit = pickWall(plan.walls, pt, 0.22, isWindow ? (w) => w.kind === 'outer' : null)
  if (!hit) {
    if (!isWindow) return { reason: 'no-wall' }
    // Near a wall that is not an outer one, or near nothing at all? (A room edge on
    // the footprint counts as outer: hostOnWall moves the window onto it.)
    const any = pickWall(plan.walls, pt, 0.22)
    if (!any) return { reason: 'no-wall' }
    const host = hostOnWall(model, plan, any, pt)
    if (host?.wall?.kind === 'outer') return placeOnHost(plan, kind, pt, host, id)
    return { reason: 'window-interior' }
  }
  const host = hostOnWall(model, plan, hit, pt)
  if (!host) return { reason: 'no-wall' }
  return placeOnHost(plan, kind, pt, host, id)
}

function placeOnHost(plan, kind, pt, host, id) {
  const isWindow = kind === 'window'
  const wallId = host.wall.id
  const widthM = isWindow ? DEFAULT_WINDOW_W_M : DEFAULT_DOOR_W_M
  const heightM = isWindow ? DEFAULT_WINDOW_H_M : undefined

  const at = findNearestOpeningAt(plan, wallId, host.at, widthM)
  if (at == null) return { reason: 'wall-full' }

  // Default swing based on click side
  const g = wallGeom(host.wall)
  const c = { x: g.a.x + g.t.x * at, y: g.a.y + g.t.y * at }
  const dot = (pt.x - c.x) * g.n.x + (pt.y - c.y) * g.n.y
  const openTo = dot >= 0 ? 'pos' : 'neg'

  return {
    opening: {
      id,
      kind,
      widthM,
      heightM,
      host: { type: 'wall', wallId, at },
      hinge: 'start',
      openTo,
      locked: false,
    },
  }
}

/** placeOpeningResult's opening, or null when nothing can be placed there. */
export function placeOpening(model, plan, kind, pt, id = uid()) {
  return placeOpeningResult(model, plan, kind, pt, id).opening || null
}

/**
 * Where an existing door or window goes when dragged to `pt`: { wallId, at } on
 * the nearest wall it may sit on, snapped along the wall to the grid when
 * `snapGrid`, and clear of the other openings — or null to stay put.
 */
export function moveOpeningTo(model, plan, opening, pt, { gridM, snapGrid }) {
  const isWindow = opening.kind === 'window'
  const tolM = Math.max(0.3, gridM * 2.2)

  const hit = pickWall(plan.walls, pt, tolM, isWindow ? (w) => w.kind === 'outer' : null)
  if (!hit) return null
  const host = hostOnWall(model, plan, hit, pt)
  if (!host) return null

  const wallId = host.wall.id
  const g = wallGeom(host.wall)
  let at = clamp(host.at, 0, g.len)

  // Snap along-wall position to grid.
  if (snapGrid) {
    const c = { x: g.a.x + g.t.x * at, y: g.a.y + g.t.y * at }
    const horizontal = Math.abs(g.t.x) >= Math.abs(g.t.y)
    const c2 = horizontal ? { ...c, x: snap(c.x, gridM) } : { ...c, y: snap(c.y, gridM) }
    at = (c2.x - g.a.x) * g.t.x + (c2.y - g.a.y) * g.t.y
  }

  const safeAt = findNearestOpeningAt(plan, wallId, at, openingWidthM(opening), opening.id)
  if (safeAt == null) return null
  return { wallId, at: safeAt }
}

// -------------------------- View box (zoom / pan) ----------------------------
// The SVG viewBox in plan metres. Zoom is limited to 0.15×–8× the model and the
// view may wander up to 4× the model's longer side past its edges.
export function defaultViewBox(m) {
  const pad = Math.max(m.widthM, m.depthM) * 0.12
  return { x: -pad, y: -pad, w: m.widthM + pad * 2, h: m.depthM + pad * 2 }
}

function viewLimits(m) {
  return {
    pad: Math.max(m.widthM, m.depthM) * 4,
    minW: m.widthM * 0.15,
    minH: m.depthM * 0.15,
    maxW: m.widthM * 8,
    maxH: m.depthM * 8,
  }
}

export function clampViewBox(vb, m) {
  const { pad, minW, minH, maxW, maxH } = viewLimits(m)
  const w = clamp(vb.w, minW, maxW)
  const h = clamp(vb.h, minH, maxH)
  const x = clamp(vb.x, -pad, m.widthM + pad - w)
  const y = clamp(vb.y, -pad, m.depthM + pad - h)
  return { x, y, w, h }
}

// Zoom by `factor` (<1 zooms in) keeping the plan point `anchor` where it is on screen.
export function zoomViewBox(vb, m, anchor, factor) {
  const { pad, minW, minH, maxW, maxH } = viewLimits(m)
  const fx = (anchor.x - vb.x) / vb.w
  const fy = (anchor.y - vb.y) / vb.h
  const newW = clamp(vb.w * factor, minW, maxW)
  const newH = clamp(vb.h * factor, minH, maxH)
  const nx = clamp(anchor.x - fx * newW, -pad, m.widthM + pad - newW)
  const ny = clamp(anchor.y - fy * newH, -pad, m.depthM + pad - newH)
  return { x: nx, y: ny, w: newW, h: newH }
}

export function panViewBox(vb0, m, dx, dy) {
  const { pad } = viewLimits(m)
  return {
    x: clamp(vb0.x + dx, -pad, m.widthM + pad - vb0.w),
    y: clamp(vb0.y + dy, -pad, m.depthM + pad - vb0.h),
    w: vb0.w,
    h: vb0.h,
  }
}

/**
 * The view that shows the whole plan: the footprint plus `extras` (rects in plan
 * metres, such as a terrace outside it), with room around it for the dimension
 * lines. The SVG keeps its aspect ratio, so this only has to contain the content.
 */
export function fitViewBox(m, extras = []) {
  let x0 = 0
  let y0 = 0
  let x1 = m.widthM
  let y1 = m.depthM
  for (const r of extras || []) {
    if (!isFiniteRect(r)) continue
    x0 = Math.min(x0, r.x)
    y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w)
    y1 = Math.max(y1, r.y + r.h)
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.04 + 0.7
  return clampViewBox({ x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }, m)
}

// -------------------------- Stored plans: migration -------------------------
// Plans live in visitors' browsers ('floorplanner.v4') and in downloaded files, and
// they outlive the model they were drawn on: the Box houses moved from the planner's
// measured footprints (LEGACY_FOOTPRINTS) to the catalogue's, and their bathroom to
// the drawing's place. A plan is stored with the footprint it was drawn on
// (`footprint: { widthM, depthM }`); when that differs from the model's — or is
// missing, as on every plan saved before the move — the plan is fitted again:
// rooms are clipped to the new footprint and trimmed clear of the bathroom, what
// still cannot fit is dropped, and the visitor is told once.

const finite = (v) => v !== null && v !== '' && Number.isFinite(Number(v))

// `room` shortened so it no longer overlaps `obstacle`, keeping the largest part
// that is still a room; null when nothing of at least MIN_ROOM_SIDE_M is left.
function trimClear(room, o) {
  const r = room
  const candidates = [
    { ...r, y: o.y + o.h, h: r.y + r.h - (o.y + o.h) }, // the part below it
    { ...r, h: o.y - r.y }, // the part above it
    { ...r, x: o.x + o.w, w: r.x + r.w - (o.x + o.w) }, // the part to its right
    { ...r, w: o.x - r.x }, // the part to its left
  ].filter((c) => c.w >= MIN_ROOM_SIDE_M - 1e-9 && c.h >= MIN_ROOM_SIDE_M - 1e-9 && !rectsOverlap(c, o))
  if (!candidates.length) return null
  return candidates.sort((a, b) => b.w * b.h - a.w * a.h)[0]
}

/**
 * A plan of unknown age fitted onto `model`: { plan, clipped, dropped,
 * droppedOpenings }. Never throws; anything unreadable is dropped. The result is
 * normalized. A plan that already fits comes back with zero counts.
 */
export function migratePlan(model, plan) {
  const base = plan && typeof plan === 'object' ? plan : {}
  const W = model.widthM
  const D = model.depthM
  const fixed = model.kind === 'box' ? [fixedBathroom(model)] : []
  const kept = []
  let clipped = 0
  let dropped = 0

  for (const r of Array.isArray(base.rooms) ? base.rooms : []) {
    if (!r || typeof r !== 'object' || r.locked || r.id === FIXED_BATHROOM_ID) continue
    if (![r.x, r.y, r.w, r.h].every(finite)) {
      dropped++
      continue
    }
    const x0 = clamp(Number(r.x), 0, W)
    const y0 = clamp(Number(r.y), 0, D)
    const x1 = clamp(Number(r.x) + Number(r.w), 0, W)
    const y1 = clamp(Number(r.y) + Number(r.h), 0, D)
    let next = {
      ...r,
      id: typeof r.id === 'string' && r.id ? r.id : uid(),
      type: ROOM_TYPES.some((t) => t.key === r.type) ? r.type : 'living',
      label: typeof r.label === 'string' ? r.label : null,
      x: x0,
      y: y0,
      w: x1 - x0,
      h: y1 - y0,
      locked: false,
    }
    let changed = Math.abs(next.w - Number(r.w)) > 1e-6 || Math.abs(next.h - Number(r.h)) > 1e-6
    if (next.w < MIN_ROOM_SIDE_M - 1e-9 || next.h < MIN_ROOM_SIDE_M - 1e-9) {
      dropped++
      continue
    }
    // Clear of the bathroom and of the rooms already kept: a few passes, because
    // trimming the room off one obstacle can leave it on another.
    for (let pass = 0; next && pass < 4; pass++) {
      const hit = [...fixed, ...kept].find((o) => rectsOverlap(next, o))
      if (!hit) break
      next = trimClear(next, hit)
      changed = true
    }
    if (!next || [...fixed, ...kept].some((o) => rectsOverlap(next, o))) {
      dropped++
      continue
    }
    if (changed) clipped++
    kept.push(next)
  }

  const walls = (Array.isArray(base.walls) ? base.walls : [])
    .filter((w) => w && w.kind === 'interior' && !w.locked && w.a && w.b && [w.a.x, w.a.y, w.b.x, w.b.y].every(finite))
    .map((w) => {
      const a = { x: clamp(Number(w.a.x), 0, W), y: clamp(Number(w.a.y), 0, D) }
      const b = { x: clamp(Number(w.b.x), 0, W), y: clamp(Number(w.b.y), 0, D) }
      return { id: typeof w.id === 'string' && w.id ? w.id : uid(), kind: 'interior', locked: false, a, b }
    })
    .filter((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) >= MIN_WALL_LEN_M - 1e-9)

  const openings = (Array.isArray(base.openings) ? base.openings : []).filter(
    (o) =>
      o &&
      typeof o === 'object' &&
      !o.locked &&
      (o.kind === 'door' || o.kind === 'window') &&
      o.host &&
      typeof o.host === 'object' &&
      (o.host.type !== 'wall' || finite(o.host.at ?? 0))
  )
  const out = normalizePlan(model, { rooms: kept, walls, openings })
  const keptIds = new Set(out.openings.map((o) => o.id))
  const droppedOpenings = openings.filter((o) => !keptIds.has(o.id)).length
  return { plan: out, clipped, dropped, droppedOpenings }
}

/** Whether `fp` ({ widthM, depthM }, as stampFootprint stores it) is model `m`'s footprint. */
export const sameFootprint = (fp, m) =>
  !!fp && typeof fp === 'object' && Math.abs(Number(fp.widthM) - m.widthM) < 1e-6 && Math.abs(Number(fp.depthM) - m.depthM) < 1e-6

/** A plan as it is stored: with the footprint it was drawn on. */
export function stampFootprint(model, plan) {
  return { ...plan, footprint: { widthM: model.widthM, depthM: model.depthM } }
}

/**
 * Everything read from storage, made safe for `models`:
 * { plans: { [modelKey]: plan }, notices: [{ modelKey, clipped, dropped }] }.
 * Plans for unknown models are left out. A notice is raised only when the model's
 * footprint changed under a plan that had rooms of the visitor's and something had
 * to give, so it is shown once: the plan is then stored with the new footprint.
 */
export function migrateStoredPlans(raw, models) {
  const plans = {}
  const notices = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { plans, notices }
  for (const [key, saved] of Object.entries(raw)) {
    const model = (models || []).find((m) => m.key === key)
    if (!model) continue
    const named = withResolvedRoomNames(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {})
    const result = migratePlan(model, named)
    plans[key] = result.plan
    if (!sameFootprint(named.footprint, model) && (result.clipped || result.dropped)) {
      notices.push({ modelKey: key, clipped: result.clipped, dropped: result.dropped })
    }
  }
  return { plans, notices }
}

// -------------------------- Share links ------------------------------------
// A plan travels in the offer as a link, #plan=<lz-string>, like the configurator's
// #cfg=. Only what the visitor made goes in (the model rebuilds its fixed parts),
// with coordinates in whole millimetres to keep the link short.
export const PLAN_HASH_KEY = 'plan'

const mmOut = (v) => Math.round(Number(v) * 1000)
const mIn = (v) => Number(v) / 1000

export function encodePlanShare({ modelKey, plan, template = null, terrace = null }) {
  const rooms = (plan?.rooms || [])
    .filter((r) => r && !r.locked)
    .map((r) => [r.id, r.type, r.label ?? null, mmOut(r.x), mmOut(r.y), mmOut(r.w), mmOut(r.h), r.finish || 'wood', r.space || null, r.kitchen ? 1 : 0])
  const walls = (plan?.walls || [])
    .filter((w) => w && w.kind === 'interior' && !w.locked)
    .map((w) => [w.id, mmOut(w.a.x), mmOut(w.a.y), mmOut(w.b.x), mmOut(w.b.y)])
  const openings = (plan?.openings || [])
    .filter((o) => o && !o.locked && o.host?.type === 'wall')
    .map((o) => [
      o.id,
      o.kind === 'window' ? 'w' : 'd',
      mmOut(openingWidthM(o)),
      o.host.wallId,
      mmOut(o.host.at),
      o.hinge === 'end' ? 1 : 0,
      o.openTo === 'neg' ? 1 : 0,
      o.heightM != null ? mmOut(o.heightM) : null,
      o.code || null,
    ])
  const payload = { v: 1, m: modelKey, t: template, tr: terrace, r: rooms, w: walls, o: openings }
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

/** The layout in a #plan= hash, { modelKey, template, terrace, plan }, or null. */
export function decodePlanShare(hash = '') {
  const raw = String(hash || '').replace(/^#/, '')
  const prefix = `${PLAN_HASH_KEY}=`
  if (!raw.startsWith(prefix)) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(raw.slice(prefix.length))
    const p = json ? JSON.parse(json) : null
    if (!p || p.v !== 1 || typeof p.m !== 'string') return null
    const rooms = (p.r || []).map(([id, type, label, x, y, w, h, finish, space, kitchen]) => ({
      id: String(id),
      type,
      label: label ?? null,
      x: mIn(x),
      y: mIn(y),
      w: mIn(w),
      h: mIn(h),
      finish: finish || 'wood',
      locked: false,
      ...(space ? { space } : {}),
      ...(kitchen ? { kitchen: true } : {}),
    }))
    const walls = (p.w || []).map(([id, ax, ay, bx, by]) => ({
      id: String(id),
      kind: 'interior',
      locked: false,
      a: { x: mIn(ax), y: mIn(ay) },
      b: { x: mIn(bx), y: mIn(by) },
    }))
    const openings = (p.o || []).map(([id, k, w, wallId, at, hingeEnd, openNeg, h, code]) => ({
      id: String(id),
      kind: k === 'w' ? 'window' : 'door',
      widthM: mIn(w),
      ...(h != null ? { heightM: mIn(h) } : {}),
      ...(code ? { code } : {}),
      host: { type: 'wall', wallId, at: mIn(at) },
      hinge: hingeEnd ? 'end' : 'start',
      openTo: openNeg ? 'neg' : 'pos',
      locked: false,
    }))
    return { modelKey: p.m, template: p.t || null, terrace: p.tr || null, plan: { rooms, walls, openings } }
  } catch {
    return null
  }
}

export function buildPlanShareUrl(share, { origin = '', pathname = '' } = {}) {
  return `${origin}${pathname}#${PLAN_HASH_KEY}=${encodePlanShare(share)}`
}
