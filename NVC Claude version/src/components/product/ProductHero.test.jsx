import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProductHero from './ProductHero.jsx'

// The product pages' first screen: one H1, the price only when there is one, buttons that are
// buttons and links that are links, and a page with no photo that still lays out.

function renderHero(props = {}) {
  return render(
    <MemoryRouter>
      <ProductHero
        eyebrow="Container units"
        title="Containers for living, office and site"
        lead="Delivered and assembled by us."
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('ProductHero', () => {
  it('names the section by its one H1', () => {
    const { container } = renderHero()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Containers for living, office and site')
    expect(container.querySelector('section').getAttribute('aria-labelledby')).toBe(h1.id)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('prints the price with its basis, and nothing while there is no figure', () => {
    const { container, rerender } = renderHero({ price: { prefix: 'from', value: '€4,300', caption: 'incl. VAT and assembly' } })
    const price = container.querySelector('.pp-price')
    expect(price).toHaveTextContent('from €4,300')
    expect(price.querySelector('.pp-price-caption')).toHaveTextContent('incl. VAT and assembly')

    rerender(
      <MemoryRouter>
        <ProductHero title="T" price={{ prefix: 'from', value: null, caption: 'incl. VAT' }} />
      </MemoryRouter>,
    )
    expect(container.querySelector('.pp-price')).toBeNull()
  })

  it('renders an onClick action as a button and to/href actions as links', () => {
    const onClick = vi.fn()
    renderHero({
      primary: { label: 'Request an offer', onClick },
      secondary: { label: 'Call us', href: 'tel:+359879355269' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request an offer' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    const call = screen.getByRole('link', { name: 'Call us' })
    expect(call).toHaveAttribute('href', 'tel:+359879355269')
    expect(call).toHaveClass('hp-btn', 'ghost')
    expect(call).not.toHaveAttribute('target')
  })

  it('routes a `to` action inside the app', () => {
    renderHero({ primary: { label: 'Build online', to: '/bg/konfigurator-box-kyshti' } })
    expect(screen.getByRole('link', { name: 'Build online' })).toHaveAttribute('href', '/bg/konfigurator-box-kyshti')
  })

  it('shows a photo with its alt text and caption chip, resized by the API', () => {
    const { container } = renderHero({
      photo: { url: '/api/img/cases/1/house.webp', alt: 'The 58 m² house on its slab', caption: '58 m² · Paralia Kariani · 2026', position: '50% 45%' },
    })
    const img = screen.getByRole('img', { name: 'The 58 m² house on its slab' })
    expect(img.getAttribute('src')).toBe('/api/img/cases/1/house.webp?w=800')
    expect(img.getAttribute('srcset')).toContain('?w=480 480w')
    expect(img).toHaveAttribute('width', '1200')
    expect(img).toHaveAttribute('height', '900')
    expect(img.style.objectPosition).toBe('50% 45%')
    expect(container.querySelector('figcaption.pp-hero-chip')).toHaveTextContent('58 m² · Paralia Kariani · 2026')
    expect(container.querySelector('.pp-hero--solo')).toBeNull()
  })

  it('lays out without a photo: a right column from children, or the copy alone', () => {
    const { container, rerender } = renderHero({ photo: null, children: <table aria-label="Specs"><tbody /></table> })
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.pp-hero-aside table')).not.toBeNull()
    expect(container.querySelector('.pp-hero--solo')).toBeNull()

    rerender(
      <MemoryRouter>
        <ProductHero title="Steel-frame houses" photo={{ url: '' }} />
      </MemoryRouter>,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.pp-hero.pp-hero--solo')).not.toBeNull()
  })

  it('prints the facts as a list', () => {
    renderHero({ facts: ['Bathroom', 'Electrics and plumbing'] })
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Bathroom', 'Electrics and plumbing'])
  })
})
