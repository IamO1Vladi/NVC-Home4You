import React from 'react'
import { createPortal } from 'react-dom'
import { fitViewBox } from '../../lib/floorPlan.js'
import { getHomeContent } from '../../content/home/index.js'
import PlanDrawing from './PlanDrawing.jsx'
import { templateDisplayName } from '../../content/shared/plannerModels.js'

const DATE_LOCALES = { bg: 'bg-BG', el: 'el-GR', en: 'en-GB' }

// The plan's print scale: the sheet's drawing area is about 170 mm wide, which the
// browser lays out at ~640 CSS px. Text and strokes are sized for that.
const PRINT_WIDTH_PX = 640
const PRINT_HEIGHT_PX = 620

/**
 * What "Print / PDF" (and the browser's own Print) puts on paper: a title block
 * with the model, footprint and date, the plan in black on white, the rooms with
 * their m², and NVC's contact line. It is a direct child of <body> (a portal) so
 * the print stylesheet can hide everything else on the page — header, footer, the
 * other sections — with one rule, and is display:none on screen.
 */
export default function PrintSheet({ s, t, summary }) {
  if (typeof document === 'undefined') return null
  const { model, plan, terrace, terraceRect, loadedTemplate } = s
  const { ed, modelLabel, fmtM2, fmtOutside, locale } = t
  const vb = fitViewBox(model, terraceRect ? [terraceRect] : [])
  const pxPerM = Math.min(PRINT_WIDTH_PX / vb.w, PRINT_HEIGHT_PX / vb.h)
  const contact = getHomeContent(locale)?.home?.finalCta || {}
  const site = getHomeContent(locale)?.home?.localBusiness?.url || ''
  const date = new Date().toLocaleDateString(DATE_LOCALES[locale] || 'en-GB')

  const facts = [
    [ed('print.model'), modelLabel(model)],
    [ed('print.outside'), fmtOutside(model.widthM, model.depthM)],
    [ed('print.area'), fmtM2(summary.footprintM2)],
    ...(loadedTemplate
      ? [[ed('print.template'), `${templateDisplayName(loadedTemplate.key, locale).name}${loadedTemplate.edited ? ` · ${ed('project.edited')}` : ''}`]]
      : []),
    ...(terrace ? [[ed('print.terrace'), terrace.label]] : []),
    [ed('print.date'), date],
  ]

  return createPortal(
    <div className="fp-print-root" aria-hidden="true">
      <header className="fp-print-head">
        <div>
          <div className="fp-print-brand">NVC Home4You</div>
          <h1 className="fp-print-title">{ed('print.title')}</h1>
        </div>
        <dl className="fp-print-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <svg
        className="fp-print-plan"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        width={Math.round(vb.w * pxPerM)}
        height={Math.round(vb.h * pxPerM)}
      >
        <PlanDrawing model={model} plan={plan} t={t} pxPerM={pxPerM} terrace={terrace} terraceRect={terraceRect} idPrefix="fp-print" />
      </svg>

      <table className="fp-print-rooms">
        <thead>
          <tr>
            <th scope="col">{ed('print.room')}</th>
            <th scope="col">{ed('print.roomArea')}</th>
          </tr>
        </thead>
        <tbody>
          {summary.rooms.map((r) => (
            <tr key={r.id}>
              <td>
                {r.name}
                {r.locked ? ` (${ed('project.fixed')})` : ''}
              </td>
              <td>{fmtM2(r.areaM2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{ed('print.total')}</th>
            <td>{fmtM2(summary.totalRoomsM2)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="fp-print-note">{ed('print.note')}</p>
      <footer className="fp-print-foot">
        NVC Home4You{contact.phone ? ` · ${contact.phone}` : ''}
        {contact.email ? ` · ${contact.email}` : ''}
        {site ? ` · ${site.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}
      </footer>
    </div>,
    document.body
  )
}
