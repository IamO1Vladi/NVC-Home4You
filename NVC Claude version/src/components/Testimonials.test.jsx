import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Testimonials from './Testimonials.jsx'

const content = {
  take: 3,
  heading: 'What our customers say',
  subheading: 'Verified reviews from homeowners across Europe.',
  aggregateAria: 'Average customer rating',
  countLabel: '{count} verified reviews',
  verified: 'Verified',
  customerFallback: 'Customer',
  ctaLabel: 'Read all reviews →',
}

function mockFetch(payload, { ok = true } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(payload),
  })
}

function renderTestimonials(props = {}) {
  return render(
    <MemoryRouter>
      <Testimonials locale="en" content={content} {...props} />
    </MemoryRouter>
  )
}

describe('Testimonials', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the heading, aggregate and one card per returned review', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        averageRating: 4.7,
        totalCount: 12,
        items: [
          { id: '1', name: 'Alice', rating: 5, comment: 'Fantastic', company: 'Acme', product: 'Modular house', location: 'Sofia' },
          { id: '2', name: 'Bob', rating: 4, comment: 'Very good' },
        ],
      })
    )

    renderTestimonials()

    expect(await screen.findByText('What our customers say')).toBeInTheDocument()
    // Aggregate score and resolved count label.
    expect(screen.getByText('4.7')).toBeInTheDocument()
    expect(screen.getByText('12 verified reviews')).toBeInTheDocument()
    // One card per review.
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('“Fantastic”')).toBeInTheDocument()
  })

  it('requests the configured number of reviews', async () => {
    const fetchMock = mockFetch({ averageRating: 5, totalCount: 1, items: [{ id: '1', name: 'Alice', rating: 5, comment: 'Good' }] })
    vi.stubGlobal('fetch', fetchMock)

    renderTestimonials()

    await screen.findByText('Alice')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/reviews/featured?take=3'))
  })

  it('falls back to the customer label when a review has no name', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ averageRating: 5, totalCount: 1, items: [{ id: '1', name: '', rating: 5, comment: 'Anonymous but happy' }] })
    )

    renderTestimonials()

    expect(await screen.findByText('Customer')).toBeInTheDocument()
  })

  it('renders nothing when there are no approved reviews', async () => {
    vi.stubGlobal('fetch', mockFetch({ averageRating: 0, totalCount: 0, items: [] }))

    const { container } = renderTestimonials()

    // Give the effect a chance to resolve, then assert the section never appears.
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByText('What our customers say')).not.toBeInTheDocument()
    expect(container.querySelector('.testimonials')).toBeNull()
  })

  it('renders nothing when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const { container } = renderTestimonials()

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByText('What our customers say')).not.toBeInTheDocument()
    expect(container.querySelector('.testimonials')).toBeNull()
  })

  it('renders nothing when the response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetch({ items: [] }, { ok: false }))

    const { container } = renderTestimonials()

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container.querySelector('.testimonials')).toBeNull()
  })
})
