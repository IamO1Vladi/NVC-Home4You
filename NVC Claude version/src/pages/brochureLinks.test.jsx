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
// brochure.test.js proves the content files hold the right names and that the helper encodes
// them; this proves each page hands the helper the right pair. The two are different failures:
// a page reading `content.quick.brochurePage` where it means `content.models.house.brochurePage`
// passes every data test and opens the wrong catalogue at the wrong page.

const PAGES = {
  bg: { modularHouses: bgModularHouses, modularBuilds: bgModularBuilds, steelHouses: bgSteelHouses, interiors: bgInteriors },
  el: { modularHouses: elModularHouses, modularBuilds: elModularBuilds, steelHouses: elSteelHouses, interiors: elInteriors },
  en: { modularHouses: enModularHouses, modularBuilds: enModularBuilds, steelHouses: enSteelHouses, interiors: enInteriors },
}

const CAPSULES = '%D0%9A%D0%BE%D1%81%D0%BC%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B8%20%D0%9A%D0%B0%D0%BF%D1%81%D1%83%D0%BB%D0%B8.pdf'
const BOX = '%D0%A0%D0%B0%D0%B7%D0%B3%D1%8A%D0%B2%D0%B0%D0%B5%D0%BC%D0%B8%20%E2%80%9C%D0%91%D0%BE%D0%BA%D1%81%E2%80%9D%20%D0%9A%D1%8A%D1%89%D0%B0.pdf'
const CONTAINERS = '%D0%A1%D1%82%D0%B0%D0%BD%D0%B4%D0%B0%D1%80%D1%82%D0%BD%D0%B8%20%D0%BA%D0%BE%D0%BD%D1%82%D0%B5%D0%B9%D0%BD%D0%B5%D1%80%D0%B8.pdf'
const VILLA = '%D0%92%D0%B8%D0%BB%D0%B0-%D0%9E%D1%84%D0%B8%D1%81.pdf'
const SLOPED = '%D0%A1%D0%BA%D0%BE%D1%81%D0%B5%D0%BD%20%D0%BF%D0%BE%D0%BA%D1%80%D0%B8%D0%B2.pdf'

const dir = '/modular-builds/'

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
  return [...container.querySelectorAll('a[href*="/modular-builds/"]')]
    .filter((a) => a.getAttribute('href').includes('.pdf'))
}

const hrefsOf = (container) => brochureLinks(container).map((a) => a.getAttribute('href'))

describe.each(Object.keys(PAGES))('%s', (locale) => {
  const content = PAGES[locale]

  it('the modular houses page opens the two capsule catalogues and the summary brochure', () => {
    const container = renderPage(<ModularHousesPage locale={locale} content={content.modularHouses} />)

    expect(hrefsOf(container)).toEqual([
      `${dir}modular-builds.pdf#page=2`,
      `${dir}${CAPSULES}#page=1`,
      `${dir}${BOX}#page=1`,
    ])
  })

  it('the modular builds page opens one catalogue per product card', () => {
    const container = renderPage(<ModularBuildsPage content={content.modularBuilds} />)

    expect(hrefsOf(container)).toEqual([
      `${dir}${CONTAINERS}#page=1`,
      `${dir}${VILLA}#page=1`,
      `${dir}${SLOPED}#page=1`,
    ])
  })

  it('the steel houses page opens the summary brochure at page 3', () => {
    const container = renderPage(<SteelHousesPage content={content.steelHouses} />)

    expect(hrefsOf(container)).toEqual([`${dir}modular-builds.pdf#page=3`])
  })

  it('the interiors page opens the summary brochure at page 4', () => {
    const container = renderPage(<InteriorsPage content={content.interiors} />)

    expect(hrefsOf(container)).toEqual([`${dir}modular-builds.pdf#page=4`])
  })

  it('keeps the wording a visitor reads on each brochure link', () => {
    // The refactor was meant to be invisible. Reading the label back off the rendered link
    // is what makes "invisible" checkable, in a language nobody on the team reads fluently.
    const houses = renderPage(<ModularHousesPage locale={locale} content={content.modularHouses} />)
    expect(brochureLinks(houses)[0].textContent.trim()).toBe(content.modularHouses.quick.viewPdf)

    const steel = renderPage(<SteelHousesPage content={content.steelHouses} />)
    expect(brochureLinks(steel)[0].textContent.trim()).toBe(content.steelHouses.brochureLabel)

    const interiors = renderPage(<InteriorsPage content={content.interiors} />)
    expect(brochureLinks(interiors)[0].textContent.trim())
      .toBe(content.interiors.hero.quick.brochureLabel)
  })

  it('labels each product card link for a screen reader', () => {
    // The cards are images, so the aria-label is the only wording there is.
    const builds = renderPage(<ModularBuildsPage content={content.modularBuilds} />)
    expect(brochureLinks(builds).map((a) => a.getAttribute('aria-label')))
      .toEqual(content.modularBuilds.products.map((p) => p.aria))

    const houses = renderPage(<ModularHousesPage locale={locale} content={content.modularHouses} />)
    expect(brochureLinks(houses).slice(1).map((a) => a.getAttribute('aria-label')))
      .toEqual([content.modularHouses.models.house.aria, content.modularHouses.models.expandable.aria])
  })
})
