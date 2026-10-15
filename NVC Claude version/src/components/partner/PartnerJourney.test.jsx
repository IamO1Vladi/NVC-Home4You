import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PartnerJourney, { MODES, bake } from './PartnerJourney.jsx'
import bg from '../../content/bg/partner.js'
import en from '../../content/en/partner.js'
import el from '../../content/el/partner.js'

// The partner hero's journey drawing (option B). What these pin: the switches are buttons with
// aria-pressed and work from the keyboard; the steps jump; the transport moves on each loop
// until the visitor picks one; reduced motion gets the three still panels, live; nothing runs
// off screen, in the prerender's browser or after unmount; a phone draws half the frames in
// real time; and the words keep the owner's facts (one factory, no speed or time claims,
// smaller shipments by air, no crane promised for every order).
// PartnerJourney.ssr.test.jsx renders the poster with no DOM at all.

const J = { bg: bg.journey, en: en.journey, el: el.journey }
const T_MS = 13600

let observers
let motion
class FakeIO {
  constructor(cb, options) { this.cb = cb; this.options = options; this.targets = []; this.off = false; observers.push(this) }
  observe(t) { this.targets.push(t) }
  unobserve() {}
  disconnect() { this.off = true }
}
const show = (on = true) => act(() => { for (const o of observers) o.cb([{ isIntersecting: on, target: o.targets[0] }], o) })

function stubMotion(reduce, phone = false) {
  const listeners = new Set()
  motion = {
    matches: reduce,
    listeners,
    set(v) { motion.matches = v; act(() => { listeners.forEach((fn) => fn({ matches: v })) }) },
  }
  vi.stubGlobal('matchMedia', (query) => ({
    get matches() { return query.includes('reduce') ? motion.matches : query.includes('pointer:coarse') ? phone : false },
    media: query,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
  }))
}

const pressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed')
const caption = (c) => c.querySelector('.pj-n').textContent

beforeEach(() => {
  observers = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  stubMotion(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PartnerJourney', () => {
  it('opens on the poster: the first caption, every step and switch, the summary', () => {
    const { container } = render(<PartnerJourney content={J.bg} />)
    expect(screen.getByRole('img', { name: J.bg.summary })).toBeInTheDocument()
    expect(caption(container)).toBe(J.bg.captions.factory)
    expect(container.querySelector('.pj-k').textContent).toBe('1 / 3')
    J.bg.steps.forEach((name, i) => {
      expect(screen.getByRole('button', { name: `Стъпка ${i + 1}: ${name}` })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Стъпка 1/ })).toHaveAttribute('aria-current', 'step')
    expect(within(screen.getByRole('group', { name: J.bg.transport })).getAllByRole('button')).toHaveLength(3)
    expect(within(screen.getByRole('group', { name: J.bg.arrival })).getAllByRole('button')).toHaveLength(2)
    expect(screen.getByRole('button', { name: J.bg.pause })).toBeInTheDocument()
    expect(pressed(J.bg.modes.sea)).toBe('true')
    expect(pressed(J.bg.places.yours)).toBe('true')
  })

  it('switches transport and arrival with aria-pressed, by click and by keyboard', async () => {
    const user = userEvent.setup()
    const { container } = render(<PartnerJourney content={J.bg} />)
    await user.click(screen.getByRole('button', { name: J.bg.modes.air }))
    expect(pressed(J.bg.modes.air)).toBe('true')
    expect(pressed(J.bg.modes.sea)).toBe('false')

    screen.getByRole('button', { name: J.bg.modes.rail }).focus()
    await user.keyboard('{Enter}')
    expect(pressed(J.bg.modes.rail)).toBe('true')
    expect(pressed(J.bg.modes.air)).toBe('false')

    // the arrival button says where on a wide screen
    const ours = screen.getByRole('button', { name: `${J.bg.places.ours}${J.bg.places.oursWhere}` })
    ours.focus()
    await user.keyboard(' ')
    expect(ours).toHaveAttribute('aria-pressed', 'true')
    expect(pressed(J.bg.places.yours)).toBe('false')

    // the drawing follows: only the train is shown, and our mountains rather than the trees
    expect(container.querySelector('[data-k="rail"]').style.display).toBe('')
    expect(container.querySelector('[data-k="sea"]').style.display).toBe('none')
    expect(container.querySelector('[data-a="ours"]').style.display).toBe('')
    expect(container.querySelector('[data-a="yours"]').style.display).toBe('none')
  })

  it('jumps to a step when it is pressed, and pauses and plays', () => {
    vi.useFakeTimers()
    const { container } = render(<PartnerJourney content={J.bg} />)
    fireEvent.click(screen.getByRole('button', { name: /Стъпка 3/ }))
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByRole('button', { name: /Стъпка 3/ })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /Стъпка 1/ })).not.toHaveAttribute('aria-current')
    expect(caption(container)).toBe(J.bg.captions.yours)

    fireEvent.click(screen.getByRole('button', { name: /Стъпка 2/ }))
    act(() => { vi.advanceTimersByTime(300) })
    expect(caption(container)).toBe(J.bg.captions.sea)

    fireEvent.click(screen.getByRole('button', { name: J.bg.pause }))
    expect(screen.getByRole('button', { name: J.bg.play })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: J.bg.play }))
    expect(screen.getByRole('button', { name: J.bg.pause })).toBeInTheDocument()
  })

  it('plays only on screen, moves to the next transport each loop, until the visitor picks one', () => {
    vi.useFakeTimers()
    render(<PartnerJourney content={J.en} />)
    // off screen: nothing scheduled
    expect(vi.getTimerCount()).toBe(0)
    show(true)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    act(() => { vi.advanceTimersByTime(T_MS + 500) })
    expect(pressed(J.en.modes.rail)).toBe('true')
    act(() => { vi.advanceTimersByTime(T_MS) })
    expect(pressed(J.en.modes.air)).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: J.en.modes.sea }))
    act(() => { vi.advanceTimersByTime(T_MS * 2) })
    expect(pressed(J.en.modes.sea)).toBe('true')

    // scrolled away: the loop stops
    show(false)
    act(() => { vi.advanceTimersByTime(100) })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops while paused and while the tab is hidden', () => {
    vi.useFakeTimers()
    render(<PartnerJourney content={J.bg} />)
    show(true)
    fireEvent.click(screen.getByRole('button', { name: J.bg.pause }))
    act(() => { vi.advanceTimersByTime(100) })
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: J.bg.play }))
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => { document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(100) })
    expect(vi.getTimerCount()).toBe(0)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('has the still panels in its first markup, so CSS can show them before any script', () => {
    // Off by default (PartnerJourney.css shows them only under prefers-reduced-motion), but there:
    // the opening frame, the ship close up and your warehouse, with their words.
    const { container } = render(<PartnerJourney content={J.bg} />)
    const board = container.querySelector('.pj-sb')
    expect(board).toHaveAttribute('aria-label', J.bg.storyboard)
    expect([...board.querySelectorAll('figcaption span')].map((s) => s.textContent)).toEqual([J.bg.captions.factory, J.bg.captions.sea, J.bg.captions.yours])
    expect(board.querySelectorAll('svg')).toHaveLength(3)
    expect(board.querySelectorAll('svg')[1].querySelector('[data-k="sea"]').getAttribute('style') || '').not.toMatch(/display:\s*none/)
    // the narrow layout is CSS (a container query), no class set by a script after the first paint
    expect(container.querySelector('.pj').className).toBe('pj')
  })

  it('with reduced motion shows the three still panels with the same words, live with the setting', async () => {
    stubMotion(true)
    vi.useFakeTimers()
    const { container } = render(<PartnerJourney content={J.bg} />)
    show(true)
    expect(container.querySelector('.pj')).toHaveClass('is-still')
    const board = screen.getByRole('group', { name: J.bg.storyboard })
    const captions = () => [...board.querySelectorAll('figcaption span')].map((s) => s.textContent)
    expect(captions()).toEqual([J.bg.captions.factory, J.bg.captions.sea, J.bg.captions.yours])
    expect(board.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3)
    // no autoplay
    act(() => { vi.advanceTimersByTime(T_MS * 2) })
    expect(vi.getTimerCount()).toBe(0)
    expect(pressed(J.bg.modes.sea)).toBe('true')

    // the switches still work and redraw the panels
    fireEvent.click(screen.getByRole('button', { name: J.bg.modes.air }))
    fireEvent.click(screen.getByRole('button', { name: `${J.bg.places.ours}${J.bg.places.oursWhere}` }))
    expect(captions()).toEqual([J.bg.captions.factory, J.bg.captions.air, J.bg.captions.ours])
    // by air, the crates, never the whole unit
    const air = board.querySelectorAll('svg')[1]
    expect(air.querySelector('[data-k="c"]').getAttribute('style') || '').not.toMatch(/display:\s*none/)
    expect(air.querySelector('[data-k="u"]').getAttribute('style')).toMatch(/display:\s*none/)

    // the setting turned off: the drawing is back (CSS hides the panels), the engine runs
    motion.set(false)
    expect(container.querySelector('.pj')).not.toHaveClass('is-still')
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('on a phone or a touch screen draws about half the frames, in real time', async () => {
    const drawn = async (phone) => {
      stubMotion(false, phone)
      vi.useFakeTimers()
      const { container, unmount } = render(<PartnerJourney content={J.bg} />)
      const fill = container.querySelector('.pj-step i i')
      let n = 0
      const mo = new MutationObserver((rs) => { n += rs.length })
      mo.observe(fill, { attributes: true, attributeFilter: ['style'] })
      show(true)
      await act(async () => { vi.advanceTimersByTime(3000) })
      mo.disconnect()
      // the time is real either way: in the second act after 3.6s
      act(() => { vi.advanceTimersByTime(600) })
      const second = screen.getByRole('button', { name: /Стъпка 2/ }).getAttribute('aria-current')
      unmount()
      vi.useRealTimers()
      return { n, second }
    }
    const full = await drawn(false)
    const phone = await drawn(true)
    expect(full.n).toBeGreaterThan(150)
    expect(phone.n).toBeLessThan(full.n * 0.6)
    expect(phone.n).toBeGreaterThan(full.n * 0.4)
    expect(full.second).toBe('step')
    expect(phone.second).toBe('step')
  })

  it('cleans up every timer, frame, observer and listener on unmount', () => {
    vi.useFakeTimers()
    const removed = vi.spyOn(document, 'removeEventListener')
    const { unmount } = render(<PartnerJourney content={J.bg} />)
    show(true)
    act(() => { vi.advanceTimersByTime(3500) }) // into the second act: a caption change pending
    fireEvent.click(screen.getByRole('button', { name: /Стъпка 3/ }))
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    expect(motion.listeners.size).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(observers.every((o) => o.off)).toBe(true)
    expect(motion.listeners.size).toBe(0)
    expect(removed).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('stays the poster in the prerender\'s browser', () => {
    vi.useFakeTimers()
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36 NVCPrerender/1.0')
    const { container } = render(<PartnerJourney content={J.bg} />)
    show(true)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(observers).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    const poster = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    poster.innerHTML = bake(0, 'sea', 'yours', true)
    expect(container.querySelector('svg.pj-svg').innerHTML).toBe(poster.innerHTML)
  })

  describe('the words', () => {
    const LOCALES = ['bg', 'en', 'el']
    const strings = (v) => (typeof v === 'string' ? [v] : Object.values(v || {}).flatMap(strings))

    it.each(LOCALES)('every label is in the content (%s)', (locale) => {
      const j = J[locale]
      for (const key of ['factory', ...MODES, 'yours', 'ours']) expect(j.captions[key]).toBeTruthy()
      for (const m of MODES) expect(j.modes[m]).toBeTruthy()
      expect(j.steps).toHaveLength(3)
      for (const key of ['summary', 'stepLabel', 'transport', 'arrival', 'pause', 'play', 'storyboard']) expect(j[key]).toBeTruthy()
      expect(j.stepLabel).toMatch(/\{n\}/)
      expect(j.stepLabel).toMatch(/\{name\}/)
    })

    it('says one factory, ours, in every language, never factories', () => {
      const PLURAL = { bg: /фабрики/i, en: /factories/i, el: /εργοστάσια|εργοστασίων/i }
      const ONE = { bg: 'Нашата фабрика в Китай', en: 'Our factory in China', el: 'Το εργοστάσιό μας στην Κίνα' }
      for (const locale of LOCALES) {
        expect(strings(J[locale]).filter((s) => PLURAL[locale].test(s))).toEqual([])
        expect(J[locale].captions.factory).toBe(ONE[locale])
      }
    })

    it('claims no speed and no transit time, and by air only smaller shipments', () => {
      const SPEED = /по-бърз|бързо|faster|quick|γρηγορότερ|γρήγορ|\d+\s*(дни|ден|седмиц|days?|weeks?|ημέρ|μέρ|εβδομάδ)/i
      const SMALLER = { bg: /по-малки/, en: /smaller/, el: /μικρότερα/ }
      for (const locale of LOCALES) {
        expect(strings(J[locale]).filter((s) => SPEED.test(s))).toEqual([])
        expect(J[locale].captions.air).toMatch(SMALLER[locale])
        expect(J[locale].summary).toMatch(SMALLER[locale])
      }
    })

    it('promises no crane for every order (a container may come without one)', () => {
      const CRANE = /кран|crane|γεραν/i
      for (const locale of LOCALES) expect(strings(J[locale]).filter((s) => CRANE.test(s))).toEqual([])
    })

    it('arrives at your warehouse or ours at Marikostinovo', () => {
      expect(J.bg.captions.yours).toBe('Вашият склад')
      expect(J.bg.captions.ours).toBe('Нашият склад в Марикостиново')
      expect(`${J.bg.places.ours}${J.bg.places.oursWhere}`).toBe(J.bg.captions.ours)
      expect(`${J.en.places.ours}${J.en.places.oursWhere}`).toBe(J.en.captions.ours)
      expect(`${J.el.places.ours}${J.el.places.oursWhere}`).toBe(J.el.captions.ours)
    })
  })
})
