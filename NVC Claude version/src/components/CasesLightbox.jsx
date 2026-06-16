import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { m } from 'framer-motion'
import { cdnImage, cdnSrcSet } from '../lib/img.js'

function fillPattern(pattern, values) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    String(pattern || ''),
  )
}

export default function CasesLightbox({
  title,
  images = [],
  index = 0,
  onClose,
  desc,
  content,
}) {
  const list = Array.isArray(images) && images.length ? images : ['']
  const [i, setI] = useState(Math.max(0, Math.min(index, list.length - 1)))

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'ArrowRight') setI((v) => (v + 1) % list.length)
      if (e.key === 'ArrowLeft') setI((v) => (v - 1 + list.length) % list.length)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [list.length, onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return createPortal(
    <div className="modal-portal">
      <m.div
        className="backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <m.div
        className="modal-card"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="close-x" aria-label={content.closeLabel} onClick={onClose}>✖</button>

        <h3>{title}</h3>

        <div className="card" style={{ overflow: 'hidden' }}>
          <img
            alt={fillPattern(content.imageAltPattern, { current: i + 1, total: list.length, title: title || '' })}
            src={cdnImage(list[i], { width: 1600 })}
            srcSet={cdnSrcSet(list[i], [800, 1200, 1600, 2000])}
            sizes="(max-width: 1100px) 100vw, 1000px"
            style={{ display: 'block', width: '100%', maxHeight: '60vh', objectFit: 'cover' }}
            loading="lazy"
            decoding="async"
          />
        </div>

        <div className="row mt-3" style={{ justifyContent: 'space-between' }}>
          <button className="btn ghost" onClick={() => setI((v) => (v - 1 + list.length) % list.length)}>{content.prevLabel}</button>
          <div />
          <button className="btn ghost" onClick={() => setI((v) => (v + 1) % list.length)}>{content.nextLabel}</button>
        </div>

        {desc ? (
          <div className="lb-meta">
            <div className="desc">
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{content.descriptionHeading}</div>
              <div className="lb-richtext" style={{ whiteSpace: 'pre-wrap' }}>{desc}</div>
            </div>
          </div>
        ) : null}

        <div className="grid cols-3 mt-3" aria-label={content.thumbnailsLabel}>
          {list.map((img, idx) => (
            <button className="tile" key={`${img}-${idx}`} onClick={() => setI(idx)}>
              <img
                src={cdnImage(img, { width: 200 })}
                srcSet={cdnSrcSet(img, [120, 200, 320])}
                sizes="120px"
                alt={fillPattern(content.thumbnailAltPattern, { current: idx + 1, total: list.length, title: title || '' })}
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      </m.div>
    </div>,
    document.body,
  )
}
