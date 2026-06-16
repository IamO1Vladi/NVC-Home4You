import React, { useEffect, useMemo, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { useModalActions } from '../context/ModalActions.jsx'
import { getLocaleFromPath } from '../routes/paths.js'
import { getHomeContent } from '../content/home/index.js'

function resolveLocale(pathname) {
  const fromPath = getLocaleFromPath(pathname)
  if (fromPath) return fromPath
  if (typeof document !== 'undefined') {
    const lang = String(document.documentElement.lang || '').toLowerCase()
    if (lang.startsWith('bg')) return 'bg'
  }
  return 'en'
}

export default function MobileDock({ content: incomingContent }) {
  const location = useLocation()
  const { openOffer } = useModalActions()
  const locale = resolveLocale(location.pathname)
  const bundle = useMemo(() => getHomeContent(locale), [locale])
  const content = incomingContent || bundle?.home?.mobileDock || {
    closeLabel: locale === 'bg' ? 'Затвори' : 'Close',
    title: 'NVC Home4You',
    description: locale === 'bg' ? 'Изпратете запитване и ще отговорим до 24 часа.' : 'Send an enquiry and we will reply within 24 hours.',
    primaryCta: locale === 'bg' ? 'Заяви оферта' : 'Get a Quote',
  }

  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = () => setEnabled(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  useEffect(() => {
    const threshold = 260
    const onScroll = () => setVisible((window.scrollY || 0) > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (dismissed || !enabled) return null

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          className="mobile-dock"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          <div className="mobile-dock-inner">
            <button className="dock-close" aria-label={content.closeLabel} onClick={() => setDismissed(true)}>✖</button>
            <div className="dock-text">
              <div className="dock-title">{content.title}</div>
              <div className="dock-sub">{content.description}</div>
            </div>
            <div className="dock-actions">
              <button className="btn" onClick={openOffer}>{content.primaryCta}</button>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
