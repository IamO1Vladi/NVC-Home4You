import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'

export default function Lightbox({ title, images, index=0, onClose, price, currency='EUR', desc,modelId,onRequest }){
  const { t } = useI18n()
  const { openOffer } = useModalActions()
  const [i, setI] = useState(index)
  const ref = useRef(null)

  useEffect(()=>{
    function onKey(e){
      if(e.key === 'Escape') onClose?.()
      if(e.key === 'ArrowRight') setI(v=>(v+1)%images.length)
      if(e.key === 'ArrowLeft') setI(v=>(v-1+images.length)%images.length)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  },[images.length, onClose])

  useEffect(()=>{ document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  return createPortal(
    <div className="modal-portal">
      <motion.div className="backdrop" onClick={onClose} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} />
      <motion.div ref={ref} className="modal-card"
        initial={{opacity:0, scale:.96, y:10}} animate={{opacity:1, scale:1, y:0}} exit={{opacity:0, scale:.98, y:8}}
        transition={{type:'spring', stiffness:300, damping:28}} onMouseDown={e=>e.stopPropagation()}>
        <button className="close-x" aria-label="Close" onClick={onClose}>✖</button>
        <h3>{title}</h3>
        <div className="card" style={{overflow:'hidden'}}>
          <img alt="" src={images[i]} style={{display:'block',width:'100%',maxHeight:'60vh',objectFit:'cover'}} loading="lazy" />
        </div>
        <div className="row mt-3" style={{justifyContent:'space-between'}}>
          <button className="btn ghost" onClick={()=>setI(v=>(v-1+images.length)%images.length)}>◀ Prev</button>
          <div></div>
          <button className="btn ghost" onClick={()=>setI(v=>(v+1)%images.length)}>Next ▶</button>
        </div>

        {(price || desc) && (
          <div className="lb-meta">
            <div className="desc">
              <div style={{fontWeight:700, marginBottom:6}}>{t('product.description')}</div>
              <div>{desc}</div>
            </div>
            <div style={{textAlign:'right'}}>
              {typeof price==='number' && (
                <div className="price">
                  <span style={{opacity:.7, fontWeight:600}}>{t('product.from')} </span>
                  {currency==='EUR' ? '€' : ''}{price.toLocaleString()}+
                </div>
              )}
              <button className="btn mt-3"   onClick={() => onRequest?.({ id: modelId, title })}>{t('product.request')}</button>
            </div>
          </div>
        )}

        <div className="grid cols-3 mt-3">
          {images.map((img, idx)=>(
            <button className="tile" key={img+idx} onClick={()=>setI(idx)}>
              <img src={img} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
