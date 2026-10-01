import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CasesPage from './CasesPage.jsx'
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

    expect(await screen.findByText('Αγοράστηκε: Δομικές κατασκευές')).toBeInTheDocument()
    expect(screen.queryByText(/modularBuilds/)).not.toBeInTheDocument()
  })

  it('names it in English on the English page', async () => {
    render(<CasesPage content={enContent} />)

    expect(await screen.findByText(`${enContent.copy.labels.purchased}: Modular builds`)).toBeInTheDocument()
  })

  it('prints an older free-text product as it was typed', async () => {
    stubReviews([{ id: 'r2', name: 'Alice', rating: 4, product: 'Box house 37 m²', status: 'approved' }])
    render(<CasesPage content={elContent} />)

    expect(await screen.findByText('Αγοράστηκε: Box house 37 m²')).toBeInTheDocument()
  })
})
