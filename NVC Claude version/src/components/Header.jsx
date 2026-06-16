import React, { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { m, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext.jsx'
import { paths, getLocaleFromPath } from '../routes/paths.js'

export default function Header({ locale = 'en', content, onLanguageChange, onOpenOffer }) {
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef(null)
  const toolsRef = useRef(null)

  const currentLocale = getLocaleFromPath(location.pathname) || locale
  const pathFor = (key) => paths[key]?.[currentLocale] || '/'

  const plannerPath = paths.planner?.[currentLocale] || null
  const boxConfiguratorPath = paths.boxConfigurator?.[currentLocale] || null
  const planningItems = [
    plannerPath
      ? {
          key: 'planner',
          label: content?.nav?.planner || (currentLocale === 'bg' ? 'Планировчик' : 'Planner'),
          to: plannerPath,
        }
      : null,
    boxConfiguratorPath
      ? {
          key: 'boxConfigurator',
          label: content?.nav?.boxConfigurator || (currentLocale === 'bg' ? 'Конфигуратор' : 'Configurator'),
          to: boxConfiguratorPath,
        }
      : null,
  ].filter(Boolean)
  const planningLabel = content?.nav?.plannerGroup || (currentLocale === 'bg' ? 'Планиране' : 'Planning')
  const isPlanningActive = planningItems.some((item) => item.to === location.pathname)

  useEffect(() => {
    function onDoc(e) {
      const inServicesMenu = menuRef.current && menuRef.current.contains(e.target)
      const inPlanningMenu = toolsRef.current && toolsRef.current.contains(e.target)
      if ((menuOpen || toolsOpen) && !inServicesMenu && !inPlanningMenu) {
        setMenuOpen(false)
        setToolsOpen(false)
      }
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [menuOpen, toolsOpen])

  if (!content) return null

  return (
    <header>
      <div className="container nav-inner">
        <Link className="brand" to={pathFor('home')}>
          <div className="brand-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 11l9-7 9 7" strokeWidth="2" />
              <path d="M9 22V12h6v10" strokeWidth="2" />
            </svg>
          </div>
          <div><span className="grad-text">{content.brand.short}</span> <span style={{ opacity: 0.9 }}>{content.brand.full}</span></div>
        </Link>

        <nav className="nav-links" aria-label={content.primaryNavAria}>
          <div className="menu" ref={menuRef}>
            <button
              className="link-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
                setToolsOpen(false)
              }}
            >
              {content.servicesSummary} ▾
            </button>
            <AnimatePresence>
              {menuOpen && (
                <m.div
                  className="menu-panel"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                >
                  <div className="grid cols-3">
                    {content.servicesMenu.columns.map((column) => (
                      <div key={column.title}>
                        <div className="mb-2"><strong className="grad-text">{column.title}</strong></div>
                        <ul>
                          {column.items.map((item) => (
                            <li key={`${column.title}-${item.pathKey}`}>
                              <Link to={pathFor(item.pathKey)} onClick={() => setMenuOpen(false)}>{item.label}</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>

          <NavLink to={pathFor('gallery')} className={({ isActive }) => ['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{content.nav.gallery}</NavLink>
          <NavLink to={pathFor('faq')} className={({ isActive }) => ['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{content.nav.faq}</NavLink>
          <NavLink to={pathFor('about')} className={({ isActive }) => ['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{content.nav.about}</NavLink>
          <NavLink to={pathFor('partner')} className={({ isActive }) => ['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{content.nav.partner}</NavLink>

          {planningItems.length > 1 ? (
            <div className="menu" ref={toolsRef}>
              <button
                className={['link-btn', isPlanningActive && 'active'].filter(Boolean).join(' ')}
                aria-haspopup="menu"
                aria-expanded={toolsOpen}
                onClick={(e) => {
                  e.stopPropagation()
                  setToolsOpen((v) => !v)
                  setMenuOpen(false)
                }}
              >
                {planningLabel} ▾
              </button>
              <AnimatePresence>
                {toolsOpen && (
                  <m.div
                    className="menu-panel"
                    style={{ width: 'min(320px, 90vw)' }}
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  >
                    <div className="grid" style={{ gap: 8 }}>
                      {planningItems.map((item) => (
                        <Link
                          key={item.key}
                          to={item.to}
                          className={['link-btn', location.pathname === item.to && 'active'].filter(Boolean).join(' ')}
                          onClick={() => setToolsOpen(false)}
                          style={{ textAlign: 'left' }}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          ) : planningItems.length === 1 ? (
            <NavLink to={planningItems[0].to} className={({ isActive }) => ['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>
              {planningItems[0].label}
            </NavLink>
          ) : null}

          <button className="btn" onClick={onOpenOffer}>{content.nav.quote}</button>
        </nav>

        <div className="row header-actions" style={{ gap: 8 }}>
          <div className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12 }}>
            <label className="visually-hidden" htmlFor="themeSelect">{content.theme.label}</label>
            <select
              id="themeSelect"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="header-select theme-toggle"
              aria-label={content.theme.ariaLabel}
            >
              <option value="light">{content.theme.light}</option>
              <option value="dark">{content.theme.dark}</option>
              <option value="system">{content.theme.system}</option>
            </select>

            <label className="visually-hidden" htmlFor="langSelect">{content.language.label}</label>
            <select
              id="langSelect"
              value={currentLocale}
              onChange={(e) => onLanguageChange?.(e.target.value)}
              className="header-select lang-toggle"
              aria-label={content.language.ariaLabel}
            >
              {content.language.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button className="hamburger" aria-label={content.mobileMenuButtonAria} onClick={() => setMobileOpen((v) => !v)}>
          <svg className="nav-icon" width="24" height="24" viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <m.div className="container mobile-drawer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="drawer-card card">
              <Link className="row mt-2" to={pathFor('gallery')} onClick={() => setMobileOpen(false)}>{content.nav.gallery}</Link>
              <Link className="row" to={pathFor('faq')} onClick={() => setMobileOpen(false)}>{content.nav.faq}</Link>
              <Link className="row" to={pathFor('about')} onClick={() => setMobileOpen(false)}>{content.nav.about}</Link>
              <Link className="row" to={pathFor('partner')} onClick={() => setMobileOpen(false)}>{content.nav.partner}</Link>
              {boxConfiguratorPath ? (
                <Link className="row" to={boxConfiguratorPath} onClick={() => setMobileOpen(false)}>{content.nav.boxConfigurator || (currentLocale === 'bg' ? 'Конфигуратор' : 'Configurator')}</Link>
              ) : null}
              <details>
                <summary>{content.servicesSummary}</summary>
                <div className="card p-6 mt-3">
                  {content.servicesMenu.columns.flatMap((column) => column.items).map((item) => (
                    <Link className="row mt-2" key={`mobile-${item.pathKey}`} to={pathFor(item.pathKey)} onClick={() => setMobileOpen(false)}><span>•</span> {item.label}</Link>
                  ))}
                </div>
              </details>
              <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => { setMobileOpen(false); onOpenOffer?.() }}>{content.nav.quote}</button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  )
}
