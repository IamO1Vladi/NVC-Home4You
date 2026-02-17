import React, { useEffect, useMemo, useRef, useState } from 'react'
import './FloorPlanner.css'

/**
 * FloorPlanner (2D + simple 3D preview) — v4
 *
 * New in v4 (your latest requests):
 * - Much more zoom-out (viewBox can exceed building bounds; safe clamped pan).
 * - Outer (default) walls are NOT shown in the wall selection list and cannot be selected.
 * - Doors can be placed on ANY wall (outer + interior).
 * - Windows can be placed ONLY on exterior (outer) walls.
 * - Rooms can be MOVED (drag) and RESIZED (drag handles) in Select mode.
 * - Room-edge walls created for doors are “attached” to the room edge (follow when room moves/resizes).
 * - If you click a ROOM EDGE that lies on an OUTER wall while using Window tool, the window is hosted on that outer wall.
 *
 * Notes:
 * - Rooms remain axis-aligned rectangles (fast MVP). Walls are independent segments.
 * - Export PDF uses browser print dialog (Save as PDF).
 */

// -------------------------- Models -------------------------------------------
const MODELS = [
  // Containers (meters)
  { key: 'c6x3', kind: 'container', label: 'Container 6×3',  widthM: 6, depthM: 3 },
  { key: 'c7x3', kind: 'container', label: 'Container 7×3',  widthM: 7, depthM: 3 },
  { key: 'c8x3', kind: 'container', label: 'Container 8×3',  widthM: 8, depthM: 3 },

  // Box houses (approx dims; area matches label)
  { key: 'b37', kind: 'box', label: 'Box house 37 m²', widthM: 6.41, depthM: 5.77 },  // ≈37.0
  { key: 'b57', kind: 'box', label: 'Box house 57 m²', widthM: 6.41, depthM: 9.00 },  // ≈57.7
  { key: 'b73', kind: 'box', label: 'Box house 73 m²', widthM: 6.41, depthM: 11.39 }, // ≈73.0
]

const FINISHES = [
  { key:'wood',     label:'Wood',     tex:'flooring/wood.png' },
  { key:'laminate', label:'Laminate', tex:'flooring/laminate.png' },
  { key:'spc',      label:'SPC',      tex:'flooring/spc.png' },
  { key:'tile',     label:'Tile',     tex:'flooring/tile.png' },
  { key:'pvc',      label:'PVC',      tex:'flooring/pvc.png' },
  { key:'concrete', label:'Concrete', tex:'flooring/concrete.png' },
]

const ROOM_TYPES = [
  { key:'living',  label:'Living' },
  { key:'bed',     label:'Bedroom' },
  { key:'kitchen', label:'Kitchen' },
  { key:'bath',    label:'Bathroom' },
  { key:'office',  label:'Office' },
  { key:'storage', label:'Storage' },
]

// -------------------------- Tuning ------------------------------------------
const STORAGE_KEY = 'floorplanner.v4'
const MIN_ROOM = 0.6

// Zoom: viewBox can exceed building bounds for “zoom out”
const ZOOM_IN_MIN_FACTOR  = 0.12  // min viewBox size as fraction of model
const ZOOM_OUT_MAX_FACTOR = 3.2   // max viewBox size as fraction of model (big zoom out)

// -------------------------- Utilities ----------------------------------------
const uid = () => Math.random().toString(36).slice(2, 10)

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)) }
function snap(v, step){ return Math.round(v / step) * step }
function round(v, p=2){ const f = 10 ** p; return Math.round(v * f) / f }

function rectContains(r, x, y){
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

function rectsOverlap(a, b){
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y)
}

function fmtAreaM2(area){
  const s = area.toFixed(2)
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function asset(path){
  // Put textures in /public/flooring/*.png
  return `${import.meta.env.BASE_URL}${path}`
}

function normPt(p){
  const x = Math.round(p.x * 1000) / 1000
  const y = Math.round(p.y * 1000) / 1000
  return { x, y }
}
function wallKey(a, b){
  const A = normPt(a), B = normPt(b)
  const leftFirst = (A.x < B.x) || (A.x === B.x && A.y <= B.y)
  const p1 = leftFirst ? A : B
  const p2 = leftFirst ? B : A
  return `${p1.x},${p1.y}_${p2.x},${p2.y}`
}

function distPointToSeg(p, a, b){
  const abx = b.x - a.x, aby = b.y - a.y
  const apx = p.x - a.x, apy = p.y - a.y
  const ab2 = abx*abx + aby*aby
  if (ab2 < 1e-9) return { d: Math.hypot(apx, apy), t: 0 }
  let t = (apx*abx + apy*aby) / ab2
  t = clamp(t, 0, 1)
  const qx = a.x + abx * t
  const qy = a.y + aby * t
  return { d: Math.hypot(p.x - qx, p.y - qy), t }
}

function unit(a, b){
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx/len, y: dy/len, len }
}

// -------------------------- Outer walls (locked) -----------------------------
function outerWalls(model){
  const w = model.widthM, d = model.depthM
  // Orientation chosen so wall normal (pos) points INSIDE the building.
  return [
    { id:'outer_top',    kind:'outer', locked:true, a:{x:0, y:0},   b:{x:w, y:0} },
    { id:'outer_right',  kind:'outer', locked:true, a:{x:w, y:0},   b:{x:w, y:d} },
    { id:'outer_bottom', kind:'outer', locked:true, a:{x:w, y:d},   b:{x:0, y:d} },
    { id:'outer_left',   kind:'outer', locked:true, a:{x:0, y:d},   b:{x:0, y:0} },
  ]
}

function normalizeWalls(walls){
  const out = []
  const seen = new Set()
  for (const w of (walls || [])){
    if(!w?.a || !w?.b) continue
    const key = w.key || wallKey(w.a, w.b)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ...w, key })
  }
  return out
}

function ensureOuterWalls(model, walls){
  const outer = outerWalls(model).map(w => ({ ...w, key: wallKey(w.a, w.b) }))
  const existing = normalizeWalls(walls || [])
  const byId = new Map(existing.map(w => [w.id, w]))
  const merged = [...existing]

  for (const ow of outer){
    const ex = byId.get(ow.id)
    if (!ex){
      merged.push(ow)
      continue
    }
    merged.splice(merged.indexOf(ex), 1, { ...ow })
  }
  return normalizeWalls(merged)
}

// -------------------------- Fixed bathroom / entrance (box houses) -----------
function fixedBathroom(model){
  // Horizontal bathroom block on LEFT wall.
  // Based on your schematic, using ~3.000m × 1.378m.
  const w = 3.0
  const h = 1.378
  const y = clamp((model.depthM - h) / 2, 0, Math.max(0, model.depthM - h))
  return {
    id: 'bathroom_fixed',
    type: 'bath',
    label: 'Bathroom',
    x: 0,
    y,
    w,
    h,
    finish: 'tile',
    locked: true,
  }
}

function fixedEntrance(model){
  // Entrance on RIGHT wall aligned with bathroom center.
  const bath = fixedBathroom(model)
  const atM = bath.y + bath.h / 2
  return {
    id: 'entrance_fixed',
    kind: 'door',
    widthM: 0.9,
    host: { type:'wall', wallId:'outer_right', at: atM },
    hinge: 'start',
    openTo: 'pos',
    locked: true,
  }
}

// -------------------------- Room edges / derived wall support ----------------
function roomEdgeGeom(room, edge){
  switch(edge){
    case 'top':    return { a:{x:room.x, y:room.y},         b:{x:room.x+room.w, y:room.y},         t:{x:1,y:0},  n:{x:0,y:-1}, len:room.w }
    case 'bottom': return { a:{x:room.x, y:room.y+room.h},  b:{x:room.x+room.w, y:room.y+room.h},  t:{x:1,y:0},  n:{x:0,y:1},  len:room.w }
    case 'left':   return { a:{x:room.x, y:room.y+room.h},  b:{x:room.x,         y:room.y},         t:{x:0,y:-1}, n:{x:1,y:0},  len:room.h }
    case 'right':  return { a:{x:room.x+room.w, y:room.y},  b:{x:room.x+room.w, y:room.y+room.h},  t:{x:0,y:1},  n:{x:-1,y:0}, len:room.h }
    default:       return { a:{x:room.x, y:room.y},         b:{x:room.x+room.w, y:room.y},         t:{x:1,y:0},  n:{x:0,y:-1}, len:room.w }
  }
}

function updateDerivedRoomEdgeWalls(rooms, walls){
  const updated = []
  for (const w of (walls || [])){
    if (w.kind === 'outer') { updated.push(w); continue }

    if (w.rel?.type === 'roomEdge'){
      const room = rooms.find(r => r.id === w.rel.roomId)
      if (!room) continue
      const geom = roomEdgeGeom(room, w.rel.edge)
      updated.push({
        ...w,
        a: geom.a,
        b: geom.b,
        key: wallKey(geom.a, geom.b),
      })
      continue
    }

    updated.push(w)
  }
  return normalizeWalls(updated)
}

function openingHostWallId(o){
  if (o?.host?.type === 'wall') return o.host.wallId
  if (o?.host?.type === 'outer') return `outer_${o.host.wall}`
  return null
}

// -------------------------- Plan creation / normalization --------------------
function makeDefaultPlan(model){
  const rooms = []
  const openings = []
  const walls = ensureOuterWalls(model, [])

  if (model.kind === 'box'){
    rooms.push(fixedBathroom(model))
    openings.push(fixedEntrance(model))
  }

  return { rooms, walls, openings }
}

function normalizePlan(model, plan){
  const base = plan && typeof plan === 'object' ? plan : {}
  const rooms0 = Array.isArray(base.rooms) ? base.rooms : []
  const openings0 = Array.isArray(base.openings) ? base.openings : []

  // 1) Outer walls always exist and are locked.
  let walls = ensureOuterWalls(model, base.walls || [])

  // 2) Rooms: enforce fixed bathroom for box houses.
  let rooms = rooms0
  if (model.kind === 'box'){
    const bath = fixedBathroom(model)
    rooms = [
      bath,
      ...rooms0.filter(r => r.id !== bath.id && !r.locked),
    ]
  }

  // 3) Update derived room-edge walls to follow room geometry.
  walls = updateDerivedRoomEdgeWalls(rooms, walls)

  // 4) Openings: upgrade legacy hosts + enforce fixed entrance (box houses).
  let openings = openings0.map(o => {
    if (!o || typeof o !== 'object') return o
    if (o.locked) return o

    // legacy outer host -> wall host
    if (o.host?.type === 'outer'){
      return { ...o, host:{ type:'wall', wallId:`outer_${o.host.wall}`, at: o.host.atM ?? 0 } }
    }

    return o
  }).filter(Boolean)

  if (model.kind === 'box'){
    const ent = fixedEntrance(model)
    openings = [
      ent,
      ...openings.filter(o => o.id !== ent.id && !o.locked),
    ]
  }

  // 5) Drop openings whose host wall no longer exists.
  const wallById = new Map((walls || []).map(w => [w.id, w]))
  openings = openings.filter(o => {
    const wid = openingHostWallId(o)
    if (!wid) return true
    return wallById.has(wid)
  })

  // 6) Enforce: WINDOWS only on OUTER walls.
  openings = openings.filter(o => {
    if (o.kind !== 'window') return true
    const wid = openingHostWallId(o)
    const w = wid ? wallById.get(wid) : null
    return w?.kind === 'outer'
  })

  // 7) Clamp door/window positions to wall length (keep data tidy).
  // (Rendering clamps further by opening width.)
  openings = openings.map(o => {
    if (o?.host?.type !== 'wall') return o
    const w = wallById.get(o.host.wallId)
    if (!w) return o
    const geom = wallGeom(w)
    const at = clamp(o.host.at ?? 0, 0, geom.len)
    return { ...o, host:{ ...o.host, at } }
  })

  return { rooms, walls, openings }
}

// -------------------------- Wall geometry / opening resolution ---------------
function wallGeom(wall){
  const a = wall.a, b = wall.b
  const u = unit(a, b)
  const t = { x: u.x, y: u.y }
  const n = { x: -t.y, y: t.x }
  return { a, b, t, n, len: u.len }
}

function resolveOpening(model, rooms, walls, opening){
  const w = clamp(opening.widthM || 0.9, 0.6, 1.8)

  const spanOnWall = (geom, at) => {
    const half = w/2
    const atClamped = clamp(at, half, geom.len - half)
    const a = { x: geom.a.x + geom.t.x * (atClamped - half), y: geom.a.y + geom.t.y * (atClamped - half) }
    const b = { x: geom.a.x + geom.t.x * (atClamped + half), y: geom.a.y + geom.t.y * (atClamped + half) }
    return { at: atClamped, a, b }
  }

  // Preferred: wall host
  if (opening.host?.type === 'wall'){
    const wall = (walls || []).find(w => w.id === opening.host.wallId)
    if (wall){
      const geom = wallGeom(wall)
      const at = clamp(opening.host.at ?? 0, 0, geom.len)
      const span = spanOnWall(geom, at)
      return { geom, at: span.at, widthM: w, a: span.a, b: span.b }
    }
  }

  // Legacy outer
  if (opening.host?.type === 'outer'){
    const wallId = `outer_${opening.host.wall}`
    const wall = (walls || []).find(w => w.id === wallId)
    if (wall){
      const geom = wallGeom(wall)
      const at = clamp(opening.host.atM ?? 0, 0, geom.len)
      const span = spanOnWall(geom, at)
      return { geom, at: span.at, widthM: w, a: span.a, b: span.b }
    }
  }

  // Legacy room edge
  if (opening.host?.type === 'room'){
    const room = rooms.find(r => r.id === opening.host.roomId)
    if(room){
      const geom = roomEdgeGeom(room, opening.host.edge)
      const at = clamp(opening.host.atRel ?? 0, 0, geom.len)
      const span = spanOnWall(geom, at)
      return { geom, at: span.at, widthM: w, a: span.a, b: span.b }
    }
  }

  // Fallback: top outer
  const wall = (walls || []).find(w => w.id === 'outer_top')
  const geom = wall ? wallGeom(wall) : { a:{x:0,y:0}, b:{x:model.widthM,y:0}, t:{x:1,y:0}, n:{x:0,y:1}, len:model.widthM }
  const span = spanOnWall(geom, 0.8)
  return { geom, at: span.at, widthM: w, a: span.a, b: span.b }
}

// -------------------------- Spaces (for door swing “opens into …”) -----------
function spaceAt(rooms, x, y){
  for (let i = rooms.length - 1; i >= 0; i--){
    const r = rooms[i]
    if (rectContains(r, x, y)) return r
  }
  return null
}

function openingSpaces(model, plan, opening){
  const { geom, at } = resolveOpening(model, plan.rooms, plan.walls, opening)
  const center = { x: geom.a.x + geom.t.x * at, y: geom.a.y + geom.t.y * at }
  const eps = 0.06
  const pos = spaceAt(plan.rooms, center.x + geom.n.x * eps, center.y + geom.n.y * eps)
  const neg = spaceAt(plan.rooms, center.x - geom.n.x * eps, center.y - geom.n.y * eps)
  return { pos, neg }
}

// -------------------------- Picking for placement -----------------------------
function pickWall(walls, pt, tolM=0.22, filterFn){
  let best = null
  for (const w of (walls || [])){
    if(!w?.a || !w?.b) continue
    if (filterFn && !filterFn(w)) continue
    const { d, t } = distPointToSeg(pt, w.a, w.b)
    if (d > tolM) continue
    if (!best || d < best.d){
      const geom = wallGeom(w)
      best = { d, wallId: w.id, at: geom.len * t }
    }
  }
  return best
}

function pickRoomEdge(rooms, pt, tolM=0.22){
  let best = null
  for (const r of rooms){
    if (pt.y >= r.y - tolM && pt.y <= r.y + r.h + tolM){
      const dL = Math.abs(pt.x - r.x)
      const dR = Math.abs(pt.x - (r.x + r.w))
      if (dL <= tolM){
        const geom = roomEdgeGeom(r, 'left')
        const y = clamp(pt.y, r.y, r.y + r.h)
        const rel = (geom.a.y - y)
        const atDist = clamp(rel, 0, geom.len)
        if(!best || dL < best.d) best = { d: dL, roomId:r.id, edge:'left', geom, atDist }
      }
      if (dR <= tolM){
        const geom = roomEdgeGeom(r, 'right')
        const y = clamp(pt.y, r.y, r.y + r.h)
        const rel = (y - geom.a.y)
        const atDist = clamp(rel, 0, geom.len)
        if(!best || dR < best.d) best = { d: dR, roomId:r.id, edge:'right', geom, atDist }
      }
    }

    if (pt.x >= r.x - tolM && pt.x <= r.x + r.w + tolM){
      const dT = Math.abs(pt.y - r.y)
      const dB = Math.abs(pt.y - (r.y + r.h))
      if (dT <= tolM){
        const geom = roomEdgeGeom(r, 'top')
        const x = clamp(pt.x, r.x, r.x + r.w)
        const rel = (x - geom.a.x)
        const atDist = clamp(rel, 0, geom.len)
        if(!best || dT < best.d) best = { d: dT, roomId:r.id, edge:'top', geom, atDist }
      }
      if (dB <= tolM){
        const geom = roomEdgeGeom(r, 'bottom')
        const x = clamp(pt.x, r.x, r.x + r.w)
        const rel = (x - geom.a.x)
        const atDist = clamp(rel, 0, geom.len)
        if(!best || dB < best.d) best = { d: dB, roomId:r.id, edge:'bottom', geom, atDist }
      }
    }
  }
  return best
}

function constrainAxis(a, b){
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  if (dx >= dy) return { x: b.x, y: a.y }
  return { x: a.x, y: b.y }
}

function outerWallHostFromPoint(model, p, tol=0.04){
  const W = model.widthM
  const D = model.depthM
  if (Math.abs(p.y - 0) <= tol)         return { wallId:'outer_top',    at: clamp(p.x, 0, W) }
  if (Math.abs(p.x - W) <= tol)         return { wallId:'outer_right',  at: clamp(p.y, 0, D) }
  if (Math.abs(p.y - D) <= tol)         return { wallId:'outer_bottom', at: clamp(W - p.x, 0, W) }
  if (Math.abs(p.x - 0) <= tol)         return { wallId:'outer_left',   at: clamp(D - p.y, 0, D) }
  return null
}

function pointOnGeom(geom, at){
  return { x: geom.a.x + geom.t.x * at, y: geom.a.y + geom.t.y * at }
}

function computeOpenToFromClick(hostWall, clickPt, at){
  // Determine whether click is on pos/neg side of wall normal.
  let openTo = 'pos'
  if (!hostWall) return openTo
  const g = wallGeom(hostWall)
  const c = { x: g.a.x + g.t.x * at, y: g.a.y + g.t.y * at }
  const dot = (clickPt.x - c.x) * g.n.x + (clickPt.y - c.y) * g.n.y
  openTo = dot >= 0 ? 'pos' : 'neg'
  return openTo
}

// -------------------------- Component -----------------------------------------
export default function FloorPlanner(){
  const [modelKey, setModelKey] = useState(MODELS[0].key)

  // UI/tool state
  const [tool, setTool] = useState('room') // 'room' | 'wall' | 'door' | 'window' | 'select' | 'pan'
  const [roomType, setRoomType] = useState('living')
  const [finish, setFinish] = useState('wood')
  const [gridM, setGridM] = useState(0.1)
  const [panelOpen, setPanelOpen] = useState(true)
  const [view, setView] = useState('2d') // '2d' | '3d'

  // Selection
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState(null)
  const [selectedWallId, setSelectedWallId] = useState(null)

  // Per-model plans
  const [byModel, setByModel] = useState(() => {
    try{
      const raw = localStorage.getItem(STORAGE_KEY)
        || localStorage.getItem('floorplanner.v3')
        || localStorage.getItem('floorplanner.v2')
      if(!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : {}
    }catch{ return {} }
  })

  const model = useMemo(() => MODELS.find(m => m.key === modelKey) || MODELS[0], [modelKey])

  const plan = useMemo(() => {
    const p = byModel[modelKey] || makeDefaultPlan(model)
    return normalizePlan(model, p)
  }, [byModel, modelKey, model])

  // Persist
  useEffect(() => {
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(byModel)) }catch{}
  }, [byModel])

  // Ensure plan exists for new model keys
  useEffect(() => {
    setByModel(prev => {
      if (prev[modelKey]) return prev
      return { ...prev, [modelKey]: makeDefaultPlan(model) }
    })
    // Reset viewbox
    setViewBox({ x: 0, y: 0, w: model.widthM, h: model.depthM })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey])

  // ---------- ViewBox (zoom/pan) ----------
  const [viewBox, setViewBox] = useState(() => ({ x: 0, y: 0, w: model.widthM, h: model.depthM }))

  const clampVB = (vb) => {
    const minW = model.widthM * ZOOM_IN_MIN_FACTOR
    const minH = model.depthM * ZOOM_IN_MIN_FACTOR
    const maxW = model.widthM * ZOOM_OUT_MAX_FACTOR
    const maxH = model.depthM * ZOOM_OUT_MAX_FACTOR

    const w = clamp(vb.w, minW, maxW)
    const h = clamp(vb.h, minH, maxH)

    const minX = Math.min(0, model.widthM - w)
    const maxX = Math.max(0, model.widthM - w)
    const minY = Math.min(0, model.depthM - h)
    const maxY = Math.max(0, model.depthM - h)

    const x = clamp(vb.x, minX, maxX)
    const y = clamp(vb.y, minY, maxY)
    return { x, y, w, h }
  }

  // Keep viewbox valid when model dims change
  useEffect(() => {
    setViewBox(vb => clampVB(vb))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.widthM, model.depthM])

  const svgRef = useRef(null)
  const dragRef = useRef(null)

  const areaM2 = useMemo(() => model.widthM * model.depthM, [model.widthM, model.depthM])

  // ---------- coordinate conversion ----------
  function svgWorldPoint(ev){
    const svg = svgRef.current
    if(!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = ev.clientX
    pt.y = ev.clientY
    const ctm = svg.getScreenCTM()
    if(!ctm) return { x: 0, y: 0 }
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function svgPointSnapped(ev){
    const p = svgWorldPoint(ev)
    return {
      x: clamp(snap(p.x, gridM), 0, model.widthM),
      y: clamp(snap(p.y, gridM), 0, model.depthM),
    }
  }

  // ---------- state update helper ----------
  const updatePlan = (fn) => {
    setByModel(prev => {
      const cur = prev[modelKey] || makeDefaultPlan(model)
      const next = fn(normalizePlan(model, cur))
      return { ...prev, [modelKey]: normalizePlan(model, next) }
    })
  }

  // ---------- keyboard delete ----------
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      if (selectedOpeningId){
        updatePlan(p => ({ ...p, openings: p.openings.filter(o => o.id !== selectedOpeningId || o.locked) }))
        setSelectedOpeningId(null)
      } else if (selectedWallId){
        updatePlan(p => ({ ...p, walls: p.walls.filter(w => w.id !== selectedWallId || w.locked) }))
        setSelectedWallId(null)
      } else if (selectedRoomId){
        updatePlan(p => ({ ...p, rooms: p.rooms.filter(r => r.id !== selectedRoomId || r.locked) }))
        setSelectedRoomId(null)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId, selectedOpeningId, selectedWallId])

  // ---------- drag preview tick ----------
  const [tick, setTick] = useState(0) // eslint-disable-line no-unused-vars

  // ---------- room validity ----------
  const isRoomValid = (candidate, selfId) => {
    if (candidate.w < MIN_ROOM || candidate.h < MIN_ROOM) return false
    if (candidate.x < 0 || candidate.y < 0) return false
    if (candidate.x + candidate.w > model.widthM) return false
    if (candidate.y + candidate.h > model.depthM) return false
    for (const r of plan.rooms){
      if (r.id === selfId) continue
      if (rectsOverlap(candidate, r)) return false
    }
    return true
  }

  // ---------- pointer handlers ----------
  const onCanvasPointerDown = (ev) => {
    if (view !== '2d') return

    // Pan tool
    if (tool === 'pan'){
      const raw = svgWorldPoint(ev)
      dragRef.current = { mode:'pan', start: raw, vb0: viewBox }
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      return
    }

    // If not select tool, clear selection (creation tools should feel clean)
    if (tool !== 'select'){
      setSelectedOpeningId(null)
      setSelectedRoomId(null)
      setSelectedWallId(null)
    }

    const pt = svgPointSnapped(ev)

    if (tool === 'room'){
      dragRef.current = { mode:'drawRoom', start: pt }
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      return
    }

    if (tool === 'wall'){
      dragRef.current = { mode:'drawWall', start: pt }
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      return
    }

    if (tool === 'door' || tool === 'window'){
      const isWindow = tool === 'window'

      // 1) Prefer snapping to existing walls.
      const wallHit = pickWall(
        plan.walls,
        pt,
        0.22,
        (w) => !isWindow || w.kind === 'outer'
      )

      if (wallHit){
        const hostWall = plan.walls.find(w => w.id === wallHit.wallId)
        const widthM = isWindow ? 1.2 : 0.9
        const openTo = isWindow ? 'pos' : computeOpenToFromClick(hostWall, pt, wallHit.at)

        const opening = {
          id: uid(),
          kind: tool,
          widthM,
          host: { type:'wall', wallId: wallHit.wallId, at: wallHit.at },
          hinge: 'start',
          openTo,
          locked: false,
        }
        updatePlan(p => ({ ...p, openings: [...p.openings, opening] }))
        setSelectedOpeningId(opening.id)
        return
      }

      // 2) Fallback: click near a room edge.
      const edgePick = pickRoomEdge(plan.rooms, pt)
      if (!edgePick) return

      const pOnEdge = pointOnGeom(edgePick.geom, edgePick.atDist)
      const outerHost = outerWallHostFromPoint(model, pOnEdge)

      // Windows: ONLY on outer.
      if (isWindow){
        if (!outerHost) return
        const opening = {
          id: uid(),
          kind: 'window',
          widthM: 1.2,
          host: { type:'wall', wallId: outerHost.wallId, at: outerHost.at },
          hinge: 'start',
          openTo: 'pos',
          locked: false,
        }
        updatePlan(p => ({ ...p, openings: [...p.openings, opening] }))
        setSelectedOpeningId(opening.id)
        return
      }

      // Doors: if room edge lies on outer wall, host door on outer wall.
      if (outerHost){
        const hostWall = plan.walls.find(w => w.id === outerHost.wallId)
        const openTo = computeOpenToFromClick(hostWall, pt, outerHost.at)
        const opening = {
          id: uid(),
          kind: 'door',
          widthM: 0.9,
          host: { type:'wall', wallId: outerHost.wallId, at: outerHost.at },
          hinge: 'start',
          openTo,
          locked: false,
        }
        updatePlan(p => ({ ...p, openings: [...p.openings, opening] }))
        setSelectedOpeningId(opening.id)
        return
      }

      // Interior edge: create or reuse a derived room-edge wall.
      const existing = plan.walls.find(w => w.rel?.type === 'roomEdge' && w.rel.roomId === edgePick.roomId && w.rel.edge === edgePick.edge)

      const wallId = existing?.id || uid()

      const widthM = 0.9
      const opening = {
        id: uid(),
        kind: 'door',
        widthM,
        host: { type:'wall', wallId, at: edgePick.atDist },
        hinge: 'start',
        openTo: 'pos',
        locked: false,
      }

      updatePlan(p => {
        let walls = p.walls || []
        if (!existing){
          walls = normalizeWalls([
            ...walls,
            {
              id: wallId,
              kind: 'interior',
              locked: false,
              a: edgePick.geom.a,
              b: edgePick.geom.b,
              key: wallKey(edgePick.geom.a, edgePick.geom.b),
              rel: { type:'roomEdge', roomId: edgePick.roomId, edge: edgePick.edge },
            }
          ])
        }

        // Better door openTo: decide based on click side.
        const hostWall = walls.find(w => w.id === wallId)
        const openTo = computeOpenToFromClick(hostWall, pt, edgePick.atDist)
        const o2 = { ...opening, openTo }

        return { ...p, walls, openings: [...p.openings, o2] }
      })

      setSelectedOpeningId(opening.id)
      return
    }

    // Select tool: clicking empty clears selection.
    if (tool === 'select'){
      setSelectedOpeningId(null)
      setSelectedRoomId(null)
      setSelectedWallId(null)
    }
  }

  const onCanvasPointerMove = (ev) => {
    if (!dragRef.current) return
    const d = dragRef.current

    if (d.mode === 'pan'){
      const raw = svgWorldPoint(ev)
      const dx = d.start.x - raw.x
      const dy = d.start.y - raw.y
      const vb0 = d.vb0
      setViewBox(clampVB({ x: vb0.x + dx, y: vb0.y + dy, w: vb0.w, h: vb0.h }))
      return
    }

    if (d.mode === 'drawRoom' || d.mode === 'drawWall'){
      const pt = svgPointSnapped(ev)
      dragRef.current = { ...d, current: pt }
      setTick(t => t + 1)
      return
    }

    if (d.mode === 'moveRoom'){
      const pt = svgPointSnapped(ev)
      const dx = pt.x - d.start.x
      const dy = pt.y - d.start.y

      const cand = {
        ...d.room0,
        x: snap(d.room0.x + dx, gridM),
        y: snap(d.room0.y + dy, gridM),
      }
      cand.x = clamp(cand.x, 0, model.widthM - cand.w)
      cand.y = clamp(cand.y, 0, model.depthM - cand.h)

      if (isRoomValid(cand, d.roomId)){
        dragRef.current = { ...d, preview: cand, lastGood: cand }
        setTick(t => t + 1)
      }
      return
    }

    if (d.mode === 'resizeRoom'){
      const pt = svgPointSnapped(ev)
      const dx = pt.x - d.start.x
      const dy = pt.y - d.start.y

      let left   = d.room0.x
      let top    = d.room0.y
      let right  = d.room0.x + d.room0.w
      let bottom = d.room0.y + d.room0.h

      const h = d.handle
      if (h.includes('w')) left  += dx
      if (h.includes('e')) right += dx
      if (h.includes('n')) top   += dy
      if (h.includes('s')) bottom+= dy

      // Snap edges
      left   = snap(left, gridM)
      right  = snap(right, gridM)
      top    = snap(top, gridM)
      bottom = snap(bottom, gridM)

      // Enforce min size
      if (right - left < MIN_ROOM){
        if (h.includes('w')) left = right - MIN_ROOM
        else right = left + MIN_ROOM
      }
      if (bottom - top < MIN_ROOM){
        if (h.includes('n')) top = bottom - MIN_ROOM
        else bottom = top + MIN_ROOM
      }

      // Clamp to model bounds
      left   = clamp(left, 0, model.widthM)
      right  = clamp(right, 0, model.widthM)
      top    = clamp(top, 0, model.depthM)
      bottom = clamp(bottom, 0, model.depthM)

      // Re-enforce min size if clamping squeezed
      if (right - left < MIN_ROOM){
        right = clamp(left + MIN_ROOM, 0, model.widthM)
        left = clamp(right - MIN_ROOM, 0, model.widthM)
      }
      if (bottom - top < MIN_ROOM){
        bottom = clamp(top + MIN_ROOM, 0, model.depthM)
        top = clamp(bottom - MIN_ROOM, 0, model.depthM)
      }

      const cand = { ...d.room0, x:left, y:top, w: right-left, h: bottom-top }

      if (isRoomValid(cand, d.roomId)){
        dragRef.current = { ...d, preview: cand, lastGood: cand }
        setTick(t => t + 1)
      }
      return
    }
  }

  const onCanvasPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return

    if (d.mode === 'drawRoom'){
      const a = d.start
      const b = d.current || d.start

      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      const w = Math.abs(a.x - b.x)
      const h = Math.abs(a.y - b.y)

      if (w < MIN_ROOM || h < MIN_ROOM) return

      const room = {
        id: uid(),
        type: roomType,
        label: ROOM_TYPES.find(t => t.key === roomType)?.label || 'Room',
        x, y, w, h,
        finish,
        locked: false,
      }

      const overlaps = plan.rooms.some(r => rectsOverlap(room, r))
      if (overlaps) return

      updatePlan(p => ({ ...p, rooms: [...p.rooms, room] }))
      setSelectedRoomId(room.id)
      setTool('select')
      return
    }

    if (d.mode === 'drawWall'){
      const a = d.start
      const b0 = d.current || d.start
      const b = constrainAxis(a, b0)
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < MIN_ROOM) return

      const wall = {
        id: uid(),
        kind: 'interior',
        locked: false,
        a,
        b,
        key: wallKey(a, b),
      }

      updatePlan(p => ({ ...p, walls: normalizeWalls([...(p.walls || []), wall]) }))
      setSelectedWallId(wall.id)
      setTool('select')
      return
    }

    if (d.mode === 'moveRoom' || d.mode === 'resizeRoom'){
      const next = d.lastGood || d.preview
      if (!next) return
      updatePlan(p => ({
        ...p,
        rooms: p.rooms.map(r => r.id === d.roomId ? { ...r, ...next } : r)
      }))
    }
  }

  // ---------- room manipulation start helpers ----------
  const startMoveRoom = (room, ev) => {
    if (room.locked) return
    const pt = svgPointSnapped(ev)
    dragRef.current = {
      mode: 'moveRoom',
      roomId: room.id,
      start: pt,
      room0: { x: room.x, y: room.y, w: room.w, h: room.h },
      lastGood: { x: room.x, y: room.y, w: room.w, h: room.h },
    }
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
  }

  const startResizeRoom = (room, handle, ev) => {
    if (room.locked) return
    const pt = svgPointSnapped(ev)
    dragRef.current = {
      mode: 'resizeRoom',
      roomId: room.id,
      handle,
      start: pt,
      room0: { x: room.x, y: room.y, w: room.w, h: room.h },
      lastGood: { x: room.x, y: room.y, w: room.w, h: room.h },
    }
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
  }

  // ---------- wheel zoom ----------
  const onWheel = (ev) => {
    if (view !== '2d') return
    ev.preventDefault()

    const raw = svgWorldPoint(ev)
    const vb = viewBox

    const fx = (raw.x - vb.x) / vb.w
    const fy = (raw.y - vb.y) / vb.h

    const zoom = ev.deltaY > 0 ? 1.14 : 0.88

    const minW = model.widthM * ZOOM_IN_MIN_FACTOR
    const minH = model.depthM * ZOOM_IN_MIN_FACTOR
    const maxW = model.widthM * ZOOM_OUT_MAX_FACTOR
    const maxH = model.depthM * ZOOM_OUT_MAX_FACTOR

    const newW = clamp(vb.w * zoom, minW, maxW)
    const newH = clamp(vb.h * zoom, minH, maxH)

    const nx = raw.x - fx * newW
    const ny = raw.y - fy * newH

    setViewBox(clampVB({ x: nx, y: ny, w: newW, h: newH }))
  }

  const zoomBtn = (dir) => {
    const vb = viewBox
    const zoom = dir === 'in' ? 0.86 : 1.20
    const cx = vb.x + vb.w / 2
    const cy = vb.y + vb.h / 2
    const minW = model.widthM * ZOOM_IN_MIN_FACTOR
    const minH = model.depthM * ZOOM_IN_MIN_FACTOR
    const maxW = model.widthM * ZOOM_OUT_MAX_FACTOR
    const maxH = model.depthM * ZOOM_OUT_MAX_FACTOR

    const newW = clamp(vb.w * zoom, minW, maxW)
    const newH = clamp(vb.h * zoom, minH, maxH)
    const nx = cx - newW / 2
    const ny = cy - newH / 2

    setViewBox(clampVB({ x: nx, y: ny, w: newW, h: newH }))
  }

  const resetView = () => setViewBox({ x: 0, y: 0, w: model.widthM, h: model.depthM })

  // ---------- derived selections ----------
  const selectedRoom = useMemo(
    () => plan.rooms.find(r => r.id === selectedRoomId) || null,
    [plan.rooms, selectedRoomId]
  )
  const selectedOpening = useMemo(
    () => plan.openings.find(o => o.id === selectedOpeningId) || null,
    [plan.openings, selectedOpeningId]
  )
  const selectedWall = useMemo(
    () => plan.walls.find(w => w.id === selectedWallId) || null,
    [plan.walls, selectedWallId]
  )

  // ---------- opening actions ----------
  const flipOpeningSwing = () => {
    if (!selectedOpening || selectedOpening.locked) return
    updatePlan(p => ({
      ...p,
      openings: p.openings.map(o => o.id === selectedOpening.id ? { ...o, openTo: o.openTo === 'pos' ? 'neg' : 'pos' } : o)
    }))
  }

  const flipOpeningHinge = () => {
    if (!selectedOpening || selectedOpening.locked) return
    updatePlan(p => ({
      ...p,
      openings: p.openings.map(o => o.id === selectedOpening.id ? { ...o, hinge: o.hinge === 'start' ? 'end' : 'start' } : o)
    }))
  }

  const deleteSelected = () => {
    if (selectedOpening){
      if (selectedOpening.locked) return
      updatePlan(p => ({ ...p, openings: p.openings.filter(o => o.id !== selectedOpening.id) }))
      setSelectedOpeningId(null)
      return
    }
    if (selectedWall){
      if (selectedWall.locked) return
      updatePlan(p => ({ ...p, walls: p.walls.filter(w => w.id !== selectedWall.id) }))
      setSelectedWallId(null)
      return
    }
    if (selectedRoom){
      if (selectedRoom.locked) return
      updatePlan(p => ({ ...p, rooms: p.rooms.filter(r => r.id !== selectedRoom.id) }))
      setSelectedRoomId(null)
    }
  }

  const clearUserItems = () => {
    updatePlan(p => ({
      rooms: p.rooms.filter(r => r.locked),
      openings: p.openings.filter(o => o.locked),
      walls: p.walls.filter(w => w.locked),
    }))
    setSelectedOpeningId(null)
    setSelectedRoomId(null)
    setSelectedWallId(null)
  }

  const exportPdf = () => window.print()

  // ---------- SVG patterns ----------
  const finishTex = useMemo(() => {
    const map = {}
    FINISHES.forEach(f => { map[f.key] = asset(f.tex) })
    return map
  }, [])

  // ---------- Drag overlays ----------
  const dragPreview = (() => {
    const d = dragRef.current
    if (!d) return null

    if (d.mode === 'drawRoom' && d.current){
      const a = d.start, b = d.current
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      const w = Math.abs(a.x - b.x)
      const h = Math.abs(a.y - b.y)
      return { kind:'room', x, y, w, h }
    }

    if (d.mode === 'drawWall' && d.current){
      const a = d.start
      const b = constrainAxis(a, d.current)
      return { kind:'wall', a, b }
    }

    return null
  })()

  const roomDragOverride = (() => {
    const d = dragRef.current
    if (!d) return null
    if ((d.mode === 'moveRoom' || d.mode === 'resizeRoom') && d.lastGood) return { roomId: d.roomId, rect: d.lastGood }
    return null
  })()

  const inspectorDisabled = (selectedRoom?.locked || selectedOpening?.locked || selectedWall?.locked) ? true : false

  const handleSize = clamp(Math.min(viewBox.w, viewBox.h) * 0.03, 0.08, 0.18)

  const interiorWalls = useMemo(() => plan.walls.filter(w => w.kind !== 'outer'), [plan.walls])

  return (
    <main className="fp-page">
      <div className="fp-topbar">
        <div className="fp-top-left">
          <div className="fp-title">Floor plan builder</div>
          <div className="fp-sub">
            Model area: <strong>{fmtAreaM2(areaM2)} m²</strong> · Size: {round(model.widthM,2)}×{round(model.depthM,2)} m
          </div>
        </div>

        <div className="fp-top-actions">
          <button className="btn ghost small" onClick={()=>setPanelOpen(p=>!p)} type="button">{panelOpen ? 'Hide panel' : 'Show panel'}</button>
          <button className="btn ghost small" onClick={clearUserItems} type="button">Clear</button>
          <button className="btn ghost small" onClick={()=>zoomBtn('out')} type="button">−</button>
          <button className="btn ghost small" onClick={()=>zoomBtn('in')} type="button">+</button>
          <button className="btn ghost small" onClick={resetView} type="button">Reset</button>
          <button className="btn small" onClick={exportPdf} type="button">Export PDF</button>
        </div>
      </div>

      <div className={['fp-grid', panelOpen ? '' : 'is-panel-closed'].join(' ')}>
        {/* Left panel */}
        <aside className="fp-panel card p-6">
          <div className="fp-section">
            <div className="fp-h">Model</div>
            <select value={modelKey} onChange={(e)=>{ setModelKey(e.target.value); setSelectedRoomId(null); setSelectedOpeningId(null); setSelectedWallId(null) }}>
              {MODELS.map(m => (
                <option key={m.key} value={m.key}>
                  {m.label} ({fmtAreaM2(m.widthM*m.depthM)} m²)
                </option>
              ))}
            </select>
          </div>

          <div className="fp-section">
            <div className="fp-h">View</div>
            <div className="fp-toolrow">
              <button className={['btn small', view==='2d' ? '' : 'ghost'].join(' ')} onClick={()=>setView('2d')} type="button">2D</button>
              <button className={['btn small', view==='3d' ? '' : 'ghost'].join(' ')} onClick={()=>setView('3d')} type="button">3D</button>
            </div>
          </div>

          <div className="fp-section">
            <div className="fp-h">Tools</div>
            <div className="fp-toolrow">
              {[
                {k:'room',  t:'Room'},
                {k:'wall',  t:'Wall'},
                {k:'door',  t:'Door'},
                {k:'window',t:'Window'},
                {k:'select',t:'Select'},
                {k:'pan',   t:'Pan'},
              ].map(b => (
                <button
                  key={b.k}
                  className={['btn small', tool===b.k ? '' : 'ghost'].join(' ')}
                  onClick={()=>setTool(b.k)}
                  type="button"
                >
                  {b.t}
                </button>
              ))}
            </div>
            <div className="fp-note">
              • Room: drag to draw (no overlaps)<br/>
              • Wall: drag to draw (axis-aligned)<br/>
              • Door: click any wall or room edge (interior edges auto-create a wall)<br/>
              • Window: click ONLY exterior walls (or room edge that lies on exterior)<br/>
              • Select: click items; drag room to move; drag handles to resize<br/>
              • Pan: drag to move view; Wheel = zoom
            </div>
          </div>

          {tool === 'room' && (
            <div className="fp-section">
              <div className="fp-h">Room settings</div>
              <label className="fp-label">Type</label>
              <select value={roomType} onChange={(e)=>setRoomType(e.target.value)}>
                {ROOM_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>

              <label className="fp-label">Floor finish</label>
              <select value={finish} onChange={(e)=>setFinish(e.target.value)}>
                {FINISHES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>

              <label className="fp-label">Grid (snap)</label>
              <select value={String(gridM)} onChange={(e)=>setGridM(Number(e.target.value))}>
                <option value="0.05">0.05 m</option>
                <option value="0.1">0.10 m</option>
                <option value="0.2">0.20 m</option>
              </select>
            </div>
          )}

          <div className="fp-section">
            <div className="fp-h">Objects</div>
            <div className="fp-objlist">
              <div className="fp-objgroup">
                <div className="fp-objtitle">Rooms ({plan.rooms.length})</div>
                {plan.rooms.map(r => (
                  <button
                    key={r.id}
                    className={['fp-obj', selectedRoomId===r.id && 'is-on'].filter(Boolean).join(' ')}
                    onClick={() => { setSelectedRoomId(r.id); setSelectedOpeningId(null); setSelectedWallId(null); setTool('select') }}
                    type="button"
                  >
                    <span className="fp-dot" />
                    <span>{r.label}{r.locked ? ' (locked)' : ''}</span>
                    <span className="fp-muted">{fmtAreaM2(r.w*r.h)} m²</span>
                  </button>
                ))}
              </div>

              <div className="fp-objgroup">
                <div className="fp-objtitle">Walls (interior) ({interiorWalls.length})</div>
                {interiorWalls.map(w => (
                  <button
                    key={w.id}
                    className={['fp-obj', selectedWallId===w.id && 'is-on'].filter(Boolean).join(' ')}
                    onClick={() => { setSelectedWallId(w.id); setSelectedRoomId(null); setSelectedOpeningId(null); setTool('select') }}
                    type="button"
                  >
                    <span className="fp-dot" />
                    <span>Wall{w.rel?.type === 'roomEdge' ? ' (room edge)' : ''}{w.locked ? ' (locked)' : ''}</span>
                    <span className="fp-muted">{round(Math.hypot(w.b.x-w.a.x, w.b.y-w.a.y),2)} m</span>
                  </button>
                ))}
              </div>

              <div className="fp-objgroup">
                <div className="fp-objtitle">Doors/Windows ({plan.openings.length})</div>
                {plan.openings.map(o => (
                  <button
                    key={o.id}
                    className={['fp-obj', selectedOpeningId===o.id && 'is-on'].filter(Boolean).join(' ')}
                    onClick={() => { setSelectedOpeningId(o.id); setSelectedRoomId(null); setSelectedWallId(null); setTool('select') }}
                    type="button"
                  >
                    <span className="fp-dot" />
                    <span>{o.kind === 'door' ? 'Door' : 'Window'}{o.locked ? ' (locked)' : ''}</span>
                    <span className="fp-muted">{round(o.widthM,2)} m</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(selectedRoom || selectedOpening || selectedWall) && (
            <div className="fp-section">
              <div className="fp-h">Inspector</div>

              {selectedRoom && (
                <div className="fp-ins">
                  <div><strong>{selectedRoom.label}</strong> {selectedRoom.locked ? '· locked' : ''}</div>
                  <div className="fp-muted">
                    {round(selectedRoom.w,2)}×{round(selectedRoom.h,2)} m · {fmtAreaM2(selectedRoom.w*selectedRoom.h)} m²
                  </div>
                  <div className="fp-muted">Finish: {selectedRoom.finish}</div>
                  {!selectedRoom.locked && (
                    <div className="fp-muted">Tip: drag the room in Select mode to move; use the corner/edge handles to resize.</div>
                  )}
                </div>
              )}

              {selectedWall && (
                <div className="fp-ins">
                  <div><strong>Wall</strong> {selectedWall.locked ? '· locked' : ''}</div>
                  <div className="fp-muted">
                    From ({round(selectedWall.a.x,2)},{round(selectedWall.a.y,2)}) to ({round(selectedWall.b.x,2)},{round(selectedWall.b.y,2)})
                  </div>
                  {selectedWall.rel?.type === 'roomEdge' && (
                    <div className="fp-muted">Attached to room edge: {selectedWall.rel.roomId} · {selectedWall.rel.edge}</div>
                  )}
                </div>
              )}

              {selectedOpening && (() => {
                const { geom } = resolveOpening(model, plan.rooms, plan.walls, selectedOpening)
                const sp = openingSpaces(model, plan, selectedOpening)
                const posName = sp.pos ? sp.pos.label : 'Outside'
                const negName = sp.neg ? sp.neg.label : 'Outside'
                const openInto = selectedOpening.openTo === 'pos' ? posName : negName

                return (
                  <div className="fp-ins">
                    <div><strong>{selectedOpening.kind === 'door' ? 'Door' : 'Window'}</strong> {selectedOpening.locked ? '· locked' : ''}</div>
                    <div className="fp-muted">
                      Width: {round(selectedOpening.widthM,2)} m · Host: {selectedOpening.host?.type === 'wall' ? `wall ${selectedOpening.host.wallId}` : 'legacy'}
                    </div>
                    {selectedOpening.kind === 'door' && (
                      <>
                        <div className="fp-muted">
                          Spaces: <span>pos → {posName}</span> · <span>neg → {negName}</span>
                        </div>
                        <div className="fp-muted">
                          Opens into: <strong>{openInto}</strong>
                        </div>
                        {!selectedOpening.locked && (
                          <div className="fp-toolrow mt-3">
                            <button className="btn small ghost" type="button" onClick={flipOpeningSwing}>Flip swing</button>
                            <button className="btn small ghost" type="button" onClick={flipOpeningHinge}>Flip hinge</button>
                          </div>
                        )}
                      </>
                    )}
                    <div className="fp-muted">
                      Wall normal: ({round(geom.n.x,2)},{round(geom.n.y,2)})
                    </div>
                  </div>
                )
              })()}

              <div className="fp-toolrow mt-3">
                <button className="btn small ghost" onClick={()=>{ setSelectedOpeningId(null); setSelectedRoomId(null); setSelectedWallId(null) }} type="button">Deselect</button>
                <button className="btn small" onClick={deleteSelected} type="button" disabled={inspectorDisabled}>Delete</button>
              </div>

              <div className="fp-note">
                Tip: press <strong>Delete</strong> / <strong>Backspace</strong> to remove selected items.
              </div>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <section className="fp-canvas card p-6">
          <div className="fp-canvas-head">
            <div className="fp-h">{view === '2d' ? 'Plan (2D)' : 'Preview (3D)'}</div>
            <div className="fp-muted">Units: meters · Snap: {gridM} m</div>
          </div>

          {view === '2d' ? (
            <div className="fp-svg-wrap" onWheel={onWheel}>
              <svg
                ref={svgRef}
                className="fp-svg"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                role="img"
                aria-label="Floor plan canvas"
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
              >
                <defs>
                  {FINISHES.map(f => (
                    <pattern
                      key={f.key}
                      id={`tex_${f.key}`}
                      patternUnits="userSpaceOnUse"
                      width="0.8"
                      height="0.8"
                    >
                      <image
                        href={finishTex[f.key]}
                        xlinkHref={finishTex[f.key]}
                        x="0"
                        y="0"
                        width="0.8"
                        height="0.8"
                        preserveAspectRatio="none"
                      />
                    </pattern>
                  ))}
                </defs>

                {/* Background */}
                <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="#0b1220" />

                {/* Grid (only within model bounds for clarity) */}
                <Grid width={model.widthM} height={model.depthM} step={gridM} />

                {/* Rooms */}
                {plan.rooms.map(r0 => {
                  const r = (roomDragOverride && roomDragOverride.roomId === r0.id) ? { ...r0, ...roomDragOverride.rect } : r0
                  const isSel = selectedRoomId === r0.id

                  return (
                    <g
                      key={r0.id}
                      onPointerDown={(e)=>{
                        if (tool !== 'select') return
                        e.stopPropagation()
                        setSelectedRoomId(r0.id)
                        setSelectedOpeningId(null)
                        setSelectedWallId(null)
                        startMoveRoom(r0, e)
                      }}
                      style={{ cursor: tool === 'select' && !r0.locked ? 'move' : 'default' }}
                    >
                      <rect
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        fill={`url(#tex_${r.finish || 'wood'})`}
                        opacity="0.95"
                        stroke={isSel ? '#60a5fa' : '#ffffff44'}
                        strokeWidth="0.04"
                      />
                      <text
                        x={r.x + 0.12}
                        y={r.y + 0.28}
                        fontSize="0.22"
                        fill="#0b1220"
                        stroke="#ffffffcc"
                        strokeWidth="0.01"
                        paintOrder="stroke"
                      >
                        {r.label}
                      </text>

                      {/* Resize handles (Select mode only, unlocked only) */}
                      {tool === 'select' && isSel && !r0.locked && (
                        <RoomResizeHandles
                          room={r}
                          size={handleSize}
                          onStart={(handle, ev)=>{ ev.stopPropagation(); startResizeRoom(r0, handle, ev) }}
                        />
                      )}
                    </g>
                  )
                })}

                {/* Walls */}
                <g aria-label="walls">
                  {plan.walls.map(w => (
                    <WallGlyph
                      key={w.id}
                      wall={w}
                      selected={selectedWallId===w.id}
                      selectable={tool === 'select' && w.kind !== 'outer'}
                      onSelect={() => { setSelectedWallId(w.id); setSelectedRoomId(null); setSelectedOpeningId(null); setTool('select') }}
                    />
                  ))}
                </g>

                {/* Drag preview */}
                {dragPreview?.kind === 'room' && (
                  <rect
                    x={dragPreview.x}
                    y={dragPreview.y}
                    width={dragPreview.w}
                    height={dragPreview.h}
                    fill="none"
                    stroke="#60a5fa"
                    strokeDasharray="0.10 0.08"
                    strokeWidth="0.05"
                  />
                )}
                {dragPreview?.kind === 'wall' && (
                  <line
                    x1={dragPreview.a.x}
                    y1={dragPreview.a.y}
                    x2={dragPreview.b.x}
                    y2={dragPreview.b.y}
                    stroke="#a78bfa"
                    strokeDasharray="0.12 0.08"
                    strokeWidth="0.10"
                    strokeLinecap="round"
                  />
                )}

                {/* Doors / windows */}
                {plan.openings.map(o => (
                  <OpeningGlyph
                    key={o.id}
                    model={model}
                    plan={plan}
                    opening={o}
                    selected={selectedOpeningId===o.id}
                    selectable={tool === 'select'}
                    onSelect={() => { setSelectedOpeningId(o.id); setSelectedRoomId(null); setSelectedWallId(null); setTool('select') }}
                  />
                ))}

                {/* Outline label (inside model) */}
                <g transform={`translate(${0.15}, ${model.depthM - 0.25})`}>
                  <rect x="0" y="-0.22" width="3.10" height="0.28" fill="#00000088" rx="0.06" />
                  <text x="0.12" y="0" fontSize="0.18" fill="#fff">
                    {model.label} · {fmtAreaM2(areaM2)} m²
                  </text>
                </g>
              </svg>
            </div>
          ) : (
            <div className="fp-3d-wrap">
              <FloorPreview3D model={model} plan={plan} />
              <div className="fp-help mt-3">Simple 3D preview (isometric). Use 2D view for editing.</div>
            </div>
          )}

          <div className="fp-help mt-3">
            {view === '2d' && (
              <>
                {tool === 'room' && 'Drag to create a room. Overlaps are blocked.'}
                {tool === 'wall' && 'Drag to create a wall segment (axis-aligned).'}
                {tool === 'door' && 'Click a wall (outer or interior). If you click a room edge without an interior wall, one is created and attached to that room edge.'}
                {tool === 'window' && 'Click ONLY the exterior (outer) walls. If you click a room edge that touches exterior, the window will be placed on the outer wall.'}
                {tool === 'select' && 'Click items to inspect. Drag rooms to move. Drag handles to resize. Press Delete to remove.'}
                {tool === 'pan' && 'Drag to pan. Mouse wheel to zoom (including far zoom-out).'}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

// -------------------------- Subcomponents ------------------------------------
function Grid({ width, height, step }){
  if (step <= 0) return null
  const lines = []
  for (let x = 0; x <= width + 1e-6; x += step){
    lines.push(<line key={'vx'+x} x1={x} y1={0} x2={x} y2={height} stroke="#ffffff12" strokeWidth="0.02" />)
  }
  for (let y = 0; y <= height + 1e-6; y += step){
    lines.push(<line key={'hy'+y} x1={0} y1={y} x2={width} y2={y} stroke="#ffffff12" strokeWidth="0.02" />)
  }
  return <g aria-hidden="true">{lines}</g>
}

function RoomResizeHandles({ room, size, onStart }){
  const hs = size
  const half = hs / 2

  const pts = [
    { k:'nw', x: room.x,           y: room.y,            c:'nwse-resize' },
    { k:'n',  x: room.x + room.w/2,y: room.y,            c:'ns-resize' },
    { k:'ne', x: room.x + room.w,  y: room.y,            c:'nesw-resize' },
    { k:'e',  x: room.x + room.w,  y: room.y + room.h/2, c:'ew-resize' },
    { k:'se', x: room.x + room.w,  y: room.y + room.h,   c:'nwse-resize' },
    { k:'s',  x: room.x + room.w/2,y: room.y + room.h,   c:'ns-resize' },
    { k:'sw', x: room.x,           y: room.y + room.h,   c:'nesw-resize' },
    { k:'w',  x: room.x,           y: room.y + room.h/2, c:'ew-resize' },
  ]

  return (
    <g aria-label="resize handles">
      {pts.map(p => (
        <rect
          key={p.k}
          x={p.x - half}
          y={p.y - half}
          width={hs}
          height={hs}
          rx={hs*0.22}
          fill="#22c55e"
          stroke="#0b1220"
          strokeWidth="0.03"
          style={{ cursor: p.c }}
          onPointerDown={(e)=> onStart?.(p.k, e)}
        />
      ))}
    </g>
  )
}

function WallGlyph({ wall, selected, onSelect, selectable }){
  const stroke = wall.kind === 'outer' ? '#ffffffcc' : '#ffffffaa'
  const s = selected ? '#22c55e' : stroke
  const sw = wall.kind === 'outer' ? 0.12 : 0.10

  return (
    <g
      onPointerDown={(e)=>{
        if (!selectable) return
        e.stopPropagation()
        onSelect?.()
      }}
      style={{ cursor: selectable ? 'pointer' : 'default' }}
    >
      {/* Hit area */}
      <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke="transparent" strokeWidth={sw*3} strokeLinecap="round" />
      {/* Visible wall */}
      <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke={s} strokeWidth={sw} strokeLinecap="round" />
    </g>
  )
}

function OpeningGlyph({ model, plan, opening, selected, onSelect, selectable }){
  const { geom, widthM, a, b } = resolveOpening(model, plan.rooms, plan.walls, opening)

  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2

  const baseStroke = selected ? '#22c55e' : (opening.kind === 'door' ? '#ffffff' : '#60a5fa')
  const sw = 0.06

  const onDown = (e) => {
    if (!selectable) return
    e.stopPropagation()
    onSelect?.()
  }

  if (opening.kind === 'window'){
    return (
      <g onPointerDown={onDown} style={{cursor: selectable ? 'pointer' : 'default'}}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0b1220" strokeWidth={sw*2.4} strokeLinecap="round" />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={baseStroke} strokeWidth={sw*1.7} strokeLinecap="round" />
      </g>
    )
  }

  // Door
  const hingeAtA = (opening.hinge || 'start') === 'start'
  const hinge = hingeAtA ? a : b
  const other = hingeAtA ? b : a

  const openToPos = (opening.openTo || 'pos') === 'pos'
  const on = openToPos ? geom.n : { x:-geom.n.x, y:-geom.n.y }

  const leafEnd = { x: hinge.x + on.x * widthM, y: hinge.y + on.y * widthM }

  const cross = geom.t.x * on.y - geom.t.y * on.x
  const sweep = cross > 0 ? 1 : 0

  const arcD = `M ${other.x} ${other.y} A ${widthM} ${widthM} 0 0 ${sweep} ${leafEnd.x} ${leafEnd.y}`

  return (
    <g onPointerDown={onDown} style={{cursor: selectable ? 'pointer' : 'default'}}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0b1220" strokeWidth={sw*2.4} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={baseStroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1={hinge.x} y1={hinge.y} x2={leafEnd.x} y2={leafEnd.y} stroke={baseStroke} strokeWidth={sw} strokeLinecap="round" />
      <path d={arcD} fill="none" stroke={baseStroke} strokeWidth={sw*0.85} />
      <circle cx={cx} cy={cy} r="0.05" fill={selected ? '#22c55e' : '#ffffffaa'} />
    </g>
  )
}

function finishColor(key){
  switch(key){
    case 'tile': return '#a7f3d0'
    case 'laminate': return '#fde68a'
    case 'spc': return '#c7d2fe'
    case 'pvc': return '#fbcfe8'
    case 'concrete': return '#e5e7eb'
    default: return '#f5d0a7'
  }
}

/**
 * Very simple 3D-ish preview rendered into a canvas.
 */
function FloorPreview3D({ model, plan }){
  const canvasRef = useRef(null)
  const [yawDeg, setYawDeg] = useState(45)

  useEffect(() => {
    const c = canvasRef.current
    if(!c) return
    const ctx = c.getContext('2d')
    if(!ctx) return

    const r = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = Math.max(1, Math.floor(r.width * dpr))
    c.height = Math.max(1, Math.floor(r.height * dpr))
    ctx.setTransform(dpr,0,0,dpr,0,0)

    ctx.clearRect(0,0,r.width,r.height)
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0,0,r.width,r.height)

    const H = 2.6
    const yaw = (yawDeg * Math.PI) / 180
    const cx = model.widthM / 2
    const cy = model.depthM / 2

    const proj = (x, y, z=0) => {
      const rx = (x - cx) * Math.cos(yaw) - (y - cy) * Math.sin(yaw)
      const ry = (x - cx) * Math.sin(yaw) + (y - cy) * Math.cos(yaw)
      const sx = (rx - ry)
      const sy = (rx + ry) * 0.55 - z * 1.0
      return { sx, sy, depth: (rx + ry) }
    }

    const faces = []

    for (const room of plan.rooms){
      const p1 = proj(room.x, room.y, 0)
      const p2 = proj(room.x + room.w, room.y, 0)
      const p3 = proj(room.x + room.w, room.y + room.h, 0)
      const p4 = proj(room.x, room.y + room.h, 0)
      faces.push({
        kind:'floor',
        depth:(p1.depth+p2.depth+p3.depth+p4.depth)/4,
        pts:[p1,p2,p3,p4],
        fill: finishColor(room.finish),
        stroke:'#ffffff1a'
      })
    }

    for (const w of plan.walls){
      const a = w.a, b = w.b
      const p1 = proj(a.x, a.y, 0)
      const p2 = proj(b.x, b.y, 0)
      const p3 = proj(b.x, b.y, H)
      const p4 = proj(a.x, a.y, H)
      faces.push({
        kind:'wall',
        depth:(p1.depth+p2.depth+p3.depth+p4.depth)/4,
        pts:[p1,p2,p3,p4],
        fill: w.kind==='outer' ? '#0f172a' : '#111827',
        stroke: w.kind==='outer' ? '#ffffff33' : '#ffffff22'
      })
    }

    faces.sort((A,B)=>A.depth - B.depth)

    const all = faces.flatMap(f => f.pts)
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity
    for (const p of all){
      minX = Math.min(minX, p.sx); maxX = Math.max(maxX, p.sx)
      minY = Math.min(minY, p.sy); maxY = Math.max(maxY, p.sy)
    }
    const bw = maxX - minX || 1
    const bh = maxY - minY || 1
    const scale = Math.min((r.width*0.88)/bw, (r.height*0.88)/bh)
    const ox = r.width/2 - (minX + bw/2)*scale
    const oy = r.height/2 - (minY + bh/2)*scale

    const drawPoly = (pts) => {
      ctx.beginPath()
      ctx.moveTo(ox + pts[0].sx*scale, oy + pts[0].sy*scale)
      for (let i=1;i<pts.length;i++) ctx.lineTo(ox + pts[i].sx*scale, oy + pts[i].sy*scale)
      ctx.closePath()
    }

    for (const f of faces){
      drawPoly(f.pts)
      ctx.fillStyle = f.fill
      ctx.fill()
      ctx.strokeStyle = f.stroke
      ctx.lineWidth = 1
      ctx.stroke()
    }

  }, [model, plan, yawDeg])

  return (
    <div className="fp-3d fp-card">
      <div className="fp-3d-bar">
        <div style={{minWidth:110, opacity:.85}}>Rotate</div>
        <input type="range" min="0" max="360" value={yawDeg} onChange={(e)=>setYawDeg(+e.target.value)} />
        <div style={{minWidth:46, textAlign:'right', opacity:.75}}>{yawDeg}°</div>
      </div>
      <canvas ref={canvasRef} className="fp-3d-canvas" />
    </div>
  )
}
