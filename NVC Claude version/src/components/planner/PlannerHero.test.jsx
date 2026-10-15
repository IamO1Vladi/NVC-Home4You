import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import PlannerHero from './PlannerHero.jsx'
import PlannerHowItWorks from './PlannerHowItWorks.jsx'
import bgContent from '../../content/bg/floorPlanner.js'
import elContent from '../../content/el/floorPlanner.js'

// The planner page's hero and its four steps. What these pin: the copy's placeholders are
// filled from the data (no number typed in the content files), the two ways in are real links
// to their sections that scroll instead of rewriting the URL once the script runs, and the 3D
// house is in the hero with its roof-and-veranda switch, as its poster and stage list where
// there is no WebGL (jsdom, the prerender).

const VALUES = { count: 18, areas: '37, 58 и 73' }

describe('PlannerHero', () => {
  it('is the page H1, with the lead and facts filled from the data', () => {
    render(<PlannerHero content={bgContent} locale="bg" values={VALUES} model="58" />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Планирайте разпределението на своята Бокс къща')
    expect(screen.getByText(/едно от 18 разпределения/)).toBeInTheDocument()
    // (the no-break space before the unit reads as a space to the query)
    expect(screen.getByText('Размерите от каталога: 37, 58 и 73 м²')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\{\w+\}/)
  })

  it('links to the templates and the editor, and scrolls there with the script', () => {
    const onGo = vi.fn()
    render(<PlannerHero content={bgContent} locale="bg" values={VALUES} model="58" onGo={onGo} />)

    const primary = screen.getByRole('link', { name: 'Започни от готов план' })
    const secondary = screen.getByRole('link', { name: 'Празен план' })
    expect(primary).toHaveAttribute('href', '#templates')
    expect(secondary).toHaveAttribute('href', '#editor')

    fireEvent.click(primary)
    fireEvent.click(secondary)
    expect(onGo.mock.calls.map((c) => c[0])).toEqual(['templates', 'editor'])
  })

  it('shows the house unfolding, the model it is given and the roof-and-veranda choice', () => {
    const onModelChange = vi.fn()
    const { container } = render(
      <PlannerHero content={bgContent} locale="bg" values={VALUES} model="73" onModelChange={onModelChange} />
    )

    expect(container.querySelector('figure.uh')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'С покрив и веранда' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /73/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /37/ }))
    expect(onModelChange).toHaveBeenCalledWith('37')
  })
})

describe('PlannerHowItWorks', () => {
  it('lists the four steps in order, as text', () => {
    render(<PlannerHowItWorks content={elContent} values={{ areas: '37, 58 και 73', areasOr: '37, 58 ή 73' }} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Πώς λειτουργεί' })).toBeInTheDocument()
    const steps = screen.getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveTextContent('Επιλέξτε μοντέλο')
    // a house is one of the sizes: "or", not "and"
    expect(steps[0]).toHaveTextContent('37, 58 ή 73 m²')
    expect(steps[3]).toHaveTextContent('Λαμβάνετε προσφορά')
  })
})
