import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'

import InteriorsPage from './InteriorsPage.jsx'
import ModularBuildsPage from './ModularBuildsPage.jsx'
import ModularHousesPage from './ModularHousesPage.jsx'
import SteelHousesPage from './SteelHousesPage.jsx'

import bgInteriors from '../content/bg/interiors.js'
import elInteriors from '../content/el/interiors.js'
import enInteriors from '../content/en/interiors.js'
import bgModularBuilds from '../content/bg/modularBuilds.js'
import elModularBuilds from '../content/el/modularBuilds.js'
import enModularBuilds from '../content/en/modularBuilds.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import elModularHouses from '../content/el/modularHouses.js'
import enModularHouses from '../content/en/modularHouses.js'
import bgSteelHouses from '../content/bg/steelHouses.js'
import elSteelHouses from '../content/el/steelHouses.js'
import enSteelHouses from '../content/en/steelHouses.js'

// The brochure links a visitor can actually click on the product pages, rendered (and the
// interiors page's none).
//
// brochure.test.js proves the content files hold the right slugs and that the helper
// addresses the API; this proves each page hands the helper the right TRIPLE — slug, page,
// and its own locale. The failures are different: a page reading the wrong node passes
// every data test and opens the wrong catalogue, and a page dropping the locale renders a
// working link that serves Bulgarian to a Greek visitor forever.
//
// Since the 2026-10 rebuild the two product pages list their brochures as Catalogues cards
// (the home page's band), and the steel houses page links none. The gallery, the reviews and
// the page photos are not needed for any of this, so every API call answers 404 and the
// pages render without them.

const PAGES = {
  bg: { modularHouses: bgModularHouses, modularBuilds: bgModularBuilds, steelHouses: bgSteelHouses, interiors: bgInteriors },
  el: { modularHouses: elModularHouses, modularBuilds: elModularBuilds, steelHouses: elSteelHouses, interiors: elInteriors },
  en: { modularHouses: enModularHouses, modularBuilds: enModularBuilds, steelHouses: enSteelHouses, interiors: enInteriors },
}

const dir = '/api/brochures/'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPage(element) {
  const { container } = render(
    <MemoryRouter>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        {element}
      </ModalActionsProvider>
    </MemoryRouter>,
  )
  return container
}

/** Every brochure link on the page, in document order. */
function brochureLinks(container) {
  return [...container.querySelectorAll('a[href*="/api/brochures/"]')]
    .filter((a) => a.getAttribute('href').includes('.pdf'))
}

const hrefsOf = (container) => brochureLinks(container).map((a) => a.getAttribute('href'))

describe.each(Object.keys(PAGES))('%s', (locale) => {
  const content = PAGES[locale]

  it('the modular houses page opens the Box house and the capsule catalogues', () => {
    const container = renderPage(<ModularHousesPage locale={locale} content={content.modularHouses} />)

    expect(hrefsOf(container)).toEqual([
      `${dir}box-house.pdf?lang=${locale}#page=1`,
      `${dir}space-capsules.pdf?lang=${locale}#page=1`,
    ])
  })

  it('the modular builds page opens one catalogue per product card', () => {
    const container = renderPage(<ModularBuildsPage locale={locale} content={content.modularBuilds} />)

    expect(hrefsOf(container)).toEqual([
      `${dir}standard-containers.pdf?lang=${locale}#page=1`,
      `${dir}villa-office.pdf?lang=${locale}#page=1`,
      `${dir}sloped-roof.pdf?lang=${locale}#page=1`,
    ])
  })

  it('the steel houses page links no brochure', () => {
    // Its one brochure page was the summary catalogue's p.3; the rebuilt page asks for the
    // visitor's project instead, and a link to it would be a brochure nobody tests.
    const container = renderPage(<SteelHousesPage locale={locale} content={content.steelHouses} />)

    expect(hrefsOf(container)).toEqual([])
  })

  it('the interiors page links no brochure', () => {
    // Its one link, "p. 4" of the summary catalogue, opened the door-delivery page with the
    // old sea-transit windows; the rebuilt page (2026-10-15) asks for a free site visit instead.
    const container = renderPage(<InteriorsPage locale={locale} content={content.interiors} />)

    expect(hrefsOf(container)).toEqual([])
  })

  it.each(['modularBuilds', 'modularHouses'])('names each %s catalogue card by its visible label', (key) => {
    // The cards carry no aria-label any more: the label and the note are real text inside the
    // link, so a screen reader reads what a sighted visitor reads, and no hidden wording can
    // drift away from it.
    const Page = key === 'modularBuilds' ? ModularBuildsPage : ModularHousesPage
    const container = renderPage(<Page locale={locale} content={content[key]} />)
    const links = brochureLinks(container)

    expect(links.map((a) => a.querySelector('strong')?.textContent))
      .toEqual(content[key].catalogues.items.map((item) => item.label))
    for (const a of links) {
      expect(a).not.toHaveAttribute('aria-label')
      // A PDF opens in a new tab, never in place of the page.
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toContain('noopener')
    }
  })
})
