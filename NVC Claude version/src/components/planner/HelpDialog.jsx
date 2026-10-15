import React, { useEffect, useRef } from 'react'
import PlannerIcon from './PlannerIcons.jsx'
import { TOOL_KEYS } from './ToolRail.jsx'

/**
 * The "?" dialog: how each tool works and the keyboard shortcuts — what the old
 * always-open legend said, one click away instead of in front of the plan. The
 * how-to lines and key rows are the content files' (planner.legend*, planner.key*);
 * the lines the old legend did not have are the editor's own.
 *
 * A plain modal: focus moves to Close on open and back to the opener on close,
 * Esc and a click on the backdrop close it, Tab stays inside.
 */
export default function HelpDialog({ open, onClose, t }) {
  const { ed, textOr, toolLabel } = t
  const closeRef = useRef(null)
  const dialogRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    openerRef.current = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      openerRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  const howTo = [
    [toolLabel('room'), textOr('planner.legendRoom', 'Drag to create a room. Rooms cannot overlap.')],
    [toolLabel('wall'), textOr('planner.legendWall', 'Drag to draw an interior wall segment (auto axis-aligned). Doors snap to any wall; windows snap to exterior walls only.')],
    [textOr('planner.openings', 'Doors & windows'), textOr('planner.legendOpenings', 'Click to place. Switch to Select to drag along a wall.')],
    [toolLabel('select'), textOr('planner.legendSelect', 'Click an element to inspect it. Drag rooms to move them. Drag doors and windows to reposition them.')],
    [toolLabel('erase'), ed('helpErase')],
    [textOr('planner.zoom', 'Zoom'), ed('helpNav')],
  ]

  const keys = [
    [TOOL_KEYS.select, textOr('planner.keyV', 'Select tool')],
    [TOOL_KEYS.room, textOr('planner.keyR', 'Room tool')],
    [TOOL_KEYS.wall, textOr('planner.keyW', 'Wall tool')],
    [TOOL_KEYS.door, textOr('planner.keyD', 'Door tool')],
    [TOOL_KEYS.window, textOr('planner.keyN', 'Window tool')],
    [TOOL_KEYS.erase, ed('keyE')],
    ['Delete', ed('keyDelete')],
    ['Ctrl/⌘ + Z / Y', ed('keyUndo')],
    ['← ↑ → ↓', ed('keyArrows')],
    ['ALT', textOr('planner.keyAlt', 'Disable snapping while dragging')],
    ['SHIFT', textOr('planner.keyShift', 'Constrain axis while moving rooms')],
    [ed('keySpaceName'), ed('keySpace')],
    ['ESC', textOr('planner.keyEsc', 'Release canvas capture (click the canvas to capture again)')],
    ['?', ed('keyHelp')],
  ]

  return (
    <div className="fp-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fp-dialog" role="dialog" aria-modal="true" aria-labelledby="fp-help-title" ref={dialogRef}>
        <div className="fp-dialog-head">
          <h3 id="fp-help-title">{ed('helpTitle')}</h3>
          <button ref={closeRef} type="button" className="fp-iconbtn" onClick={onClose} aria-label={ed('close')}>
            <PlannerIcon name="close" />
          </button>
        </div>
        <div className="fp-dialog-body">
          <dl className="fp-howto">
            {howTo.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="fp-howto-locked">
            <PlannerIcon name="lock" />
            {ed('helpLocked')}
          </p>
          <h4 className="fp-keys-h">{ed('helpShortcuts')}</h4>
          <dl className="fp-keys">
            {keys.map(([k, v]) => (
              <div key={k}>
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
