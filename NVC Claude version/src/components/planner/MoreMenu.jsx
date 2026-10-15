import React, { useEffect, useRef, useState } from 'react'
import PlannerIcon from './PlannerIcons.jsx'

/**
 * "More": the things a visitor needs now and then, out of the main view — save
 * and open a layout file, clear the plan (after a confirm), the grid step, the two
 * snapping switches and multi-place. A popover; Esc or a click outside closes it.
 * `s` is usePlannerState's result, `t` usePlannerText's.
 */
export default function MoreMenu({ s, t }) {
  const { ed, textOr, unitM, fmtNum } = t
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef(null)
  const fileInputRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) setConfirming(false)
  }, [open])

  const onLayoutFileChange = (ev) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    s.loadLayoutFile(file)
    setOpen(false)
  }

  return (
    <div className="fp-more" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`fp-iconbtn${open ? ' is-on' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={ed('more')}
        title={ed('more')}
        onClick={() => setOpen((v) => !v)}
      >
        <PlannerIcon name="more" />
      </button>

      {/* Outside the popover so it survives the menu closing while the file dialog is up. */}
      <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={onLayoutFileChange} hidden />

      {open && (
        <div className="fp-menu" role="group" aria-label={ed('more')}>
          <button type="button" className="fp-menu-item" onClick={() => { s.downloadLayout(); setOpen(false) }}>
            <PlannerIcon name="save" />
            {ed('saveFile')}
          </button>
          <button type="button" className="fp-menu-item" onClick={() => fileInputRef.current?.click()}>
            <PlannerIcon name="open" />
            {ed('openFile')}
          </button>

          {confirming ? (
            <div className="fp-confirm" role="alertdialog" aria-label={ed('clear')}>
              <p>{ed('clearConfirm')}</p>
              <div className="fp-confirm-row">
                <button
                  type="button"
                  className="fp-btn danger small"
                  onClick={() => {
                    s.clearUserItems()
                    setOpen(false)
                  }}
                >
                  {ed('clearYes')}
                </button>
                <button type="button" className="fp-btn ghost small" onClick={() => setConfirming(false)}>
                  {ed('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="fp-menu-item is-danger" onClick={() => setConfirming(true)}>
              <PlannerIcon name="trash" />
              {ed('clear')}
            </button>
          )}

          <div className="fp-menu-sep" />

          <div className="fp-menu-h" id="fp-grid-h">
            {ed('gridSize')}
          </div>
          <div className="fp-seg" role="radiogroup" aria-labelledby="fp-grid-h">
            {[0.05, 0.1, 0.2].map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={s.gridM === g}
                className={`fp-seg-btn${s.gridM === g ? ' is-on' : ''}`}
                onClick={() => s.setGridM(g)}
              >
                {fmtNum(g)} {unitM}
              </button>
            ))}
          </div>

          <div className="fp-menu-h">{ed('snapping')}</div>
          <label className="fp-check">
            <input type="checkbox" checked={s.snapGridOn} onChange={(e) => s.setSnapGridOn(e.target.checked)} />
            <span>{textOr('planner.snapGrid', 'Grid snap')}</span>
          </label>
          <label className="fp-check">
            <input type="checkbox" checked={s.snapAlignOn} onChange={(e) => s.setSnapAlignOn(e.target.checked)} />
            <span>{textOr('planner.snapAlign', 'Wall / room snap')}</span>
          </label>
          <label className="fp-check">
            <input type="checkbox" checked={s.multiPlace} onChange={(e) => s.setMultiPlace(e.target.checked)} />
            <span>{textOr('planner.multiPlace', 'Multi-place')}</span>
          </label>
          <p className="fp-menu-note">{textOr('planner.snapHint', 'ALT = temporarily disable snapping · SHIFT = constrain axis while moving rooms')}</p>
        </div>
      )}
    </div>
  )
}
