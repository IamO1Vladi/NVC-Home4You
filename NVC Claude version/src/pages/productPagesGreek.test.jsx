import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'

import GlideServices from '../components/GlideServices.jsx'
import ModularBuildsPage from './ModularBuildsPage.jsx'
import ModularHousesPage from './ModularHousesPage.jsx'
import SteelHousesPage from './SteelHousesPage.jsx'

import { getHomeContent } from '../content/home/index.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import elModularBuilds from '../content/el/modularBuilds.js'
import enModularBuilds from '../content/en/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import elModularHouses from '../content/el/modularHouses.js'
import enModularHouses from '../content/en/modularHouses.js'
import bgSteelHouses from '../content/bg/steelHouses.js'
import elSteelHouses from '../content/el/steelHouses.js'
import enSteelHouses from '../content/en/steelHouses.js'

// The leftovers of the Greek audit that live in components rather than copy, checked on the
// rendered pages: the carousels' aria-roledescription (a screen reader says it aloud), the
// modular-houses size cell, once hardcoded with a Cyrillic м and a 78 m² model that does not
// exist, and, since the 2026-10 rebuild, the whole English and Greek product pages, which
// now print gallery titles, prices and the shared contact card as well as their own copy.
//
// The gallery rows are a few of the live /api/gallery items (2026-10-12), with their three
// titles; every other API call answers 404, so the reviews, the case and the admin photos
// are absent and each page shows its defaults.

const item = (id, category, price, title, titleBg, titleEl) => ({
  id, category, price, currency: 'EUR', title, titleBg, titleEl,
  description: `<p>${title}</p>`, descriptionBg: `<p>${titleBg}</p>`, descriptionEl: `<p>${titleEl}</p>`,
  coverUrl: `/api/img/gallery/${id}/cover.webp`, images: [`/api/img/gallery/${id}/cover.webp`], catalogId: null,
})

const GALLERY = [
  item(13, 'wagon', 4300, 'Container House – 6000mm*3000mm', 'Жилищен фургон - 6000мм*3000мм', 'Σπίτι τύπου Container – 6000 mm × 3000 mm'),
  item(8, 'wagon', 6500, 'Container House – 8000*3000mm with pitched roof', 'Контейнерна къща – 8000*3000мм с двускатен покрив', 'Σπίτι τύπου Container – 8000 × 3000 mm με δίρριχτη στέγη'),
  item(10, 'modular', 14000, 'Expandable House – 37 m²', 'Разгъваема Къща – 37 м²', 'Αναπτυσσόμενη κατοικία – 37 m²'),
  item(5, 'modular', 23000, 'Expandable House – 58 m²', 'Разгъваема Къща – 58 м²', 'Αναπτυσσόμενη κατοικία — 58 m²'),
  item(100015, 'modular', 55000, 'Space house', 'Космическа къща - капсула', 'Φουτουριστική κατοικία-κάψουλα'),
  item(100016, 'modular', 10500, 'Expandable House – 18 m²', 'Разгъваема Къща – 18 м²', 'Αναπτυσσόμενη κατοικία – 18 m²'),
]

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url) => (
    String(url).includes('/api/gallery')
      ? json({ items: GALLERY })
      : Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  )))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPage(element) {
  return render(
    <MemoryRouter>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        {element}
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

const PAGES = {
  modularBuilds: { Page: ModularBuildsPage, content: { bg: bgModularBuilds, en: enModularBuilds, el: elModularBuilds } },
  modularHouses: { Page: ModularHousesPage, content: { bg: bgModularHouses, en: enModularHouses, el: elModularHouses } },
  steelHouses: { Page: SteelHousesPage, content: { bg: bgSteelHouses, en: enSteelHouses, el: elSteelHouses } },
}

/** Render one product page and wait until the gallery figures are on it. */
async function renderProduct(key, locale) {
  const { Page, content } = PAGES[key]
  const view = renderPage(<Page locale={locale} content={content[locale]} />)
  // Every page prints at least one gallery price once the rows arrive: the cards on the two
  // priced pages, the sibling cards' "from" figures on the steel page. No content file
  // types a euro sign, so one on the page is a figure computed from the rows.
  await waitFor(() => expect(view.container.textContent).toMatch(/\d\s?€|€\s?\d/))
  return view
}

const ROLE = { el: 'καρουζέλ', en: 'carousel', bg: 'carousel' }

describe('carousel role description', () => {
  it.each(Object.entries(ROLE))('%s: the home services carousel is announced as "%s"', (locale, role) => {
    const { container } = renderPage(
      <GlideServices locale={locale} content={getHomeContent(locale).home.glideServices} />,
    )
    expect(container.querySelector('section.gl')).toHaveAttribute('aria-roledescription', role)
  })

  it.each(Object.keys(PAGES).flatMap((key) => ['bg', 'en', 'el'].map((locale) => [key, locale])))(
    '%s (%s) has no carousel left to announce',
    async (key, locale) => {
      // The steel page's slider of stock renders was the last one on a product page; a new
      // one would need its role description in all three languages again.
      const { container } = await renderProduct(key, locale)
      expect(container.querySelector('[aria-roledescription]')).toBeNull()
    },
  )
})

describe('modular houses comparison table', () => {
  it.each([
    ['el', elModularHouses],
    ['en', enModularHouses],
    ['bg', bgModularHouses],
  ])('%s: the area row states the gallery sizes from content, never 78 m²', async (locale, content) => {
    await renderProduct('modularHouses', locale)

    const area = content.compare.rows[0]
    const row = screen.getByRole('rowheader', { name: area.label }).closest('tr')
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent)
    // The stacked phone layout puts the column name inside each cell, so compare the end.
    area.values.forEach((value, i) => expect(cells[i].endsWith(value)).toBe(true))
    expect(row.textContent).not.toMatch(/78\s*[mм]/)
    if (locale !== 'bg') expect(row.textContent).not.toMatch(/[А-Яа-я]/)
  })

  it('heads the Greek table with the Greek model names', async () => {
    await renderProduct('modularHouses', 'el')

    for (const name of elModularHouses.compare.columns.slice(1)) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.queryByText(/Space capsule/i)).not.toBeInTheDocument()
  })
})

describe('English and Greek product pages', () => {
  it.each(Object.keys(PAGES).flatMap((key) => ['en', 'el'].map((locale) => [key, locale])))(
    '%s (%s) prints no Cyrillic, in its text or in what a screen reader reads',
    async (key, locale) => {
      const { container } = await renderProduct(key, locale)

      const said = [
        container.textContent,
        ...[...container.querySelectorAll('[alt], [aria-label], [title]')].flatMap((el) => (
          ['alt', 'aria-label', 'title'].map((name) => el.getAttribute(name) || '')
        )),
      ]
      const cyrillic = said.filter((text) => /[А-Яа-яЁёЀ-ӿ]/.test(text)).map((text) => text.slice(0, 160))
      expect(cyrillic).toEqual([])
    },
  )
})
