// The gallery's route modal: a model opened from the gallery index, over the list (the URL is
// the model's own; a direct load of it is the full page). Redesigned 2026-10-17 on the product
// pages' system: a sheet in the theme's surface colour (it was #0f1115 in both themes, as the
// --bg it asked for is defined nowhere, under grey see-through panels), a head with the close
// button that never sits on the photo, a body that scrolls, and a footer with the actions, so
// "request an offer" is always in view. Full screen on a phone.
//
// A dialog by the book: labelled by the model's h2 (the index keeps its H1), focus moves to
// that heading when it opens, Tab stays inside it, Esc and a click on the backdrop close it,
// and the item page hands focus back to the card it was opened from.
import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import { lockScroll } from '../lib/scrollLock.js'
import { CloseIcon, trapTab } from '../gallery/GalleryItemView.jsx'

/**
 * @param labelledBy the id of the heading the dialog is named by
 * @param head       what the head shows beside the close button (the category chip)
 * @param footer     the actions, kept in view under the scrolling body
 * @param resetKey   a new model in the same modal (a similar model opened from it): the body
 *                   goes back to its top and focus to its heading
 */
export default function GalleryModal({ open, onClose, children, closeLabel, labelledBy, head, footer, resetKey }) {
  const cardRef = useRef(null)
  const bodyRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      // The full-screen photo view, on top, handles its own keys first.
      if (e.defaultPrevented) return
      if (e.key === 'Escape') closeRef.current?.()
      else if (e.key === 'Tab') trapTab(e, cardRef.current)
    }
    document.addEventListener('keydown', onKey)
    // Shared and counted: "request an offer" opens the offer form BEFORE this modal closes,
    // and this cleanup used to unlock the page behind that form. See scrollLock.js.
    const unlockScroll = lockScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockScroll()
    }
  }, [open])

  // Into the dialog: its heading (announced as the model's name), or the sheet itself while
  // the model loads. Again for a new model in the same modal, which also starts at its top.
  useEffect(() => {
    if (!open) return
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    const target = cardRef.current?.querySelector('[data-autofocus]') || cardRef.current
    target?.focus?.({ preventScroll: true })
  }, [open, resetKey])

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="gmodal-portal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
          <m.div className="gmodal-backdrop" onClick={() => closeRef.current?.()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <m.div
            ref={cardRef}
            tabIndex={-1}
            className="gmodal-card hp pp"
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="gmodal-head">
              <div className="gmodal-head-main">{head}</div>
              <button type="button" className="gmodal-close" aria-label={closeLabel} onClick={() => closeRef.current?.()}>
                <CloseIcon />
              </button>
            </div>
            <div className="gmodal-body" ref={bodyRef}>{children}</div>
            {footer ? <div className="gmodal-foot">{footer}</div> : null}
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
