import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { paths, getLocaleFromPath } from '../routes/paths.js'

// Slim site-wide footer. Its main job is to expose the Privacy & Cookie Policy and a
// "Cookie settings" control on every page (legal requirement), which the dismissable
// consent banner alone can't guarantee.
const COPY = {
  en: { privacy: 'Privacy & Cookies', cookies: 'Cookie settings', rights: 'All rights reserved' },
  bg: { privacy: 'Поверителност и бисквитки', cookies: 'Настройки на бисквитките', rights: 'Всички права запазени' },
  el: { privacy: 'Απόρρητο & Cookies', cookies: 'Ρυθμίσεις cookies', rights: 'Με την επιφύλαξη παντός δικαιώματος' },
}

export default function SiteFooter({ locale = 'en' }) {
  const location = useLocation()
  const current = getLocaleFromPath(location.pathname) || locale
  const t = COPY[current] || COPY.en
  const year = new Date().getFullYear()
  const privacyPath = paths.privacy[current] || paths.privacy.en

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
      <div
        className="container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '18px 20px',
          borderTop: '1px solid var(--line, #9993)',
          // The theme token, NOT a hard-coded gray: this footer renders on both themes,
          // and #cbd5e1 — written for the dark one — was 1.5:1 against the light
          // background on every page of the site (axe, 2026-08-29).
          color: 'var(--muted)',
        }}
      >
        <div>© {year} NVC Home4You — {t.rights}</div>
        <nav style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <Link to={privacyPath} style={{ color: 'inherit' }}>{t.privacy}</Link>
          <button
            type="button"
            onClick={openConsent}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'inherit',
              font: 'inherit',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {t.cookies}
          </button>
        </nav>
      </div>
    </footer>
  )
}
