import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

function getFocusable(root){
  return root ? Array.from(root.querySelectorAll(
    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.hasAttribute('disabled')) : []
}

export default function Modal({ open, onClose, title, children }){
  const ref = useRef(null)
  const lastFocused = useRef(null)

  useEffect(()=>{ if(open){ lastFocused.current = document.activeElement } },[open])

  useEffect(()=>{
    function onKey(e){
      if(!open) return
      if(e.key === 'Escape'){ e.preventDefault(); onClose?.() }
      if(e.key === 'Tab'){
        const nodes = getFocusable(ref.current)
        if(nodes.length === 0) return
        const first = nodes[0]; const last = nodes[nodes.length - 1]
        if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus() }
        else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  },[open, onClose])

  useEffect(()=>{
    if(open){
      const nodes = getFocusable(ref.current)
      nodes[0]?.focus()
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  },[open])

  useEffect(()=>{ if(!open && lastFocused.current){ lastFocused.current.focus?.() } },[open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="modal-portal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <motion.div className="backdrop" onClick={onClose}
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
          <motion.div
            ref={ref}
            className="modal-card"
            initial={{opacity:0, scale:.96, y:10}}
            animate={{opacity:1, scale:1, y:0}}
            exit={{opacity:0, scale:.98, y:8}}
            transition={{type:'spring', stiffness:300, damping:28}}
            onMouseDown={(e)=>{ e.stopPropagation() }}
          >
            <button className="close-x" aria-label="Close" onClick={onClose}>✖</button>
            {title && <h3 id="modal-title">{title}</h3>}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
