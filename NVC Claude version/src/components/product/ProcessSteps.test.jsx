import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ProcessSteps, { STAGE_QUERY } from './ProcessSteps.jsx'

// The steps of a project, each with its own picture: all of it in the markup on a phone and
// without the script, and on a wide screen a sticky stage that follows the step being read.

const STEPS = [
  { title: 'Design', text: 'We draw the project.', image: { src: '/api/img/content/a.webp', alt: 'A render of the house', caption: 'The house' } },
  { title: 'Frame', text: 'We size the frame.', image: { src: '/api/img/content/b.webp', alt: 'The steel frame', caption: 'The frame' } },
  { title: 'Handover', text: 'We hand it over.', image: { src: '/api/img/content/c.webp', alt: 'The finished house', caption: 'Finished' } },
]

// A matchMedia that answers `wide` for the stage query, and an IntersectionObserver whose
// callback the test can call, standing in for the visitor scrolling.
function stubBrowser({ wide }) {
  const observers = []
  vi.stubGlobal('matchMedia', vi.fn((query) => ({
    matches: query === STAGE_QUERY ? wide : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
    observe(target) { this.targets.push(target) }
    disconnect() { this.targets = [] }
  })
  return observers
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProcessSteps', () => {
  it('is a section named by its h2 with every step, its words and its picture in an ordered list', () => {
    const { container } = render(<ProcessSteps heading="How a project goes" sub="Three steps." steps={STEPS} />)

    const section = screen.getByRole('region', { name: 'How a project goes' })
    expect(section).toHaveTextContent('Three steps.')
    const items = section.querySelectorAll('ol > li')
    expect(items).toHaveLength(3)
    STEPS.forEach((step, i) => {
      expect(items[i].querySelector('h3')).toHaveTextContent(step.title)
      expect(items[i]).toHaveTextContent(step.text)
      const img = items[i].querySelector('figure img')
      expect(img).toHaveAttribute('alt', step.image.alt)
      expect(img.getAttribute('src')).toContain(step.image.src)
      expect(items[i].querySelector('figcaption')).toHaveTextContent(step.image.caption)
    })
    // The number is drawn for the eye; the list already numbers the steps for a screen reader.
    expect(items[0].querySelector('.pp-step-n')).toHaveAttribute('aria-hidden', 'true')
    // Without matchMedia (no script, or a phone) there is no stage and nothing to press.
    expect(container.querySelector('.pp-stage')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('[aria-current]')).toBeNull()
  })

  it('keeps the phone layout, with no stage, under the wide breakpoint', () => {
    stubBrowser({ wide: false })
    const { container } = render(<ProcessSteps heading="How" steps={STEPS} />)
    expect(container.querySelector('.pp-process--live')).toBeNull()
    expect(container.querySelector('.pp-stage')).toBeNull()
    expect(container.querySelectorAll('.pp-step-fig img')).toHaveLength(3)
  })

  it('on a wide screen shows the step being read in the stage, and a step picks itself on click or focus', () => {
    const observers = stubBrowser({ wide: true })
    const { container } = render(<ProcessSteps id="steps" heading="How" steps={STEPS} />)

    expect(container.querySelector('.pp-process--live')).not.toBeNull()
    const stage = container.querySelector('#steps-stage')
    expect(stage.querySelectorAll('figure')).toHaveLength(3)
    const shown = () => [...stage.querySelectorAll('figure.is-on img')].map((img) => img.getAttribute('alt'))
    const current = () => [...container.querySelectorAll('li[aria-current="step"] h3')].map((h) => h.textContent)
    expect(shown()).toEqual(['A render of the house'])
    expect(current()).toEqual(['Design'])
    // Only the shown picture is exposed; the others are hidden from a screen reader too.
    expect(stage.querySelectorAll('figure[aria-hidden="true"]')).toHaveLength(2)
    // The step figures stay in the DOM, for the crawler and the snapshot.
    expect(container.querySelectorAll('.pp-step-fig img')).toHaveLength(3)

    // Scrolling the third step into the reading band.
    const observer = observers.at(-1)
    expect(observer.targets).toHaveLength(3)
    act(() => observer.callback([{ isIntersecting: true, target: observer.targets[2] }]))
    expect(shown()).toEqual(['The finished house'])
    expect(current()).toEqual(['Handover'])

    // Clicking a title, and tabbing to one.
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Design', 'Frame', 'Handover'])
    buttons.forEach((b) => expect(b).toHaveAttribute('aria-controls', 'steps-stage'))
    fireEvent.click(buttons[1])
    expect(shown()).toEqual(['The steel frame'])
    fireEvent.focus(buttons[0])
    expect(current()).toEqual(['Design'])
  })

  it('never advances by itself', () => {
    vi.useFakeTimers()
    try {
      stubBrowser({ wide: true })
      const { container } = render(<ProcessSteps heading="How" steps={STEPS} />)
      act(() => { vi.advanceTimersByTime(30000) })
      expect(container.querySelector('li[aria-current="step"] h3')).toHaveTextContent('Design')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays a plain list on a wide screen when no step has a picture', () => {
    // The interiors page's steps: its photos are in its own gallery, so there is nothing to
    // put on a stage, and title buttons would pick pictures that are not there.
    stubBrowser({ wide: true })
    const bare = STEPS.map(({ image, ...step }) => step)
    const { container } = render(<ProcessSteps heading="How" steps={bare} />)
    expect(container.querySelectorAll('ol > li')).toHaveLength(3)
    expect(container.querySelector('.pp-stage, .pp-step-btn, figure, [aria-current]')).toBeNull()
    expect(container.querySelector('.pp-process--live')).toBeNull()
  })

  it('renders nothing without steps', () => {
    const { container } = render(<ProcessSteps heading="How" steps={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
