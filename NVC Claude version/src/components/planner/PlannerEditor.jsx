import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { MODELS, buildPlanShareUrl, decodePlanShare, isContainerShell, parseLayout, planSummary } from '../../lib/floorPlan.js'
import { writeConfiguratorPrefill } from '../../lib/configPrefill.js'
import { trackEvent } from '../../lib/analytics.js'
import { useModalActions } from '../../context/ModalActions.jsx'
import HelpDialog from './HelpDialog.jsx'
import PlannerCanvas from './PlannerCanvas.jsx'
import PrintSheet from './PrintSheet.jsx'
import ProjectCard from './ProjectCard.jsx'
import ToolRail from './ToolRail.jsx'
import { buildPlannerPrefill } from './plannerOffer.js'
import { usePlannerText } from './plannerText.js'
import { usePlannerState } from './usePlannerState.js'

// The editor needs a pointer and room for three columns. Below this width it shows
// the plan and the project card only (the owner's call: no editing on phones).
export const EDITOR_MIN_WIDTH_PX = 900

/**
 * Whether the screen is wide enough for the editor (EDITOR_MIN_WIDTH_PX), read before the
 * first paint; without matchMedia (tests, very old browsers) it is. While printing it does
 * not change: the browser lays the page out at paper width, and switching to the narrow
 * layout then would take the editor -- and the print sheet in it -- off the page. The
 * planner page uses the same hook to decide whether to mount the editor at all.
 */
export function useWideEnough() {
  const query = `(min-width: ${EDITOR_MIN_WIDTH_PX}px)`
  const read = () => (typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? true : window.matchMedia(query).matches)
  const [wide, setWide] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(query)
    // Printing lays the page out at paper width; the editor (and the print sheet in
    // it) must not switch to the phone layout halfway through.
    const on = () => {
      if (window.matchMedia('print').matches) return
      setWide(mq.matches)
    }
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return wide
}

/**
 * The whole floor-planning tool with its own state: a tool rail on the left, the
 * plan in the middle, "Your project" on the right (from 900 px); below that, the
 * plan read-only and the project card under it.
 *
 * Props
 * - content: the page's floorPlanner content (src/content/{bg,en,el}/floorPlanner.js).
 * - locale: 'bg' | 'en' | 'el'. Picks the editor's own copy (editorContent.js) and the
 *   number format; guessed from `content` when left out.
 * - models: the models on offer (default MODELS, the catalogue's — src/lib/floorPlan.js).
 * - modelKey / onModelKeyChange: the current model. Leave modelKey undefined to let
 *   the editor keep it; onModelKeyChange is still called when a layout file or a
 *   template switches the model.
 * - terraceKey / onTerraceChange: the terrace option of a Box house ('standard',
 *   'extended', 'long-58', 'long-73'); uncontrolled when terraceKey is undefined.
 * - pendingPlan: a layout to load, { modelKey, template?, plan: { rooms, walls, openings } }
 *   (see parseLayout; templateLayout() makes one). Applied once per object, as one
 *   undo step; then onPendingPlanApplied(ok) is called, so the shell can clear it.
 * - onSummaryChange(summary): on mount and whenever any of it changes. Summary:
 *   { modelKey, widthM, depthM, footprintM2, rooms: [{ id, type, name, label, locked,
 *   areaM2, parts, kitchen }], totalRoomsM2, bedrooms, doors, windows, template,
 *   templateEdited, terrace: { key, label, price, included } | null }. An open space
 *   split into rectangles is ONE room (parts lists them).
 * - onShowTemplates: optional; the empty plan then offers a button that calls it
 *   (the page scrolls to its catalogue layouts).
 * - renderHeader(api): optional; rendered before the editor, with its actions.
 */
export default function PlannerEditor({
  content,
  locale,
  models = MODELS,
  modelKey,
  onModelKeyChange,
  terraceKey,
  onTerraceChange,
  pendingPlan,
  onPendingPlanApplied,
  onSummaryChange,
  onShowTemplates,
  renderHeader,
}) {
  const text = usePlannerText(content, locale)
  const s = usePlannerState({
    models,
    modelKey,
    onModelKeyChange,
    terraceKey,
    onTerraceChange,
    locale: text.locale,
    onLoadError: () => notifyRef.current?.('loadError'),
  })
  const notifyRef = useRef(s.notify)
  notifyRef.current = s.notify

  // A container as it arrives is one undivided space: the whole unit, never "Дневна".
  // Named here, once, so the plan label, the room list, the offer text and the print
  // sheet all say what the phone preview says (isContainerShell, templates.containerRoom).
  const shell = isContainerShell(s.model, s.plan)
  const t = useMemo(
    () => (shell ? { ...text, groupName: (g) => g.primary?.label || text.textOr('templates.containerRoom', text.groupName(g)) } : text),
    [text, shell],
  )
  const wide = useWideEnough()
  const { openOffer } = useModalActions()

  // A template arrives as a new object; StrictMode's double effects and re-renders
  // must not load it twice (that would leave a second, empty undo step).
  const appliedPendingRef = useRef(null)
  useEffect(() => {
    if (!pendingPlan || appliedPendingRef.current === pendingPlan) return
    appliedPendingRef.current = pendingPlan
    const layout = parseLayout(pendingPlan, s.models, s.modelKey)
    if (layout) {
      s.applyLayout({ ...layout, template: typeof pendingPlan.template === 'string' ? pendingPlan.template : null })
      trackEvent('planner_template', { template: pendingPlan.template || '', model_key: layout.modelKey })
    }
    onPendingPlanApplied?.(Boolean(layout))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlan])

  // A shared link (#plan=…, the one in an offer) opens that plan once, then the hash
  // is dropped so a reload keeps the visitor's later edits instead of reloading it.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const shared = decodePlanShare(window.location.hash)
    if (!shared || !s.models.some((m) => m.key === shared.modelKey)) return
    s.applyLayout({ modelKey: shared.modelKey, plan: shared.plan, template: shared.template })
    // named explicitly: the switch to the link's model has not re-rendered yet
    if (shared.terrace) s.setTerraceKey(shared.terrace, shared.modelKey)
    s.notify('linkLoaded')
    try {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => {
    const base = planSummary(s.model, s.plan)
    const byId = new Map(s.plan.rooms.map((r) => [r.id, r]))
    const name = (r) => {
      const parts = r.parts.map((id) => byId.get(id)).filter(Boolean)
      const primary = parts.find((p) => p.label) || parts.find((p) => p.type === r.type) || parts[0]
      return t.groupName({ primary, type: r.type, kitchen: r.kitchen })
    }
    return {
      ...base,
      rooms: base.rooms.map((r) => ({ ...r, name: name(r) })),
      template: s.loadedTemplate?.key || null,
      templateEdited: Boolean(s.loadedTemplate?.edited),
      terrace: s.terrace
        ? { key: s.terrace.key, label: s.terrace.label, price: s.terrace.price, included: s.terrace.included }
        : null,
    }
  }, [s.model, s.plan, s.loadedTemplate?.key, s.loadedTemplate?.edited, s.terrace, t])

  // Only a real change reaches the shell: the plan object is rebuilt on every edit,
  // most of which (a door's swing, a finish) leave the summary as it was.
  const onSummaryChangeRef = useRef(onSummaryChange)
  onSummaryChangeRef.current = onSummaryChange
  const summaryKey = JSON.stringify(summary)
  useEffect(() => {
    onSummaryChangeRef.current?.(summary)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey])

  // The offer form's prefill, kept current like the configurator's: the site
  // header's "Request an offer" on this page then carries the plan too.
  const makePrefill = useCallback(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
    const shareUrl = buildPlanShareUrl(
      { modelKey: s.modelKey, plan: s.plan, template: summary.template, terrace: summary.terrace?.key || null },
      { origin, pathname }
    )
    return buildPlannerPrefill({ summary, model: s.model, t, sourcePath: pathname, shareUrl })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey, s.plan, s.model, t])

  useEffect(() => {
    const id = window.setTimeout(() => writeConfiguratorPrefill(makePrefill()), 300)
    return () => window.clearTimeout(id)
  }, [makePrefill])

  const sendForOffer = () => {
    writeConfiguratorPrefill(makePrefill())
    trackEvent('planner_offer', {
      model_key: s.modelKey,
      template: summary.template || '',
      rooms: summary.rooms.length,
      total_m2: summary.totalRoomsM2,
    })
    openOffer?.()
  }

  // The print sheet is in the document only while printing, so the page's
  // snapshot and screen readers never meet a second copy of the plan.
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true))
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
  const exportPdf = () => {
    flushSync(() => setPrinting(true))
    window.print()
  }
  const s2 = { ...s, exportPdf }

  const api = {
    model: s.model,
    modelKey: s.modelKey,
    plan: s.plan,
    summary,
    canUndo: s.canUndo,
    canRedo: s.canRedo,
    undo: s.undo,
    redo: s.redo,
    // The side panel is always shown now; kept so an older shell still renders.
    panelOpen: true,
    togglePanel: () => {},
    downloadLayout: s.downloadLayout,
    loadLayoutFile: s.loadLayoutFile,
    clearUserItems: s.clearUserItems,
    exportPdf,
    sendForOffer,
    openHelp: () => s.setHelpOpen(true),
    snapGridOn: s.snapGridOn,
    snapAlignOn: s.snapAlignOn,
    multiPlace: s.multiPlace,
    text: t,
  }

  return (
    <>
      {renderHeader?.(api)}
      <div
        ref={s.rootRef}
        className={`fp-grid ${wide ? 'is-wide' : 'is-narrow'}`}
        onPointerDownCapture={(e) => {
          // A click anywhere in the editor hands it the keyboard; only the plan
          // itself takes the wheel (PlannerCanvas).
          if (wide && !e.target.closest?.('input, select, textarea')) s.setActive(true)
        }}
      >
        {wide && <ToolRail s={s2} t={t} />}
        <PlannerCanvas s={s2} t={t} readOnly={!wide} onShowTemplates={onShowTemplates} />
        <ProjectCard s={s2} t={t} summary={summary} onOffer={sendForOffer} readOnly={!wide} />
        {!wide && (
          <p className="fp-phone-note">
            <strong>{t.ed('phoneTitle')}</strong> {t.ed('phoneBody')}
          </p>
        )}
      </div>
      <HelpDialog open={s.helpOpen} onClose={() => s.setHelpOpen(false)} t={t} />
      {printing && <PrintSheet s={s2} t={t} summary={summary} />}
    </>
  )
}
