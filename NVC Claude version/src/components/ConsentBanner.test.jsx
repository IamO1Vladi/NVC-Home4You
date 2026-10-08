import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConsentBanner from './ConsentBanner.jsx'
import { LANG_STORAGE_KEY } from '../i18n/I18nContext.jsx'

// The banner renders outside the router and the i18n provider, reading window.location on
// its own, so the two things the representative link (#38) changed about it are pinned
// here: the representatives' panel is a staff area with no banner, and a customer path with
// no locale prefix (/r/{slug}) gets the language the page itself will render in rather than
// English every time.

const BG_ACCEPT = 'Приемам'
const EL_ACCEPT = 'Αποδοχή'
const EN_ACCEPT = 'Accept'

function renderAt(url) {
  window.history.replaceState(null, '', url)
  return render(<ConsentBanner />)
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('ConsentBanner', () => {
  it('stays off the representatives panel, like the admin one', () => {
    renderAt('/rep/leads')
    expect(screen.queryByRole('region')).toBeNull()
    renderAt('/rep')
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('still asks on the public pages, including a representative link', () => {
    renderAt('/bg/ceni')
    expect(screen.getByRole('region')).toBeInTheDocument()
  })

  it('reads the path locale first', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'bg')
    renderAt('/en/prices')
    expect(screen.getByRole('button', { name: EN_ACCEPT })).toBeInTheDocument()
  })

  it('follows ?lang on a representative link, before anything the device remembers', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'bg')
    renderAt('/r/dtodorov?lang=el')
    expect(screen.getByRole('button', { name: EL_ACCEPT })).toBeInTheDocument()
  })

  it('falls back to the language the site remembers on a locale-less path', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'bg')
    renderAt('/r/dtodorov')
    expect(screen.getByRole('button', { name: BG_ACCEPT })).toBeInTheDocument()
  })

  it('then to the browser language, and only then to English', () => {
    vi.stubGlobal('navigator', { ...window.navigator, language: 'el-GR' })
    renderAt('/r/dtodorov')
    expect(screen.getByRole('button', { name: EL_ACCEPT })).toBeInTheDocument()
  })

  it('ignores a language it cannot speak', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'de')
    vi.stubGlobal('navigator', { ...window.navigator, language: 'fr-FR' })
    renderAt('/r/dtodorov?lang=ro')
    expect(screen.getByRole('button', { name: EN_ACCEPT })).toBeInTheDocument()
  })
})
