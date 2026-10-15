import React from 'react'
import { roomGroups } from '../../lib/floorPlan.js'
import { templateDisplayName } from '../../content/shared/plannerModels.js'
import Inspector from './Inspector.jsx'
import PlannerIcon from './PlannerIcons.jsx'

/**
 * The right-hand column: the selection's inspector (when there is one) above
 * "Your project" — the model and its footprint, every room with its m², the
 * total, the terrace, and the two ways out: send it for an offer, print it.
 *
 * `summary` is the editor's summary (see PlannerEditor), `onOffer` opens the
 * offer form with the plan in it. `s` is usePlannerState's, `t` usePlannerText's.
 */
export default function ProjectCard({ s, t, summary, onOffer, readOnly = false }) {
  const { models, model, modelKey, setModelKey, plan, selectedRoomId, onSelectRoom, loadedTemplate, terraceOptions, terrace, setTerraceKey } = s
  const { ed, textOr, modelLabel, groupName, fmtM2, fmtOutside, fmtPrice, locale } = t
  const modelT = textOr('planner.model', 'Model')
  const groups = roomGroups(plan.rooms)

  return (
    <aside className="fp-side">
      {!readOnly && <Inspector s={s} t={t} />}

      <div role="region" className="fp-card fp-project" aria-labelledby="fp-project-h">
        <h3 className="fp-card-eyebrow" id="fp-project-h">
          {ed('project.eyebrow')}
        </h3>

        <label className="fp-label" htmlFor="fp-model">
          {modelT}
        </label>
        <div className="fp-select">
          <select id="fp-model" aria-label={modelT} value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
            {models.map((m) => (
              <option key={m.key} value={m.key}>
                {modelLabel(m)}
              </option>
            ))}
          </select>
        </div>

        <dl className="fp-facts fp-facts--model">
          <div>
            <dt>{ed('project.outside')}</dt>
            <dd>{fmtOutside(model.widthM, model.depthM)}</dd>
          </div>
          <div>
            <dt>{ed('project.area')}</dt>
            <dd>{fmtM2(summary.footprintM2)}</dd>
          </div>
        </dl>
        {/* A Box house is named by its catalogue area, which is not the outline's own
            (58 m² against 9,00 × 6,26 м = 56,34 м²): say which is which, so the two
            numbers side by side do not read as a mistake. */}
        {model.kind === 'box' && <p className="fp-muted fp-facts-note">{ed('project.areaNote')}</p>}

        {loadedTemplate && (
          <p className="fp-template-line">
            {(() => {
              // a catalogue layout by its key (A1); a container shell by its name, never
              // its internal key, and not as a catalogue layout
              const { name, catalogue } = templateDisplayName(loadedTemplate.key, locale)
              return catalogue ? ed('project.template', { key: name }) : ed('project.templateShell', { name })
            })()}
            {loadedTemplate.edited ? <span> · {ed('project.edited')}</span> : null}
          </p>
        )}

        {terraceOptions.length > 0 && (
          <>
            <label className="fp-label" htmlFor="fp-terrace">
              {ed('project.terrace')}
            </label>
            <div className="fp-select">
              <select id="fp-terrace" value={terrace?.key || ''} onChange={(e) => setTerraceKey(e.target.value)}>
                {terraceOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {terrace && (
              <p className="fp-terrace-cost">
                {terrace.included ? ed('project.included') : ed('project.surcharge', { price: fmtPrice(terrace.price) })}
              </p>
            )}
          </>
        )}

        <div className="fp-rooms-h">
          <span>{ed('project.rooms')}</span>
          <span className="fp-muted">{groups.length}</span>
        </div>
        {groups.length ? (
          <ul className="fp-rooms">
            {groups.map((g) => {
              const on = g.ids.includes(selectedRoomId)
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    className={`fp-room-row${on ? ' is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() => onSelectRoom(g.primary.id)}
                    disabled={readOnly}
                  >
                    <span className={`fp-dot fp-dot--${g.type}`} aria-hidden="true" />
                    <span className="fp-room-name">
                      {groupName(g)}
                      {g.locked && (
                        <span className="fp-room-fixed">
                          <PlannerIcon name="lock" />
                          {ed('project.fixed')}
                        </span>
                      )}
                    </span>
                    <span className="fp-room-area">{fmtM2(g.areaM2)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="fp-muted fp-rooms-empty">{ed('project.noRooms')}</p>
        )}

        <div className="fp-total">
          <span>{ed('project.roomsTotal')}</span>
          <strong>{fmtM2(summary.totalRoomsM2)}</strong>
        </div>
        <p className="fp-counts">
          {ed('project.bedrooms')}: {summary.bedrooms} · {ed('project.doors')}: {summary.doors} · {ed('project.windows')}: {summary.windows}
        </p>

        <div className="fp-cta">
          <button type="button" className="fp-btn fp-btn--wide" onClick={onOffer}>
            <PlannerIcon name="send" />
            {ed('project.offer')}
          </button>
          <p className="fp-cta-hint">{ed('project.offerHint')}</p>
          {!readOnly && (
            <button type="button" className="fp-btn ghost fp-btn--wide" onClick={s.exportPdf}>
              <PlannerIcon name="print" />
              {ed('project.print')}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
