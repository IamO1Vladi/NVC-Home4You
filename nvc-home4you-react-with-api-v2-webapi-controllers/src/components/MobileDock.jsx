import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/I18nContext.jsx'
import { useModalActions } from '../context/ModalActions.jsx'

export default function MobileDock(){
  const { t } = useI18n()
  const { openOffer } = useModalActions()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [enabled, setEnabled] = useState(true)

  useEffect(()=>{
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = ()=> setEnabled(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return ()=> mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(()=>{
    const threshold = 260
    const onScroll = ()=> setVisible((window.scrollY||0) > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive:true })
    return ()=> window.removeEventListener('scroll', onScroll)
  }, [])

  if(dismissed || !enabled) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="mobile-dock"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type:'spring', stiffness: 320, damping: 30 }}
        >
          <div className="mobile-dock-inner">
            <button className="dock-close" aria-label="Close" onClick={()=>setDismissed(true)}>✖</button>
            <div className="dock-text">
              <div className="dock-title">NVC Home4You</div>
              <div className="dock-sub">{t('cta.desc')}</div>
            </div>
            <div className="dock-actions">
              <button className="btn" onClick={openOffer}>{t('nav.quote')}</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
