import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import ConfiguratorStrip from './ConfiguratorStrip.jsx'
import { getHomeContent } from '../content/home/index.js'
import { paths } from '../routes/paths.js'

// The home strip's planner link was hidden below 768px (.hp-desk) while the planner was a
// desktop tool. Since the redesign its page works on a phone (owner, 2026-10-15), so the link
// is shown at every width: no class hides it, and the class that did is gone from the CSS.

describe('ConfiguratorStrip', () => {
  it.each(['bg', 'en', 'el'])('%s: links the planner beside the prices, on every screen', (locale) => {
    const strip = getHomeContent(locale).home.strip
    const { container } = render(
      <MemoryRouter>
        <ConfiguratorStrip locale={locale} content={strip} />
      </MemoryRouter>,
    )
    const links = within(container.querySelector('.hp-head-links')).getAllByRole('link')
    // Prices, then the gallery (2026-10-16: the home page's link to every model with photos),
    // then the planner.
    expect(links.map((a) => a.getAttribute('href'))).toEqual([paths.prices[locale], paths.gallery[locale], paths.planner[locale]])
    expect(links[1]).toHaveTextContent(strip.gallery)
    expect(links[2]).toHaveTextContent(strip.planner)
    expect(links[2].getAttribute('class')).toBeNull()
  })

  it('leaves no rule in the home styles that hides a link on phones', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../style/HomePage.css'), 'utf8')
    expect(css).not.toMatch(/\.hp-desk\b/)
  })
})
