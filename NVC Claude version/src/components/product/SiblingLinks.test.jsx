import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SiblingLinks from './SiblingLinks.jsx'

// The other product pages, one link card each, with the live price the page passes in.

function renderSiblings(props = {}) {
  return render(
    <MemoryRouter>
      <SiblingLinks
        heading="Looking for something else?"
        go="See →"
        items={[
          { to: '/en/modular-houses', label: 'Modular houses', desc: 'Expandable Box houses and the capsule.', price: 'from €10,500 without assembly' },
          { to: '/en/steel-houses', label: 'Steel-frame houses to your plan', desc: 'Priced per project.' },
          { to: '', label: 'Broken' },
        ]}
        {...props}
      />
    </MemoryRouter>,
  )
}

describe('SiblingLinks', () => {
  it('is a section named by its h2 with one link per page', () => {
    const { container } = renderSiblings()
    const section = container.querySelector('section.pp-siblings')
    const h2 = screen.getByRole('heading', { level: 2, name: 'Looking for something else?' })
    expect(section.getAttribute('aria-labelledby')).toBe(h2.id)

    const links = within(section).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/en/modular-houses', '/en/steel-houses'])
    expect(links[0]).toHaveTextContent('Modular houses')
    expect(links[0].querySelector('.pp-sib-price')).toHaveTextContent('from €10,500 without assembly')
    // No price passed, no price line.
    expect(links[1].querySelector('.pp-sib-price')).toBeNull()
  })

  it('renders nothing with no usable items', () => {
    const { container } = renderSiblings({ items: [] })
    expect(container.querySelector('section')).toBeNull()
  })
})
