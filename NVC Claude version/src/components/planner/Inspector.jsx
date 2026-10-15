import React from 'react'
import {
  FINISHES,
  FIXED_BATHROOM_DOOR_ID,
  FIXED_FRONT_DOOR_ID,
  ROOM_TYPES,
  isDefaultRoomName,
  openingSpaces,
  roomGroups,
  wallGeom,
} from '../../lib/floorPlan.js'
import PlannerIcon from './PlannerIcons.jsx'

/**
 * The selected room, wall or door/window: its size, and for anything not locked
 * its name, type, floor finish, door swing/hinge and Delete. A locked item says
 * why it cannot change. Renders nothing while nothing is selected.
 * `s` is usePlannerState's result, `t` usePlannerText's.
 */
export default function Inspector({ s, t }) {
  const { model, plan, selectedRoom, selectedWall, selectedOpening, updatePlan, deleteSelected, flipOpeningSwing, flipOpeningHinge } = s
  const { ed, textOr, roomTypeLabel, finishLabel, roomName, groupName, fmtSizeCm, fmtLenCm, fmtM2, toolLabel } = t

  if (!selectedRoom && !selectedOpening && !selectedWall) return null

  const typeT = textOr('planner.type', 'Type')
  const deleteT = textOr('planner.delete', 'Delete')

  // A rectangle of an open space is edited as that space: its name is the space's.
  const group = selectedRoom ? roomGroups(plan.rooms).find((g) => g.ids.includes(selectedRoom.id)) : null
  const groupIds = group?.ids || (selectedRoom ? [selectedRoom.id] : [])
  const nameOwner = group?.primary || selectedRoom

  return (
    <div role="region" className="fp-card fp-inspector" aria-label={ed('inspector.title')}>
      <div className="fp-card-eyebrow">{ed('inspector.title')}</div>

      {selectedRoom && (
        <div className="fp-ins">
          <div className="fp-ins-title">
            <span className={`fp-dot fp-dot--${selectedRoom.type}`} aria-hidden="true" />
            <strong>{group ? groupName(group) : roomName(selectedRoom)}</strong>
            {selectedRoom.locked && <PlannerIcon name="lock" className="fp-ins-lock" />}
          </div>
          <dl className="fp-facts">
            <div>
              <dt>{ed('inspector.size')}</dt>
              <dd>{fmtSizeCm(selectedRoom.w, selectedRoom.h)}</dd>
            </div>
            <div>
              <dt>{ed('inspector.area')}</dt>
              <dd>{fmtM2(group ? group.areaM2 : selectedRoom.w * selectedRoom.h)}</dd>
            </div>
          </dl>

          {selectedRoom.locked ? (
            <p className="fp-ins-note">{ed('inspector.lockedBath')}</p>
          ) : (
            <>
              <label className="fp-label" htmlFor="fp-ins-name">
                {textOr('planner.name', 'Name')}
              </label>
              <input
                id="fp-ins-name"
                className="fp-input"
                // A room with no stored name shows its type's name, as the field always did.
                value={nameOwner.label ?? (group ? groupName(group) : roomTypeLabel(selectedRoom.type))}
                placeholder={roomTypeLabel(selectedRoom.type)}
                onChange={(e) => {
                  const label = e.target.value
                  updatePlan(
                    (p) => ({
                      ...p,
                      rooms: p.rooms.map((r) => (groupIds.includes(r.id) ? { ...r, label } : r)),
                    }),
                    { mergeKey: `roomLabel:${selectedRoom.id}` }
                  )
                }}
              />

              <label className="fp-label" htmlFor="fp-ins-type">
                {typeT}
              </label>
              <div className="fp-select">
                <select
                  id="fp-ins-type"
                  aria-label={typeT}
                  value={selectedRoom.type}
                  onChange={(e) => {
                    const nextType = e.target.value
                    updatePlan((p) => ({
                      ...p,
                      rooms: p.rooms.map((r) => {
                        if (r.id !== selectedRoom.id) return r
                        // A typed name survives the type change; a default one (in any
                        // language) gives way to the new type's name.
                        return {
                          ...r,
                          type: nextType,
                          label: isDefaultRoomName(r.type, r.label) ? null : r.label,
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

              <label className="fp-label" htmlFor="fp-ins-finish">
                {textOr('planner.floorFinish', 'Floor finish')}
              </label>
              <div className="fp-select">
                <select
                  id="fp-ins-finish"
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

              <div className="fp-ins-actions">
                <button type="button" className="fp-btn ghost small danger-text" onClick={deleteSelected}>
                  <PlannerIcon name="trash" />
                  {deleteT}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {selectedWall && (
        <div className="fp-ins">
          <div className="fp-ins-title">
            <strong>{toolLabel('wall')}</strong>
          </div>
          <dl className="fp-facts">
            <div>
              <dt>{ed('inspector.wallLength')}</dt>
              <dd>{fmtLenCm(wallGeom(selectedWall).len)}</dd>
            </div>
          </dl>
          {selectedWall.kind === 'interior' && !selectedWall.locked && (
            <div className="fp-ins-actions">
              <button type="button" className="fp-btn ghost small danger-text" onClick={deleteSelected}>
                <PlannerIcon name="trash" />
                {deleteT}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedOpening && (
        <div className="fp-ins">
          <div className="fp-ins-title">
            <strong>
              {selectedOpening.id === FIXED_FRONT_DOOR_ID
                ? ed('inspector.frontDoor')
                : selectedOpening.id === FIXED_BATHROOM_DOOR_ID
                  ? ed('inspector.bathDoor')
                  : toolLabel(selectedOpening.kind === 'door' ? 'door' : 'window')}
            </strong>
            {selectedOpening.locked && <PlannerIcon name="lock" className="fp-ins-lock" />}
          </div>
          <dl className="fp-facts">
            <div>
              <dt>{ed('inspector.size')}</dt>
              <dd>{fmtLenCm(selectedOpening.widthM || 0)}</dd>
            </div>
          </dl>

          {selectedOpening.kind === 'door' && (
            <p className="fp-ins-between">
              {(() => {
                const { pos, neg } = openingSpaces(model, plan, selectedOpening)
                const outside = textOr('planner.outside', 'Outside')
                return `${pos ? roomName(pos) : outside} ↔ ${neg ? roomName(neg) : outside}`
              })()}
            </p>
          )}

          {selectedOpening.locked && <p className="fp-ins-note">{ed('inspector.lockedDoor')}</p>}

          {!selectedOpening.locked && (
            <div className="fp-ins-actions">
              {selectedOpening.kind === 'door' && (
                <>
                  <button type="button" className="fp-btn ghost small" onClick={flipOpeningSwing}>
                    {textOr('planner.flipSwing', 'Flip swing')}
                  </button>
                  <button type="button" className="fp-btn ghost small" onClick={flipOpeningHinge}>
                    {textOr('planner.flipHinge', 'Flip hinge')}
                  </button>
                </>
              )}
              <button type="button" className="fp-btn ghost small danger-text" onClick={deleteSelected}>
                <PlannerIcon name="trash" />
                {deleteT}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
