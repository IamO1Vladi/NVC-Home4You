import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SiteFooter, { SITE_MAP } from './SiteFooter.jsx'
import { ThemeProvider } from '../context/ThemeContext.jsx'
import { getHomeContent } from '../content/home/index.js'
import { paths } from '../routes/paths.js'

// The footer's site map (2026-10-16). The header's dropdowns and the phone drawer exist only
// after a click, so the prerendered pages carried four header links; the footer is the one
// place every page links to every other in plain HTML. These pin that each group lists its
// pages in the page's language, with the header's own words and paths.js's paths.

beforeEach(() => {
  // ThemeProvider asks for the colour scheme; jsdom has no matchMedia.
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })))
  return () => vi.unstubAllGlobals()
})

function renderFooter(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <SiteFooter />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

/** The header's label for a page, read the way a visitor reads the menu. */
function menuLabel(header, key) {
  const item = header.servicesMenu.columns.flatMap((c) => c.items).find((i) => i.pathKey === key)
  return item ? item.label : header.nav[key]
}

const LOCALES = ['bg', 'en', 'el']
const EXPECTED = {
  products: ['modularBuilds', 'modularHouses', 'steelHouses', 'doors', 'interiors'],
  buy: ['prices', 'gallery', 'boxConfigurator', 'planner', 'delivery'],
  company: ['about', 'cases', 'faq', 'partner'],
}

describe('SiteFooter site map', () => {
  it('lists the groups the owner\'s pages fall into, every public page once', () => {
    expect(Object.fromEntries(SITE_MAP.map((g) => [g.key, g.pages]))).toEqual(EXPECTED)
    const listed = SITE_MAP.flatMap((g) => g.pages)
    expect(new Set(listed).size).toBe(listed.length)
    // Every page in paths.js but the home page (the brand links it) and privacy (the legal row).
    expect([...listed].sort()).toEqual(Object.keys(paths).filter((k) => !['home', 'privacy'].includes(k)).sort())
  })

  it.each(LOCALES)('%s: every group renders its pages as real links, in the page\'s language', (locale) => {
    const bundle = getHomeContent(locale)
    const { container } = renderFooter(paths.about[locale])
    const nav = within(container).getByRole('navigation', { name: bundle.footer.siteMapLabel })

    for (const [group, keys] of Object.entries(EXPECTED)) {
      const heading = within(nav).getByRole('heading', { name: bundle.footer.groups[group] })
      const list = within(nav).getByRole('list', { name: bundle.footer.groups[group] })
      expect(heading.id).toBe(list.getAttribute('aria-labelledby'))
      const links = within(list).getAllByRole('link')
      expect(links.map((a) => a.getAttribute('href'))).toEqual(keys.map((key) => paths[key][locale]))
      expect(links.map((a) => a.textContent)).toEqual(keys.map((key) => menuLabel(bundle.header, key)))
    }
  })

  it.each(LOCALES)('%s: no link in it leaves the language or the site', (locale) => {
    const { container } = renderFooter(paths.home[locale])
    const hrefs = [...container.querySelectorAll('nav a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toHaveLength(14)
    for (const href of hrefs) expect(href.startsWith(`/${locale}/`)).toBe(true)
  })

  it.each(LOCALES)('%s: marks the page you are on', (locale) => {
    const { container } = renderFooter(paths.cases[locale])
    const current = container.querySelectorAll('nav a[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', paths.cases[locale])
  })

  it.each(LOCALES)('%s: keeps the contact block, the catalogues, the privacy link and the cookie settings', (locale) => {
    const bundle = getHomeContent(locale)
    const { container } = renderFooter(paths.prices[locale])
    const contact = container.querySelector('[data-group="contact"]')
    expect(within(contact).getByRole('heading', { name: bundle.footer.groups.contact })).toBeInTheDocument()
    expect(contact).toHaveTextContent('NVC Home4You')
    expect(contact).toHaveTextContent(bundle.home.band.hours)
    expect(within(contact).getByRole('link', { name: 'Facebook' })).toHaveAttribute('target', '_blank')
    expect(within(contact).getByRole('link', { name: bundle.header.nav.catalogues })).toHaveAttribute('href', `${paths.home[locale]}#catalogues`)
    expect(contact.querySelector('a[href^="https://www.google.com/maps/"]')).not.toBeNull()

    const footer = container.querySelector('footer')
    expect(within(footer).getByRole('link', { name: /Поверителност|Privacy|Απόρρητο/ })).toHaveAttribute('href', paths.privacy[locale])
    expect(within(footer).getByRole('button', { name: /бисквитките|Cookie settings|cookies/ })).toBeInTheDocument()
    expect(within(footer).getByRole('combobox')).toBeInTheDocument()
  })
})
