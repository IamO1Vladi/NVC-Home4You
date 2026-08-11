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
  const [aboutOpen, setAboutOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef(null)
  const toolsRef = useRef(null)
  const aboutRef = useRef(null)
  const barRef = useRef(null)
  // The drawer has to stop where the viewport does, and the bar it hangs off is not a
  // fixed height (the brand wraps on narrow screens), so measure rather than guess.
  const [barHeight, setBarHeight] = useState(0)

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

  // "About Us" groups the company page and the Cases page so the top nav stays uncluttered.
  const aboutLabel = content?.nav?.about || (currentLocale === 'bg' ? 'За нас' : 'About Us')
  const aboutItems = [
    { key: 'about', label: aboutLabel, to: pathFor('about') },
    { key: 'cases', label: content?.nav?.cases || (currentLocale === 'bg' ? 'Казуси' : 'Cases'), to: pathFor('cases') },
  ]
  const isAboutActive = aboutItems.some((item) => item.to === location.pathname)

  // The drawer mirrors the desktop nav, but flattened: on a phone a link you can
  // see beats a link hidden one dropdown deep.
  const mobileItems = [
    { key: 'gallery', label: content?.nav?.gallery, to: pathFor('gallery') },
    ...aboutItems,
    { key: 'faq', label: content?.nav?.faq, to: pathFor('faq') },
    { key: 'partner', label: content?.nav?.partner, to: pathFor('partner') },
    ...planningItems,
  ].filter((item) => item.label && item.to)

  useEffect(() => {
    function onDoc(e) {
      const inServicesMenu = menuRef.current && menuRef.current.contains(e.target)
      const inPlanningMenu = toolsRef.current && toolsRef.current.contains(e.target)
      const inAboutMenu = aboutRef.current && aboutRef.current.contains(e.target)
      if ((menuOpen || toolsOpen || aboutOpen) && !inServicesMenu && !inPlanningMenu && !inAboutMenu) {
        setMenuOpen(false)
        setToolsOpen(false)
        setAboutOpen(false)
      }
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [menuOpen, toolsOpen, aboutOpen])

  // A drawer left open across a navigation (e.g. the back button) covers the page
  // it just took you to, so tie it to the current route.
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // While the drawer is open: Escape closes it, the page behind it stays put, and
  // crossing into the desktop breakpoint dismisses it (the hamburger disappears there).
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    const mq = window.matchMedia('(min-width: 768px)')
    // Re-measure and re-check the breakpoint from one handler, so a plain resize is
    // enough on browsers where the media-query listener is unreliable.
    const onViewportChange = () => {
      if (mq.matches) {
        setMobileOpen(false)
        return
      }
      setBarHeight(barRef.current?.getBoundingClientRect().height || 0)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    onViewportChange()
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onViewportChange)
    mq.addEventListener?.('change', onViewportChange)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onViewportChange)
      mq.removeEventListener?.('change', onViewportChange)
    }
  }, [mobileOpen])

  if (!content) return null

  return (
    <>
      {/* The scrim lives outside <header> on purpose: the header's backdrop-filter
          makes it a containing block, which would clip a position:fixed child. */}
      <AnimatePresence>
        {mobileOpen && (
          <m.div
            className="mobile-scrim"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <header>
      <div className="container nav-inner" ref={barRef}>
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
                setAboutOpen(false)
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

          <div className="menu" ref={aboutRef}>
            <button
              className={['link-btn', isAboutActive && 'active'].filter(Boolean).join(' ')}
              aria-haspopup="menu"
              aria-expanded={aboutOpen}
              onClick={(e) => {
                e.stopPropagation()
                setAboutOpen((v) => !v)
                setMenuOpen(false)
                setToolsOpen(false)
              }}
            >
              {aboutLabel} ▾
            </button>
            <AnimatePresence>
              {aboutOpen && (
                <m.div
                  className="menu-panel"
                  style={{ width: 'min(320px, 90vw)' }}
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                >
                  <div className="grid" style={{ gap: 8 }}>
                    {aboutItems.map((item) => (
                      <Link
                        key={item.key}
                        to={item.to}
                        className={['link-btn', location.pathname === item.to && 'active'].filter(Boolean).join(' ')}
                        onClick={() => setAboutOpen(false)}
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
                  setAboutOpen(false)
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

        <div className="row header-actions" style={{ gap: 8 }} data-nosnippet>
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

        <button
          className="hamburger"
          aria-label={content.mobileMenuButtonAria}
          aria-expanded={mobileOpen}
          aria-controls="mobile-drawer"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg className="nav-icon" width="24" height="24" viewBox="0 0 24 24" role="img" aria-hidden="true">
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
            <m.div
              id="mobile-drawer"
              className="container mobile-drawer"
              style={barHeight ? { maxHeight: `calc(100dvh - ${Math.round(barHeight)}px - 12px)` } : undefined}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <nav className="drawer-card card" aria-label={content.primaryNavAria}>
                <ul className="drawer-list">
                  {mobileItems.map((item) => (
                    <li key={`mobile-${item.key}`}>
                      <NavLink
                        className={({ isActive }) => ['drawer-link', isActive && 'active'].filter(Boolean).join(' ')}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                  <li>
                    <details className="drawer-group">
                      <summary className="drawer-link drawer-summary">
                        <span>{content.servicesSummary}</span>
                        <svg className="drawer-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <ul className="drawer-sublist">
                        {content.servicesMenu.columns.flatMap((column) => column.items).map((item) => (
                          <li key={`mobile-${item.pathKey}`}>
                            <NavLink
                              className={({ isActive }) => ['drawer-link', 'drawer-sublink', isActive && 'active'].filter(Boolean).join(' ')}
                              to={pathFor(item.pathKey)}
                              onClick={() => setMobileOpen(false)}
                            >
                              {item.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                </ul>
                <button className="btn drawer-cta" onClick={() => { setMobileOpen(false); onOpenOffer?.() }}>{content.nav.quote}</button>
              </nav>
            </m.div>
        )}
      </AnimatePresence>
      </header>
    </>
  )
}
