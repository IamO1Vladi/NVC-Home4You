import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nContext.jsx'
import './FloorPlanner.css'

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
  { key: 'b37', kind: 'box', label: 'Box house 37 m²', widthM: 6.41, depthM: 5.77 },
  { key: 'b57', kind: 'box', label: 'Box house 57 m²', widthM: 6.41, depthM: 9.0 },
  { key: 'b73', kind: 'box', label: 'Box house 73 m²', widthM: 6.41, depthM: 11.39 },
]

const FINISHES = [
  { key: 'wood', label: 'Wood', tex: 'flooring/wood.png' },
  { key: 'laminate', label: 'Laminate', tex: 'flooring/laminate.png' },
  { key: 'spc', label: 'SPC', tex: 'flooring/spc.png' },
  { key: 'tile', label: 'Tile', tex: 'flooring/tile.png' },
  { key: 'pvc', label: 'PVC', tex: 'flooring/pvc.png' },
  { key: 'concrete', label: 'Concrete', tex: 'flooring/concrete.png' },
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
const DEFAULT_WINDOW_W_M = 1.8
const DEFAULT_WINDOW_H_M = 0.96

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

// -------------------------- Fixed bathroom / entrance (box houses) -----------
function fixedBathroom(model) {
  // Horizontal bathroom locked to LEFT wall.
  const w = 3.0
  const h = 1.378
  const y = clamp((model.depthM - h) / 2, 0, Math.max(0, model.depthM - h))
  return {
    id: 'bathroom_fixed',
    type: 'bath',
    label: null,
    x: 0,
    y,
    w,
    h,
    finish: 'tile',
    locked: true,
  }
}

function fixedEntrance(model) {
  const bath = fixedBathroom(model)
  const atM = bath.y + bath.h / 2
  return {
    id: 'entrance_fixed',
    kind: 'door',
    widthM: DEFAULT_DOOR_W_M,
    host: { type: 'wall', wallId: 'outer_right', at: atM },
    hinge: 'start',
    openTo: 'pos',
    locked: true,
  }
}

// -------------------------- Plan creation / normalization --------------------
function makeDefaultPlan(model) {
  const rooms = []
  const openings = []
  let walls = ensureOuterWalls(model, [])

  if (model.kind === 'box') {
    rooms.push(fixedBathroom(model))
    openings.push(fixedEntrance(model))
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

  // Ensure fixed bathroom + entrance for box houses
  if (model.kind === 'box') {
    const bath = fixedBathroom(model)
    const ent = fixedEntrance(model)

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

    openings = [ent, ...openings.filter((o) => o?.id !== ent.id && !o?.locked)]
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

  return { rooms, walls, openings }
}

// -------------------------- Opening resolution / glyph -----------------------
function resolveOpening(model, plan, opening) {
  const w = clamp(opening.widthM || DEFAULT_DOOR_W_M, 0.6, 2.2)
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

// -------------------------- Local storage ------------------------------------
const STORAGE_KEY = 'floorplanner.v4'

// -------------------------- Component ----------------------------------------
export default function FloorPlanner() {
  const { t } = useI18n()

  const [modelKey, setModelKey] = useState(MODELS[0].key)
  const [tool, setTool] = useState('room') // room | wall | door | window | select | pan
  const [roomType, setRoomType] = useState('living')
  const [finish, setFinish] = useState('wood')
  const [gridM, setGridM] = useState(0.1)
  const [panelOpen, setPanelOpen] = useState(true)

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

  const model = useMemo(() => MODELS.find((m) => m.key === modelKey) || MODELS[0], [modelKey])
  const plan = useMemo(() => {
    const p = byModel[modelKey] || makeDefaultPlan(model)
    return normalizePlan(model, p)
  }, [byModel, modelKey, model])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(byModel))
    } catch {}
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
    const tr = t(`planner.models.${m.key}`)
    return typeof tr === 'string' ? tr : m.label
  }
  const finishLabel = (k) => {
    const tr = t(`planner.finishes.${k}`)
    if (typeof tr === 'string') return tr
    return FINISHES.find((x) => x.key === k)?.label || k
  }
  const roomTypeLabel = (k) => {
    const tr = t(`planner.roomTypes.${k}`)
    if (typeof tr === 'string') return tr
    return ROOM_TYPES.find((x) => x.key === k)?.label || k
  }

  const unitCm = typeof t('planner.unitCm') === 'string' ? t('planner.unitCm') : 'cm'
  const unitM = typeof t('planner.unitM') === 'string' ? t('planner.unitM') : 'm'
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
    return {
      x: clamp(snap(p.x, gridM), 0, model.widthM),
      y: clamp(snap(p.y, gridM), 0, model.depthM),
    }
  }

  // ---------- state update helper ----------
  const updatePlan = (fn) => {
    setByModel((prev) => {
      const cur = prev[modelKey] || makeDefaultPlan(model)
      const next = fn(normalizePlan(model, cur))
      return { ...prev, [modelKey]: normalizePlan(model, next) }
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
  }, [canvasHover, canvasCaptured, selectedRoomId, selectedWallId, selectedOpeningId])

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
      setTool('select')
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

  const onCanvasPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return

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
      setTool('select')
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
      setTool('select')
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

  const title = typeof t('planner.title') === 'string' ? t('planner.title') : 'Floor plan builder'
  const subtitleT = t('planner.subtitle')
  const subtitle =
    typeof subtitleT === 'string'
      ? subtitleT
          .replaceAll('{area}', fmtAreaM2(areaM2))
          .replaceAll('{w}', round(model.widthM, 2))
          .replaceAll('{d}', round(model.depthM, 2))
      : `${fmtAreaM2(areaM2)} m² · ${round(model.widthM, 2)}×${round(model.depthM, 2)} ${unitM}`

  const captureOn = typeof t('planner.captureOn') === 'string' ? t('planner.captureOn') : 'Canvas controls active — press Esc to release'
  const captureOff = typeof t('planner.captureOff') === 'string' ? t('planner.captureOff') : 'Click the canvas to capture controls'
  const windowOnlyExteriorMsg =
    typeof t('planner.windowOnlyExterior') === 'string' ? t('planner.windowOnlyExterior') : 'Windows can be placed only on exterior walls.'

  const userWalls = plan.walls.filter((w) => w.kind === 'interior' && !w.locked)

  return (
    <main className="fp-page">
      <div className="fp-topbar">
        <div>
          <div className="fp-title">{title}</div>
          <div className="fp-sub">{subtitle}</div>
        </div>
        <div className="fp-top-actions">
          <button className="btn ghost" onClick={() => setPanelOpen((v) => !v)}>
            {panelOpen
              ? typeof t('planner.hidePanel') === 'string'
                ? t('planner.hidePanel')
                : 'Hide panel'
              : typeof t('planner.showPanel') === 'string'
                ? t('planner.showPanel')
                : 'Show panel'}
          </button>
          <button className="btn ghost" onClick={clearUserItems}>
            {typeof t('planner.clear') === 'string' ? t('planner.clear') : 'Clear'}
          </button>
          <button className="btn" onClick={exportPdf}>
            {typeof t('planner.exportPdf') === 'string' ? t('planner.exportPdf') : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className={`fp-grid ${panelOpen ? '' : 'is-panel-closed'}`}>
        <aside className="fp-panel card p-6">
          <div className="fp-section">
            <div className="fp-h">{typeof t('planner.model') === 'string' ? t('planner.model') : 'Model'}</div>
            <div className="fp-select mt-2">
              <select value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
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
            <div className="fp-h">{typeof t('planner.tools') === 'string' ? t('planner.tools') : 'Tools'}</div>
            <div className="fp-toolrow">
              {[
                ['room', typeof t('planner.tool.room') === 'string' ? t('planner.tool.room') : 'Room'],
                ['wall', typeof t('planner.tool.wall') === 'string' ? t('planner.tool.wall') : 'Wall'],
                ['door', typeof t('planner.tool.door') === 'string' ? t('planner.tool.door') : 'Door'],
                ['window', typeof t('planner.tool.window') === 'string' ? t('planner.tool.window') : 'Window'],
                ['select', typeof t('planner.tool.select') === 'string' ? t('planner.tool.select') : 'Select'],
                ['pan', typeof t('planner.tool.pan') === 'string' ? t('planner.tool.pan') : 'Pan'],
              ].map(([k, label]) => (
                <button key={k} className={`btn ${tool === k ? '' : 'ghost'}`} onClick={() => setTool(k)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="fp-note">
              {tool === 'room' && (typeof t('planner.tip.room') === 'string' ? t('planner.tip.room') : 'Drag to create a room.')}
              {tool === 'wall' && (typeof t('planner.tip.wall') === 'string' ? t('planner.tip.wall') : 'Drag to draw an interior wall segment.')}
              {tool === 'door' && (typeof t('planner.tip.door') === 'string' ? t('planner.tip.door') : 'Click a wall to place a door.')}
              {tool === 'window' && (typeof t('planner.tip.window') === 'string' ? t('planner.tip.window') : 'Click an exterior wall to place a window.')}
              {tool === 'select' && (typeof t('planner.tip.select') === 'string' ? t('planner.tip.select') : 'Select an element. Delete removes it.')}
              {tool === 'pan' && (typeof t('planner.tip.pan') === 'string' ? t('planner.tip.pan') : 'Drag to pan. Wheel to zoom.')}
              {tool === 'window' && <div className="mt-2">⚠️ {windowOnlyExteriorMsg}</div>}
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-h">{typeof t('planner.roomSettings') === 'string' ? t('planner.roomSettings') : 'Room settings'}</div>
            <label className="fp-label">{typeof t('planner.type') === 'string' ? t('planner.type') : 'Type'}</label>
            <div className="fp-select">
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                {ROOM_TYPES.map((rt) => (
                  <option key={rt.key} value={rt.key}>
                    {roomTypeLabel(rt.key)}
                  </option>
                ))}
              </select>
            </div>

            <label className="fp-label">{typeof t('planner.floorFinish') === 'string' ? t('planner.floorFinish') : 'Floor finish'}</label>
            <div className="fp-select">
              <select value={finish} onChange={(e) => setFinish(e.target.value)}>
                {FINISHES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {finishLabel(f.key)}
                  </option>
                ))}
              </select>
            </div>

            <label className="fp-label">{typeof t('planner.grid') === 'string' ? t('planner.grid') : 'Grid'}</label>
            <div className="fp-toolrow">
              {[0.05, 0.1, 0.2].map((g) => (
                <button key={g} className={`btn ${gridM === g ? '' : 'ghost'}`} onClick={() => setGridM(g)}>
                  {g} {unitM}
                </button>
              ))}
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-h">{typeof t('planner.objects') === 'string' ? t('planner.objects') : 'Objects'}</div>
            <div className="fp-objlist">
              <div>
                <div className="fp-objtitle">{typeof t('planner.rooms') === 'string' ? t('planner.rooms') : 'Rooms'} ({plan.rooms.length})</div>
                {plan.rooms.map((r) => (
                  <button
                    key={r.id}
                    className={`fp-obj ${selectedRoomId === r.id ? 'is-on' : ''}`}
                    onClick={() => onSelectRoom(r.id)}
                    title={r.locked ? (typeof t('planner.locked') === 'string' ? t('planner.locked') : 'Locked') : ''}
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
                <div className="fp-objtitle">{typeof t('planner.openings') === 'string' ? t('planner.openings') : 'Doors & windows'} ({plan.openings.length})</div>
                {plan.openings.map((o) => (
                  <button
                    key={o.id}
                    className={`fp-obj ${selectedOpeningId === o.id ? 'is-on' : ''}`}
                    onClick={() => onSelectOpening(o.id)}
                    title={o.locked ? (typeof t('planner.locked') === 'string' ? t('planner.locked') : 'Locked') : ''}
                  >
                    <div className="fp-ins">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="fp-dot" style={{ opacity: o.kind === 'window' ? 0.9 : 1 }} />
                        <strong>
                          {o.kind === 'door'
                            ? typeof t('planner.tool.door') === 'string'
                              ? t('planner.tool.door')
                              : 'Door'
                            : typeof t('planner.tool.window') === 'string'
                              ? t('planner.tool.window')
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
                <div className="fp-objtitle">{typeof t('planner.walls') === 'string' ? t('planner.walls') : 'Walls'} ({userWalls.length})</div>
                {userWalls.map((w) => {
                  const len = wallGeom(w).len
                  return (
                    <button key={w.id} className={`fp-obj ${selectedWallId === w.id ? 'is-on' : ''}`} onClick={() => onSelectWall(w.id)}>
                      <div className="fp-ins">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="fp-dot" />
                          <strong>{typeof t('planner.tool.wall') === 'string' ? t('planner.tool.wall') : 'Wall'}</strong>
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
              <div className="fp-h">{typeof t('planner.inspector') === 'string' ? t('planner.inspector') : 'Inspector'}</div>

              {selectedRoom && (
                <div className="fp-note">
                  <div style={{ fontWeight: 800 }}>{selectedRoom.label || roomTypeLabel(selectedRoom.type)}</div>
                  <div className="fp-muted">{fmtSizeCm(selectedRoom.w, selectedRoom.h)} · {finishLabel(selectedRoom.finish)}</div>
                  {!selectedRoom.locked && (
                    <div className="fp-toolrow mt-3">
                      <button className="btn" onClick={deleteSelected}>
                        {typeof t('planner.delete') === 'string' ? t('planner.delete') : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedWall && (
                <div className="fp-note">
                  <div style={{ fontWeight: 800 }}>{typeof t('planner.tool.wall') === 'string' ? t('planner.tool.wall') : 'Wall'}</div>
                  <div className="fp-muted">{fmtLenCm(wallGeom(selectedWall).len)}</div>
                  {selectedWall.kind === 'interior' && !selectedWall.locked && (
                    <div className="fp-toolrow mt-3">
                      <button className="btn" onClick={deleteSelected}>
                        {typeof t('planner.delete') === 'string' ? t('planner.delete') : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedOpening && (
                <div className="fp-note">
                  <div style={{ fontWeight: 800 }}>
                    {selectedOpening.kind === 'door'
                      ? typeof t('planner.tool.door') === 'string'
                        ? t('planner.tool.door')
                        : 'Door'
                      : typeof t('planner.tool.window') === 'string'
                        ? t('planner.tool.window')
                        : 'Window'}
                  </div>
                  <div className="fp-muted">{selectedOpening.host?.wallId}</div>

                  {!selectedOpening.locked && selectedOpening.kind === 'door' && (
                    <div className="fp-toolrow mt-3">
                      <button className="btn ghost" onClick={flipOpeningSwing}>
                        {typeof t('planner.flipSwing') === 'string' ? t('planner.flipSwing') : 'Flip swing'}
                      </button>
                      <button className="btn ghost" onClick={flipOpeningHinge}>
                        {typeof t('planner.flipHinge') === 'string' ? t('planner.flipHinge') : 'Flip hinge'}
                      </button>
                      <button className="btn" onClick={deleteSelected}>
                        {typeof t('planner.delete') === 'string' ? t('planner.delete') : 'Delete'}
                      </button>
                    </div>
                  )}

                  {!selectedOpening.locked && selectedOpening.kind === 'window' && (
                    <div className="fp-toolrow mt-3">
                      <button className="btn" onClick={deleteSelected}>
                        {typeof t('planner.delete') === 'string' ? t('planner.delete') : 'Delete'}
                      </button>
                    </div>
                  )}

                  {selectedOpening.kind === 'door' && (
                    <div className="fp-muted mt-2">
                      {(() => {
                        const { pos, neg } = openingSpaces(model, plan, selectedOpening)
                        const outside = typeof t('planner.outside') === 'string' ? t('planner.outside') : 'Outside'
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
              <div className="fp-h">{typeof t('planner.plan') === 'string' ? t('planner.plan') : 'Plan'}</div>
              <div className="fp-muted">
                {typeof t('planner.units') === 'string' ? t('planner.units') : 'Units: meters'} ·{' '}
                {(typeof t('planner.snap') === 'string' ? t('planner.snap') : `Snap: {grid} ${unitM}`)
                  .replaceAll('{grid}', gridM)}
              </div>
            </div>

            <div className="fp-zoom">
              <button className="btn ghost" onClick={() => zoomBtn('out')}>−</button>
              <button className="btn ghost" onClick={() => zoomBtn('in')}>+</button>
              <button className="btn ghost" onClick={resetView}>
                {typeof t('planner.resetView') === 'string' ? t('planner.resetView') : 'Reset'}
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
                {FINISHES.map((f) => (
                  <pattern key={f.key} id={`tex-${f.key}`} patternUnits="userSpaceOnUse" width="1" height="1">
                    <image href={asset(f.tex)} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
                  </pattern>
                ))}
              </defs>

              {/* Background + grid */}
              <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="#0b1220" />
              <Grid width={model.widthM} height={model.depthM} step={gridM} />

              {/* Rooms (fill only) */}
              <g aria-label="rooms">
                {plan.rooms.map((r) => (
                  <rect
                    key={r.id}
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={`url(#tex-${r.finish || finish})`}
                    opacity={r.locked ? 0.85 : 0.92}
                    onPointerDown={(e) => {
                      if (tool !== 'select') return
                      e.stopPropagation()
                      onSelectRoom(r.id)
                    }}
                    style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
                  />
                ))}
              </g>

              {/* Walls */}
              <g aria-label="walls">
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
              <g aria-label="labels">
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
              <g aria-label="selected-dimensions" pointerEvents="none">
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
              <g aria-label="openings">
                {plan.openings.map((o) => (
                  <OpeningGlyph
                    key={o.id}
                    model={model}
                    plan={plan}
                    opening={o}
                    selected={selectedOpeningId === o.id}
                    onSelect={() => onSelectOpening(o.id)}
                  />
                ))}
              </g>

              {/* Drag previews + dimensions */}
              {dragPreview && dragPreview.type === 'room' && (
                <g pointerEvents="none">
                  <rect
                    x={dragPreview.x}
                    y={dragPreview.y}
                    width={dragPreview.w}
                    height={dragPreview.h}
                    fill="#60a5fa22"
                    stroke="#60a5fa"
                    strokeWidth={0.05}
                    strokeDasharray="0.12 0.08"
                  />
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

function OpeningGlyph({ model, plan, opening, selected, onSelect }) {
  const { geom, widthM, a, b } = resolveOpening(model, plan, opening)
  const sw = 0.06
  const stroke = selected ? '#22c55e' : opening.kind === 'window' ? '#60a5fa' : '#ffffff'

  if (opening.kind === 'window') {
    return (
      <g
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect?.()
        }}
        style={{ cursor: 'pointer' }}
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
      }}
      style={{ cursor: 'pointer' }}
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
