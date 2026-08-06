import React from 'react'
import { createPortal } from 'react-dom'

// Dialog for the admin editors.
//
// The forms used to render inline above the list, which meant pressing "Edit" changed
// something below the fold with no indication anything had happened, and left the whole
// catalogue sitting under a tall form. A dialog makes editing a mode you are clearly in
// and clearly leave.
//
// Separate from the site's components/Modal.jsx on purpose: that one is sized for a short
// marketing form and hard-codes its own card styling and framer-motion. This one is a
// full-height editor shell — scrolling body, pinned header and footer, full-screen sheet on
// phones — and stays inside the admin's own styling like the rest of the panel.

const focusableSelector =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'

export default function AdminModal({ open, title, subtitle, onClose, closeLabel = 'Close', footer, children }) {
  const cardRef = React.useRef(null)
  const lastFocused = React.useRef(null)
  const titleId = React.useId()

  // Escape and tab-trapping. onClose is the page's, so it can ask about unsaved work.
  React.useEffect(() => {
    if (!open) return undefined

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.() }
      if (e.key !== 'Tab') return

      const nodes = Array.from(cardRef.current?.querySelectorAll(focusableSelector) ?? [])
        .filter((el) => el.offsetParent !== null)
      if (nodes.length === 0) return

      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Move focus in on open and put it back on close, so keyboard users are not dropped at
  // the top of the document when the dialog goes away.
  React.useEffect(() => {
    if (!open) return undefined

    lastFocused.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // The dialog itself, not its first control. The first control is the ✕, where a stray
    // Enter would close the editor; and focusing the first *field* instead pops the
    // keyboard open on a phone before anyone has decided to type. Tab goes where expected
    // from here either way.
    cardRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      // Only if it is still in the document. Saving reloads the list, which replaces the
      // row's Edit button, and focusing a detached node silently drops focus to <body>
      // instead of restoring it.
      const opener = lastFocused.current
      if (opener?.isConnected) opener.focus?.()
      else document.querySelector('.adm-head-actions button, .adm-page h1')?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="adm-modal-portal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="adm-modal-backdrop" onClick={onClose} />
      <div className="adm-modal" ref={cardRef} tabIndex={-1}>
        <header className="adm-modal-head">
          <div className="adm-modal-head-text">
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="adm-sub">{subtitle}</p> : null}
          </div>
          <button type="button" className="adm-modal-x" aria-label={closeLabel} onClick={onClose}>✕</button>
        </header>

        <div className="adm-modal-body">{children}</div>

        {footer ? <footer className="adm-modal-foot">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  )
}
