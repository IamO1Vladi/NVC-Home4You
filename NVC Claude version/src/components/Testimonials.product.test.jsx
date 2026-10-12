import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Testimonials from './Testimonials.jsx'

// The product pages' use of the reviews section: with `product` it asks the API for that
// product's reviews, up to `limit`, and shows the rating and count the API computed for that
// product; Testimonials.test.jsx pins the home page's call, which must not change.

const content = {
  take: 3,
  heading: 'What buyers say',
  aggregatePattern: '{score} from {count} verified reviews',
  verified: 'Verified',
  customerFallback: 'Customer',
}

const items = [
  { id: '1', name: 'Ivan', rating: 5, comment: 'Container one', product: 'modularBuilds' },
  { id: '2', name: 'Maria', rating: 5, comment: 'A house', product: 'modularHouses' },
  { id: '3', name: 'Petar', rating: 4, comment: 'Container two', product: 'modularBuilds' },
  { id: '4', name: 'Georgi', rating: 5, comment: 'Container three', product: 'modularBuilds' },
  { id: '5', name: 'Stoyan', rating: 5, comment: 'Container four', product: 'modularBuilds' },
]

function mockFetch(payload) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) })
}

function renderIt(props = {}) {
  return render(
    <MemoryRouter>
      <Testimonials locale="en" content={content} {...props} />
    </MemoryRouter>,
  )
}

const containers = items.filter((item) => item.product === 'modularBuilds')

describe('Testimonials for one product', () => {
  it('asks the API for that product, up to the limit', async () => {
    const fetchMock = mockFetch({ averageRating: 4.8, totalCount: 4, items: containers.slice(0, 2) })
    vi.stubGlobal('fetch', fetchMock)

    renderIt({ product: 'modularBuilds', limit: 2 })

    await screen.findByText('Ivan')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/reviews/featured?take=2&product=modularBuilds'))
    expect(screen.getByText('Petar')).toBeInTheDocument()
  })

  it("quotes the product's own rating and count from the API", async () => {
    vi.stubGlobal('fetch', mockFetch({ averageRating: 4.5, totalCount: 4, items: containers }))

    renderIt({ product: 'modularBuilds', limit: 6 })

    await screen.findByText('Ivan')
    expect(screen.getByText('4.5 from 4 verified reviews')).toBeInTheDocument()
  })

  it('asks for content.take of them when no limit is given', async () => {
    const fetchMock = mockFetch({ averageRating: 4.8, totalCount: 4, items: containers.slice(0, 3) })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = renderIt({ product: 'modularBuilds' })

    await screen.findByText('Ivan')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/reviews/featured?take=3&product=modularBuilds'))
    expect(container.querySelectorAll('.cs-review-card')).toHaveLength(3)
  })

  it('renders nothing when no review is about that product', async () => {
    const fetchMock = mockFetch({ averageRating: 0, totalCount: 0, items: [] })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = renderIt({ product: 'steelHouses' })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('product=steelHouses')))
    // Let the response settle before asserting that nothing appeared.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container.querySelector('.testimonials')).toBeNull()
  })

  it('trims the home call to a limit without filtering it', async () => {
    const fetchMock = mockFetch({ averageRating: 4.8, totalCount: 12, items })
    vi.stubGlobal('fetch', fetchMock)

    const { container } = renderIt({ limit: 2 })

    await screen.findByText('Ivan')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/reviews\/featured\?take=3$/))
    expect(container.querySelectorAll('.cs-review-card')).toHaveLength(2)
    expect(screen.getByText('Maria')).toBeInTheDocument()
  })
})
