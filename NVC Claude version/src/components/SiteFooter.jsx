import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { paths, getLocaleFromPath } from '../routes/paths.js'
import { useTheme } from '../context/ThemeContext.jsx'
import { getHomeContent } from '../content/home/index.js'

// Site-wide footer: a site map, then the contact block, then the legal row.
//
// THE SITE MAP (2026-10-16) is the one place every public page links to every other in plain
// HTML. The header's dropdowns and the phone drawer only exist after a click, so the prerendered
// header carries four page links; crawlers, and a visitor before they open a menu, saw the doors,
// About, FAQ, the planner, cases, delivery and interiors only where a page body happened to link
// them. Three groups (products, buying, the company), each a heading over a list of real router
// links. Each link is named with the header's own label (servicesMenu by pathKey, else nav) and
// goes to its paths.js path, so the menu and the footer cannot name or point at a page two ways;
// a key with no label or no path in this locale is simply not drawn. Nothing collapses: on a
// phone the groups sit two to a row.
//
// The contact block says where the company is and when it answers, the facts the JSON-LD already
// carried but no page showed. The legal row: the © line, the Privacy & Cookie Policy and a
// "Cookie settings" control on every page (the dismissable consent card alone cannot guarantee
// it), plus the theme select, which moved here from the header because it is a setting, not
// navigation. No phone or email here: the contact card above the footer carries them.
const COPY = {
  en: {
    privacy: 'Privacy & Cookies',
    cookies: 'Cookie settings',
    rights: 'All rights reserved',
    address: 'Marikostinovo, 2850 Petrich, Bulgaria',
    hours: 'Mon–Fri 07:00–19:00',
    catalogues: 'Catalogues (PDF)',
    theme: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'Match device' },
  },
  bg: {
    privacy: 'Поверителност и бисквитки',
    cookies: 'Настройки на бисквитките',
    rights: 'Всички права запазени',
    address: 'Марикостиново, 2850 Петрич, България',
    hours: 'пон–пет 07:00–19:00',
    catalogues: 'Каталози (PDF)',
    theme: { label: 'Тема', light: 'Светла', dark: 'Тъмна', system: 'Като устройството' },
  },
  el: {
    privacy: 'Απόρρητο & Cookies',
    cookies: 'Ρυθμίσεις cookies',
    rights: 'Με την επιφύλαξη παντός δικαιώματος',
    address: 'Μαρικοστίνοβο, 2850 Πέτριτς, Βουλγαρία',
    hours: 'Δευ–Παρ 07:00–19:00',
    catalogues: 'Κατάλογοι (PDF)',
    theme: { label: 'Θέμα', light: 'Φωτεινό', dark: 'Σκούρο', system: 'Όπως η συσκευή' },
  },
}

// The site map's groups and the paths.js keys in each, in the order they are listed.
export const SITE_MAP = [
  { key: 'products', pages: ['modularBuilds', 'modularHouses', 'steelHouses', 'doors', 'interiors'] },
  { key: 'buy', pages: ['prices', 'gallery', 'boxConfigurator', 'planner', 'delivery'] },
  { key: 'company', pages: ['about', 'cases', 'faq', 'partner'] },
]

const MAPS_HREF = 'https://www.google.com/maps/search/?api=1&query=Marikostinovo%2C%202850%20Petrich%2C%20Bulgaria'
const FACEBOOK_HREF = 'https://www.facebook.com/profile.php?id=61581135006737'

/** The header's label for a page: its services-menu item, else its nav entry. */
function headerLabel(header, pageKey) {
  const item = (header?.servicesMenu?.columns || [])
    .flatMap((column) => column.items || [])
    .find((entry) => entry.pathKey === pageKey)
  return item?.label || header?.nav?.[pageKey] || null
}

export default function SiteFooter({ locale = 'en' }) {
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const current = getLocaleFromPath(location.pathname) || locale
  const t = COPY[current] || COPY.en
  const bundle = getHomeContent(current)
  // The printed hours and the map link come from the home content when it carries them, so
  // the footer and the contact band cannot disagree. localBusiness.hours is the schema.org
  // object (dayOfWeek/opens/closes), not a sentence, so only a string is accepted from there.
  const business = bundle?.home?.localBusiness || {}
  const str = (value) => (typeof value === 'string' && value ? value : null)
  const hours = str(bundle?.home?.band?.hours) || str(business.hours) || t.hours
  const mapsHref = str(business.mapsHref) || str(bundle?.home?.band?.mapsHref) || MAPS_HREF
  const themeCopy = { ...t.theme, ...(bundle?.header?.theme || {}) }
  const cataloguesLabel = bundle?.header?.nav?.catalogues || t.catalogues
  const footerCopy = bundle?.footer || {}
  const year = new Date().getFullYear()
  const privacyPath = paths.privacy[current] || paths.privacy.en
  const homePath = paths.home[current] || paths.home.en

  const groups = SITE_MAP.map((group) => ({
    key: group.key,
    heading: footerCopy.groups?.[group.key],
    links: group.pages
      .map((pageKey) => ({ pageKey, to: paths[pageKey]?.[current], label: headerLabel(bundle?.header, pageKey) }))
      .filter((link) => link.to && link.label),
  })).filter((group) => group.links.length)

  const openConsent = () => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem('consent.choice')
    } catch (e) {
      /* ignore storage errors (private mode etc.) */
    }
    window.dispatchEvent(new Event('nvc:open-consent'))
  }

  return (
    <footer className="site-footer" data-nosnippet>
      <div className="container">
        <div className="site-footer-map">
          <nav className="site-footer-nav" aria-label={footerCopy.siteMapLabel}>
            {groups.map((group) => (
              <div className="site-footer-col" key={group.key} data-group={group.key}>
                {group.heading ? <h2 className="site-footer-h" id={`site-footer-${group.key}`}>{group.heading}</h2> : null}
                <ul className="site-footer-list" aria-labelledby={group.heading ? `site-footer-${group.key}` : undefined}>
                  {group.links.map((link) => (
                    <li key={link.pageKey}>
                      <Link to={link.to} aria-current={location.pathname === link.to ? 'page' : undefined}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="site-footer-col site-footer-contact" data-group="contact">
            {footerCopy.groups?.contact ? <h2 className="site-footer-h">{footerCopy.groups.contact}</h2> : null}
            <ul className="site-footer-list">
              <li>
                NVC Home4You · <a href={mapsHref} target="_blank" rel="noopener noreferrer">{t.address}</a>
              </li>
              <li>{hours}</li>
              <li><a href={FACEBOOK_HREF} target="_blank" rel="noopener noreferrer">Facebook</a></li>
              {/* A plain anchor on purpose: the browser loads the home page and its fragment. */}
              <li><a href={`${homePath}#catalogues`}>{cataloguesLabel}</a></li>
            </ul>
          </div>
        </div>

        <div className="site-footer-row site-footer-legal">
          <div className="site-footer-group">
            <span>© {year} NVC Home4You — {t.rights}</span>
            <Link to={privacyPath}>{t.privacy}</Link>
            <button type="button" className="site-footer-link" onClick={openConsent}>
              {t.cookies}
            </button>
          </div>
          <div className="site-footer-group">
            <label htmlFor="themeSelect">{themeCopy.label}</label>
            <span className="select-wrap">
              <select
                id="themeSelect"
                className="header-select theme-toggle"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                aria-label={themeCopy.ariaLabel || themeCopy.label}
              >
                <option value="light">{themeCopy.light}</option>
                <option value="dark">{themeCopy.dark}</option>
                <option value="system">{themeCopy.system}</option>
              </select>
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
