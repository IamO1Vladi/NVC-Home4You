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

  it('names the Greek delivery link and its menu column in Greek', () => {
    const { container } = renderHeader('el')
    fireEvent.click(screen.getByRole('button', { name: /Σπίτια & υπηρεσίες/ }))

    expect(screen.getByText('Παράδοση')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Παράδοση και συναρμολόγηση' })).toHaveAttribute('href', paths.delivery.el)
    expect(container.textContent).not.toMatch(/Logistics|Delivery|Planning/)
  })

  // The logistics page was retired into the delivery page (2026-10-15): its column is the
  // delivery column now, one item, and no locale links the old URLs.
  it.each([
    ['bg', 'Доставка', 'Доставка и монтаж'],
    ['en', 'Delivery', 'Delivery and assembly'],
    ['el', 'Παράδοση', 'Παράδοση και συναρμολόγηση'],
  ])('%s: the delivery column holds the one delivery link', (locale, column, label) => {
    const header = getHomeContent(locale).header
    const { container } = renderHeader(locale)
    expect(header.servicesMenu.columns).toHaveLength(3)
    expect(header.servicesMenu.columns[1]).toEqual({ title: column, items: [{ pathKey: 'delivery', label }] })

    fireEvent.click(screen.getByRole('button', { name: (name) => name.startsWith(header.servicesSummary) }))
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', paths.delivery[locale])
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('/bg/mejdunarodna-logistika')
    expect(hrefs).not.toContain('/en/logistics')
    expect(hrefs).not.toContain('/el/diethnis-efodiastiki')
  })
})

// The phone drawer (owner's rule): a few top rows, the planner right after the configurator
// since the planner page works on phones (owner, 2026-10-15), and a Call button beside the
// quote button so the one device that can dial gets a number it can tap.
describe('Header phone drawer', () => {
  it.each(['en', 'bg', 'el'])('%s: offers the planner after the configurator, a tel: link and the quote button', (locale) => {
    const header = getHomeContent(locale).header
    const { container } = renderHeader(locale)
    fireEvent.click(screen.getByRole('button', { name: header.mobileMenuButtonAria }))

    const drawer = container.querySelector('#mobile-drawer')
    expect(drawer).not.toBeNull()
    const hrefs = [...drawer.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    expect(hrefs.some((href) => href.startsWith('tel:'))).toBe(true)

    // The top rows, in order: the configurator, the planner, then gallery, prices, partners.
    const top = [...drawer.querySelectorAll('.drawer-list > li > a')]
    expect(top.map((a) => a.getAttribute('href'))).toEqual([
      paths.boxConfigurator[locale],
      paths.planner[locale],
      paths.gallery[locale],
      paths.prices[locale],
      paths.partner[locale],
    ])
    expect(top[1]).toHaveTextContent(header.nav.planner)
    expect(within(drawer).getAllByRole('link', { name: header.nav.planner })).toHaveLength(1)
    expect(within(drawer).getByRole('button', { name: header.nav.quote })).toBeInTheDocument()
  })
})
