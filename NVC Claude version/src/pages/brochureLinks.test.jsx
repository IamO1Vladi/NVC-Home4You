import React from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
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

// The eight brochure links a visitor can actually click, rendered.
//
// brochure.test.js proves the content files hold the right slugs and that the helper
// addresses the API; this proves each page hands the helper the right TRIPLE — slug, page,
// and its own locale. The failures are different: a page reading the wrong node passes
// every data test and opens the wrong catalogue, and a page dropping the locale renders a
// working link that serves Bulgarian to a Greek visitor forever.

const PAGES = {
  bg: { modularHouses: bgModularHouses, modularBuilds: bgModularBuilds, steelHouses: bgSteelHouses, interiors: bgInteriors },
  el: { modularHouses: elModularHouses, modularBuilds: elModularBuilds, steelHouses: elSteelHouses, interiors: elInteriors },
  en: { modularHouses: enModularHouses, modularBuilds: enModularBuilds, steelHouses: enSteelHouses, interiors: enInteriors },
}

const dir = '/api/brochures/'

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

  it('the modular houses page opens the two capsule catalogues and the summary brochure', () => {
    const container = renderPage(<ModularHousesPage locale={locale} content={content.modularHouses} />)

    expect(hrefsOf(container)).toEqual([
      `${dir}modular-builds.pdf?lang=${locale}#page=2`,
      `${dir}space-capsules.pdf?lang=${locale}#page=1`,
      `${dir}box-house.pdf?lang=${locale}#page=1`,
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

  it('the steel houses page opens the summary brochure at page 3', () => {
    const container = renderPage(<SteelHousesPage locale={locale} content={content.steelHouses} />)

    expect(hrefsOf(container)).toEqual([`${dir}modular-builds.pdf?lang=${locale}#page=3`])
  })

  it('the interiors page opens the summary brochure at page 4', () => {
    const container = renderPage(<InteriorsPage locale={locale} content={content.interiors} />)

    expect(hrefsOf(container)).toEqual([`${dir}modular-builds.pdf?lang=${locale}#page=4`])
  })

  it('keeps the wording a visitor reads on each brochure link', () => {
    // The refactor was meant to be invisible. Reading the label back off the rendered link
    // is what makes "invisible" checkable, in a language nobody on the team reads fluently.
    const houses = renderPage(<ModularHousesPage locale={locale} content={content.modularHouses} />)
    expect(brochureLinks(houses)[0].textContent.trim()).toBe(content.modularHouses.quick.viewPdf)

    const steel = renderPage(<SteelHousesPage locale={locale} content={content.steelHouses} />)
    expect(brochureLinks(steel)[0].textContent.trim()).toBe(content.steelHouses.brochureLabel)

    const interiors = renderPage(<InteriorsPage locale={locale} content={content.interiors} />)
    expect(brochureLinks(interiors)[0].textContent.trim())
      .toBe(content.interiors.hero.quick.brochureLabel)
  })

  it('labels each product card link for a screen reader', () => {
    // The cards are images, so the aria-label is the only wording there is.
    const builds = renderPage(<ModularBuildsPage locale={locale} content={content.modularBuilds} />)
    expect(brochureLinks(builds).map((a) => a.getAttribute('aria-label')))
      .toEqual(content.modularBuilds.products.map((p) => p.aria))

    const houses = renderPage(<ModularHousesPage locale={locale} content={content.modularHouses} />)
    expect(brochureLinks(houses).slice(1).map((a) => a.getAttribute('aria-label')))
      .toEqual([content.modularHouses.models.house.aria, content.modularHouses.models.expandable.aria])
  })
})
