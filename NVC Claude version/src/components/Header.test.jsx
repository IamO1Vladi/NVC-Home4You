import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Header from './Header.jsx'
import { ThemeProvider } from '../context/ThemeContext.jsx'
import { getHomeContent } from '../content/home/index.js'
import { paths } from '../routes/paths.js'

// The desktop "Planning ▾" dropdown (planner + configurator). Its label had a bg-or-English
// fallback and no locale defined the key, so every Greek page showed "Planning". The label
// now comes from content alone.

beforeEach(() => {
  // ThemeProvider asks for the colour scheme; jsdom has no matchMedia.
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })))
  return () => vi.unstubAllGlobals()
})

function renderHeader(locale) {
  return render(
    <MemoryRouter initialEntries={[`/${locale}`]}>
      <ThemeProvider>
        <Header locale={locale} content={getHomeContent(locale).header} />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('Header planning dropdown', () => {
  it.each([
    ['el', 'Σχεδιασμός ▾'],
    ['en', 'Planning ▾'],
    ['bg', 'Планиране ▾'],
  ])('%s labels it "%s"', (locale, label) => {
    renderHeader(locale)
    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('names the Greek logistics link and its menu column in Greek', () => {
    const { container } = renderHeader('el')
    fireEvent.click(screen.getByRole('button', { name: /Σπίτια & υπηρεσίες/ }))

    expect(screen.getByText('Εφοδιαστική & Εργοτάξιο')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Διεθνής εφοδιαστική' })).toHaveAttribute('href', '/el/diethnis-efodiastiki')
    expect(container.textContent).not.toMatch(/Logistics|Planning/)
  })
})

// The phone drawer (owner's rule): no planner on phones, and a Call button beside the
// quote button so the one device that can dial gets a number it can tap.
describe('Header phone drawer', () => {
  it.each(['en', 'bg', 'el'])('%s: offers a tel: link and the quote button, and no planner link', (locale) => {
    const header = getHomeContent(locale).header
    const { container } = renderHeader(locale)
    fireEvent.click(screen.getByRole('button', { name: header.mobileMenuButtonAria }))

    const drawer = container.querySelector('#mobile-drawer')
    expect(drawer).not.toBeNull()
    const hrefs = [...drawer.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    expect(hrefs.some((href) => href.startsWith('tel:'))).toBe(true)
    expect(hrefs).not.toContain(paths.planner[locale])
    expect(hrefs).toContain(paths.boxConfigurator[locale])
    expect(within(drawer).queryByRole('link', { name: header.nav.planner })).toBeNull()
    expect(within(drawer).getByRole('button', { name: header.nav.quote })).toBeInTheDocument()
  })
})
