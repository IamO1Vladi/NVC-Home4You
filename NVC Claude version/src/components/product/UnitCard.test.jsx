import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import UnitCard from './UnitCard.jsx'

// One priced product: the anchor /bg/ceni uses, the price always printed with what it
// includes, a real button for the enquiry and a link for the details, each naming its model
// to a screen reader.

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <UnitCard
        id={13}
        title="Container House – 6000mm*3000mm"
        photo={{ url: '/api/img/gallery/1/a.webp' }}
        price={{ value: '€4,300', caption: 'incl. VAT and assembly' }}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('UnitCard', () => {
  it('is an article anchored at item-<gallery id> with an h3 title', () => {
    const { container } = renderCard()
    const card = container.querySelector('article#item-13')
    expect(card).not.toBeNull()
    expect(card).toHaveClass('hp-card', 'pp-unit')
    expect(within(card).getByRole('heading', { level: 3 })).toHaveTextContent('Container House – 6000mm*3000mm')
  })

  it('always shows the price and its caption, and the difference line and extra lines', () => {
    const { container } = renderCard({
      price: { prefix: 'from', value: '€14,000', caption: 'incl. VAT, without assembly' },
      difference: 'Fully glazed wall with an aluminium frame',
      lines: ['+ assembly €840 incl. VAT', null, 'with veranda: €16,700'],
    })
    expect(container.querySelector('.pp-unit-price')).toHaveTextContent('from €14,000')
    expect(container.querySelector('.pp-unit-caption')).toHaveTextContent('incl. VAT, without assembly')
    expect(container.querySelector('.pp-unit-diff')).toHaveTextContent('Fully glazed wall')
    expect([...container.querySelectorAll('.pp-unit-lines li')].map((li) => li.textContent))
      .toEqual(['+ assembly €840 incl. VAT', 'with veranda: €16,700'])
  })

  it('opens the offer form from a button and links to the details, both naming the model', () => {
    const onClick = vi.fn()
    renderCard({
      primary: { label: 'Request an offer for this model', onClick },
      details: { label: 'Details →', to: '/en/gallery/container-house-6000mm-3000mm' },
    })
    const button = screen.getByRole('button', { name: /^Request an offer for this model\s?: Container House – 6000mm\*3000mm$/ })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    const details = screen.getByRole('link', { name: /^Details →\s?: Container House – 6000mm\*3000mm$/ })
    expect(details).toHaveAttribute('href', '/en/gallery/container-house-6000mm-3000mm')
    expect(details).toHaveClass('pp-unit-more')
    // No link wraps the button: the card itself is not a link.
    expect(button.closest('a')).toBeNull()
  })

  it('resizes the photo through the API and gives it the title as alt by default', () => {
    renderCard()
    const img = screen.getByRole('img', { name: 'Container House – 6000mm*3000mm' })
    expect(img.getAttribute('src')).toBe('/api/img/gallery/1/a.webp?w=640')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('keeps the price and its caption together, and asks for a full-width photo on a phone', () => {
    // The phone card is one column (ProductPage.css): the photo spans the card, so the
    // browser must fetch a card-wide image, not the 112px thumbnail the old row layout took.
    const { container } = renderCard()
    const cost = container.querySelector('.pp-unit-cost')
    expect(cost).not.toBeNull()
    expect(cost.querySelector('.pp-unit-price')).toHaveTextContent('€4,300')
    expect(cost.querySelector('.pp-unit-caption')).toHaveTextContent('incl. VAT and assembly')
    expect(container.querySelector('img').getAttribute('sizes')).toMatch(/^\(max-width: 639px\) 100vw,/)
  })

  it('has a wide variant for a one-off product', () => {
    const { container } = renderCard({ id: 100015, title: 'Space house', wide: true })
    expect(container.querySelector('article#item-100015')).toHaveClass('pp-unit--wide')
  })

  it('renders without a photo or actions', () => {
    const { container } = renderCard({ photo: null })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.pp-unit-actions')).toBeNull()
    expect(container.querySelector('.pp-unit-price')).toHaveTextContent('€4,300')
  })
})
