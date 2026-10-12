import React from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import Catalogues from './Catalogues.jsx'
import enHome from '../content/en/home.js'
import bgHome from '../content/bg/home.js'
import elHome from '../content/el/home.js'

// The icons are keyed by slug, and a slug with no drawing falls back to a plain document.
// That fallback is right for a catalogue added tomorrow and wrong for the six we have, where
// it would mean a slug was renamed in one language's content and the drawing quietly lost.

function iconMarkup(content) {
  const { container } = render(<Catalogues locale="en" content={content} />)
  return [...container.querySelectorAll('.hp-cat-ico svg')].map((svg) => svg.innerHTML)
}

const fallback = iconMarkup({ heading: 'x', items: [{ brochureSlug: 'not-a-range', label: 'New' }] })[0]

describe('Catalogues icons', () => {
  it('draws a document, not an empty tile, for a catalogue it has no drawing for', () => {
    expect(fallback).toMatch(/<path/)
  })

  it.each([
    ['en', enHome],
    ['bg', bgHome],
    ['el', elHome],
  ])('gives each of the six %s catalogues its own drawing', (_, content) => {
    const icons = iconMarkup(content.home.catalogues)
    expect(icons).toHaveLength(6)
    icons.forEach((markup) => expect(markup).not.toBe(fallback))
    expect(new Set(icons).size).toBe(6)
  })
})
