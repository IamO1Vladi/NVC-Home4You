import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'

import GlideServices from '../components/GlideServices.jsx'
import ModularHousesPage from './ModularHousesPage.jsx'
import SteelHousesPage from './SteelHousesPage.jsx'

import { getHomeContent } from '../content/home/index.js'
import bgModularHouses from '../content/bg/modularHouses.js'
import elModularHouses from '../content/el/modularHouses.js'
import enModularHouses from '../content/en/modularHouses.js'
import bgSteelHouses from '../content/bg/steelHouses.js'
import elSteelHouses from '../content/el/steelHouses.js'
import enSteelHouses from '../content/en/steelHouses.js'

// Two leftovers of the Greek audit that live in components rather than copy: the carousels'
// aria-roledescription, hardcoded "carousel" (a screen reader says it aloud), and the
// modular-houses size cell, hardcoded with a Cyrillic м on every locale's page.

function renderPage(element) {
  return render(
    <MemoryRouter>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        {element}
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

const ROLE = { el: 'καρουζέλ', en: 'carousel', bg: 'carousel' }

describe('carousel role description', () => {
  it.each(Object.entries(ROLE))('%s: the home services carousel is announced as "%s"', (locale, role) => {
    const { container } = renderPage(
      <GlideServices locale={locale} content={getHomeContent(locale).home.glideServices} />,
    )
    expect(container.querySelector('section.gl')).toHaveAttribute('aria-roledescription', role)
  })

  it.each([
    ['el', elSteelHouses],
    ['en', enSteelHouses],
    ['bg', bgSteelHouses],
  ])('%s: the steel houses slider says the same', (locale, content) => {
    const { container } = renderPage(<SteelHousesPage locale={locale} content={content} />)
    expect(container.querySelector('.sh-slider')).toHaveAttribute('aria-roledescription', ROLE[locale])
  })
})

describe('modular houses comparison table', () => {
  it.each([
    ['el', elModularHouses],
    ['en', enModularHouses],
    ['bg', bgModularHouses],
  ])('%s: the expandable size cell comes from content, with a Latin m²', (locale, content) => {
    renderPage(<ModularHousesPage locale={locale} content={content} />)

    const row = screen.getByRole('rowheader', { name: content.table.size }).closest('tr')
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent)
    expect(cells).toEqual(['40–100 m²', '37 m² / 58 m² / 78 m²'])
    expect(row.textContent).not.toMatch(/м/)
  })

  it('heads the Greek table with the Greek model names', () => {
    renderPage(<ModularHousesPage locale="el" content={elModularHouses} />)

    expect(screen.getByRole('columnheader', { name: 'Κάψουλα χώρου' })).toBeInTheDocument()
    expect(screen.queryByText(/Space capsule/i)).not.toBeInTheDocument()
  })
})
