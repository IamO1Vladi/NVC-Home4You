import React from 'react'
import { ROOM_TYPES } from '../../lib/floorPlan.js'
import MoreMenu from './MoreMenu.jsx'
import PlannerIcon from './PlannerIcons.jsx'

// The tools, in the order a visitor reaches for them. Pan is no longer a tool:
// Space + drag or the middle button moves the view (see PlannerCanvas).
export const TOOLS = ['select', 'room', 'wall', 'door', 'window', 'erase']

// The key that picks each tool, shown on its button and in the help.
export const TOOL_KEYS = { select: 'V', room: 'R', wall: 'W', door: 'D', window: 'N', erase: 'E' }

/**
 * The left rail: tools (icon + name), the type a new room gets (colour chips),
 * undo/redo, zoom and the "More" menu, and the help button.
 * `s` is usePlannerState's result, `t` usePlannerText's.
 */
export default function ToolRail({ s, t }) {
  const { tool, setTool, roomType, setRoomType } = s
  const { ed, textOr, toolLabel, roomTypeLabel } = t

  return (
    <aside className="fp-rail" aria-label={ed('tools')}>
      <div className="fp-rail-group">
        <div className="fp-rail-h">{ed('tools')}</div>
        <div className="fp-tools notranslate" translate="no" role="toolbar" aria-label={ed('tools')}>
          {TOOLS.map((k) => (
            <button
              key={k}
              type="button"
              className={`fp-tool${tool === k ? ' is-on' : ''}`}
              aria-pressed={tool === k}
              title={`${toolLabel(k)} (${TOOL_KEYS[k]})`}
              onClick={() => setTool(k)}
            >
              <PlannerIcon name={k} />
              <span className="fp-tool-label">{toolLabel(k)}</span>
              <kbd className="fp-tool-key" aria-hidden="true">
                {TOOL_KEYS[k]}
              </kbd>
            </button>
          ))}
        </div>
      </div>

      <div className="fp-rail-group">
        <div className="fp-rail-h" id="fp-roomtypes-h">
          {ed('roomTypesTitle')}
        </div>
        <div className="fp-chips" role="radiogroup" aria-labelledby="fp-roomtypes-h">
          {ROOM_TYPES.map((rt) => (
            <button
              key={rt.key}
              type="button"
              role="radio"
              aria-checked={roomType === rt.key}
              className={`fp-chip${roomType === rt.key ? ' is-on' : ''}`}
              onClick={() => {
                setRoomType(rt.key)
                // Picking a room type means "the next room I draw": arm the Room tool.
                setTool('room')
              }}
            >
              <span className={`fp-dot fp-dot--${rt.key}`} aria-hidden="true" />
              {roomTypeLabel(rt.key)}
            </button>
          ))}
        </div>
      </div>

      <div className="fp-rail-group fp-rail-actions">
        <div className="fp-iconrow">
          <button
            type="button"
            className="fp-iconbtn"
            onClick={s.undo}
            disabled={!s.canUndo}
            aria-label={textOr('planner.undo', 'Undo')}
            title={`${textOr('planner.undo', 'Undo')} (Ctrl/⌘+Z)`}
          >
            <PlannerIcon name="undo" />
          </button>
          <button
            type="button"
            className="fp-iconbtn"
            onClick={s.redo}
            disabled={!s.canRedo}
            aria-label={textOr('planner.redo', 'Redo')}
            title={textOr('planner.redoShortcut', 'Ctrl/⌘+Y or Ctrl/⌘+Shift+Z')}
          >
            <PlannerIcon name="redo" />
          </button>
        </div>
        <div className="fp-iconrow">
          <button type="button" className="fp-iconbtn" onClick={() => s.zoomBtn('out')} aria-label={ed('zoomOut')} title={ed('zoomOut')}>
            <PlannerIcon name="zoomOut" />
          </button>
          <button type="button" className="fp-iconbtn" onClick={() => s.zoomBtn('in')} aria-label={ed('zoomIn')} title={ed('zoomIn')}>
            <PlannerIcon name="zoomIn" />
          </button>
          <button type="button" className="fp-iconbtn" onClick={s.resetView} aria-label={ed('fit')} title={ed('fit')}>
            <PlannerIcon name="fit" />
          </button>
        </div>
        <div className="fp-iconrow">
          <MoreMenu s={s} t={t} />
          <button
            type="button"
            className="fp-iconbtn"
            onClick={() => s.setHelpOpen(true)}
            aria-label={ed('help')}
            title={`${ed('help')} (?)`}
            aria-haspopup="dialog"
          >
            <PlannerIcon name="help" />
          </button>
        </div>
      </div>
    </aside>
  )
}
