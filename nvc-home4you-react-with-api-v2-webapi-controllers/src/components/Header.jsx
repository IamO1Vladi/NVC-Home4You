import React, { useEffect, useRef, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext.jsx'
import { useI18n } from '../i18n/I18nContext.jsx'

export default function Header({ onOpenOffer, onOpenQuestion }){
  const { theme, setTheme } = useTheme()
  const { t, lang, setLang } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(()=>{
    function onDoc(e){ if(menuOpen && menuRef.current && !menuRef.current.contains(e.target)){ setMenuOpen(false) } }
    document.addEventListener('click', onDoc); return () => document.removeEventListener('click', onDoc)
  },[menuOpen])

  return (
    <header>
      <div className="container nav-inner">
        <Link className="brand" to="/">
          <div className="brand-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 11l9-7 9 7" strokeWidth="2"/><path d="M9 22V12h6v10" strokeWidth="2"/>
            </svg>
          </div>
          <div><span className="grad-text">NVC</span> <span style={{opacity:.9}}>Home4You</span></div>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <div className="menu" ref={menuRef}>
            <button className="link-btn" aria-haspopup="menu" aria-expanded={menuOpen}
              onClick={(e)=>{ e.stopPropagation(); setMenuOpen(v=>!v) }}>
              {t('nav.services')} ▾
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div className="menu-panel"
                  initial={{opacity:0, y:6, scale:.98}} animate={{opacity:1, y:0, scale:1}}
                  exit={{opacity:0, y:4, scale:.98}} transition={{type:'spring', stiffness:300, damping:26}}>
                  <div className="grid cols-3">
                    <div><div className="mb-2"><strong className="grad-text">{t('services.categories.0.h')}</strong></div>
                      <ul><li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.0.items.0.0')}</Link></li>
                          <li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.0.items.1.0')}</Link></li>
                          <li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.0.items.2.0')}</Link></li></ul></div>
                    <div><div className="mb-2"><strong className="grad-text">{t('services.categories.1.h')}</strong></div>
                      <ul><li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.1.items.0.0')}</Link></li>
                          <li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.1.items.1.0')}</Link></li>
                          <li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.1.items.2.0')}</Link></li></ul></div>
                    <div><div className="mb-2"><strong className="grad-text">{t('services.categories.2.h')}</strong></div>
                      <ul><li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.2.items.0.0')}</Link></li>
                          <li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.2.items.1.0')}</Link></li>
                          <li><Link to="/services" onClick={()=>setMenuOpen(false)}>{t('services.categories.2.items.2.0')}</Link></li></ul></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <NavLink to="/gallery" className={({isActive})=>['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{t('nav.gallery')}</NavLink>
          <NavLink to="/faq" className={({isActive})=>['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{t('nav.faq')}</NavLink>
          <NavLink to="/about" className={({isActive})=>['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{t('nav.about')}</NavLink>
          <button className="btn" onClick={onOpenOffer}>{t('nav.quote')}</button>
        </nav>

        <div className="row" style={{gap:8}}>
          <div className="card p-4" style={{display:'flex',alignItems:'center',gap:8,borderRadius:12}}>
            <label className="visually-hidden" htmlFor="themeSelect">Theme</label>
            <select id="themeSelect" value={theme} onChange={(e)=>setTheme(e.target.value)}
              className="header-select" aria-label="Theme">
              <option value="light">{t('nav.theme.light')}</option>
              <option value="dark">{t('nav.theme.dark')}</option>
              <option value="system">{t('nav.theme.system')}</option>
            </select>

            <label className="visually-hidden" htmlFor="langSelect">Language</label>
            <select id="langSelect" value={lang} onChange={(e)=>setLang(e.target.value)}
              className="header-select" aria-label={t('nav.lang')}>
              <option value="en">EN</option>
              <option value="bg">BG</option>
            </select>
          </div>
        </div>

        <button className="hamburger" aria-label="Open menu" onClick={()=>setMobileOpen(v=>!v)}>☰</button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="container mobile-drawer" initial={{height:0, opacity:0}} animate={{height:'auto', opacity:1}} exit={{height:0, opacity:0}}>
            <div className="drawer-card card">
              <details><summary>▾ {t('nav.services')}</summary>
                <div className="card p-6 mt-3">
                  <Link className="row" to="/services" onClick={()=>setMobileOpen(false)}><span>•</span> {t('services.categories.0.h')}</Link>
                  <Link className="row mt-2" to="/services" onClick={()=>setMobileOpen(false)}><span>•</span> {t('services.categories.1.h')}</Link>
                  <Link className="row mt-2" to="/services" onClick={()=>setMobileOpen(false)}><span>•</span> {t('services.categories.2.h')}</Link>
                </div>
              </details>
              <Link className="row mt-2" to="/gallery" onClick={()=>setMobileOpen(false)}>{t('nav.gallery')}</Link>
              <Link className="row" to="/faq" onClick={()=>setMobileOpen(false)}>{t('nav.faq')}</Link>
              <Link className="row" to="/about" onClick={()=>setMobileOpen(false)}>{t('nav.about')}</Link>
              <button className="btn" style={{width:'100%',marginTop:8}} onClick={()=>{ setMobileOpen(false); onOpenOffer?.() }}>{t('nav.quote')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
