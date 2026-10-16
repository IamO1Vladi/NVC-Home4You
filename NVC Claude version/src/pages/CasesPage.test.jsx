import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CasesPage from './CasesPage.jsx'
import bgContent from '../content/bg/cases.js'
import { paths } from '../routes/paths.js'
import elContent from '../content/el/cases.js'
import enContent from '../content/en/cases.js'

// A review's product is the KEY the review form saved ("modularBuilds"). The review list
// printed it as it came — "Αγοράστηκε: modularBuilds" on /el, and the same key in English
// and Bulgarian (Greek audit, #11). It is named with the labels the form's own select uses.

function stubReviews(reviews) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ cases: [], reviews, clients: [], stats: {} }),
  }))
}

describe('CasesPage reviews', () => {
  beforeEach(() => {
    stubReviews([
      { id: 'r1', name: 'Νίκος', rating: 5, comment: 'Πολύ καλή δουλειά', product: 'modularBuilds', status: 'approved' },
    ])
  })

  it('names the product in Greek on the Greek page', async () => {
    render(<CasesPage content={elContent} />)

    expect(await screen.findByText('Αγοράστηκε: Μονάδες-κοντέινερ')).toBeInTheDocument()
    expect(screen.queryByText(/modularBuilds/)).not.toBeInTheDocument()
  })

  it('names it in English on the English page', async () => {
    render(<CasesPage content={enContent} />)

    expect(await screen.findByText(`${enContent.copy.labels.purchased}: Container units`)).toBeInTheDocument()
  })

  it('prints an older free-text product as it was typed', async () => {
    stubReviews([{ id: 'r2', name: 'Alice', rating: 4, product: 'Box house 37 m²', status: 'approved' }])
    render(<CasesPage content={elContent} />)

    expect(await screen.findByText('Αγοράστηκε: Box house 37 m²')).toBeInTheDocument()
  })
})

// Each case card links to its product page and carries id="case-<id>" (2026-10-16): the Box,
// delivery, partner and About pages link "the house in Paralia Kariani" to #case-2, which
// used to land at the top of the page.
describe('CasesPage case cards', () => {
  const CASES = [
    { id: 2, category: 'Modular houses', product: '58 m² с веранда', location: 'Паралия Кариани, Гърция', images: [] },
    { id: 9, category: 'modularBuilds', product: 'Контейнер 6 × 3', location: 'Петрич', images: [] },
    { id: 11, category: 'interiors', product: 'Баня', location: 'София', images: [] },
  ]

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cases: CASES, reviews: [], clients: [], stats: {} }),
    }))
  })

  it.each([
    ['bg', bgContent],
    ['en', enContent],
    ['el', elContent],
  ])('%s: a card links to its product page, by category, and carries its case id', async (locale, content) => {
    const { container } = render(
      <MemoryRouter initialEntries={[paths.cases[locale]]}>
        <CasesPage content={content} />
      </MemoryRouter>,
    )
    await screen.findAllByText(content.copy.productLinks.modularHouses)

    const box = container.querySelector('#case-2')
    expect(within(box).getByRole('link', { name: content.copy.productLinks.modularHouses })).toHaveAttribute('href', paths.modularHouses[locale])
    const containers = container.querySelector('#case-9')
    expect(within(containers).getByRole('link', { name: content.copy.productLinks.modularBuilds })).toHaveAttribute('href', paths.modularBuilds[locale])
    // Interiors waits for the owner (Q19): the card is there, with no product link.
    const interiors = container.querySelector('#case-11')
    expect(interiors).not.toBeNull()
    expect(interiors.querySelector('.cs-case-more')).toBeNull()
  })

  it('every page that links to the published case lands on its card', async () => {
    const { caseHref } = await import('../lib/usePublishedCase.js')
    expect(caseHref(paths.cases.bg, '2')).toBe(`${paths.cases.bg}#case-2`)
    expect(caseHref(paths.cases.bg, undefined)).toBe(paths.cases.bg)
  })
})

describe('CasesPage direct link to a case', () => {
  let scrolled
  beforeEach(() => {
    scrolled = []
    Element.prototype.scrollIntoView = function scrollIntoView() { scrolled.push(this.id) }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cases: [{ id: 2, category: 'Modular houses', product: '58', images: [] }], reviews: [], clients: [], stats: {} }),
    }))
    window.history.replaceState(null, '', `${paths.cases.bg}#case-2`)
  })
  afterEach(() => {
    delete Element.prototype.scrollIntoView
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
  })

  it('brings the card into view once the cases have loaded', async () => {
    render(
      <MemoryRouter initialEntries={[`${paths.cases.bg}#case-2`]}>
        <CasesPage content={bgContent} />
      </MemoryRouter>,
    )
    await screen.findAllByText(bgContent.copy.productLinks.modularHouses)
    expect(scrolled).toContain('case-2')
  })
})
