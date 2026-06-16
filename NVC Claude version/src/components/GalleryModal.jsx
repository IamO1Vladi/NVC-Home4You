import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { m, AnimatePresence } from 'framer-motion'
import DOMPurify from 'dompurify'

function sanitizeDescription(desc) {
  if (!desc) return ''
  const raw = String(desc)
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw)
  const html = looksLikeHtml ? raw : raw.replace(/\n/g, '<br/>')
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ['style'],
  })
}

export default function GalleryModal({ open, onClose, children, closeLabel }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="gmodal-portal" role="dialog" aria-modal="true">
          <m.div className="gmodal-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <m.div
            className="gmodal-card"
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="gmodal-close" aria-label={closeLabel} onClick={onClose}>✖</button>
            {children}
          </m.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function GalleryRichText({ description }) {
  const safeDescription = React.useMemo(() => sanitizeDescription(description), [description])
  if (!safeDescription) return null
  return <div className="gdetail-richtext" dangerouslySetInnerHTML={{ __html: safeDescription }} />
}
