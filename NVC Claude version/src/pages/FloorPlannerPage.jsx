import React, { useEffect, useMemo, useRef, useState } from 'react'
import '../style/FloorPlanner.css'

/**
 * FloorPlanner — v4 (2D only)
 *
 * Included:
 * - Rooms + walls (walls[])
 *   - Outer walls are locked and excluded from the wall list
 *   - Creating a room auto-generates its 4 room-edge walls (locked) so doors snap to “real walls”
 *   - User can draw extra interior wall segments (deletable)
 * - Doors can be hosted on any wall; Windows only on exterior walls
 *   - Window size: 180cm × 96cm (stored)
 * - Live dimension labels while drawing (cm)
 * - Zoom/Pan (wheel + Pan tool)
 * - Canvas input capture (Esc to release, click canvas to capture)
 * - i18n via I18nContext (add planner.* keys to translations)
 */

// -------------------------- Models -------------------------------------------
const MODELS = [
  // Containers (meters)
  { key: 'c6x3', kind: 'container', label: 'Container 6×3', widthM: 6, depthM: 3 },
  { key: 'c7x3', kind: 'container', label: 'Container 7×3', widthM: 7, depthM: 3 },
  { key: 'c8x3', kind: 'container', label: 'Container 8×3', widthM: 8, depthM: 3 },

  // Box houses (dims tuned to match plan files you shared)
  { key: 'b37', kind: 'box', label: 'Box house 37 m²', widthM: 6.442, depthM: 5.77 },
  { key: 'b57', kind: 'box', label: 'Box house 58 m²', widthM: 6.41, depthM: 9.0 },
  { key: 'b73', kind: 'box', label: 'Box house 73 m²', widthM: 6.41, depthM: 11.39 },
]

// Finishes (room textures)
// - tileM controls the repeat size (in meters)
// - base + overlay guarantee a “nice enough” material even if the image fails to load
const FINISHES = [
  { key: 'wood', label: 'Wood', tex: 'flooring/wood.webp', tileM: 0.62, base: '#7a4f2b', overlay: 'planks', rot: 0 },
  { key: 'laminate', label: 'Laminate', tex: 'flooring/laminate.webp', tileM: 0.55, base: '#6b4a2f', overlay: 'planks', rot: 90 },
  { key: 'spc', label: 'SPC', tex: 'flooring/spc.webp', tileM: 0.48, base: '#635b54', overlay: 'planks', rot: 0 },
  { key: 'tile', label: 'Tile', tex: 'flooring/tile.webp', tileM: 0.36, base: '#d1d5db', overlay: 'grid', rot: 0 },
  { key: 'pvc', label: 'PVC', tex: 'flooring/pvc.webp', tileM: 0.44, base: '#cbd5e1', overlay: 'grid', rot: 0 },
  { key: 'concrete', label: 'Concrete', tex: 'flooring/concrete.webp', tileM: 0.95, base: '#6b7280', overlay: 'speckle', rot: 0 },
]

const ROOM_TYPES = [
  { key: 'living', label: 'Living' },
  { key: 'bed', label: 'Bedroom' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'bath', label: 'Bathroom' },
  { key: 'office', label: 'Office' },
  { key: 'storage', label: 'Storage' },
]

const DEFAULT_DOOR_W_M = 0.9
const DEFAULT_WINDOW_W_M = 0.96
const DEFAULT_WINDOW_H_M = 1.8

const HISTORY_LIMIT = 20

// -------------------------- Utilities ----------------------------------------
const uid = () => Math.random().toString(36).slice(2, 10)

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

function snap(v, step) {
  return Math.round(v / step) * step
}

function round(v, p = 2) {
  const f = 10 ** p
  return Math.round(v * f) / f
}

function fmtAreaM2(area) {
  const s = area.toFixed(2)
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

function rectsOverlap(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

function overlap1D(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

function rangesOverlap(a0, a1, b0, b1, minOverlap = 0) {
  return overlap1D(a0, a1, b0, b1) > minOverlap
}

function axisAligned(wall, eps = 1e-6) {
  const a = wall?.a
  const b = wall?.b
  if (!a || !b) return null
  if (Math.abs(a.x - b.x) < eps) return 'v'
  if (Math.abs(a.y - b.y) < eps) return 'h'
  return null
}

function snapRoomPosition(model, plan, roomId, x, y, w, h, gridM, snapTolM = null) {
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
function snapRoomRectEdges(model, plan, roomId, edges, active, gridM, snapTolM = null) {
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

function asset(path) {
  // Put textures in /public/flooring/*.png
  return `${import.meta.env.BASE_URL}${path}`
}

function normPt(p) {
  const x = Math.round(p.x * 1000) / 1000
  const y = Math.round(p.y * 1000) / 1000
  return { x, y }
}

function wallKey(a, b) {
  const A = normPt(a)
  const B = normPt(b)
  const leftFirst = A.x < B.x || (A.x === B.x && A.y <= B.y)
  const p1 = leftFirst ? A : B
  const p2 = leftFirst ? B : A
  return `${p1.x},${p1.y}_${p2.x},${p2.y}`
}

function distPointToSeg(p, a, b) {
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

function wallGeom(wall) {
  const a = wall.a
  const b = wall.b
  const u = unit(a, b)
  const t = { x: u.x, y: u.y }
  const n = { x: -t.y, y: t.x }
  return { a, b, t, n, len: u.len }
}

function constrainAxis(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) return { x: b.x, y: a.y }
  return { x: a.x, y: b.y }
}

// -------------------------- Walls --------------------------------------------
function outerWalls(model) {
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

function normalizeWallsKeepAll(walls) {
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

// -------------------------- Fixed bathroom / doors (box houses) --------------
const FIXED_BATHROOM_BY_MODEL = {
  // Based on the CAT measurements you provided:
  // - 37 m²: centered on the 6442 mm side with 2420 mm to each side => 1602 × 2100 mm
  // - 57/58 and 73 m²: centered on the 6410 mm side with 2435 mm to each side => 1540 × 3000 mm
  b37: { sideGapM: 2.42, depthM: 2.1 },
  b57: { sideGapM: 2.435, depthM: 3.0 },
  b73: { sideGapM: 2.435, depthM: 3.0 },
}

function fixedBathroomSpec(model) {
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

function fixedBathroom(model) {
  const { x, y, w, h } = fixedBathroomSpec(model)
  return {
    id: 'bathroom_fixed',
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
    id: 'entrance_fixed',
    kind: 'door',
    widthM: DEFAULT_DOOR_W_M,
    host: { type: 'wall', wallId: 're_bathroom_fixed_bottom', at: DEFAULT_DOOR_W_M / 2 },
    hinge: 'start',
    openTo: 'pos',
    locked: true,
  }
}

function fixedFrontDoor(model) {
  // Permanent front door on the opposite outer wall, aligned with the bathroom centerline.
  const bath = fixedBathroom(model)
  const centerX = bath.x + bath.w / 2
  const atM = round(model.widthM - centerX, 3)
  return {
    id: 'entrance_front_fixed',
    kind: 'door',
    widthM: DEFAULT_DOOR_W_M,
    host: { type: 'wall', wallId: 'outer_bottom', at: atM },
    hinge: 'start',
    openTo: 'pos',
    locked: true,
  }
}

function fixedBoxOpenings(model) {
  return [fixedBathroomDoor(model), fixedFrontDoor(model)]
}

// -------------------------- Plan creation / normalization --------------------
function makeDefaultPlan(model) {
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

function normalizePlan(model, plan) {
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

// -------------------------- Opening resolution / glyph -----------------------
function resolveOpening(model, plan, opening) {
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

function openingSpaces(model, plan, opening) {
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

function pickWall(walls, pt, tolM = 0.22, filterFn = null) {
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

function boundaryOuterWallId(model, wall) {
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

function openingWidthM(opening) {
  const fallback = opening?.kind === 'window' ? DEFAULT_WINDOW_W_M : DEFAULT_DOOR_W_M
  return clamp(Number(opening?.widthM ?? fallback), 0.6, 2.2)
}

function findNearestOpeningAt(plan, wallId, desiredAt, widthM, ignoreOpeningId = null) {
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

// -------------------------- Local storage ------------------------------------
const STORAGE_KEY = 'floorplanner.v4'

// -------------------------- Component ----------------------------------------
export default function FloorPlannerPage({ content }) {
  const txt = React.useCallback((path, params) => {
    const parts = String(path || '').split('.')
    let cur = content
    for (const p of parts) cur = cur && typeof cur === 'object' ? cur[p] : undefined
    if (typeof cur === 'string') {
      return params
        ? Object.keys(params).reduce((acc, k) => acc.replaceAll(`{${k}}`, params[k]), cur)
        : cur
    }
    return cur
  }, [content])

  const [modelKey, setModelKey] = useState(MODELS[0].key)
  const [tool, setTool] = useState('room') // room | wall | door | window | select | pan
  const [roomType, setRoomType] = useState('living')
  const [finish, setFinish] = useState('wood')
  const [gridM, setGridM] = useState(0.1)

  // Snapping
  // - Grid snapping controls how pointer positions quantize to the grid.
  // - Align snapping controls wall/room alignment snapping (room move/resize).
  const [snapGridOn, setSnapGridOn] = useState(() => {
    try {
      return localStorage.getItem('floorplanner.v4.snapGrid') !== '0'
    } catch {
      return true
    }
  })
  const [snapAlignOn, setSnapAlignOn] = useState(() => {
    try {
      return localStorage.getItem('floorplanner.v4.snapAlign') !== '0'
    } catch {
      return true
    }
  })

  const [panelOpen, setPanelOpen] = useState(true)

  // Undo/redo (per-model, in-memory)
  const historyRef = useRef({}) // { [modelKey]: { undo: Plan[], redo: Plan[] } }
  const [historyTick, setHistoryTick] = useState(0)

  // Collision feedback (room move/resize)
  const [collision, setCollision] = useState(null) // { roomId, x,y,w,h }

  // UX helpers
  // - Multi-place: keep the current creation tool active after each placement
  // - Legend: collapsible “how to use” section at the top
  const [multiPlace, setMultiPlace] = useState(() => {
    try {
      return localStorage.getItem('floorplanner.v4.multiPlace') !== '0'
    } catch {
      return true
    }
  })

  const [legendOpen, setLegendOpen] = useState(() => {
    try {
      return localStorage.getItem('floorplanner.v4.legendOpen') !== '0'
    } catch {
      return true
    }
  })

  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [selectedWallId, setSelectedWallId] = useState(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState(null)

  // Canvas input capture
  const [canvasHover, setCanvasHover] = useState(false)
  const [canvasCaptured, setCanvasCaptured] = useState(true)

  const [byModel, setByModel] = useState(() => {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem('floorplanner.v3') ||
        localStorage.getItem('floorplanner.v2')
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })

  // Persist small UI prefs
  useEffect(() => {
    try {
      localStorage.setItem('floorplanner.v4.multiPlace', multiPlace ? '1' : '0')
    } catch {}
  }, [multiPlace])

  useEffect(() => {
    try {
      localStorage.setItem('floorplanner.v4.legendOpen', legendOpen ? '1' : '0')
    } catch {}
  }, [legendOpen])

  useEffect(() => {
    try {
      localStorage.setItem('floorplanner.v4.snapGrid', snapGridOn ? '1' : '0')
    } catch {}
  }, [snapGridOn])

  useEffect(() => {
    try {
      localStorage.setItem('floorplanner.v4.snapAlign', snapAlignOn ? '1' : '0')
    } catch {}
  }, [snapAlignOn])

  const model = useMemo(() => MODELS.find((m) => m.key === modelKey) || MODELS[0], [modelKey])
  const plan = useMemo(() => {
    const p = byModel[modelKey] || makeDefaultPlan(model)
    return normalizePlan(model, p)
  }, [byModel, modelKey, model])

  // Debounced persistence (prevents spamming localStorage during drag operations)
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(byModel))
      } catch {}
    }, 220)
    return () => window.clearTimeout(id)
  }, [byModel])

  // ---------- ViewBox (zoom/pan) ----------
  function defaultViewBox(m) {
    const pad = Math.max(m.widthM, m.depthM) * 0.12
    return { x: -pad, y: -pad, w: m.widthM + pad * 2, h: m.depthM + pad * 2 }
  }
  const [viewBox, setViewBox] = useState(() => defaultViewBox(model))

  useEffect(() => {
    setByModel((prev) => {
      if (prev[modelKey]) return prev
      return { ...prev, [modelKey]: makeDefaultPlan(model) }
    })
    setViewBox(defaultViewBox(model))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey])

  useEffect(() => {
    setViewBox((vb) => {
      const maxDim = Math.max(model.widthM, model.depthM)
      const pad = maxDim * 4
      const minW = model.widthM * 0.15
      const minH = model.depthM * 0.15
      const maxW = model.widthM * 8
      const maxH = model.depthM * 8
      const w = clamp(vb.w, minW, maxW)
      const h = clamp(vb.h, minH, maxH)
      const xMin = -pad
      const yMin = -pad
      const xMax = model.widthM + pad - w
      const yMax = model.depthM + pad - h
      const x = clamp(vb.x, xMin, xMax)
      const y = clamp(vb.y, yMin, yMax)
      return { x, y, w, h }
    })
  }, [model.widthM, model.depthM])

  const svgRef = useRef(null)
  const fileInputRef = useRef(null)
  const dragRef = useRef(null)
  const [, setTick] = useState(0)

  // React's onWheel handler may be passive in some setups.
  // We attach a native wheel listener with {passive:false} so we can reliably prevent page scroll.
  const wheelCtxRef = useRef({
    canvasHover: false,
    canvasCaptured: true,
    viewBox: { x: 0, y: 0, w: 1, h: 1 },
    model: { widthM: 1, depthM: 1 },
  })

  const areaM2 = model.widthM * model.depthM

  // ---------- i18n helpers ----------
  const modelLabel = (m) => {
    const tr = txt(`planner.models.${m.key}`)
    return typeof tr === 'string' ? tr : m.label
  }
  const finishLabel = (k) => {
    const tr = txt(`planner.finishes.${k}`)
    if (typeof tr === 'string') return tr
    return FINISHES.find((x) => x.key === k)?.label || k
  }
  const roomTypeLabel = (k) => {
    const tr = txt(`planner.roomTypes.${k}`)
    if (typeof tr === 'string') return tr
    return ROOM_TYPES.find((x) => x.key === k)?.label || k
  }

  const unitCm = typeof txt('planner.unitCm') === 'string' ? txt('planner.unitCm') : 'cm'
  const unitM = typeof txt('planner.unitM') === 'string' ? txt('planner.unitM') : 'm'
  const fmtCm = (m) => `${Math.round(m * 100)} ${unitCm}`
  const fmtSizeCm = (w, h) => `${fmtCm(w)} × ${fmtCm(h)}`
  const fmtLenCm = (m) => `${fmtCm(m)}`

  // ---------- coordinate conversion ----------
  function svgWorldPoint(ev) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = ev.clientX
    pt.y = ev.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function svgPointSnapped(ev) {
    const p = svgWorldPoint(ev)
    const snapOn = snapGridOn && !ev.altKey
    return {
      x: clamp(snapOn ? snap(p.x, gridM) : p.x, 0, model.widthM),
      y: clamp(snapOn ? snap(p.y, gridM) : p.y, 0, model.depthM),
    }
  }

  // ---------- undo/redo helpers ----------
  const clonePlan = (p) => {
    try {
      // structuredClone is available in modern browsers; fallback to JSON for older.
      // Plans are plain data (no functions), so JSON is safe.
      // eslint-disable-next-line no-undef
      return typeof structuredClone === 'function' ? structuredClone(p) : JSON.parse(JSON.stringify(p))
    } catch {
      return JSON.parse(JSON.stringify(p))
    }
  }

  const ensureHistory = (key) => {
    const h = historyRef.current[key]
    if (h && Array.isArray(h.undo) && Array.isArray(h.redo)) return h
    const fresh = { undo: [], redo: [] }
    historyRef.current[key] = fresh
    return fresh
  }

  const hist = ensureHistory(modelKey)
  const canUndo = hist.undo.length > 0
  const canRedo = hist.redo.length > 0

  const noteHistoryChanged = () => setHistoryTick((x) => x + 1)

  // Used by normal edit actions (push undo + clear redo)
  const pushUndoSnapshot = (snap) => {
    const h = ensureHistory(modelKey)
    h.undo.push(clonePlan(snap))
    if (h.undo.length > HISTORY_LIMIT) h.undo.splice(0, h.undo.length - HISTORY_LIMIT)
    h.redo.length = 0
    h._merge = null
    noteHistoryChanged()
  }

  const undo = () => {
    const h = ensureHistory(modelKey)
    if (!h.undo.length) return
    const prev = h.undo.pop()

    // Break any ongoing merge session.
    h._merge = null

    // Current -> redo
    h.redo.push(clonePlan(plan))
    if (h.redo.length > HISTORY_LIMIT) h.redo.splice(0, h.redo.length - HISTORY_LIMIT)

    noteHistoryChanged()
    setByModel((cur) => ({ ...cur, [modelKey]: normalizePlan(model, prev) }))
    setSelectedRoomId(null)
    setSelectedWallId(null)
    setSelectedOpeningId(null)
    setCollision(null)
  }

  const redo = () => {
    const h = ensureHistory(modelKey)
    if (!h.redo.length) return
    const next = h.redo.pop()

    // Break any ongoing merge session.
    h._merge = null

    // Current -> undo (do NOT clear redo here)
    h.undo.push(clonePlan(plan))
    if (h.undo.length > HISTORY_LIMIT) h.undo.splice(0, h.undo.length - HISTORY_LIMIT)

    noteHistoryChanged()
    setByModel((cur) => ({ ...cur, [modelKey]: normalizePlan(model, next) }))
    setSelectedRoomId(null)
    setSelectedWallId(null)
    setSelectedOpeningId(null)
    setCollision(null)
  }

  // ---------- state update helper ----------
  const updatePlan = (fn, opts = {}) => {
    const { history = true, mergeKey = null, mergeWindowMs = 650 } = opts
    setByModel((prev) => {
      const cur = prev[modelKey] || makeDefaultPlan(model)
      const normCur = normalizePlan(model, cur)
      const next = fn(normCur)
      const normNext = normalizePlan(model, next)

      if (history) {
        // Push history only if something actually changed.
        // (JSON compare is fine here — plans are tiny.)
        const a = JSON.stringify(normCur)
        const b = JSON.stringify(normNext)
        if (a !== b) {
          const h = ensureHistory(modelKey)

          // Merge mode: coalesce rapid-fire updates (e.g., typing a label) into a single undo step.
          if (mergeKey) {
            const now = Date.now()
            if (h._merge && h._merge.key === mergeKey && now - h._merge.t < mergeWindowMs) {
              // Keep the existing pre-edit snapshot; just extend the merge window.
              h._merge.t = now
            } else {
              h.undo.push(clonePlan(normCur))
              if (h.undo.length > HISTORY_LIMIT) h.undo.splice(0, h.undo.length - HISTORY_LIMIT)
              h._merge = { key: mergeKey, t: now }
            }
          } else {
            h.undo.push(clonePlan(normCur))
            if (h.undo.length > HISTORY_LIMIT) h.undo.splice(0, h.undo.length - HISTORY_LIMIT)
            h._merge = null
          }

          // Any new edit invalidates redo.
          if (h.redo.length) h.redo.length = 0
          setHistoryTick((x) => x + 1)
        }
      }

      return { ...prev, [modelKey]: normNext }
    })
  }

  // ---------- keyboard (only when hover + captured) ----------
  useEffect(() => {
    const onKey = (e) => {
      if (!canvasHover || !canvasCaptured) return
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      if (e.key === 'Escape') {
        e.preventDefault()
        setCanvasCaptured(false)
        return
      }

      // Undo / redo (while captured)
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const k = (e.key || '').toLowerCase()
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
          return
        }
        if (k === 'y') {
          e.preventDefault()
          redo()
          return
        }
      }

      // While captured, keep the page from scrolling via keyboard.
      if (
        e.key === ' ' ||
        e.code === 'Space' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageUp' ||
        e.key === 'PageDown' ||
        e.key === 'Home' ||
        e.key === 'End'
      ) {
        e.preventDefault()
        return
      }

      // Tool shortcuts (no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = (e.key || '').toLowerCase()
        if (k === 'v') {
          e.preventDefault()
          setTool('select')
          return
        }
        if (k === 'r') {
          e.preventDefault()
          setTool('room')
          return
        }
        if (k === 'w') {
          e.preventDefault()
          setTool('wall')
          return
        }
        if (k === 'd') {
          e.preventDefault()
          setTool('door')
          return
        }
        if (k === 'n') {
          e.preventDefault()
          setTool('window')
          return
        }
        if (k === 'p') {
          e.preventDefault()
          setTool('pan')
          return
        }
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      e.preventDefault()

      if (selectedOpeningId) {
        updatePlan((p) => ({ ...p, openings: p.openings.filter((o) => o.id !== selectedOpeningId || o.locked) }))
        setSelectedOpeningId(null)
      } else if (selectedWallId) {
        updatePlan((p) => {
          const wall = p.walls.find((w) => w.id === selectedWallId)
          if (!wall || wall.locked || wall.kind !== 'interior') return p
          const openings = p.openings.filter((o) => !(o.host?.type === 'wall' && o.host.wallId === selectedWallId))
          return { ...p, walls: p.walls.filter((w) => w.id !== selectedWallId), openings }
        })
        setSelectedWallId(null)
      } else if (selectedRoomId) {
        updatePlan((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== selectedRoomId || r.locked) }))
        setSelectedRoomId(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canvasHover, canvasCaptured, selectedRoomId, selectedWallId, selectedOpeningId, undo, redo])

  // Keep wheel context fresh for the native listener.
  useEffect(() => {
    wheelCtxRef.current = { canvasHover, canvasCaptured, viewBox, model }
  }, [canvasHover, canvasCaptured, viewBox, model])

  // Native wheel listener (non-passive) for reliable zoom and scroll prevention.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handler = (ev) => {
      const ctx = wheelCtxRef.current
      if (!ctx.canvasHover || !ctx.canvasCaptured) return
      ev.preventDefault()

      const vb = ctx.viewBox
      const m = ctx.model
      const raw = svgWorldPoint(ev)
      const fx = (raw.x - vb.x) / vb.w
      const fy = (raw.y - vb.y) / vb.h
      const zoom = ev.deltaY > 0 ? 1.12 : 0.89

      const maxDim = Math.max(m.widthM, m.depthM)
      const pad = maxDim * 4
      const minW = m.widthM * 0.15
      const minH = m.depthM * 0.15
      const maxW = m.widthM * 8
      const maxH = m.depthM * 8

      const newW = clamp(vb.w * zoom, minW, maxW)
      const newH = clamp(vb.h * zoom, minH, maxH)

      let nx = raw.x - fx * newW
      let ny = raw.y - fy * newH
      nx = clamp(nx, -pad, m.widthM + pad - newW)
      ny = clamp(ny, -pad, m.depthM + pad - newH)

      setViewBox({ x: nx, y: ny, w: newW, h: newH })
    }

    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
  }, [])

  const zoomBtn = (dir) => {
    const vb = viewBox
    const zoom = dir === 'in' ? 0.85 : 1.18
    const cx = vb.x + vb.w / 2
    const cy = vb.y + vb.h / 2
    const maxDim = Math.max(model.widthM, model.depthM)
    const pad = maxDim * 4
    const minW = model.widthM * 0.15
    const minH = model.depthM * 0.15
    const maxW = model.widthM * 8
    const maxH = model.depthM * 8
    const newW = clamp(vb.w * zoom, minW, maxW)
    const newH = clamp(vb.h * zoom, minH, maxH)
    let nx = cx - newW / 2
    let ny = cy - newH / 2
    nx = clamp(nx, -pad, model.widthM + pad - newW)
    ny = clamp(ny, -pad, model.depthM + pad - newH)
    setViewBox({ x: nx, y: ny, w: newW, h: newH })
  }

  const resetView = () => setViewBox(defaultViewBox(model))

  // ---------- derived selections ----------
  const selectedRoom = plan.rooms.find((r) => r.id === selectedRoomId) || null
  const selectedWall = plan.walls.find((w) => w.id === selectedWallId) || null
  const selectedOpening = plan.openings.find((o) => o.id === selectedOpeningId) || null

  // ---------- opening actions ----------
  const flipOpeningSwing = () => {
    if (!selectedOpening || selectedOpening.locked) return
    updatePlan((p) => ({
      ...p,
      openings: p.openings.map((o) => (o.id === selectedOpening.id ? { ...o, openTo: o.openTo === 'pos' ? 'neg' : 'pos' } : o)),
    }))
  }
  const flipOpeningHinge = () => {
    if (!selectedOpening || selectedOpening.locked) return
    updatePlan((p) => ({
      ...p,
      openings: p.openings.map((o) => (o.id === selectedOpening.id ? { ...o, hinge: o.hinge === 'start' ? 'end' : 'start' } : o)),
    }))
  }

  const deleteSelected = () => {
    if (selectedOpening) {
      if (selectedOpening.locked) return
      updatePlan((p) => ({ ...p, openings: p.openings.filter((o) => o.id !== selectedOpening.id) }))
      setSelectedOpeningId(null)
      return
    }
    if (selectedWall) {
      if (selectedWall.locked || selectedWall.kind !== 'interior') return
      updatePlan((p) => {
        const openings = p.openings.filter((o) => !(o.host?.type === 'wall' && o.host.wallId === selectedWall.id))
        return { ...p, walls: p.walls.filter((w) => w.id !== selectedWall.id), openings }
      })
      setSelectedWallId(null)
      return
    }
    if (selectedRoom) {
      if (selectedRoom.locked) return
      updatePlan((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== selectedRoom.id) }))
      setSelectedRoomId(null)
    }
  }

  // ---------- pointer handlers ----------
  const onCanvasPointerDown = (ev) => {
    // Click to capture controls again
    setCanvasCaptured(true)
    const pt = svgPointSnapped(ev)

    if (tool === 'pan') {
      const raw = svgWorldPoint(ev)
      dragRef.current = { mode: 'pan', start: raw, vb0: viewBox }
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      return
    }

    if (tool !== 'select') {
      setSelectedOpeningId(null)
      setSelectedRoomId(null)
      setSelectedWallId(null)
    }

    if (tool === 'room') {
      dragRef.current = { mode: 'drawRoom', start: pt }
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      return
    }

    if (tool === 'wall') {
      dragRef.current = { mode: 'drawWall', start: pt }
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      return
    }

    if (tool === 'door' || tool === 'window') {
      const isWindow = tool === 'window'
      const hit = pickWall(plan.walls, pt, 0.22, isWindow ? (w) => w.kind === 'outer' : null)
      if (!hit) return
      const hostWall = plan.walls.find((w) => w.id === hit.wallId)
      if (!hostWall) return

      // If the chosen wall is a boundary-aligned non-outer wall, map to its corresponding outer wall.
      let wallId = hostWall.id
      let at = hit.at
      const boundaryId = boundaryOuterWallId(model, hostWall)
      if (boundaryId && hostWall.kind !== 'outer') {
        const outer = plan.walls.find((w) => w.id === boundaryId)
        if (outer) {
          const g = wallGeom(outer)
          const { t } = distPointToSeg(pt, outer.a, outer.b)
          wallId = outer.id
          at = g.len * t
        }
      }

      const widthM = isWindow ? DEFAULT_WINDOW_W_M : DEFAULT_DOOR_W_M
      const heightM = isWindow ? DEFAULT_WINDOW_H_M : undefined

      const safeAt = findNearestOpeningAt(plan, wallId, at, widthM)
      if (safeAt == null) return
      at = safeAt

      // Default swing based on click side
      let openTo = 'pos'
      const whost = plan.walls.find((w) => w.id === wallId)
      if (whost) {
        const g = wallGeom(whost)
        const c = { x: g.a.x + g.t.x * at, y: g.a.y + g.t.y * at }
        const dot = (pt.x - c.x) * g.n.x + (pt.y - c.y) * g.n.y
        openTo = dot >= 0 ? 'pos' : 'neg'
      }

      const opening = {
        id: uid(),
        kind: tool,
        widthM,
        heightM,
        host: { type: 'wall', wallId, at },
        hinge: 'start',
        openTo,
        locked: false,
      }

      updatePlan((p) => ({ ...p, openings: [...p.openings, opening] }))
      setSelectedOpeningId(opening.id)
      if (!multiPlace) setTool('select')
      return
    }

    if (tool === 'select') {
      setSelectedOpeningId(null)
      setSelectedRoomId(null)
      setSelectedWallId(null)
    }
  }

  const onCanvasPointerMove = (ev) => {
    if (!dragRef.current) return
    const d = dragRef.current

    if (d.mode === 'moveRoom') {
      const raw = svgWorldPoint(ev)
      const start = d.startRaw
      if (!start || !d.room0) return

      const threshold = Math.max(0.03, gridM * 0.4)
      const movedDist = Math.hypot(raw.x - start.x, raw.y - start.y)
      if (!d.didMove && movedDist < threshold) return
      if (!d.didMove) d.didMove = true

      let dx = raw.x - start.x
      let dy = raw.y - start.y

      // SHIFT: constrain axis while moving (picked once when the user starts moving).
      if (ev.shiftKey) {
        if (!d.axisLock) d.axisLock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
        if (d.axisLock === 'x') dy = 0
        if (d.axisLock === 'y') dx = 0
      } else {
        d.axisLock = null
      }

      let nx = d.room0.x + dx
      let ny = d.room0.y + dy

      // Snapping rules:
      // - ALT always disables snapping.
      // - Grid snap can be toggled.
      // - Wall/room alignment snap can be toggled.
      if (!ev.altKey && snapGridOn) {
        nx = snap(nx, gridM)
        ny = snap(ny, gridM)
      }

      nx = clamp(nx, 0, model.widthM - d.room0.w)
      ny = clamp(ny, 0, model.depthM - d.room0.h)

      if (!ev.altKey && snapAlignOn) {
        const s = snapRoomPosition(model, plan, d.roomId, nx, ny, d.room0.w, d.room0.h, gridM)
        if (d.axisLock === 'x') nx = s.x
        else if (d.axisLock === 'y') ny = s.y
        else {
          nx = s.x
          ny = s.y
        }
      }

      // Keep the existing "rooms do not overlap" invariant + show collision feedback.
      const candidate = { x: nx, y: ny, w: d.room0.w, h: d.room0.h }
      const overlaps = (plan.rooms || []).some((r) => r?.id !== d.roomId && rectsOverlap(candidate, r))
      if (overlaps) {
        setCollision({ roomId: d.roomId, ...candidate })
        nx = d.lastValid?.x ?? d.room0.x
        ny = d.lastValid?.y ?? d.room0.y
      } else {
        setCollision(null)
        d.lastValid = { x: nx, y: ny }
      }

      // Push a single undo snapshot per drag gesture (only if something actually changed).
      if (!d.historyPushed && (nx !== d.room0.x || ny !== d.room0.y)) {
        pushUndoSnapshot(d.plan0)
        d.historyPushed = true
      }

      updatePlan(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) => (r.id === d.roomId ? { ...r, x: nx, y: ny } : r)),
        }),
        { history: false }
      )
      return
    }

    if (d.mode === 'resizeRoom') {
      const raw = svgWorldPoint(ev)
      const start = d.startRaw
      if (!start || !d.room0) return

      const threshold = Math.max(0.03, gridM * 0.4)
      const movedDist = Math.hypot(raw.x - start.x, raw.y - start.y)
      if (!d.didMove && movedDist < threshold) return
      if (!d.didMove) d.didMove = true

      const handle = d.handle || 'se'
      const moveLeft = handle.includes('w')
      const moveRight = handle.includes('e')
      const moveTop = handle.includes('n')
      const moveBottom = handle.includes('s')

      const minW = 0.6
      const minH = 0.6

      const x0 = d.room0.x
      const y0 = d.room0.y
      const w0 = d.room0.w
      const h0 = d.room0.h

      const left0 = x0
      const right0 = x0 + w0
      const top0 = y0
      const bottom0 = y0 + h0

      const dx = raw.x - start.x
      const dy = raw.y - start.y

      let left = left0
      let right = right0
      let top = top0
      let bottom = bottom0

      if (moveLeft) left = left0 + dx
      if (moveRight) right = right0 + dx
      if (moveTop) top = top0 + dy
      if (moveBottom) bottom = bottom0 + dy

      // Snapping (ALT disables all)
      if (!ev.altKey && snapGridOn) {
        if (moveLeft) left = snap(left, gridM)
        if (moveRight) right = snap(right, gridM)
        if (moveTop) top = snap(top, gridM)
        if (moveBottom) bottom = snap(bottom, gridM)
      }

      if (!ev.altKey && snapAlignOn) {
        const s = snapRoomRectEdges(
          model,
          plan,
          d.roomId,
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

      let nx = left
      let ny = top
      let nw = right - left
      let nh = bottom - top

      // No-overlap + collision feedback
      const candidate = { x: nx, y: ny, w: nw, h: nh }
      const overlaps = (plan.rooms || []).some((r) => r?.id !== d.roomId && rectsOverlap(candidate, r))
      if (overlaps) {
        setCollision({ roomId: d.roomId, ...candidate })
        const lv = d.lastValid || d.room0
        nx = lv.x
        ny = lv.y
        nw = lv.w
        nh = lv.h
      } else {
        setCollision(null)
        d.lastValid = { x: nx, y: ny, w: nw, h: nh }
      }

      // One undo snapshot per resize gesture.
      if (!d.historyPushed && (nx !== x0 || ny !== y0 || nw !== w0 || nh !== h0)) {
        pushUndoSnapshot(d.plan0)
        d.historyPushed = true
      }

      updatePlan(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) => (r.id === d.roomId ? { ...r, x: nx, y: ny, w: nw, h: nh } : r)),
        }),
        { history: false }
      )
      return
    }

    if (d.mode === 'moveOpening') {
      const raw = svgWorldPoint(ev)
      const start = d.startRaw
      if (!start) return

      const opening = plan.openings.find((o) => o.id === d.openingId)
      if (!opening || opening.locked) return

      const threshold = Math.max(0.03, gridM * 0.4)
      const movedDist = Math.hypot(raw.x - start.x, raw.y - start.y)
      if (!d.didMove && movedDist < threshold) return
      if (!d.didMove) d.didMove = true

      const isWindow = opening.kind === 'window'
      const tolM = Math.max(0.3, gridM * 2.2)

      const hit = pickWall(plan.walls, raw, tolM, isWindow ? (w) => w.kind === 'outer' : null)
      if (!hit) return

      let hostWall = plan.walls.find((w) => w.id === hit.wallId)
      if (!hostWall) return

      // If the chosen wall is a boundary-aligned non-outer wall, map to its corresponding outer wall.
      let wallId = hostWall.id
      let at = hit.at
      const boundaryId = boundaryOuterWallId(model, hostWall)
      if (boundaryId && hostWall.kind !== 'outer') {
        const outer = plan.walls.find((w) => w.id === boundaryId)
        if (outer) {
          hostWall = outer
          wallId = outer.id
          const gOuter = wallGeom(outer)
          const proj = distPointToSeg(raw, outer.a, outer.b)
          at = gOuter.len * proj.t
        }
      }

      const g = wallGeom(hostWall)
      at = clamp(at, 0, g.len)

      // Snap along-wall position to grid (ALT disables snapping).
      if (!ev.altKey && snapGridOn) {
        const c = { x: g.a.x + g.t.x * at, y: g.a.y + g.t.y * at }
        const horizontal = Math.abs(g.t.x) >= Math.abs(g.t.y)
        const c2 = horizontal ? { ...c, x: snap(c.x, gridM) } : { ...c, y: snap(c.y, gridM) }
        at = (c2.x - g.a.x) * g.t.x + (c2.y - g.a.y) * g.t.y
      }

      const widthM = openingWidthM(opening)
      const safeAt = findNearestOpeningAt(plan, wallId, at, widthM, opening.id)
      if (safeAt == null) return
      at = safeAt

      d.lastValid = { wallId, at }

      // One undo snapshot per drag gesture.
      if (!d.historyPushed && (wallId !== d.opening0?.wallId || Math.abs(at - (d.opening0?.at ?? at)) > 1e-6)) {
        pushUndoSnapshot(d.plan0)
        d.historyPushed = true
      }

      updatePlan(
        (p) => ({
          ...p,
          openings: p.openings.map((o) => (o.id === opening.id ? { ...o, host: { type: 'wall', wallId, at } } : o)),
        }),
        { history: false }
      )
      return
    }

    if (d.mode === 'pan') {
      const raw = svgWorldPoint(ev)
      const dx = d.start.x - raw.x
      const dy = d.start.y - raw.y
      const maxDim = Math.max(model.widthM, model.depthM)
      const pad = maxDim * 4
      const w = d.vb0.w
      const h = d.vb0.h
      const nx = clamp(d.vb0.x + dx, -pad, model.widthM + pad - w)
      const ny = clamp(d.vb0.y + dy, -pad, model.depthM + pad - h)
      setViewBox({ x: nx, y: ny, w, h })
      return
    }

    if (d.mode === 'drawRoom' || d.mode === 'drawWall') {
      const pt = svgPointSnapped(ev)
      dragRef.current = { ...d, current: pt }
      setTick((x) => x + 1)
    }
  }

  const onCanvasPointerUp = (ev) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return

    if (d.mode === 'moveRoom') {
      setCollision(null)
      if (!d.didMove) return
      if (!d.room0) return

      const final = d.lastValid || { x: d.room0.x, y: d.room0.y }
      updatePlan(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) => (r.id === d.roomId ? { ...r, x: final.x, y: final.y } : r)),
        }),
        { history: false }
      )
      return
    }

    if (d.mode === 'resizeRoom') {
      setCollision(null)
      if (!d.didMove) return
      if (!d.room0) return

      const final = d.lastValid || d.room0
      updatePlan(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) => (r.id === d.roomId ? { ...r, x: final.x, y: final.y, w: final.w, h: final.h } : r)),
        }),
        { history: false }
      )
      return
    }

    if (d.mode === 'moveOpening') {
      if (!d.didMove) return

      const opening = plan.openings.find((o) => o.id === d.openingId)
      if (!opening || opening.locked) return
      if (!d.lastValid?.wallId) return

      updatePlan(
        (p) => ({
          ...p,
          openings: p.openings.map((o) =>
            o.id === opening.id ? { ...o, host: { type: 'wall', wallId: d.lastValid.wallId, at: d.lastValid.at } } : o
          ),
        }),
        { history: false }
      )
      return
    }

    if (d.mode === 'drawRoom') {
      const a = d.start
      const b = d.current || d.start
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      const w = Math.abs(a.x - b.x)
      const h = Math.abs(a.y - b.y)
      if (w < 0.6 || h < 0.6) return

      const room = {
        id: uid(),
        type: roomType,
        label: roomTypeLabel(roomType),
        x,
        y,
        w,
        h,
        finish,
        locked: false,
      }
      if (plan.rooms.some((r) => rectsOverlap(room, r))) return
      updatePlan((p) => ({ ...p, rooms: [...p.rooms, room] }))
      setSelectedRoomId(room.id)
      if (!multiPlace) setTool('select')
      return
    }

    if (d.mode === 'drawWall') {
      const a = d.start
      const b0 = d.current || d.start
      const b = constrainAxis(a, b0)
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < 0.6) return
      const key = wallKey(a, b)
      // Don't duplicate identical interior segments.
      if (plan.walls.some((w) => w.kind === 'interior' && (w.key || wallKey(w.a, w.b)) === key)) return
      const wall = { id: uid(), kind: 'interior', locked: false, a, b, key }
      updatePlan((p) => ({ ...p, walls: normalizeWallsKeepAll([...(p.walls || []), wall]) }))
      setSelectedWallId(wall.id)
      if (!multiPlace) setTool('select')
    }
  }

  const onSelectRoom = (id) => {
    setSelectedRoomId(id)
    setSelectedWallId(null)
    setSelectedOpeningId(null)
    setTool('select')
  }
  const onSelectWall = (id) => {
    setSelectedWallId(id)
    setSelectedRoomId(null)
    setSelectedOpeningId(null)
    setTool('select')
  }
  const onSelectOpening = (id) => {
    setSelectedOpeningId(id)
    setSelectedRoomId(null)
    setSelectedWallId(null)
    setTool('select')
  }

  const exportPdf = () => window.print()

  const downloadLayout = () => {
    const payload = {
      kind: 'floorplanner-layout',
      version: 1,
      savedAt: new Date().toISOString(),
      modelKey,
      plan: normalizePlan(model, plan),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `layout-${modelKey}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const onLayoutFileChange = async (ev) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      let targetModelKey = modelKey
      let nextPlan = null

      if (parsed && typeof parsed === 'object') {
        if (parsed.plan && typeof parsed.plan === 'object') {
          nextPlan = parsed.plan
          if (typeof parsed.modelKey === 'string' && MODELS.some((m) => m.key === parsed.modelKey)) {
            targetModelKey = parsed.modelKey
          }
        } else if (Array.isArray(parsed.rooms) || Array.isArray(parsed.walls) || Array.isArray(parsed.openings)) {
          nextPlan = parsed
        }
      }

      if (!nextPlan) throw new Error('invalid-layout-file')

      const targetModel = MODELS.find((m) => m.key === targetModelKey) || model
      const prevTargetPlan = normalizePlan(targetModel, byModel[targetModelKey] || makeDefaultPlan(targetModel))
      const importedPlan = normalizePlan(targetModel, nextPlan)

      const h = ensureHistory(targetModelKey)
      h.undo.push(clonePlan(prevTargetPlan))
      if (h.undo.length > HISTORY_LIMIT) h.undo.splice(0, h.undo.length - HISTORY_LIMIT)
      h.redo.length = 0
      h._merge = null
      noteHistoryChanged()

      setByModel((prev) => ({ ...prev, [targetModelKey]: importedPlan }))
      setModelKey(targetModelKey)
      setSelectedRoomId(null)
      setSelectedWallId(null)
      setSelectedOpeningId(null)
      setCollision(null)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      const msg =
        typeof txt('planner.loadLayoutError') === 'string'
          ? txt('planner.loadLayoutError')
          : 'Could not open that saved layout file.'
      window.alert(msg)
    }
  }

  const clearUserItems = () => {
    updatePlan((p) => ({
      rooms: p.rooms.filter((r) => r.locked),
      walls: p.walls.filter((w) => w.locked && w.kind === 'outer'),
      openings: p.openings.filter((o) => o.locked),
    }))
    setSelectedRoomId(null)
    setSelectedWallId(null)
    setSelectedOpeningId(null)
  }

  // Render-only wall segments (dedupe by key)
  const wallSegments = useMemo(() => {
    const map = new Map()
    for (const w of plan.walls) {
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
  }, [plan.walls])

  const dragPreview = (() => {
    const d = dragRef.current
    if (!d) return null
    if (d.mode === 'drawRoom') {
      const a = d.start
      const b = d.current || d.start
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      const w = Math.abs(a.x - b.x)
      const h = Math.abs(a.y - b.y)
      return { type: 'room', x, y, w, h, label: fmtSizeCm(w, h) }
    }
    if (d.mode === 'drawWall') {
      const a = d.start
      const b0 = d.current || d.start
      const b = constrainAxis(a, b0)
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      return { type: 'wall', a, b, label: fmtLenCm(len) }
    }
    return null
  })()

  const title = typeof txt('planner.title') === 'string' ? txt('planner.title') : 'Floor plan builder'

  const showT = typeof txt('planner.show') === 'string' ? txt('planner.show') : 'Show'
  const hideT = typeof txt('planner.hide') === 'string' ? txt('planner.hide') : 'Hide'
  const zoomT = typeof txt('planner.zoom') === 'string' ? txt('planner.zoom') : 'Zoom'
  const legendSnapTitle =
    typeof txt('planner.legendSnapTitle') === 'string' ? txt('planner.legendSnapTitle') : 'Snapping & multi-place'
  const subtitleT = txt('planner.subtitle')
  const subtitle =
    typeof subtitleT === 'string'
      ? subtitleT
          .replaceAll('{area}', fmtAreaM2(areaM2))
          .replaceAll('{w}', round(model.widthM, 2))
          .replaceAll('{d}', round(model.depthM, 2))
          .replaceAll('{unitM}', unitM)
      : `${fmtAreaM2(areaM2)} m² · ${round(model.widthM, 2)}×${round(model.depthM, 2)} ${unitM}`

  const captureOn = typeof txt('planner.captureOn') === 'string' ? txt('planner.captureOn') : 'Canvas controls active — press Esc to release'
  const captureOff = typeof txt('planner.captureOff') === 'string' ? txt('planner.captureOff') : 'Click the canvas to capture controls'
  const windowOnlyExteriorMsg =
    typeof txt('planner.windowOnlyExterior') === 'string' ? txt('planner.windowOnlyExterior') : 'Windows can be placed only on exterior walls.'

  const toolNoteText = useMemo(() => {
    if (tool === 'room') {
      return typeof txt('planner.tip.room') === 'string' ? txt('planner.tip.room') : 'Drag to create a room.'
    }
    if (tool === 'wall') {
      return typeof txt('planner.tip.wall') === 'string' ? txt('planner.tip.wall') : 'Drag to draw an interior wall segment.'
    }
    if (tool === 'door') {
      return typeof txt('planner.tip.door') === 'string' ? txt('planner.tip.door') : 'Click a wall to place a door.'
    }
    if (tool === 'window') {
      return typeof txt('planner.tip.window') === 'string' ? txt('planner.tip.window') : 'Click an exterior wall to place a window.'
    }
    if (tool === 'select') {
      return typeof txt('planner.tip.select') === 'string' ? txt('planner.tip.select') : 'Select an element. Delete removes it.'
    }
    if (tool === 'pan') {
      return typeof txt('planner.tip.pan') === 'string' ? txt('planner.tip.pan') : 'Drag to pan. Wheel to zoom.'
    }
    return ''
  }, [tool, txt])

  const onT = typeof txt('planner.on') === 'string' ? txt('planner.on') : 'ON'
  const offT = typeof txt('planner.off') === 'string' ? txt('planner.off') : 'OFF'
  const downloadLayoutT = typeof txt('planner.downloadLayout') === 'string' ? txt('planner.downloadLayout') : 'Download layout'
  const loadLayoutT = typeof txt('planner.loadLayout') === 'string' ? txt('planner.loadLayout') : 'Load layout'

  const legendSnapT = txt('planner.legendSnap')
  const legendSnapText =
    typeof legendSnapT === 'string'
      ? legendSnapT
          .replaceAll('{grid}', snapGridOn ? onT : offT)
          .replaceAll('{align}', snapAlignOn ? onT : offT)
          .replaceAll('{multi}', multiPlace ? onT : offT)
      : `Grid snap is ${snapGridOn ? onT : offT}. Wall/room snap is ${snapAlignOn ? onT : offT}. Hold ALT to temporarily disable snapping. Hold SHIFT while moving a room to constrain the axis. Multi‑place is currently ${multiPlace ? onT : offT}.`

  const snapStatusT = txt('planner.snapStatus')
  const snapStatusText =
    typeof snapStatusT === 'string'
      ? snapStatusT
          .replaceAll('{grid}', snapGridOn ? onT : offT)
          .replaceAll('{align}', snapAlignOn ? onT : offT)
      : `Snap: ${snapGridOn ? 'grid' : 'off'} / ${snapAlignOn ? 'align' : 'no-align'} (ALT disables)`

  const userWalls = plan.walls.filter((w) => w.kind === 'interior' && !w.locked)

  return (
    <main className="fp-page">
      <div className="fp-topbar">
        <div>
          <h1 className="fp-title">{title}</h1>
          <div className="fp-sub">{subtitle}</div>
        </div>
        <div className="fp-top-actions">
          <button className="btn ghost" onClick={undo} disabled={!canUndo} title="Ctrl/⌘+Z">
            {typeof txt('planner.undo') === 'string' ? txt('planner.undo') : 'Undo'}
          </button>
          <button className="btn ghost" onClick={redo} disabled={!canRedo} title="Ctrl/⌘+Y or Ctrl/⌘+Shift+Z">
            {typeof txt('planner.redo') === 'string' ? txt('planner.redo') : 'Redo'}
          </button>
          <button className="btn ghost" onClick={() => setPanelOpen((v) => !v)}>
            {panelOpen
              ? typeof txt('planner.hidePanel') === 'string'
                ? txt('planner.hidePanel')
                : 'Hide panel'
              : typeof txt('planner.showPanel') === 'string'
                ? txt('planner.showPanel')
                : 'Show panel'}
          </button>
          <button className="btn ghost" onClick={downloadLayout}>
            {downloadLayoutT}
          </button>
          <button className="btn ghost" onClick={() => fileInputRef.current?.click()}>
            {loadLayoutT}
          </button>
          <button className="btn ghost" onClick={clearUserItems}>
            {typeof txt('planner.clear') === 'string' ? txt('planner.clear') : 'Clear'}
          </button>
          <button className="btn" onClick={exportPdf}>
            {typeof txt('planner.exportPdf') === 'string' ? txt('planner.exportPdf') : 'Export PDF'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onLayoutFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Legend / quick help (top section) */}
      <details
        className="fp-legend card p-6"
        open={legendOpen}
        onToggle={(e) => setLegendOpen(e.currentTarget.open)}
      >
        <summary className="fp-legend-sum">
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span className="fp-legend-title">
              {typeof txt('planner.legend') === 'string' ? txt('planner.legend') : 'Legend / How to use'}
            </span>
            <span className="fp-legend-hint">
              {typeof txt('planner.legendHint') === 'string' ? txt('planner.legendHint') : 'Quick guide + shortcuts'}
            </span>
          </span>
          <span className="fp-legend-pill">{legendOpen ? hideT : showT}</span>
        </summary>

        <div className="fp-legend-grid">
          <div className="fp-legend-item">
            <div className="fp-legend-k">🧱 {typeof txt('planner.tool.room') === 'string' ? txt('planner.tool.room') : 'Room'}</div>
            <div className="fp-legend-v">
              {typeof txt('planner.legendRoom') === 'string'
                ? txt('planner.legendRoom')
                : 'Drag to draw a room. Rooms cannot overlap; choose type + floor finish from the panel.'}
            </div>
          </div>

          <div className="fp-legend-item">
            <div className="fp-legend-k">🧱 {typeof txt('planner.tool.wall') === 'string' ? txt('planner.tool.wall') : 'Wall'}</div>
            <div className="fp-legend-v">
              {typeof txt('planner.legendWall') === 'string'
                ? txt('planner.legendWall')
                : 'Drag to draw an interior wall segment (auto axis-aligned). Doors snap to any wall; windows snap to exterior walls only.'}
            </div>
          </div>

          <div className="fp-legend-item">
            <div className="fp-legend-k">🚪 / 🪟 {typeof txt('planner.openings') === 'string' ? txt('planner.openings') : 'Doors & windows'}</div>
            <div className="fp-legend-v">
              {typeof txt('planner.legendOpenings') === 'string'
                ? txt('planner.legendOpenings')
                : 'Click to place. Switch to Select to drag along a wall. Doors support Flip swing / hinge in the Inspector.'}
            </div>
          </div>

          <div className="fp-legend-item">
            <div className="fp-legend-k">🖱️ {typeof txt('planner.tool.select') === 'string' ? txt('planner.tool.select') : 'Select'}</div>
            <div className="fp-legend-v">
              {typeof txt('planner.legendSelect') === 'string'
                ? txt('planner.legendSelect')
                : 'Click an object to inspect it. Drag rooms to move (with snapping + no-overlap). Drag doors/windows to reposition.'}
            </div>
          </div>

          <div className="fp-legend-item">
            <div className="fp-legend-k">🧭 {typeof txt('planner.tool.pan') === 'string' ? txt('planner.tool.pan') : 'Pan'} / {zoomT}</div>
            <div className="fp-legend-v">
              {typeof txt('planner.legendPan') === 'string'
                ? txt('planner.legendPan')
                : 'Use Pan tool to drag the view. Use mouse wheel to zoom (+ / − buttons also work).'}
            </div>
          </div>

          <div className="fp-legend-item">
            <div className="fp-legend-k">⚙️ {legendSnapTitle}</div>
            <div className="fp-legend-v">
              {legendSnapText}
            </div>
          </div>
        </div>

        <div className="fp-legend-keys">
          <div className="fp-keyrow">
            <span className="fp-key">ALT</span>
            <span className="fp-keytext">{typeof txt('planner.keyAlt') === 'string' ? txt('planner.keyAlt') : 'Disable snapping while dragging'}</span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">SHIFT</span>
            <span className="fp-keytext">
              {typeof txt('planner.keyShift') === 'string' ? txt('planner.keyShift') : 'Constrain axis while moving rooms'}
            </span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">ESC</span>
            <span className="fp-keytext">{typeof txt('planner.keyEsc') === 'string' ? txt('planner.keyEsc') : 'Release canvas capture (click canvas to capture again)'}</span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">V</span>
            <span className="fp-keytext">{typeof txt('planner.keyV') === 'string' ? txt('planner.keyV') : 'Select tool'}</span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">R</span>
            <span className="fp-keytext">{typeof txt('planner.keyR') === 'string' ? txt('planner.keyR') : 'Room tool'}</span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">W</span>
            <span className="fp-keytext">{typeof txt('planner.keyW') === 'string' ? txt('planner.keyW') : 'Wall tool'}</span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">D</span>
            <span className="fp-keytext">{typeof txt('planner.keyD') === 'string' ? txt('planner.keyD') : 'Door tool'}</span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">N</span>
            <span className="fp-keytext">{typeof txt('planner.keyN') === 'string' ? txt('planner.keyN') : 'Window tool'}</span>
          </div>
          <div className="fp-keyrow">
            <span className="fp-key">P</span>
            <span className="fp-keytext">{typeof txt('planner.keyP') === 'string' ? txt('planner.keyP') : 'Pan tool'}</span>
          </div>
        </div>
      </details>

      <div className={`fp-grid ${panelOpen ? '' : 'is-panel-closed'}`}>
        <aside className="fp-panel card p-6">
          <div className="fp-section">
            <div className="fp-h">{typeof txt('planner.model') === 'string' ? txt('planner.model') : 'Model'}</div>
            <div className="fp-select mt-2">
              <select aria-label={typeof txt('planner.model') === 'string' ? txt('planner.model') : 'Model'} value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
                {MODELS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {modelLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="fp-muted mt-2">
              {round(model.widthM, 2)}×{round(model.depthM, 2)} {unitM} · {fmtAreaM2(areaM2)} m²
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-h">{typeof txt('planner.tools') === 'string' ? txt('planner.tools') : 'Tools'}</div>
            <div className="fp-toolrow notranslate" translate="no">
              {[
                ['room', typeof txt('planner.tool.room') === 'string' ? txt('planner.tool.room') : 'Room'],
                ['wall', typeof txt('planner.tool.wall') === 'string' ? txt('planner.tool.wall') : 'Wall'],
                ['door', typeof txt('planner.tool.door') === 'string' ? txt('planner.tool.door') : 'Door'],
                ['window', typeof txt('planner.tool.window') === 'string' ? txt('planner.tool.window') : 'Window'],
                ['select', typeof txt('planner.tool.select') === 'string' ? txt('planner.tool.select') : 'Select'],
                ['pan', typeof txt('planner.tool.pan') === 'string' ? txt('planner.tool.pan') : 'Pan'],
              ].map(([k, label]) => (
                <button key={k} className={`btn ${tool === k ? '' : 'ghost'}`} onClick={() => setTool(k)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="fp-toolopts">
              <label className="fp-check">
                <input type="checkbox" checked={multiPlace} onChange={(e) => setMultiPlace(e.target.checked)} />
                <span>{typeof txt('planner.multiPlace') === 'string' ? txt('planner.multiPlace') : 'Multi-place'}</span>
              </label>
              <div className="fp-muted">
                {typeof txt('planner.multiPlaceHint') === 'string'
                  ? txt('planner.multiPlaceHint')
                  : 'Keep the current tool active after each placement (walls/doors/windows/rooms).'}
              </div>
            </div>

            <div className="fp-note notranslate" translate="no">
              <span key={`tool-note-${tool}`}>{toolNoteText}</span>
              {tool === 'window' ? <div className="mt-2">⚠️ {windowOnlyExteriorMsg}</div> : null}
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-h">{typeof txt('planner.roomSettings') === 'string' ? txt('planner.roomSettings') : 'Room settings'}</div>
            <label className="fp-label">{typeof txt('planner.type') === 'string' ? txt('planner.type') : 'Type'}</label>
            <div className="fp-select">
              <select aria-label={typeof txt('planner.type') === 'string' ? txt('planner.type') : 'Type'} value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                {ROOM_TYPES.map((rt) => (
                  <option key={rt.key} value={rt.key}>
                    {roomTypeLabel(rt.key)}
                  </option>
                ))}
              </select>
            </div>

            <label className="fp-label">{typeof txt('planner.floorFinish') === 'string' ? txt('planner.floorFinish') : 'Floor finish'}</label>
            <div className="fp-select">
              <select aria-label={typeof txt('planner.floorFinish') === 'string' ? txt('planner.floorFinish') : 'Floor finish'} value={finish} onChange={(e) => setFinish(e.target.value)}>
                {FINISHES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {finishLabel(f.key)}
                  </option>
                ))}
              </select>
            </div>

            <label className="fp-label">{typeof txt('planner.grid') === 'string' ? txt('planner.grid') : 'Grid'}</label>
            <div className="fp-toolrow">
              {[0.05, 0.1, 0.2].map((g) => (
                <button key={g} className={`btn ${gridM === g ? '' : 'ghost'}`} onClick={() => setGridM(g)}>
                  {g} {unitM}
                </button>
              ))}
            </div>

            <div className="fp-toolopts">
              <label className="fp-check">
                <input type="checkbox" checked={snapGridOn} onChange={(e) => setSnapGridOn(e.target.checked)} />
                <span>{typeof txt('planner.snapGrid') === 'string' ? txt('planner.snapGrid') : 'Grid snap'}</span>
              </label>

              <label className="fp-check" style={{ marginTop: 10 }}>
                <input type="checkbox" checked={snapAlignOn} onChange={(e) => setSnapAlignOn(e.target.checked)} />
                <span>{typeof txt('planner.snapAlign') === 'string' ? txt('planner.snapAlign') : 'Wall / room snap'}</span>
              </label>

              <div className="fp-muted" style={{ marginTop: 8 }}>
                {typeof txt('planner.snapHint') === 'string'
                  ? txt('planner.snapHint')
                  : 'ALT = temporarily disable snapping · SHIFT = constrain axis while moving rooms'}
              </div>
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-h">{typeof txt('planner.objects') === 'string' ? txt('planner.objects') : 'Objects'}</div>
            <div className="fp-objlist">
              <div>
                <div className="fp-objtitle">{typeof txt('planner.rooms') === 'string' ? txt('planner.rooms') : 'Rooms'} ({plan.rooms.length})</div>
                {plan.rooms.map((r) => (
                  <button
                    key={r.id}
                    className={`fp-obj ${selectedRoomId === r.id ? 'is-on' : ''}`}
                    onClick={() => onSelectRoom(r.id)}
                    title={r.locked ? (typeof txt('planner.locked') === 'string' ? txt('planner.locked') : 'Locked') : ''}
                  >
                    <div className="fp-ins">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="fp-dot" />
                        <strong>{r.label || roomTypeLabel(r.type)}</strong>
                      </div>
                      <div className="fp-muted">{fmtSizeCm(r.w, r.h)}</div>
                    </div>
                    <div className="fp-muted">{finishLabel(r.finish)}</div>
                  </button>
                ))}
              </div>

              <div>
                <div className="fp-objtitle">{typeof txt('planner.openings') === 'string' ? txt('planner.openings') : 'Doors & windows'} ({plan.openings.length})</div>
                {plan.openings.map((o) => (
                  <button
                    key={o.id}
                    className={`fp-obj ${selectedOpeningId === o.id ? 'is-on' : ''}`}
                    onClick={() => onSelectOpening(o.id)}
                    title={o.locked ? (typeof txt('planner.locked') === 'string' ? txt('planner.locked') : 'Locked') : ''}
                  >
                    <div className="fp-ins">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="fp-dot" style={{ opacity: o.kind === 'window' ? 0.9 : 1 }} />
                        <strong>
                          {o.kind === 'door'
                            ? typeof txt('planner.tool.door') === 'string'
                              ? txt('planner.tool.door')
                              : 'Door'
                            : typeof txt('planner.tool.window') === 'string'
                              ? txt('planner.tool.window')
                              : 'Window'}
                        </strong>
                      </div>
                      <div className="fp-muted">{fmtLenCm(o.widthM || 0)}</div>
                    </div>
                    <div className="fp-muted">{o.host?.wallId}</div>
                  </button>
                ))}
              </div>

              <div>
                <div className="fp-objtitle">{typeof txt('planner.walls') === 'string' ? txt('planner.walls') : 'Walls'} ({userWalls.length})</div>
                {userWalls.map((w) => {
                  const len = wallGeom(w).len
                  return (
                    <button key={w.id} className={`fp-obj ${selectedWallId === w.id ? 'is-on' : ''}`} onClick={() => onSelectWall(w.id)}>
                      <div className="fp-ins">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="fp-dot" />
                          <strong>{typeof txt('planner.tool.wall') === 'string' ? txt('planner.tool.wall') : 'Wall'}</strong>
                        </div>
                        <div className="fp-muted">{fmtLenCm(len)}</div>
                      </div>
                      <div className="fp-muted">{w.id}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {(selectedRoom || selectedOpening || selectedWall) && (
            <div className="fp-section">
              <div className="fp-h">{typeof txt('planner.inspector') === 'string' ? txt('planner.inspector') : 'Inspector'}</div>

              {selectedRoom && (
                <div className="fp-note">
                  <div style={{ fontWeight: 800 }}>{selectedRoom.label || roomTypeLabel(selectedRoom.type)}</div>
                  <div className="fp-muted">
                    {fmtSizeCm(selectedRoom.w, selectedRoom.h)} · {finishLabel(selectedRoom.finish)}
                  </div>

                  {!selectedRoom.locked && (
                    <>
                      <label className="fp-label">{typeof txt('planner.name') === 'string' ? txt('planner.name') : 'Name'}</label>
                      <input
                        className="fp-input"
                        value={selectedRoom.label ?? ''}
                        placeholder={roomTypeLabel(selectedRoom.type)}
                        onChange={(e) => {
                          const label = e.target.value
                          updatePlan(
                            (p) => ({
                              ...p,
                              rooms: p.rooms.map((r) => (r.id === selectedRoom.id ? { ...r, label } : r)),
                            }),
                            { mergeKey: `roomLabel:${selectedRoom.id}` }
                          )
                        }}
                      />

                      <label className="fp-label">{typeof txt('planner.type') === 'string' ? txt('planner.type') : 'Type'}</label>
                      <div className="fp-select">
                        <select
                          aria-label={typeof txt('planner.type') === 'string' ? txt('planner.type') : 'Type'}
                          value={selectedRoom.type}
                          onChange={(e) => {
                            const nextType = e.target.value
                            updatePlan((p) => ({
                              ...p,
                              rooms: p.rooms.map((r) => {
                                if (r.id !== selectedRoom.id) return r
                                const oldDefault = roomTypeLabel(r.type)
                                const nextDefault = roomTypeLabel(nextType)
                                const keepCustom = (r.label || '').trim() && r.label !== oldDefault
                                return {
                                  ...r,
                                  type: nextType,
                                  label: keepCustom ? r.label : nextDefault,
                                }
                              }),
                            }))
                          }}
                        >
                          {ROOM_TYPES.map((rt) => (
                            <option key={rt.key} value={rt.key}>
                              {roomTypeLabel(rt.key)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="fp-label">{typeof txt('planner.floorFinish') === 'string' ? txt('planner.floorFinish') : 'Floor finish'}</label>
                      <div className="fp-select">
                        <select
                          value={selectedRoom.finish || 'wood'}
                          onChange={(e) => {
                            const finish = e.target.value
                            updatePlan((p) => ({
                              ...p,
                              rooms: p.rooms.map((r) => (r.id === selectedRoom.id ? { ...r, finish } : r)),
                            }))
                          }}
                        >
                          {FINISHES.map((f) => (
                            <option key={f.key} value={f.key}>
                              {finishLabel(f.key)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="fp-toolrow mt-3">
                        <button className="btn" onClick={deleteSelected}>
                          {typeof txt('planner.delete') === 'string' ? txt('planner.delete') : 'Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedWall && (
                <div className="fp-note">
                  <div style={{ fontWeight: 800 }}>{typeof txt('planner.tool.wall') === 'string' ? txt('planner.tool.wall') : 'Wall'}</div>
                  <div className="fp-muted">{fmtLenCm(wallGeom(selectedWall).len)}</div>
                  {selectedWall.kind === 'interior' && !selectedWall.locked && (
                    <div className="fp-toolrow mt-3">
                      <button className="btn" onClick={deleteSelected}>
                        {typeof txt('planner.delete') === 'string' ? txt('planner.delete') : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedOpening && (
                <div className="fp-note">
                  <div style={{ fontWeight: 800 }}>
                    {selectedOpening.kind === 'door'
                      ? typeof txt('planner.tool.door') === 'string'
                        ? txt('planner.tool.door')
                        : 'Door'
                      : typeof txt('planner.tool.window') === 'string'
                        ? txt('planner.tool.window')
                        : 'Window'}
                  </div>
                  <div className="fp-muted">{selectedOpening.host?.wallId}</div>

                  {!selectedOpening.locked && selectedOpening.kind === 'door' && (
                    <div className="fp-toolrow mt-3">
                      <button className="btn ghost" onClick={flipOpeningSwing}>
                        {typeof txt('planner.flipSwing') === 'string' ? txt('planner.flipSwing') : 'Flip swing'}
                      </button>
                      <button className="btn ghost" onClick={flipOpeningHinge}>
                        {typeof txt('planner.flipHinge') === 'string' ? txt('planner.flipHinge') : 'Flip hinge'}
                      </button>
                      <button className="btn" onClick={deleteSelected}>
                        {typeof txt('planner.delete') === 'string' ? txt('planner.delete') : 'Delete'}
                      </button>
                    </div>
                  )}

                  {!selectedOpening.locked && selectedOpening.kind === 'window' && (
                    <div className="fp-toolrow mt-3">
                      <button className="btn" onClick={deleteSelected}>
                        {typeof txt('planner.delete') === 'string' ? txt('planner.delete') : 'Delete'}
                      </button>
                    </div>
                  )}

                  {selectedOpening.kind === 'door' && (
                    <div className="fp-muted mt-2">
                      {(() => {
                        const { pos, neg } = openingSpaces(model, plan, selectedOpening)
                        const outside = typeof txt('planner.outside') === 'string' ? txt('planner.outside') : 'Outside'
                        const posLabel = pos ? (pos.label || roomTypeLabel(pos.type)) : outside
                        const negLabel = neg ? (neg.label || roomTypeLabel(neg.type)) : outside
                        return `${posLabel} ↔ ${negLabel}`
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>

        <section className="fp-canvas card p-6">
          <div className="fp-canvas-head">
            <div>
              <div className="fp-h">{typeof txt('planner.plan') === 'string' ? txt('planner.plan') : 'Plan'}</div>
              <div className="fp-muted">
                {typeof txt('planner.units') === 'string' ? txt('planner.units') : 'Units: meters'} ·{' '}
                {typeof txt('planner.grid') === 'string' ? txt('planner.grid') : 'Grid'}: {gridM} {unitM} ·{' '}
                {snapStatusText}
              </div>
            </div>

            <div className="fp-zoom">
              <button className="btn ghost" onClick={() => zoomBtn('out')}>−</button>
              <button className="btn ghost" onClick={() => zoomBtn('in')}>+</button>
              <button className="btn ghost" onClick={resetView}>
                {typeof txt('planner.resetView') === 'string' ? txt('planner.resetView') : 'Reset'}
              </button>
            </div>
          </div>

          <div className={`fp-svg-wrap ${canvasCaptured ? 'is-captured' : 'is-free'}`} onMouseEnter={() => setCanvasHover(true)} onMouseLeave={() => setCanvasHover(false)}>
            <div className="fp-canvas-hud">
              <div className={`fp-capture ${canvasCaptured ? 'on' : 'off'}`}>{canvasCaptured ? captureOn : captureOff}</div>
            </div>

            <svg
              ref={svgRef}
              className="fp-svg"
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp}
            >
              <defs>
                {FINISHES.map((f) => {
                  const size = f.tileM || 1
                  const base = f.base || '#111827'
                  const rot = f.rot ? `rotate(${f.rot})` : undefined
                  const imgOpacity = f.overlay === 'grid' ? 0.55 : f.overlay === 'speckle' ? 0.42 : 0.58

                  return (
                    <pattern
                      key={f.key}
                      id={`tex-${f.key}`}
                      patternUnits="userSpaceOnUse"
                      width={size}
                      height={size}
                      patternTransform={rot}
                    >
                      {/* Base so rooms never render as “empty” if the image is missing */}
                      <rect x="0" y="0" width={size} height={size} fill={base} />

                      {/* Lightweight vector overlays (fast + works offline) */}
                      {f.overlay === 'planks' && (
                        <>
                          {/* plank seams */}
                          <path
                            d={`M ${size * 0.34} 0 V ${size} M ${size * 0.68} 0 V ${size}`}
                            stroke="rgba(0,0,0,0.22)"
                            strokeWidth={0.012}
                          />
                          {/* subtle grain */}
                          <path
                            d={`M 0 ${size * 0.18} H ${size} M 0 ${size * 0.52} H ${size} M 0 ${size * 0.86} H ${size}`}
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth={0.01}
                          />
                        </>
                      )}

                      {f.overlay === 'grid' && (
                        <>
                          {/* tile border + grout */}
                          <path
                            d={`M 0 0 H ${size} V ${size} H 0 Z`}
                            fill="none"
                            stroke="rgba(0,0,0,0.22)"
                            strokeWidth={0.012}
                          />
                          <path
                            d={`M ${size * 0.5} 0 V ${size} M 0 ${size * 0.5} H ${size}`}
                            stroke="rgba(0,0,0,0.14)"
                            strokeWidth={0.01}
                          />
                        </>
                      )}

                      {f.overlay === 'speckle' && (
                        <>
                          {/* concrete / terrazzo speckles */}
                          <circle cx={size * 0.18} cy={size * 0.22} r={0.018} fill="rgba(0,0,0,0.18)" />
                          <circle cx={size * 0.62} cy={size * 0.34} r={0.014} fill="rgba(0,0,0,0.14)" />
                          <circle cx={size * 0.42} cy={size * 0.72} r={0.016} fill="rgba(0,0,0,0.12)" />
                          <circle cx={size * 0.78} cy={size * 0.78} r={0.012} fill="rgba(255,255,255,0.10)" />
                          <circle cx={size * 0.28} cy={size * 0.58} r={0.010} fill="rgba(255,255,255,0.08)" />
                        </>
                      )}

                      {/* Raster texture (optional) */}
                      {f.tex && (
                        <image
                          href={asset(f.tex)}
                          x="0"
                          y="0"
                          width={size}
                          height={size}
                          preserveAspectRatio="xMidYMid slice"
                          opacity={imgOpacity}
                        />
                      )}

                      {/* tiny sheen so materials don't look flat */}
                      <rect x="0" y="0" width={size} height={size} fill="rgba(255,255,255,0.03)" />
                    </pattern>
                  )
                })}
              </defs>

              {/* Background + grid */}
              <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="#0b1220" />
              <Grid width={model.widthM} height={model.depthM} step={gridM} />

              {/* Rooms (fill only) */}
              <g role="group" aria-label="rooms">
                {plan.rooms.map((r) => (
                  <rect
                    key={r.id}
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={`url(#tex-${r.finish || finish})`}
                    opacity={r.locked ? 0.85 : 0.92}
                    stroke={selectedRoomId === r.id ? '#22c55e' : '#ffffff12'}
                    strokeWidth={selectedRoomId === r.id ? 0.05 : 0.02}
                    strokeLinejoin="round"
                    onPointerDown={(e) => {
                      if (tool !== 'select') return
                      e.stopPropagation()
                      onSelectRoom(r.id)

                      if (r.locked) return
                      const raw = svgWorldPoint(e)
                      dragRef.current = {
                        mode: 'moveRoom',
                        roomId: r.id,
                        startRaw: raw,
                        plan0: clonePlan(plan),
                        room0: { x: r.x, y: r.y, w: r.w, h: r.h },
                        lastValid: { x: r.x, y: r.y },
                        didMove: false,
                        historyPushed: false,
                        axisLock: null,
                      }
                      svgRef.current?.setPointerCapture?.(e.pointerId)
                    }}
                    style={{
                      cursor:
                        tool === 'select'
                          ? dragRef.current?.mode === 'moveRoom' && dragRef.current?.roomId === r.id
                            ? 'grabbing'
                            : r.locked
                              ? 'pointer'
                              : 'grab'
                          : 'default',
                    }}
                  />
                ))}
              </g>

              {/* Walls */}
              <g role="group" aria-label="walls">
                {wallSegments.map((seg) => {
                  const isOuter = seg.kind === 'outer'
                  const isUser = seg.repKind === 'interior'
                  const isSelected = isUser && selectedWallId === seg.repWallId
                  const stroke = isOuter ? '#ffffffcc' : isSelected ? '#22c55e' : '#ffffff99'
                  const sw = isOuter ? 0.09 : 0.06
                  return (
                    <line
                      key={seg.key}
                      x1={seg.a.x}
                      y1={seg.a.y}
                      x2={seg.b.x}
                      y2={seg.b.y}
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeLinecap="round"
                      onPointerDown={(e) => {
                        if (tool !== 'select') return
                        if (!isUser) return
                        e.stopPropagation()
                        onSelectWall(seg.repWallId)
                      }}
                      style={{ cursor: tool === 'select' && isUser ? 'pointer' : 'default' }}
                    />
                  )
                })}
              </g>

              {/* Room labels */}
              <g role="group" aria-label="labels">
                {plan.rooms.map((r) => (
                  <text
                    key={`lbl-${r.id}`}
                    x={r.x + 0.12}
                    y={r.y + 0.26}
                    fontSize={0.18}
                    fill="#e5e7eb"
                    style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.03 }}
                    pointerEvents="none"
                  >
                    {r.label || roomTypeLabel(r.type)}
                  </text>
                ))}
              </g>

              {/* Selected dimensions */}
              <g role="group" aria-label="selected-dimensions" pointerEvents="none">
                {selectedRoom && (
                  <MeasureTag
                    x={selectedRoom.x + 0.08}
                    y={selectedRoom.y - 0.08}
                    text={fmtSizeCm(selectedRoom.w, selectedRoom.h)}
                  />
                )}
                {selectedWall && selectedWall.kind === 'interior' && !selectedWall.locked && (
                  <MeasureTag
                    x={(selectedWall.a.x + selectedWall.b.x) / 2 + 0.06}
                    y={(selectedWall.a.y + selectedWall.b.y) / 2 - 0.06}
                    text={fmtLenCm(wallGeom(selectedWall).len)}
                  />
                )}
              </g>

              {/* Openings */}
              <g role="group" aria-label="openings">
                {plan.openings.map((o) => (
                  <OpeningGlyph
                    key={o.id}
                    model={model}
                    plan={plan}
                    opening={o}
                    selected={selectedOpeningId === o.id}
                    onSelect={() => onSelectOpening(o.id)}
                    cursor={
                      dragRef.current?.mode === 'moveOpening' && dragRef.current?.openingId === o.id
                        ? 'grabbing'
                        : tool === 'select' && !o.locked
                          ? 'grab'
                          : 'pointer'
                    }
                    onPointerDown={(e) => {
                      if (tool !== 'select') return
                      if (o.locked) return
                      const raw = svgWorldPoint(e)
                      dragRef.current = {
                        mode: 'moveOpening',
                        openingId: o.id,
                        startRaw: raw,
                        plan0: clonePlan(plan),
                        opening0: { wallId: o.host?.wallId, at: o.host?.at },
                        lastValid: { wallId: o.host?.wallId, at: o.host?.at },
                        didMove: false,
                        historyPushed: false,
                      }
                      svgRef.current?.setPointerCapture?.(e.pointerId)
                    }}
                  />
                ))}
              </g>

              {/* Collision feedback (room move/resize) */}
              {collision && (
                <rect
                  x={collision.x}
                  y={collision.y}
                  width={collision.w}
                  height={collision.h}
                  fill="rgba(239,68,68,0.08)"
                  stroke="#ef4444"
                  strokeWidth={0.06}
                  strokeDasharray="0.14 0.10"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )}

              {/* Room resize handles (selected room) */}
              {tool === 'select' && selectedRoom && !selectedRoom.locked && (
                <g aria-label="room-resize-handles">
                  {(() => {
                    const r = selectedRoom
                    const hs = 0.14
                    const hs2 = hs / 2
                    const left = r.x
                    const right = r.x + r.w
                    const top = r.y
                    const bottom = r.y + r.h
                    const cx = (left + right) / 2
                    const cy = (top + bottom) / 2
                    const handles = [
                      { key: 'nw', x: left, y: top, cursor: 'nwse-resize' },
                      { key: 'n', x: cx, y: top, cursor: 'ns-resize' },
                      { key: 'ne', x: right, y: top, cursor: 'nesw-resize' },
                      { key: 'e', x: right, y: cy, cursor: 'ew-resize' },
                      { key: 'se', x: right, y: bottom, cursor: 'nwse-resize' },
                      { key: 's', x: cx, y: bottom, cursor: 'ns-resize' },
                      { key: 'sw', x: left, y: bottom, cursor: 'nesw-resize' },
                      { key: 'w', x: left, y: cy, cursor: 'ew-resize' },
                    ]
                    return handles.map((h) => (
                      <g
                        key={`h-${h.key}`}
                        onPointerDown={(e) => {
                          if (tool !== 'select') return
                          e.stopPropagation()
                          onSelectRoom(r.id)
                          const raw = svgWorldPoint(e)
                          dragRef.current = {
                            mode: 'resizeRoom',
                            roomId: r.id,
                            handle: h.key,
                            startRaw: raw,
                            plan0: clonePlan(plan),
                            room0: { x: r.x, y: r.y, w: r.w, h: r.h },
                            lastValid: { x: r.x, y: r.y, w: r.w, h: r.h },
                            didMove: false,
                            historyPushed: false,
                          }
                          svgRef.current?.setPointerCapture?.(e.pointerId)
                        }}
                        style={{ cursor: h.cursor }}
                      >
                        {/* Hit area */}
                        <rect x={h.x - 0.18} y={h.y - 0.18} width={0.36} height={0.36} fill="transparent" />
                        {/* Visible handle */}
                        <rect
                          x={h.x - hs2}
                          y={h.y - hs2}
                          width={hs}
                          height={hs}
                          rx={0.02}
                          fill="#0b1220"
                          stroke="#22c55e"
                          strokeWidth={0.04}
                        />
                      </g>
                    ))
                  })()}
                </g>
              )}

              {/* Drag previews + dimensions */}
              {dragPreview && dragPreview.type === 'room' && (
                <g pointerEvents="none">
                  {(() => {
                    const cand = { x: dragPreview.x, y: dragPreview.y, w: dragPreview.w, h: dragPreview.h }
                    const overlaps = (plan.rooms || []).some((r) => rectsOverlap(cand, r))
                    const stroke = overlaps ? '#ef4444' : '#60a5fa'
                    const fill = overlaps ? 'rgba(239,68,68,0.08)' : '#60a5fa22'
                    return (
                      <rect
                        x={dragPreview.x}
                        y={dragPreview.y}
                        width={dragPreview.w}
                        height={dragPreview.h}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={0.05}
                        strokeDasharray="0.12 0.08"
                      />
                    )
                  })()}
                  <MeasureTag x={dragPreview.x + 0.08} y={dragPreview.y - 0.08} text={dragPreview.label} />
                </g>
              )}
              {dragPreview && dragPreview.type === 'wall' && (
                <g pointerEvents="none">
                  <line
                    x1={dragPreview.a.x}
                    y1={dragPreview.a.y}
                    x2={dragPreview.b.x}
                    y2={dragPreview.b.y}
                    stroke="#a78bfa"
                    strokeWidth={0.06}
                    strokeDasharray="0.12 0.08"
                    strokeLinecap="round"
                  />
                  <MeasureTag x={(dragPreview.a.x + dragPreview.b.x) / 2 + 0.06} y={(dragPreview.a.y + dragPreview.b.y) / 2 - 0.06} text={dragPreview.label} />
                </g>
              )}

              {/* Footer label */}
              <g transform={`translate(${0.12}, ${model.depthM + 0.48})`} pointerEvents="none">
                <rect x="0" y="-0.22" width="3.1" height="0.28" fill="#00000088" rx="0.06" />
                <text x="0.12" y="0" fontSize="0.18" fill="#fff">
                  {modelLabel(model)} · {fmtAreaM2(areaM2)} m²
                </text>
              </g>
            </svg>
          </div>

          <div className="fp-help mt-3">
            {!canvasCaptured && canvasHover && <span>{captureOff}</span>}
            {tool === 'window' && <span className="ml-2">{windowOnlyExteriorMsg}</span>}
          </div>
        </section>
      </div>
    </main>
  )
}

// -------------------------- Subcomponents ------------------------------------
function Grid({ width, height, step }) {
  if (step <= 0) return null
  const lines = []
  const stroke = '#ffffff14'
  const sw = 0.02
  for (let x = 0; x <= width + 1e-6; x += step) {
    lines.push(<line key={`vx-${x}`} x1={x} y1={0} x2={x} y2={height} stroke={stroke} strokeWidth={sw} />)
  }
  for (let y = 0; y <= height + 1e-6; y += step) {
    lines.push(<line key={`hy-${y}`} x1={0} y1={y} x2={width} y2={y} stroke={stroke} strokeWidth={sw} />)
  }
  return <g aria-hidden="true">{lines}</g>
}

function MeasureTag({ x, y, text }) {
  const fontSize = 0.16
  const padX = 0.08
  const w = Math.max(0.7, text.length * fontSize * 0.55) + padX
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={0} y={-0.22} width={w} height={0.28} rx={0.06} fill="#00000099" />
      <text x={0.06} y={0} fontSize={fontSize} fill="#fff" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 0.03 }}>
        {text}
      </text>
    </g>
  )
}

function OpeningGlyph({ model, plan, opening, selected, onSelect, onPointerDown, cursor = 'pointer' }) {
  const { geom, widthM, a, b } = resolveOpening(model, plan, opening)
  const sw = 0.06
  const stroke = selected ? '#22c55e' : opening.kind === 'window' ? '#60a5fa' : '#ffffff'

  if (opening.kind === 'window') {
    return (
      <g
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect?.()
          onPointerDown?.(e)
        }}
        style={{ cursor }}
      >
        {/* erase wall behind */}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0b1220" strokeWidth={sw * 2.2} strokeLinecap="round" />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw * 1.6} strokeLinecap="round" />
      </g>
    )
  }

  // Door: draw leaf + arc.
  const hingeAtA = (opening.hinge || 'start') === 'start'
  const hinge = hingeAtA ? a : b
  const other = hingeAtA ? b : a
  const openToPos = (opening.openTo || 'pos') === 'pos'
  const on = openToPos ? geom.n : { x: -geom.n.x, y: -geom.n.y }
  const leafEnd = { x: hinge.x + on.x * widthM, y: hinge.y + on.y * widthM }
  const cross = geom.t.x * on.y - geom.t.y * on.x
  const sweep = cross > 0 ? 1 : 0
  const arcD = `M ${other.x} ${other.y} A ${widthM} ${widthM} 0 0 ${sweep} ${leafEnd.x} ${leafEnd.y}`

  return (
    <g
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect?.()
        onPointerDown?.(e)
      }}
      style={{ cursor }}
    >
      {/* erase wall behind */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0b1220" strokeWidth={sw * 2.2} strokeLinecap="round" />
      {/* jamb */}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      {/* leaf */}
      <line x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      {/* arc */}
      <path d={arcD} fill="none" stroke={stroke} strokeWidth={sw * 0.85} />
    </g>
  )
}
