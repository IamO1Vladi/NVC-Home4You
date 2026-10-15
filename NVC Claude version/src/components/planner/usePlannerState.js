import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  HISTORY_LIMIT,
  LEGACY_STORAGE_KEYS,
  MODELS,
  STORAGE_KEY,
  clampViewBox,
  clonePlan,
  fitViewBox,
  makeDefaultPlan,
  migratePlan,
  migrateStoredPlans,
  normalizePlan,
  parseLayout,
  rectsOverlap,
  sameFootprint,
  stampFootprint,
  withResolvedRoomNames,
  zoomViewBox,
} from '../../lib/floorPlan.js'
import { terraceOptionsFor } from '../../content/shared/plannerModels.js'

// Small UI preferences, each in its own key next to the plans.
const PREF_KEYS = {
  multiPlace: 'floorplanner.v4.multiPlace',
  snapGrid: 'floorplanner.v4.snapGrid',
  snapAlign: 'floorplanner.v4.snapAlign',
  terrace: 'floorplanner.v4.terrace',
}

// Every preference defaults to on; only an explicit '0' turns it off. Storage can
// throw (private mode, blocked site data), and then the default stands.
function readPref(key) {
  try {
    return localStorage.getItem(key) !== '0'
  } catch {
    return true
  }
}

function writePref(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {}
}

function readJsonPref(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

// The plans as stored, fitted onto today's models (see migrateStoredPlans): a plan
// drawn on a Box house's old footprint is clipped to the catalogue's, and the
// notices say which models changed under the visitor's rooms.
function readStoredPlans(models) {
  try {
    const raw = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].map((k) => localStorage.getItem(k)).find(Boolean)
    if (!raw) return { plans: {}, notices: [] }
    return migrateStoredPlans(JSON.parse(raw), models)
  } catch {
    return { plans: {}, notices: [] }
  }
}

// What a template looked like when it was loaded, to tell "B2" from "B2, changed".
const planFingerprint = (plan) =>
  JSON.stringify({
    r: (plan?.rooms || []).filter((r) => !r.locked).map((r) => [r.id, r.type, r.label, r.x, r.y, r.w, r.h]),
    w: (plan?.walls || []).filter((w) => w.kind === 'interior').map((w) => [w.a, w.b]),
    o: (plan?.openings || []).filter((o) => !o.locked).map((o) => [o.id, o.kind, o.host?.wallId, o.host?.at, o.hinge, o.openTo]),
  })

/**
 * Where the terrace option is drawn, in plan metres. A front deck starts at the
 * wings' front face, CORE_OVERHANG inside the planner's one-rectangle footprint, so
 * only the part beyond the footprint is drawn; its outer edge is where the real one is.
 */
export function terraceDrawRect(model, option) {
  const r = option?.rect
  if (!r) return null
  if (option.side === 'front') {
    const y = Math.max(r.y, model.depthM)
    return { x: r.x, y, w: r.w, h: r.y + r.h - y }
  }
  return { ...r }
}

/**
 * All of the planner's state: the plans per model (persisted), undo/redo per
 * model (in memory), the active tool and its defaults, the selection, the view
 * box and canvas capture, the terrace, the toasts — and the actions that change them.
 *
 * The model can be controlled (`modelKey` + `onModelKeyChange`) or left to the
 * hook (`modelKey` undefined); either way a loaded layout that names another
 * model switches to it through `onModelKeyChange`.
 *
 * Capture: the page scrolls as usual until the visitor clicks into the editor.
 * Then the keyboard shortcuts work (`active`); a click on the plan itself also
 * lets the wheel zoom (`canvasCaptured`). Esc, or a click outside the editor,
 * gives both back to the page. Ctrl/⌘ + wheel zooms at any time.
 */
export function usePlannerState({
  models = MODELS,
  modelKey: controlledModelKey,
  onModelKeyChange,
  terraceKey: controlledTerraceKey,
  onTerraceChange,
  onLoadError,
  locale = 'en',
} = {}) {
  const [ownModelKey, setOwnModelKey] = useState(() => controlledModelKey ?? models[0]?.key)
  const isControlled = controlledModelKey !== undefined
  const modelKey = isControlled ? controlledModelKey : ownModelKey

  const onModelKeyChangeRef = useRef(onModelKeyChange)
  onModelKeyChangeRef.current = onModelKeyChange
  const isControlledRef = useRef(isControlled)
  isControlledRef.current = isControlled
  const setModelKey = useCallback((key) => {
    if (!isControlledRef.current) setOwnModelKey(key)
    onModelKeyChangeRef.current?.(key)
  }, [])

  const [tool, setTool] = useState('select') // select | room | wall | door | window | erase
  const [roomType, setRoomType] = useState('living')
  const [finish, setFinish] = useState('wood')
  const [gridM, setGridM] = useState(0.1)

  // Snapping
  // - Grid snapping controls how pointer positions quantize to the grid.
  // - Align snapping controls wall/room alignment snapping (room move/resize).
  const [snapGridOn, setSnapGridOn] = useState(() => readPref(PREF_KEYS.snapGrid))
  const [snapAlignOn, setSnapAlignOn] = useState(() => readPref(PREF_KEYS.snapAlign))

  // Undo/redo (per-model, in-memory)
  const historyRef = useRef({}) // { [modelKey]: { undo: Plan[], redo: Plan[] } }
  const [, setHistoryTick] = useState(0)

  // Collision feedback (room move/resize)
  const [collision, setCollision] = useState(null) // { roomId, x,y,w,h }

  // Multi-place: keep the current creation tool active after each placement
  const [multiPlace, setMultiPlace] = useState(() => readPref(PREF_KEYS.multiPlace))

  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [selectedWallId, setSelectedWallId] = useState(null)
  const [selectedOpeningId, setSelectedOpeningId] = useState(null)

  // Capture (see above). Both start released: the page must scroll past the plan.
  const [active, setActive] = useState(false)
  const [canvasCaptured, setCanvasCaptured] = useState(false)
  const rootRef = useRef(null)
  // Space held: the next drag on the plan moves the view.
  const panHeldRef = useRef(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // A refused action says why: { key, n } — n makes the same message show again.
  const [toast, setToast] = useState(null)
  const notify = useCallback((key) => setToast((t) => ({ key, n: (t?.n || 0) + 1 })), [])
  useEffect(() => {
    if (!toast) return undefined
    const id = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(id)
  }, [toast])

  const [stored] = useState(() => readStoredPlans(models))
  const [byModel, setByModel] = useState(stored.plans)
  const [notices, setNotices] = useState(stored.notices)
  const dismissNotices = () => setNotices([])

  // The catalogue layout each model's plan was loaded from, if any.
  const [templates, setTemplates] = useState({}) // { [modelKey]: { key, fingerprint } }

  // Persist small UI prefs
  useEffect(() => writePref(PREF_KEYS.multiPlace, multiPlace), [multiPlace])
  useEffect(() => writePref(PREF_KEYS.snapGrid, snapGridOn), [snapGridOn])
  useEffect(() => writePref(PREF_KEYS.snapAlign, snapAlignOn), [snapAlignOn])

  const model = useMemo(() => models.find((m) => m.key === modelKey) || models[0], [models, modelKey])
  const plan = useMemo(() => {
    const p = byModel[modelKey] || makeDefaultPlan(model)
    return normalizePlan(model, p)
  }, [byModel, modelKey, model])

  // ---------- terrace ----------
  const terraceOptions = useMemo(() => terraceOptionsFor(model.key, locale), [model.key, locale])
  const [ownTerraces, setOwnTerraces] = useState(() => readJsonPref(PREF_KEYS.terrace))
  const isTerraceControlled = controlledTerraceKey !== undefined
  const wantedTerrace = isTerraceControlled ? controlledTerraceKey : ownTerraces[model.key]
  const terrace =
    terraceOptions.find((o) => o.key === wantedTerrace) || terraceOptions.find((o) => o.included) || terraceOptions[0] || null
  const onTerraceChangeRef = useRef(onTerraceChange)
  onTerraceChangeRef.current = onTerraceChange
  // `forModelKey` names the model the choice belongs to when it is not the one on screen
  // yet: a shared link switches the model and sets its terrace in one go, before the
  // switch has re-rendered, and the terrace must not land on the model being left.
  const setTerraceKey = useCallback(
    (key, forModelKey) => {
      if (!isTerraceControlled) {
        setOwnTerraces((prev) => {
          const next = { ...prev, [forModelKey || model.key]: key }
          try {
            localStorage.setItem(PREF_KEYS.terrace, JSON.stringify(next))
          } catch {}
          return next
        })
      }
      onTerraceChangeRef.current?.(key)
    },
    [isTerraceControlled, model.key]
  )
  const terraceRect = terrace ? terraceDrawRect(model, terrace) : null

  // Debounced persistence (prevents spamming localStorage during drag operations).
  // Each plan carries the footprint it was drawn on, for the next migration.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const out = {}
        for (const [key, p] of Object.entries(byModel)) {
          const m = models.find((x) => x.key === key)
          out[key] = m ? stampFootprint(m, p) : p
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(out))
      } catch {}
    }, 220)
    return () => window.clearTimeout(id)
  }, [byModel, models])

  // ---------- ViewBox (zoom/pan) ----------
  const fitView = () => fitViewBox(model, terraceRect ? [terraceRect] : [])
  const [viewBox, setViewBox] = useState(fitView)

  useEffect(() => {
    setByModel((prev) => {
      if (prev[modelKey]) return prev
      return { ...prev, [modelKey]: makeDefaultPlan(model) }
    })
    setViewBox(fitView())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelKey])

  // A terrace of another depth changes what "the whole plan" is.
  useEffect(() => {
    setViewBox(fitView())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrace?.key])

  useEffect(() => {
    setViewBox((vb) => clampViewBox(vb, model))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.widthM, model.depthM])

  const zoomBtn = (dir) => {
    const vb = viewBox
    const center = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 }
    setViewBox(zoomViewBox(vb, model, center, dir === 'in' ? 0.85 : 1.18))
  }

  const resetView = () => setViewBox(fitView())

  // ---------- undo/redo helpers ----------
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

  const pushCapped = (stack, p) => {
    stack.push(clonePlan(p))
    if (stack.length > HISTORY_LIMIT) stack.splice(0, stack.length - HISTORY_LIMIT)
  }

  const clearSelection = () => {
    setSelectedRoomId(null)
    setSelectedWallId(null)
    setSelectedOpeningId(null)
  }

  // Used by normal edit actions (push undo + clear redo)
  const pushUndoSnapshot = (snapshot) => {
    const h = ensureHistory(modelKey)
    pushCapped(h.undo, snapshot)
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
    pushCapped(h.redo, plan)

    noteHistoryChanged()
    setByModel((cur) => ({ ...cur, [modelKey]: normalizePlan(model, prev) }))
    clearSelection()
    setCollision(null)
  }

  const redo = () => {
    const h = ensureHistory(modelKey)
    if (!h.redo.length) return
    const next = h.redo.pop()

    // Break any ongoing merge session.
    h._merge = null

    // Current -> undo (do NOT clear redo here)
    pushCapped(h.undo, plan)

    noteHistoryChanged()
    setByModel((cur) => ({ ...cur, [modelKey]: normalizePlan(model, next) }))
    clearSelection()
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
              pushCapped(h.undo, normCur)
              h._merge = { key: mergeKey, t: now }
            }
          } else {
            pushCapped(h.undo, normCur)
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

  // ---------- derived selections ----------
  const selectedRoom = plan.rooms.find((r) => r.id === selectedRoomId) || null
  const selectedWall = plan.walls.find((w) => w.id === selectedWallId) || null
  const selectedOpening = plan.openings.find((o) => o.id === selectedOpeningId) || null

  // ---------- removing things (Delete, the Erase tool, the inspector) ----------
  // A refusal is said out loud: the locked bathroom and doors, outer walls, and the
  // walls a room makes (those go with the room).
  const removeRoom = (id) => {
    const r = plan.rooms.find((x) => x.id === id)
    if (!r) return false
    if (r.locked) {
      notify('locked')
      return false
    }
    updatePlan((p) => ({ ...p, rooms: p.rooms.filter((x) => x.id !== id) }))
    if (selectedRoomId === id) setSelectedRoomId(null)
    return true
  }
  const removeOpening = (id) => {
    const o = plan.openings.find((x) => x.id === id)
    if (!o) return false
    if (o.locked) {
      notify('lockedDoor')
      return false
    }
    updatePlan((p) => ({ ...p, openings: p.openings.filter((x) => x.id !== id) }))
    if (selectedOpeningId === id) setSelectedOpeningId(null)
    return true
  }
  const removeWall = (id) => {
    const w = plan.walls.find((x) => x.id === id)
    if (!w) return false
    if (w.kind === 'outer') {
      notify('outerWall')
      return false
    }
    if (w.locked || w.kind !== 'interior') {
      notify('roomEdge')
      return false
    }
    updatePlan((p) => {
      const openings = p.openings.filter((o) => !(o.host?.type === 'wall' && o.host.wallId === id))
      return { ...p, walls: p.walls.filter((x) => x.id !== id), openings }
    })
    if (selectedWallId === id) setSelectedWallId(null)
    return true
  }

  const deleteSelected = () => {
    if (selectedOpening) return removeOpening(selectedOpening.id)
    if (selectedWall) return removeWall(selectedWall.id)
    if (selectedRoom) return removeRoom(selectedRoom.id)
    return false
  }

  // Arrow keys move the selected room one grid step, under the same no-overlap rule.
  const nudgeSelected = (dx, dy) => {
    const r = selectedRoom
    if (!r) return
    if (r.locked) {
      notify('locked')
      return
    }
    const x = Math.min(Math.max(r.x + dx, 0), model.widthM - r.w)
    const y = Math.min(Math.max(r.y + dy, 0), model.depthM - r.h)
    const cand = { x, y, w: r.w, h: r.h }
    const hit = plan.rooms.find((o) => o.id !== r.id && rectsOverlap(cand, o))
    if (hit) {
      notify(hit.locked ? 'overlapBath' : 'overlap')
      return
    }
    updatePlan((p) => ({ ...p, rooms: p.rooms.map((o) => (o.id === r.id ? { ...o, x, y } : o)) }), {
      mergeKey: `nudge:${r.id}`,
      mergeWindowMs: 900,
    })
  }

  // ---------- capture ----------
  const release = useCallback(() => {
    setActive(false)
    setCanvasCaptured(false)
    panHeldRef.current = false
  }, [])

  // A click anywhere outside the editor gives the keyboard and wheel back.
  useEffect(() => {
    if (!active) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) release()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [active, release])

  // ---------- keyboard (only while the editor is active) ----------
  useEffect(() => {
    const onKey = (e) => {
      if (!active || helpOpen) return
      const tag = document.activeElement?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return

      if (e.key === 'Escape') {
        e.preventDefault()
        clearSelection()
        release()
        return
      }

      // Undo / redo
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
        return
      }

      if (e.key === ' ' || e.code === 'Space') {
        // On a focused button, link or switch Space is the key that presses it: leave it
        // to the browser, or Help, Send for an offer and the tools stop answering to it.
        const focused = document.activeElement
        if (
          focused?.closest?.(
            'button, a[href], summary, [role="button"], [role="menuitem"], [role="menuitemcheckbox"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"]'
          )
        ) {
          return
        }
        // Held, it turns the next drag into a pan; it must not scroll the page meanwhile.
        e.preventDefault()
        panHeldRef.current = true
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setHelpOpen(true)
        return
      }

      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      if (arrows[e.key] && selectedRoom) {
        e.preventDefault()
        const step = gridM * (e.shiftKey ? 10 : 1)
        nudgeSelected(arrows[e.key][0] * step, arrows[e.key][1] * step)
        return
      }

      // Tool shortcuts (no modifiers)
      if (!e.altKey) {
        const k = (e.key || '').toLowerCase()
        const shortcut = { v: 'select', r: 'room', w: 'wall', d: 'door', n: 'window', e: 'erase' }[k]
        if (shortcut) {
          e.preventDefault()
          setTool(shortcut)
          return
        }
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      e.preventDefault()
      deleteSelected()
    }
    const onKeyUp = (e) => {
      if (e.key === ' ' || e.code === 'Space') panHeldRef.current = false
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, helpOpen, selectedRoomId, selectedWallId, selectedOpeningId, plan, gridM, undo, redo])

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

  // Selecting anything from the list or the plan switches to the Select tool.
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

  // ---------- save / load ----------
  // The page prints the sheet the editor puts in the document (PrintSheet); the
  // browser's own Print does the same.
  const exportPdf = () => window.print()

  const downloadLayout = () => {
    const payload = {
      kind: 'floorplanner-layout',
      version: 1,
      savedAt: new Date().toISOString(),
      modelKey,
      ...(templates[modelKey]?.key ? { template: templates[modelKey].key } : {}),
      plan: stampFootprint(model, normalizePlan(model, plan)),
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

  // Replaces a model's plan with `layout` ({ modelKey, plan, template? }, from
  // parseLayout) and switches to that model. One undo step, so a loaded file or
  // template can be undone. The plan is fitted onto today's model first, so a file
  // saved on an old footprint loads what still fits rather than overlapping rooms; and
  // when that cut or dropped rooms, the visitor is told, as for a plan kept in storage.
  const applyLayout = (layout) => {
    const targetModelKey = layout.modelKey
    const targetModel = models.find((m) => m.key === targetModelKey) || model
    const prevTargetPlan = normalizePlan(targetModel, byModel[targetModelKey] || makeDefaultPlan(targetModel))
    const named = withResolvedRoomNames(layout.plan)
    const migrated = migratePlan(targetModel, named)
    const importedPlan = migrated.plan
    if (!sameFootprint(named?.footprint, targetModel) && (migrated.clipped || migrated.dropped)) {
      setNotices((prev) => [
        ...prev.filter((n) => n.modelKey !== targetModelKey),
        { modelKey: targetModelKey, clipped: migrated.clipped, dropped: migrated.dropped },
      ])
    }

    const h = ensureHistory(targetModelKey)
    pushCapped(h.undo, prevTargetPlan)
    h.redo.length = 0
    h._merge = null
    noteHistoryChanged()

    setByModel((prev) => ({ ...prev, [targetModelKey]: importedPlan }))
    setTemplates((prev) => ({
      ...prev,
      [targetModelKey]: typeof layout.template === 'string' && layout.template
        ? { key: layout.template, fingerprint: planFingerprint(importedPlan) }
        : null,
    }))
    setModelKey(targetModelKey)
    clearSelection()
    setCollision(null)
  }

  const loadLayoutFile = async (file) => {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const layout = parseLayout(parsed, models, modelKey)
      if (!layout) throw new Error('invalid-layout-file')
      applyLayout({ ...layout, template: typeof parsed?.template === 'string' ? parsed.template : null })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err)
      onLoadError?.(err)
    }
  }

  const clearUserItems = () => {
    updatePlan((p) => ({
      rooms: p.rooms.filter((r) => r.locked),
      walls: p.walls.filter((w) => w.locked && w.kind === 'outer'),
      openings: p.openings.filter((o) => o.locked),
    }))
    clearSelection()
  }

  // The template this model's plan came from, and whether it has been changed since.
  const userRoomCount = plan.rooms.filter((r) => !r.locked).length
  const loadedTemplate = templates[modelKey] && userRoomCount
    ? { key: templates[modelKey].key, edited: templates[modelKey].fingerprint !== planFingerprint(plan) }
    : null

  return {
    models,
    model,
    modelKey,
    setModelKey,
    plan,
    tool,
    setTool,
    roomType,
    setRoomType,
    finish,
    setFinish,
    gridM,
    setGridM,
    snapGridOn,
    setSnapGridOn,
    snapAlignOn,
    setSnapAlignOn,
    multiPlace,
    setMultiPlace,
    collision,
    setCollision,
    selectedRoomId,
    selectedWallId,
    selectedOpeningId,
    setSelectedRoomId,
    setSelectedWallId,
    setSelectedOpeningId,
    selectedRoom,
    selectedWall,
    selectedOpening,
    rootRef,
    active,
    setActive,
    canvasCaptured,
    setCanvasCaptured,
    release,
    panHeldRef,
    helpOpen,
    setHelpOpen,
    toast,
    notify,
    notices,
    dismissNotices,
    viewBox,
    setViewBox,
    zoomBtn,
    resetView,
    canUndo,
    canRedo,
    undo,
    redo,
    updatePlan,
    pushUndoSnapshot,
    flipOpeningSwing,
    flipOpeningHinge,
    deleteSelected,
    removeRoom,
    removeOpening,
    removeWall,
    onSelectRoom,
    onSelectWall,
    onSelectOpening,
    exportPdf,
    downloadLayout,
    applyLayout,
    loadLayoutFile,
    clearUserItems,
    loadedTemplate,
    userRoomCount,
    terraceOptions,
    terrace,
    terraceRect,
    setTerraceKey,
  }
}
