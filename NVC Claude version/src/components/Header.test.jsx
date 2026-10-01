import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Header from './Header.jsx'
import { ThemeProvider } from '../context/ThemeContext.jsx'
import { getHomeContent } from '../content/home/index.js'

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
    fireEvent.click(screen.getByRole('button', { name: /Τα Προϊόντα & οι Υπηρεσίες μας/ }))

    expect(screen.getByText('Εφοδιαστική & Εργοτάξιο')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Διεθνής εφοδιαστική' })).toHaveAttribute('href', '/el/diethnis-efodiastiki')
    expect(container.textContent).not.toMatch(/Logistics|Planning/)
  })
})
