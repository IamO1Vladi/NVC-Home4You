import React, { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { m, AnimatePresence } from 'framer-motion'
import { paths, getLocaleFromPath } from '../routes/paths.js'

// The site-wide bar and the phone drawer. The number is the one thing here that is not
// copy: it is dialled, so it lives as a tel: href and is printed the same way in the bar,
// the drawer and the contact dock. App.jsx passes it from home.localBusiness.telephone /
// home.finalCta.phone so the content files stay the one place to edit; the constants below
// are only the fallback for a render without those props. The theme select used to sit in
// the bar; it is a setting, not navigation, and now lives in the footer.
const PHONE_TEL = 'tel:+359879355269'
const PHONE_DISPLAY = '+359 87 935 5269'

// Copy the header needs before the content files carry it; the content key wins when set.
const FALLBACK = {
  call: { en: 'Call us', bg: 'Обадете ни се', el: 'Καλέστε μας' },
  catalogues: { en: 'Catalogues (PDF)', bg: 'Каталози (PDF)', el: 'Κατάλογοι (PDF)' },
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" />
    </svg>
  )
}

function DrawerChevron() {
  return (
    <svg className="drawer-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Header({ locale = 'en', content, telephone, phone, onLanguageChange, onOpenOffer }) {
  const phoneTel = telephone ? `tel:${String(telephone).replace(/\s+/g, '')}` : PHONE_TEL
  const phoneDisplay = phone || PHONE_DISPLAY
  const location = useLocation()
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
  const callLabel = content?.nav?.call || FALLBACK.call[currentLocale] || FALLBACK.call.en
  const cataloguesLabel = content?.nav?.catalogues || FALLBACK.catalogues[currentLocale] || FALLBACK.catalogues.en

  const plannerPath = paths.planner?.[currentLocale] || null
  const boxConfiguratorPath = paths.boxConfigurator?.[currentLocale] || null
  const configuratorItem = boxConfiguratorPath
    ? {
        key: 'boxConfigurator',
        label: content?.nav?.boxConfigurator || (currentLocale === 'bg' ? 'Конфигуратор' : 'Configurator'),
        to: boxConfiguratorPath,
      }
    : null
  const plannerItem = plannerPath
    ? {
        key: 'planner',
        label: content?.nav?.planner || (currentLocale === 'bg' ? 'Планировчик' : 'Planner'),
        to: plannerPath,
      }
    : null
  const planningItems = [plannerItem, configuratorItem].filter(Boolean)
  // From content alone: the old bg-or-English fallback is what put "Planning" on every
  // Greek page, because no locale had the key. All three do now.
  const planningLabel = content?.nav?.plannerGroup
  const isPlanningActive = planningItems.some((item) => item.to === location.pathname)

  // "About Us" groups the company page and the Cases page so the top nav stays uncluttered.
  const aboutLabel = content?.nav?.about || (currentLocale === 'bg' ? 'За нас' : 'About Us')
  const aboutItems = [
    { key: 'about', label: aboutLabel, to: pathFor('about') },
    { key: 'cases', label: content?.nav?.cases || (currentLocale === 'bg' ? 'Казуси' : 'Cases'), to: pathFor('cases') },
    // Moved out of the top bar when Prices went in. Eight top-level items was too many, and
    // of the candidates the FAQ is the one nobody arrives intending to visit — it is support
    // content, where Gallery and Prices are the two pages that sell.
    { key: 'faq', label: content?.nav?.faq, to: pathFor('faq') },
  ]
  const isAboutActive = aboutItems.some((item) => item.to === location.pathname)

  // The drawer (owner's rule): the few rows a phone visitor acts on, then the homes and
  // services as one collapsible group, then About, with the quote button still in sight.
  // The planner is back after the configurator (owner, 2026-10-15): since the redesign its
  // page works on a phone (the 3D unfold, the layouts as previews, send for an offer); only
  // the editor itself waits for a 900px screen.
  const mobileItems = [
    configuratorItem,
    plannerItem,
    { key: 'gallery', label: content?.nav?.gallery, to: pathFor('gallery') },
    { key: 'prices', label: content?.nav?.prices, to: pathFor('prices') },
    { key: 'partner', label: content?.nav?.partner, to: pathFor('partner') },
  ].filter((item) => item && item.label && item.to)
  const servicesItems = (content?.servicesMenu?.columns || []).flatMap((column) => column.items)

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
    const mq = window.matchMedia('(min-width: 980px)')
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

  const closeDrawer = () => setMobileOpen(false)

  return (
    <>
      {/* The scrim lives outside <header> on purpose: a sticky header that paints its own
          surface must not become the containing block of a position:fixed child. */}
      <AnimatePresence>
        {mobileOpen && (
          <m.div
            className="mobile-scrim"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeDrawer}
          />
        )}
      </AnimatePresence>

      <header className="site-header">
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
          <NavLink to={pathFor('prices')} className={({ isActive }) => ['link-btn', isActive && 'active'].filter(Boolean).join(' ')}>{content.nav.prices}</NavLink>

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
          {/* Icon only until 1280px, where the number fits; hidden on phones (CSS), where the
              drawer carries the Call button instead. */}
          <a className="call" href={phoneTel} aria-label={`${callLabel}, ${phoneDisplay}`}>
            <PhoneIcon />
            <span className="num">{phoneDisplay}</span>
          </a>
          <label className="visually-hidden" htmlFor="langSelect">{content.language.label}</label>
          <span className="select-wrap">
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
          </span>
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
                        onClick={closeDrawer}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                  <li>
                    <details className="drawer-group">
                      <summary className="drawer-link drawer-summary">
                        <span>{content.servicesSummary}</span>
                        <DrawerChevron />
                      </summary>
                      <ul className="drawer-sublist">
                        {servicesItems.map((item) => (
                          <li key={`mobile-${item.pathKey}`}>
                            <NavLink
                              className={({ isActive }) => ['drawer-link', 'drawer-sublink', isActive && 'active'].filter(Boolean).join(' ')}
                              to={pathFor(item.pathKey)}
                              onClick={closeDrawer}
                            >
                              {item.label}
                            </NavLink>
                          </li>
                        ))}
                        <li>
                          {/* A plain anchor: the browser handles the fragment itself on the home
                              page and loads the home page from elsewhere; the router has no
                              hash scrolling of its own. */}
                          <a className="drawer-link drawer-sublink" href={`${pathFor('home')}#catalogues`} onClick={closeDrawer}>
                            {cataloguesLabel}
                          </a>
                        </li>
                      </ul>
                    </details>
                  </li>
                  <li>
                    <details className="drawer-group">
                      <summary className="drawer-link drawer-summary">
                        <span>{aboutLabel}</span>
                        <DrawerChevron />
                      </summary>
                      <ul className="drawer-sublist">
                        {aboutItems.filter((item) => item.label).map((item) => (
                          <li key={`mobile-${item.key}`}>
                            <NavLink
                              className={({ isActive }) => ['drawer-link', 'drawer-sublink', isActive && 'active'].filter(Boolean).join(' ')}
                              to={item.to}
                              onClick={closeDrawer}
                            >
                              {item.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                </ul>
                {/* Sticky at the drawer's foot so both stay visible without scrolling. The quote
                    stays a <button>: it opens the form, it does not navigate. */}
                <div className="drawer-cta-row">
                  <a className="btn ghost" href={phoneTel} onClick={closeDrawer}>{callLabel}</a>
                  <button className="btn" onClick={() => { closeDrawer(); onOpenOffer?.() }}>{content.nav.quote}</button>
                </div>
              </nav>
            </m.div>
        )}
      </AnimatePresence>
      </header>
    </>
  )
}
