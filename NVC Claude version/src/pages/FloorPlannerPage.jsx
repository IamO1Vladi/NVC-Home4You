import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../style/HomePage.css'
import '../style/ProductPage.css'
import '../style/FloorPlanner.css'
import '../style/PlannerPage.css'
import PlannerEditor, { EDITOR_MIN_WIDTH_PX, useWideEnough } from '../components/planner/PlannerEditor.jsx'
import PlannerHero from '../components/planner/PlannerHero.jsx'
import PlannerHowItWorks from '../components/planner/PlannerHowItWorks.jsx'
import PlannerTemplates, {
  BOX_MODELS,
  PlanDrawing,
  fill,
  fmtList,
  fmtNumber,
  namedSummary,
  roomLabels,
  templatePlan,
} from '../components/planner/PlannerTemplates.jsx'
import { buildPlannerPrefill } from '../components/planner/plannerOffer.js'
import { usePlannerText } from '../components/planner/plannerText.js'
import FinalCta from '../components/FinalCta.jsx'
import SiblingLinks from '../components/product/SiblingLinks.jsx'
import { paths } from '../routes/paths.js'
import { useModalActions } from '../context/ModalActions.jsx'
import { writeConfiguratorPrefill } from '../lib/configPrefill.js'
import { trackEvent } from '../lib/analytics.js'
import { STORAGE_KEY, buildPlanShareUrl, decodePlanShare, migratePlan, withResolvedRoomNames } from '../lib/floorPlan.js'
import {
  PLANNER_MODELS,
  PLAN_TEMPLATES,
  catalogueKeyFor,
  getPlannerModel,
  templateDisplayName,
  templateLayout,
  terraceOptionsFor,
} from '../content/shared/plannerModels.js'

/**
 * The floor planner page: /bg/planirane-na-razpredelenie, /en/floor-planner, /el/sxediasmos-katopsis.
 *
 * Built on the home and product pages' system (<main class="hp pp fp">, HomePage.css then
 * ProductPage.css, then PlannerPage.css for the fpp-* parts), top to bottom:
 *   1. the hero, with the Box house unfolding in 3D (PlannerHero);
 *   2. the catalogue's own layouts for the size picked, drawn from the template data
 *      (PlannerTemplates) — "Отвори в планера" loads one into the editor below;
 *   3. the editor (PlannerEditor), from 900px only. Under that it is not mounted at all — the
 *      owner's decision (2026-10-15): no editing on phones — and an honest card says where it
 *      works, next to the way a phone visitor can still send a plan (the template preview);
 *      a plan's link (#plan=, the one every planner offer carries) is shown there read-only;
 *   4. how it works in four steps, 5. the closing contact card (FinalCta).
 *
 * What the page owns, and the editor does not: which model the visitor is on (remembered
 * across visits), the size tab and the 3D house that follow it, the template (or blank
 * plan) waiting to be loaded, and the offer for a template sent from a phone. The editor
 * sends its own plan (its "Your project" card) and keeps the offer form's message current
 * while it is on the page.
 *
 * The models are the catalogue's (PLANNER_MODELS): the Box houses at their catalogue sizes
 * with the bathroom where the brochure's drawings put it. Plans saved under the old sizes are
 * clamped into the new footprint by normalizePlan; the keys b37/b57/b73 did not change.
 */

// Where the editor appears: PlannerEditor's own EDITOR_MIN_WIDTH_PX, so the two never differ.
export const EDITOR_QUERY = `(min-width: ${EDITOR_MIN_WIDTH_PX}px)`
// The model last worked on, so a returning visitor lands on their own plan.
export const MODEL_PREF_KEY = `${STORAGE_KEY}.model`
const DEFAULT_MODEL_KEY = 'b57'

function readModelPref() {
  try {
    const key = localStorage.getItem(MODEL_PREF_KEY)
    if (key && getPlannerModel(key)) return key
  } catch {}
  return DEFAULT_MODEL_KEY
}

function scrollToSection(id) {
  const el = typeof document !== 'undefined' ? document.getElementById(id) : null
  if (!el) return
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}

// After React has painted the section the visitor is sent to (the editor re-renders first).
const afterPaint = (fn) =>
  typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame(fn) : setTimeout(fn, 0)

const boxKeyForCatalogue = (catKey) => BOX_MODELS.find((m) => m.catalogueKey === catKey)?.key || null

// A layout with nothing of the visitor's in it: what "Празен план" loads. The model adds
// its own fixed parts (a Box house's bathroom and doors) when the editor normalizes it.
const blankLayout = (modelKey) => ({
  kind: 'floorplanner-layout',
  version: 1,
  modelKey,
  plan: { rooms: [], walls: [], openings: [] },
})

/**
 * The plan in the page's #plan= link, ready to draw read-only (a phone has no editor to
 * open it in), or null: { model, plan, rooms, terraceRect, template }. Fitted onto today's
 * model exactly as the editor would load it.
 */
function readSharedPlan(text, locale) {
  if (typeof window === 'undefined') return null
  const shared = decodePlanShare(window.location.hash)
  const model = shared ? getPlannerModel(shared.modelKey) : null
  if (!model) return null
  const plan = migratePlan(model, withResolvedRoomNames(shared.plan)).plan
  const options = terraceOptionsFor(model.key, locale)
  const terrace = options.find((o) => o.key === shared.terrace) || options.find((o) => o.included) || null
  return { model, plan, rooms: namedSummary(model, plan, text).rooms, terraceRect: terrace?.rect || null, template: shared.template }
}

export default function FloorPlannerPage({ content, locale = 'bg' }) {
  const { openOffer } = useModalActions()
  const text = usePlannerText(content, locale)
  const wide = useWideEnough()

  const [modelKey, setModelKey] = useState(readModelPref)
  const [tab, setTab] = useState(() => (getPlannerModel(modelKey)?.kind === 'box' ? modelKey : DEFAULT_MODEL_KEY))
  // The 3D follows the size tab; on the containers tab it keeps the last Box house it showed.
  const [houseKey, setHouseKey] = useState(() => catalogueKeyFor(tab) || '58')
  const [pendingPlan, setPendingPlan] = useState(null)
  const [loadedTemplate, setLoadedTemplate] = useState(null) // { key, modelKey } or { blank: true, modelKey }
  // The editor's actions, for the closing card's "send" button (see renderHeader below).
  const editorApiRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(MODEL_PREF_KEY, modelKey)
    } catch {}
  }, [modelKey])

  // The copy's placeholders, from the data: how many catalogue layouts, and the Box sizes
  // ("37, 58 and 73" for what the catalogue has, "37, 58 or 73" for what a house is).
  const values = useMemo(() => {
    const count = PLAN_TEMPLATES.filter((t) => getPlannerModel(t.model)?.kind === 'box').length
    const sizes = BOX_MODELS.map((m) => String(m.area))
    return { count, areas: fmtList(sizes, locale), areasOr: fmtList(sizes, locale, 'disjunction') }
  }, [locale])

  const changeTab = useCallback((key) => {
    setTab(key)
    const cat = catalogueKeyFor(key)
    if (cat) setHouseKey(cat)
  }, [])

  const changeHouse = useCallback((cat) => {
    setHouseKey(cat)
    const key = boxKeyForCatalogue(cat)
    if (key) setTab(key)
  }, [])

  // The editor's own model picker, a layout file or a template moved the editor: the size tab
  // (and the 3D house) follow a Box house, so the page tells one story.
  const onModelKeyChange = useCallback((key) => {
    setModelKey(key)
    if (getPlannerModel(key)?.kind === 'box') changeTab(key)
  }, [changeTab])

  const openTemplate = useCallback((template) => {
    // A new object every time, so opening the same layout again reloads it.
    setPendingPlan(templateLayout(template))
    setLoadedTemplate({ key: template.key, modelKey: template.model })
    // To the line that confirms the load rather than the section's heading: the heading
    // and its intro scroll off, and the loaded plan and its project card fill the screen.
    afterPaint(() => scrollToSection('fpp-loaded'))
  }, [])

  // "Празен план": a blank plan for the model on screen, loaded the way a template is, so
  // it is one undo step and the planner's Undo brings the visitor's earlier plan back.
  const startBlank = useCallback(() => {
    setPendingPlan(blankLayout(modelKey))
    setLoadedTemplate({ blank: true, modelKey })
    afterPaint(() => scrollToSection('editor'))
  }, [modelKey])

  const onPendingPlanApplied = useCallback((ok) => {
    setPendingPlan(null)
    if (!ok) setLoadedTemplate(null)
  }, [])

  // The offer form reads its message from the prefill store (src/lib/configPrefill.js), for
  // the page that wrote it. On a phone the editor is not there to keep it current, so the page
  // writes it: a template's plan, or nothing at all for a plain offer, so an earlier plan's
  // text never rides along by accident.
  const openOfferWith = useCallback((prefill) => {
    writeConfiguratorPrefill(
      prefill || {
        source: 'floor-planner',
        sourcePath: typeof window !== 'undefined' ? window.location.pathname : '',
        modelLabel: '',
        knownTotal: 0,
        offerText: '',
        questionText: '',
        updatedAt: Date.now(),
      }
    )
    openOffer?.()
  }, [openOffer])

  // A catalogue layout sent from its phone preview: the same text, share link and analytics
  // as the editor's own "send", built by the editor's helpers from the template's summary.
  const sendTemplate = useCallback((template, summary) => {
    const model = getPlannerModel(template.model)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
    const shareUrl = buildPlanShareUrl(
      { modelKey: model.key, plan: templatePlan(template), template: template.key, terrace: summary.terrace?.key || null },
      { origin, pathname }
    )
    trackEvent('planner_offer', {
      model_key: model.key,
      template: template.key,
      rooms: summary.rooms.length,
      total_m2: summary.totalRoomsM2,
    })
    openOfferWith(buildPlannerPrefill({ summary, model, t: text, sourcePath: pathname, shareUrl }))
  }, [text, openOfferWith])

  // A plan's link opened where the editor is not offered (a salesperson reading a lead on a
  // phone, say): the plan is drawn read-only above the card that explains why. From 900px
  // the editor opens the link itself.
  const sharedPlan = useMemo(() => (wide ? null : readSharedPlan(text, locale)), [wide, text, locale])
  useEffect(() => {
    if (sharedPlan) afterPaint(() => scrollToSection('fpp-shared'))
  }, [Boolean(sharedPlan)]) // eslint-disable-line react-hooks/exhaustive-deps

  const editorCopy = content?.editor || {}
  const loadedNotice = (() => {
    const copy = content?.templates || {}
    if (!loadedTemplate || loadedTemplate.modelKey !== modelKey) return ''
    if (loadedTemplate.blank) return copy.loadedBlank || ''
    // a catalogue layout by its key; a container shell by its name, never its internal key
    const { name, catalogue } = templateDisplayName(loadedTemplate.key, locale)
    if (catalogue) return copy.loaded ? fill(copy.loaded, { key: name }) : ''
    return fill(copy.loadedShell || copy.loaded || '', { name, key: name })
  })()

  return (
    <main className="hp pp fp">
      <PlannerHero
        content={content}
        locale={locale}
        values={values}
        model={houseKey}
        onModelChange={changeHouse}
        onGo={scrollToSection}
        wide={wide}
        onBlank={startBlank}
        onOffer={() => openOfferWith(null)}
      />

      <PlannerTemplates
        content={content}
        locale={locale}
        tab={tab}
        onTabChange={changeTab}
        canEdit={wide}
        onOpen={openTemplate}
        onSend={sendTemplate}
      />

      <section id="editor" className="fpp-editor" aria-labelledby="fpp-editor-title">
        <div className="hp-container">
          <div className="hp-head">
            <div>
              {editorCopy.eyebrow ? <span className="hp-eyebrow">{editorCopy.eyebrow}</span> : null}
              <h2 id="fpp-editor-title">{wide ? editorCopy.title : editorCopy.phoneTitle}</h2>
              {wide && editorCopy.sub ? <p className="hp-sub">{editorCopy.sub}</p> : null}
            </div>
          </div>

          {wide ? (
            <>
              <p id="fpp-loaded" className="fpp-loaded" role="status">{loadedNotice}</p>
              <div className="fp-page fpp-editor-host">
                <PlannerEditor
                  content={content}
                  locale={locale}
                  models={PLANNER_MODELS}
                  modelKey={modelKey}
                  onModelKeyChange={onModelKeyChange}
                  pendingPlan={pendingPlan}
                  onPendingPlanApplied={onPendingPlanApplied}
                  onShowTemplates={() => scrollToSection('templates')}
                  // Nothing is drawn above the editor; the hook only hands the page the
                  // editor's actions, so the closing card can send the plan on the screen.
                  renderHeader={(api) => {
                    editorApiRef.current = api
                    return null
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {sharedPlan ? <SharedPlan shared={sharedPlan} content={content} text={text} locale={locale} /> : null}
              <div className="hp-card fpp-phone-card">
                <p>{editorCopy.phoneText}</p>
                <div className="hp-cta-row">
                  <a
                    className="hp-btn ghost"
                    href="#templates"
                    onClick={(ev) => {
                      ev.preventDefault()
                      scrollToSection('templates')
                    }}
                  >
                    {editorCopy.phoneTemplates}
                  </a>
                  <button type="button" className="hp-btn" onClick={() => openOfferWith(null)}>
                    {editorCopy.phoneOffer}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <PlannerHowItWorks content={content} values={values} wide={wide} />

      {/* On from the plan: the Box houses page (sizes, prices, delivery, warranty) and the
          configurator, which prices the house the plan is for. Real links, in the markup. */}
      <SiblingLinks
        id="fpp-siblings"
        heading={content?.siblings?.heading}
        go={content?.siblings?.go}
        items={[
          { to: paths.modularHouses[locale] || paths.modularHouses.en, ...content?.siblings?.houses },
          { to: paths.boxConfigurator[locale] || paths.boxConfigurator.en, ...content?.siblings?.configurator },
        ]}
      />

      <FinalCta
        locale={locale}
        title={content?.finalCta?.title}
        desc={content?.finalCta?.desc}
        onPrimary={() => (wide && editorApiRef.current?.sendForOffer ? editorApiRef.current.sendForOffer() : openOfferWith(null))}
      />
    </main>
  )
}

// The plan from a #plan= link, read-only: the template preview's drawing and room list.
function SharedPlan({ shared, content, text, locale }) {
  const copy = content?.templates || {}
  const editorCopy = content?.editor || {}
  const { model, plan, rooms, terraceRect, template } = shared
  const title = template
    ? `${text.modelLabel(model)} · ${templateDisplayName(template, locale).name}`
    : text.modelLabel(model)
  return (
    <div id="fpp-shared" className="hp-card fpp-shared" role="region" aria-labelledby="fpp-shared-title">
      <h3 id="fpp-shared-title">{editorCopy.sharedTitle}</h3>
      <p>{editorCopy.sharedText}</p>
      <div className="fpp-preview-plan">
        <PlanDrawing
          model={model}
          plan={plan}
          terrace={terraceRect ? { rect: terraceRect } : null}
          detailed
          title={title}
          labels={roomLabels(rooms, locale)}
        />
      </div>
      <ul className="fpp-rooms">
        {rooms.map((r) => (
          <li key={r.id}>
            <span className={`fpp-swatch fpp-swatch--${r.type}`} aria-hidden="true" />
            <span className="fpp-rooms-name">{r.locked && copy.bathFixed ? copy.bathFixed : r.name}</span>
            <span className="fpp-rooms-area">{fill(copy.approx, { area: fmtNumber(r.areaM2, locale) })}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
