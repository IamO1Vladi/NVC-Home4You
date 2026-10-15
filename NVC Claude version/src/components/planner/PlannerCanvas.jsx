import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  MIN_ROOM_SIDE_M,
  MIN_WALL_LEN_M,
  clamp,
  clonePlan,
  constrainAxis,
  fitViewBox,
  moveOpeningTo,
  normalizeWallsKeepAll,
  panViewBox,
  placeOpeningResult,
  rectsOverlap,
  resizeRoomRect,
  roomOverlapsAny,
  snap,
  snapRoomPosition,
  uid,
  wallGeom,
  wallKey,
  zoomViewBox,
} from '../../lib/floorPlan.js'
import PlanDrawing from './PlanDrawing.jsx'
import PlannerIcon from './PlannerIcons.jsx'

// Why the Door / Window tool placed nothing, as the toast that says so.
const OPENING_REASON_TOAST = { 'no-wall': 'noWall', 'window-interior': 'windowInterior', 'wall-full': 'wallFull' }

// A press that travels less than this (in screen pixels) is a click, not a drag.
const CLICK_SLOP_PX = 6

/**
 * The plan itself: the SVG, its zoom/pan, and the pointer state machine that
 * draws rooms and walls, places doors and windows, and moves and resizes rooms.
 * A drag lives in `dragRef` (not state) so a pointermove does not re-render
 * twice; `setTick` re-renders only the drawing previews.
 *
 * Anything refused — an overlap, the locked bathroom, a window on an inside
 * wall — says why in a toast instead of silently doing nothing.
 *
 * `readOnly` (phones): the same drawing, fitted, with no pointer handling at all,
 * so a finger scrolls the page as on any picture.
 *
 * `s` is usePlannerState's result, `t` usePlannerText's.
 */
export default function PlannerCanvas({ s, t, readOnly = false, onShowTemplates }) {
  const {
    model,
    plan,
    tool,
    setTool,
    roomType,
    finish,
    gridM,
    snapGridOn,
    snapAlignOn,
    multiPlace,
    collision,
    setCollision,
    selectedRoomId,
    selectedWallId,
    selectedOpeningId,
    selectedRoom,
    selectedWall,
    setSelectedRoomId,
    setSelectedWallId,
    setSelectedOpeningId,
    setActive,
    canvasCaptured,
    setCanvasCaptured,
    panHeldRef,
    viewBox,
    setViewBox,
    updatePlan,
    pushUndoSnapshot,
    onSelectRoom,
    onSelectWall,
    onSelectOpening,
    removeRoom,
    removeOpening,
    removeWall,
    notify,
    toast,
    notices,
    dismissNotices,
    terrace,
    terraceRect,
    userRoomCount,
  } = s
  const { textOr, ed, modelLabel, fmtSizeCm, fmtLenCm } = t

  const svgRef = useRef(null)
  const wrapRef = useRef(null)
  const dragRef = useRef(null)
  const [, setTick] = useState(0)

  // The drawing's scale in screen pixels per metre, for text, strokes and handles.
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fitBox = fitViewBox(model, terraceRect ? [terraceRect] : [])
  const pxPerM = box.w && box.h ? Math.min(box.w / viewBox.w, box.h / viewBox.h) : 60
  const m = (px) => px / pxPerM

  // React's onWheel handler may be passive in some setups.
  // We attach a native wheel listener with {passive:false} so we can reliably prevent page scroll.
  const wheelCtxRef = useRef({ canvasCaptured: false, viewBox, model })
  useEffect(() => {
    wheelCtxRef.current = { canvasCaptured, viewBox, model }
  }, [canvasCaptured, viewBox, model])
  const wheelHintShownRef = useRef(false)

  // ---------- coordinate conversion ----------
  function svgWorldPoint(ev) {
    const svg = svgRef.current
    if (!svg || typeof svg.createSVGPoint !== 'function') return { x: 0, y: 0 }
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

  // The wheel zooms only once the visitor has clicked the plan, or with Ctrl/⌘
  // held; otherwise it scrolls the page, and the first time it does so over the
  // plan a toast says how to zoom.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || readOnly) return undefined

    const handler = (ev) => {
      const ctx = wheelCtxRef.current
      if (!ctx.canvasCaptured && !ev.ctrlKey && !ev.metaKey) {
        if (!wheelHintShownRef.current) {
          wheelHintShownRef.current = true
          notify('wheelHint')
        }
        return
      }
      ev.preventDefault()
      setViewBox(zoomViewBox(ctx.viewBox, ctx.model, svgWorldPoint(ev), ev.deltaY > 0 ? 1.12 : 0.89))
    }

    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  // ---------- pointer handlers ----------
  const startDrag = (e, state) => {
    dragRef.current = { ...state, startClient: { x: Number(e.clientX) || 0, y: Number(e.clientY) || 0 } }
    svgRef.current?.setPointerCapture?.(e.pointerId)
  }

  const onCanvasPointerDown = (ev) => {
    // Clicking the plan hands it the wheel and the keyboard (Esc gives them back).
    setActive(true)
    setCanvasCaptured(true)

    // Space held, or the middle button: move the view. A finger has neither, so on a
    // touch screen a drag on empty plan with the Select tool moves the view too (rooms,
    // walls and doors take their own presses first, so those still select and drag).
    const touchPan = ev.pointerType === 'touch' && tool === 'select'
    if (panHeldRef.current || ev.button === 1 || touchPan) {
      ev.preventDefault()
      startDrag(ev, { mode: 'pan', start: svgWorldPoint(ev), vb0: viewBox })
      return
    }
    if (ev.button !== undefined && ev.button !== 0) return

    const pt = svgPointSnapped(ev)

    if (tool !== 'select') {
      setSelectedOpeningId(null)
      setSelectedRoomId(null)
      setSelectedWallId(null)
    }

    if (tool === 'room') {
      startDrag(ev, { mode: 'drawRoom', start: pt })
      return
    }

    if (tool === 'wall') {
      startDrag(ev, { mode: 'drawWall', start: pt })
      return
    }

    if (tool === 'door' || tool === 'window') {
      const result = placeOpeningResult(model, plan, tool, pt)
      if (!result.opening) {
        notify(OPENING_REASON_TOAST[result.reason] || 'noWall')
        return
      }
      updatePlan((p) => ({ ...p, openings: [...p.openings, result.opening] }))
      setSelectedOpeningId(result.opening.id)
      if (!multiPlace) setTool('select')
      return
    }

    if (tool === 'select') {
      setSelectedOpeningId(null)
      setSelectedRoomId(null)
      setSelectedWallId(null)
    }
  }

  // A press only becomes a drag once it has travelled a little, so a click selects
  // without nudging the room by a grid step.
  const passedDragThreshold = (d, ev) => {
    if (d.didMove) return true
    const dx = (Number(ev.clientX) || 0) - (d.startClient?.x ?? 0)
    const dy = (Number(ev.clientY) || 0) - (d.startClient?.y ?? 0)
    if (Math.hypot(dx, dy) < CLICK_SLOP_PX) return false
    d.didMove = true
    return true
  }

  const noteCollision = (d, candidate) => {
    const hit = plan.rooms.find((r) => r.id !== d.roomId && rectsOverlap(candidate, r))
    d.collidedWith = hit?.locked ? 'bath' : 'room'
  }

  const onCanvasPointerMove = (ev) => {
    if (!dragRef.current) return
    const d = dragRef.current

    if (d.mode === 'lockedRoom' || d.mode === 'lockedOpening') {
      if (!d.told && passedDragThreshold(d, ev)) {
        d.told = true
        notify(d.mode === 'lockedRoom' ? 'locked' : 'lockedDoor')
      }
      return
    }

    if (d.mode === 'moveRoom') {
      const raw = svgWorldPoint(ev)
      const start = d.startRaw
      if (!start || !d.room0) return
      if (!passedDragThreshold(d, ev)) return

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
        const sn = snapRoomPosition(model, plan, d.roomId, nx, ny, d.room0.w, d.room0.h, gridM)
        if (d.axisLock === 'x') nx = sn.x
        else if (d.axisLock === 'y') ny = sn.y
        else {
          nx = sn.x
          ny = sn.y
        }
      }

      // Keep the existing "rooms do not overlap" invariant + show collision feedback.
      const candidate = { x: nx, y: ny, w: d.room0.w, h: d.room0.h }
      if (roomOverlapsAny(plan.rooms, candidate, d.roomId)) {
        setCollision({ roomId: d.roomId, ...candidate })
        noteCollision(d, candidate)
        nx = d.lastValid?.x ?? d.room0.x
        ny = d.lastValid?.y ?? d.room0.y
      } else {
        setCollision(null)
        d.collidedWith = null
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
      if (!passedDragThreshold(d, ev)) return

      const snapping = !ev.altKey
      let next = resizeRoomRect(model, plan, d.roomId, d.room0, d.handle, raw.x - start.x, raw.y - start.y, {
        gridM,
        snapGrid: snapping && snapGridOn,
        snapAlign: snapping && snapAlignOn,
      })

      // No-overlap + collision feedback
      if (roomOverlapsAny(plan.rooms, next, d.roomId)) {
        setCollision({ roomId: d.roomId, ...next })
        noteCollision(d, next)
        const lv = d.lastValid || d.room0
        next = { x: lv.x, y: lv.y, w: lv.w, h: lv.h }
      } else {
        setCollision(null)
        d.collidedWith = null
        d.lastValid = next
      }

      // One undo snapshot per resize gesture.
      const r0 = d.room0
      if (!d.historyPushed && (next.x !== r0.x || next.y !== r0.y || next.w !== r0.w || next.h !== r0.h)) {
        pushUndoSnapshot(d.plan0)
        d.historyPushed = true
      }

      updatePlan(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) => (r.id === d.roomId ? { ...r, ...next } : r)),
        }),
        { history: false }
      )
      return
    }

    if (d.mode === 'moveOpening') {
      const raw = svgWorldPoint(ev)
      if (!d.startRaw) return

      const opening = plan.openings.find((o) => o.id === d.openingId)
      if (!opening || opening.locked) return
      if (!passedDragThreshold(d, ev)) return

      // ALT disables snapping along the wall.
      const target = moveOpeningTo(model, plan, opening, raw, { gridM, snapGrid: !ev.altKey && snapGridOn })
      if (!target) return
      const { wallId, at } = target

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
      setViewBox(panViewBox(d.vb0, model, d.start.x - raw.x, d.start.y - raw.y))
      return
    }

    if (d.mode === 'drawRoom' || d.mode === 'drawWall') {
      passedDragThreshold(d, ev)
      const pt = svgPointSnapped(ev)
      dragRef.current = { ...d, current: pt }
      setTick((x) => x + 1)
    }
  }

  const onCanvasPointerCancel = () => {
    // A system gesture took the pointer: drop the gesture, keep what was committed.
    dragRef.current = null
    setCollision(null)
    setTick((x) => x + 1)
  }

  const onCanvasPointerUp = () => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return

    if (d.mode === 'moveRoom' || d.mode === 'resizeRoom') {
      setCollision(null)
      if (!d.didMove || !d.room0) return
      // It stopped where it last fitted; say why it would not go further.
      if (d.collidedWith) notify(d.collidedWith === 'bath' ? 'overlapBath' : 'overlap')

      const final = d.lastValid || d.room0
      updatePlan(
        (p) => ({
          ...p,
          rooms: p.rooms.map((r) =>
            r.id === d.roomId
              ? d.mode === 'moveRoom'
                ? { ...r, x: final.x, y: final.y }
                : { ...r, x: final.x, y: final.y, w: final.w, h: final.h }
              : r
          ),
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
      if (w < MIN_ROOM_SIDE_M || h < MIN_ROOM_SIDE_M) {
        // A click is a visitor who has not found out they must drag; a short drag
        // is a room below the minimum.
        notify(d.didMove ? 'roomTooSmall' : 'dragToDraw')
        return
      }

      const room = {
        id: uid(),
        type: roomType,
        // No stored name: it follows the type, in whichever language the plan is opened.
        label: null,
        x,
        y,
        w,
        h,
        finish,
        locked: false,
      }
      if (roomOverlapsAny(plan.rooms, room)) {
        const onBath = plan.rooms.some((r) => r.locked && rectsOverlap(room, r))
        notify(onBath ? 'overlapBath' : 'overlap')
        return
      }
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
      if (len < MIN_WALL_LEN_M) {
        notify('dragWall')
        return
      }
      const key = wallKey(a, b)
      // Don't duplicate identical interior segments.
      if (plan.walls.some((w) => w.kind === 'interior' && (w.key || wallKey(w.a, w.b)) === key)) {
        notify('wallExists')
        return
      }
      const wall = { id: uid(), kind: 'interior', locked: false, a, b, key }
      updatePlan((p) => ({ ...p, walls: normalizeWallsKeepAll([...(p.walls || []), wall]) }))
      setSelectedWallId(wall.id)
      if (!multiPlace) setTool('select')
    }
  }

  // ---------- item handlers (Select and Erase act on what was pressed) ----------
  const onRoomPointerDown = (r, e) => {
    if (tool !== 'select' && tool !== 'erase') return
    if (panHeldRef.current || e.button === 1) return
    e.stopPropagation()
    setActive(true)
    setCanvasCaptured(true)
    if (tool === 'erase') {
      removeRoom(r.id)
      return
    }
    onSelectRoom(r.id)
    if (r.locked) {
      startDrag(e, { mode: 'lockedRoom', didMove: false })
      return
    }
    startDrag(e, {
      mode: 'moveRoom',
      roomId: r.id,
      startRaw: svgWorldPoint(e),
      plan0: clonePlan(plan),
      room0: { x: r.x, y: r.y, w: r.w, h: r.h },
      lastValid: { x: r.x, y: r.y },
      didMove: false,
      historyPushed: false,
      axisLock: null,
    })
  }

  const onWallPointerDown = (seg, e) => {
    if (tool !== 'select' && tool !== 'erase') return
    if (panHeldRef.current || e.button === 1) return
    const isUser = seg.repKind === 'interior'
    if (tool === 'erase') {
      e.stopPropagation()
      setActive(true)
      setCanvasCaptured(true)
      removeWall(seg.repWallId)
      return
    }
    if (!isUser) return
    e.stopPropagation()
    setActive(true)
    setCanvasCaptured(true)
    onSelectWall(seg.repWallId)
  }

  const onOpeningPointerDown = (o, e) => {
    if (panHeldRef.current || e.button === 1) return
    setActive(true)
    setCanvasCaptured(true)
    if (tool === 'erase') {
      removeOpening(o.id)
      return
    }
    onSelectOpening(o.id)
    if (tool !== 'select') return
    if (o.locked) {
      startDrag(e, { mode: 'lockedOpening', didMove: false })
      return
    }
    startDrag(e, {
      mode: 'moveOpening',
      openingId: o.id,
      startRaw: svgWorldPoint(e),
      plan0: clonePlan(plan),
      opening0: { wallId: o.host?.wallId, at: o.host?.at },
      lastValid: { wallId: o.host?.wallId, at: o.host?.at },
      didMove: false,
      historyPushed: false,
    })
  }

  const drag = dragRef.current
  const roomCursor = (r) => {
    if (tool === 'erase') return r.locked ? 'not-allowed' : 'pointer'
    if (tool !== 'select') return 'crosshair'
    if (drag?.mode === 'moveRoom' && drag.roomId === r.id) return 'grabbing'
    return r.locked ? 'not-allowed' : 'grab'
  }
  const wallCursor = (seg) => {
    if (tool === 'erase') return seg.repKind === 'interior' ? 'pointer' : 'not-allowed'
    if (tool === 'select') return seg.repKind === 'interior' ? 'pointer' : 'default'
    return 'crosshair'
  }
  const openingCursor = (o) => {
    if (tool === 'erase') return o.locked ? 'not-allowed' : 'pointer'
    if (drag?.mode === 'moveOpening' && drag.openingId === o.id) return 'grabbing'
    return tool === 'select' && !o.locked ? 'grab' : 'pointer'
  }

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

    const toastText = !toast
    ? ''
    : toast.key === 'wheelHint'
      ? ed('wheelHint')
      : toast.key === 'loadError'
        ? textOr('planner.loadLayoutError', 'Could not open that saved layout file.')
        : ed(`toast.${toast.key}`)
  const migratedText = notices.length
    ? (() => {
        const names = notices.map((n) => modelLabel(s.models.find((x) => x.key === n.modelKey) || { key: n.modelKey, label: n.modelKey })).join(', ')
        const dropped = notices.reduce((sum, n) => sum + n.dropped, 0)
        return dropped ? ed('migratedDropped', { models: names, n: dropped }) : ed('migrated', { models: names })
      })()
    : ''

  // Only while Select is the tool: with Wall, Door, Window or Erase picked, the card would
  // sit on the very floor those tools are aimed at.
  const showEmpty = !readOnly && userRoomCount === 0 && tool === 'select' && !dragPreview
  const toolTip = ed(`toolTip.${tool}`)
  const hs = m(11)
  const hit = m(24)

  return (
    <div role="region" className={`fp-canvas${readOnly ? ' is-readonly' : ''}`} aria-label={ed('canvasLabel', { model: modelLabel(model) })}>
      <div
        ref={wrapRef}
        className={`fp-svg-wrap ${canvasCaptured ? 'is-captured' : 'is-free'} fp-tool-${tool}`}
        // As tall as the whole plan needs at this width, within the screen's height:
        // a 37 m² house does not sit in a tall empty box, a 73 m² one is not squeezed.
        style={{ aspectRatio: `${fitBox.w} / ${fitBox.h}` }}
      >
        {migratedText && (
          <div className="fp-notice" role="status">
            <PlannerIcon name="info" />
            <span>{migratedText}</span>
            <button type="button" className="fp-notice-btn" onClick={dismissNotices}>
              {ed('dismiss')}
            </button>
          </div>
        )}

        <div className="fp-toast-slot" aria-live="polite" aria-atomic="true">
          {toastText && (
            <div className="fp-toast" key={toast.n} role="status">
              {toastText}
            </div>
          )}
        </div>

        {showEmpty && (
          <div className="fp-empty">
            <div className="fp-empty-card">
              <PlannerIcon name="room" className="fp-empty-ico" />
              <p className="fp-empty-title">{ed('emptyTitle')}</p>
              <p className="fp-empty-body">{ed('emptyBody')}</p>
              <div className="fp-empty-actions">
                <button type="button" className="fp-btn" onClick={() => setTool('room')}>
                  {ed('emptyDraw')}
                </button>
                {onShowTemplates && (
                  <button type="button" className="fp-btn ghost" onClick={onShowTemplates}>
                    {ed('emptyTemplates')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          className="fp-svg"
          // On a phone the drawing sets its own height from the plan's proportions.
          style={readOnly ? { aspectRatio: `${viewBox.w} / ${viewBox.h}` } : undefined}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          role={readOnly ? 'img' : undefined}
          aria-label={ed('canvasLabel', { model: modelLabel(model) })}
          onPointerDown={readOnly ? undefined : onCanvasPointerDown}
          onPointerMove={readOnly ? undefined : onCanvasPointerMove}
          onPointerUp={readOnly ? undefined : onCanvasPointerUp}
          onPointerCancel={readOnly ? undefined : onCanvasPointerCancel}
          onAuxClick={(e) => e.preventDefault()}
        >
          {/* Background + grid */}
          <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} className="fp-paper" />
          <Grid width={model.widthM} height={model.depthM} step={gridM} strokeWidth={m(1)} />

          <PlanDrawing
            model={model}
            plan={plan}
            t={t}
            pxPerM={pxPerM}
            terrace={terrace}
            terraceRect={terraceRect}
            idPrefix="fp-canvas"
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            selectedOpeningId={selectedOpeningId}
            onRoomPointerDown={readOnly ? undefined : onRoomPointerDown}
            onWallPointerDown={readOnly ? undefined : onWallPointerDown}
            onOpeningPointerDown={readOnly ? undefined : onOpeningPointerDown}
            roomCursor={readOnly ? undefined : roomCursor}
            wallCursor={readOnly ? undefined : wallCursor}
            openingCursor={readOnly ? undefined : openingCursor}
            textOr={textOr}
          />

          {/* Selected dimensions */}
          <g role="group" aria-label={textOr('planner.aria.dimensions', 'selected-dimensions')} pointerEvents="none">
            {!readOnly && selectedRoom && (
              <MeasureTag x={selectedRoom.x + selectedRoom.w / 2} y={selectedRoom.y + m(16)} text={fmtSizeCm(selectedRoom.w, selectedRoom.h)} m={m} />
            )}
            {!readOnly && selectedWall && selectedWall.kind === 'interior' && !selectedWall.locked && (
              <MeasureTag
                x={(selectedWall.a.x + selectedWall.b.x) / 2}
                y={(selectedWall.a.y + selectedWall.b.y) / 2 - m(14)}
                text={fmtLenCm(wallGeom(selectedWall).len)}
                m={m}
              />
            )}
          </g>

          {/* Collision feedback (room move/resize) */}
          {collision && (
            <rect
              x={collision.x}
              y={collision.y}
              width={collision.w}
              height={collision.h}
              className="fp-collision"
              strokeWidth={m(2)}
              strokeDasharray={`${m(6)} ${m(4)}`}
              pointerEvents="none"
            />
          )}

          {/* Room resize handles (selected room) */}
          {!readOnly && tool === 'select' && selectedRoom && !selectedRoom.locked && (
            <g aria-label={textOr('planner.aria.resizeHandles', 'room-resize-handles')}>
              {(() => {
                const r = selectedRoom
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
                      if (tool !== 'select' || e.button === 1) return
                      e.stopPropagation()
                      onSelectRoom(r.id)
                      startDrag(e, {
                        mode: 'resizeRoom',
                        roomId: r.id,
                        handle: h.key,
                        startRaw: svgWorldPoint(e),
                        plan0: clonePlan(plan),
                        room0: { x: r.x, y: r.y, w: r.w, h: r.h },
                        lastValid: { x: r.x, y: r.y, w: r.w, h: r.h },
                        didMove: false,
                        historyPushed: false,
                      })
                    }}
                    style={{ cursor: h.cursor }}
                  >
                    {/* Hit area */}
                    <rect x={h.x - hit / 2} y={h.y - hit / 2} width={hit} height={hit} fill="transparent" />
                    {/* Visible handle */}
                    <rect x={h.x - hs / 2} y={h.y - hs / 2} width={hs} height={hs} rx={m(2)} className="fp-handle" strokeWidth={m(2)} />
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
                const overlaps = roomOverlapsAny(plan.rooms, cand)
                return (
                  <rect
                    x={dragPreview.x}
                    y={dragPreview.y}
                    width={dragPreview.w}
                    height={dragPreview.h}
                    className={overlaps ? 'fp-collision' : 'fp-preview'}
                    strokeWidth={m(2)}
                    strokeDasharray={`${m(6)} ${m(4)}`}
                  />
                )
              })()}
              <MeasureTag x={dragPreview.x + dragPreview.w / 2} y={dragPreview.y - m(14)} text={dragPreview.label} m={m} />
            </g>
          )}
          {dragPreview && dragPreview.type === 'wall' && (
            <g pointerEvents="none">
              <line
                x1={dragPreview.a.x}
                y1={dragPreview.a.y}
                x2={dragPreview.b.x}
                y2={dragPreview.b.y}
                className="fp-preview-wall"
                strokeWidth={m(3)}
                strokeDasharray={`${m(6)} ${m(4)}`}
                strokeLinecap="round"
              />
              <MeasureTag x={(dragPreview.a.x + dragPreview.b.x) / 2} y={(dragPreview.a.y + dragPreview.b.y) / 2 - m(14)} text={dragPreview.label} m={m} />
            </g>
          )}
        </svg>
      </div>

      {!readOnly && (
        <p className="fp-hint">
          <span className="fp-hint-tool">{toolTip}</span>
          <span>{canvasCaptured ? ed('hintCaptured') : ed('hintIdle')}</span>
        </p>
      )}
    </div>
  )
}

// -------------------------- Subcomponents ------------------------------------
function Grid({ width, height, step, strokeWidth }) {
  if (step <= 0) return null
  // Fine lines every step, a stronger one every metre, inside the footprint only.
  const lines = []
  const every = Math.max(1, Math.round(1 / step))
  let i = 0
  for (let x = 0; x <= width + 1e-6; x += step, i++) {
    lines.push(<line key={`vx-${i}`} x1={x} y1={0} x2={x} y2={height} className={i % every === 0 ? 'fp-grid-major' : 'fp-grid-minor'} strokeWidth={strokeWidth} />)
  }
  i = 0
  for (let y = 0; y <= height + 1e-6; y += step, i++) {
    lines.push(<line key={`hy-${i}`} x1={0} y1={y} x2={width} y2={y} className={i % every === 0 ? 'fp-grid-major' : 'fp-grid-minor'} strokeWidth={strokeWidth} />)
  }
  return <g aria-hidden="true" pointerEvents="none">{lines}</g>
}

// A small dark tag with a size in it, centred on (x, y).
function MeasureTag({ x, y, text, m }) {
  const fs = m(11)
  const w = text.length * fs * 0.6 + m(12)
  const h = m(20)
  return (
    <g transform={`translate(${x}, ${y})`} className="fp-measure">
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={m(5)} />
      <text x={0} y={fs * 0.36} textAnchor="middle" fontSize={fs}>
        {text}
      </text>
    </g>
  )
}
