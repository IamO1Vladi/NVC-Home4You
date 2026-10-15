import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UnfoldHouse, { UNFOLD_CONTENT, resetWebglProbe } from './UnfoldHouse.jsx'

// The WebGL half is replaced by a stand-in that hands up a fake scene, so these tests run
// the real clock, captions and controls without three.js (jsdom has no WebGL anyway).
const canvas = vi.hoisted(() => ({ mounted: 0, scene: null }))
vi.mock('./UnfoldCanvas.jsx', async () => {
  const { useEffect } = await import('react')
  return {
    default: function FakeCanvas({ onReady, label }) {
      useEffect(() => {
        canvas.mounted += 1
        onReady(canvas.scene)
        return () => onReady(null)
      }, [])
      return <div role="img" aria-label={label} data-testid="fake-canvas" />
    },
  }
})

function fakeScene() {
  return {
    setPose: vi.fn(),
    render: vi.fn(),
    drift: vi.fn(),
    resetView: vi.fn(),
    setTheme: vi.fn(),
    setModel: vi.fn(),
    dispose: vi.fn(),
  }
}

// IntersectionObserver stand-in: tests call show(ratio) to scroll the house into view.
let observers = []
class FakeObserver {
  constructor(cb, options) { this.cb = cb; this.options = options; observers.push(this) }
  observe() {}
  disconnect() { this.gone = true }
}
const show = (ratio = 0.8) => act(() => {
  for (const o of observers.filter((x) => !x.gone)) o.cb([{ isIntersecting: ratio > 0, intersectionRatio: ratio }])
})

const items = () => screen.getAllByRole('listitem')
const poster = () => document.querySelector('.uh-poster')

describe('UnfoldHouse without WebGL (jsdom, old devices, the prerendered page)', () => {
  it('shows the poster of the finished house and the stages as text', () => {
    render(<UnfoldHouse locale="bg" />)
    const figure = document.querySelector('figure.uh')
    expect(figure.dataset.status).toBe('static')
    expect(poster().getAttribute('src')).toBe('/planner/unfold-37.webp')
    expect(poster().getAttribute('alt')).toMatch(/37\s*м²/)
    expect(items()).toHaveLength(6)
    expect(items()[0].textContent).toContain('Доставка в сгънат вид')
    expect(items()[5].textContent).toContain('Готова къща')
    // the caption shows the finished house, matching the poster
    expect(document.querySelector('.uh-step-label').textContent).toBe('Готова къща')
    // length × width, as the catalogue and the editor write it, never split across lines;
    // and the finished house has its standard terrace, as the plan cards show
    expect(document.querySelector('.uh-step-note').textContent).toMatch(/5,90\u00a0×\u00a06,26\u00a0м/)
    expect(document.querySelector('.uh-step-note').textContent).toContain('6230\u00a0×\u00a02000')
    expect(screen.queryByRole('button', { name: 'Пусни' })).toBeNull()
    expect(canvas.mounted).toBe(0)
  })

  it('switches to the roof and veranda version and to the longer models', () => {
    render(<UnfoldHouse locale="en" />)
    fireEvent.click(screen.getByRole('button', { name: 'With roof and veranda' }))
    expect(items()).toHaveLength(8)
    expect(items()[7].textContent).toContain('Veranda')
    // the roof-and-veranda house's veranda is the catalogue's 6260 × 2000, not the flat deck
    expect(items()[7].textContent).toContain('6260\u00a0×\u00a02000')
    expect(poster().getAttribute('src')).toBe('/planner/unfold-37-roof.webp')
    fireEvent.click(screen.getByRole('button', { name: /^73\s*m²$/ }))
    expect(poster().getAttribute('src')).toBe('/planner/unfold-73-roof.webp')
    expect(screen.getByRole('button', { name: /^73\s*m²$/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Base model' }))
    expect(items()).toHaveLength(6)
    expect(document.querySelector('.uh-step-note').textContent).toMatch(/11\.80\u00a0×\u00a06\.26/)
  })

  it('takes the variant and model from the page when it controls them', () => {
    const onVariantChange = vi.fn()
    render(<UnfoldHouse locale="el" variant="roof" model="58" onVariantChange={onVariantChange} showModelSwitch={false} />)
    expect(poster().getAttribute('src')).toBe('/planner/unfold-58-roof.webp')
    expect(screen.queryByRole('group', { name: UNFOLD_CONTENT.el.modelLabel })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: UNFOLD_CONTENT.el.variants.base }))
    expect(onVariantChange).toHaveBeenCalledWith('base')
    // still the page's value until it passes a new one
    expect(items()).toHaveLength(8)
  })

  it('uses the dark poster on the dark theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    render(<UnfoldHouse locale="bg" />)
    expect(poster().getAttribute('src')).toBe('/planner/unfold-37-dark.webp')
    document.documentElement.removeAttribute('data-theme')
  })
})

describe('UnfoldHouse with WebGL', () => {
  let userAgent
  let getContext
  beforeEach(() => {
    observers = []
    canvas.mounted = 0
    canvas.scene = fakeScene()
    window.WebGLRenderingContext = function WebGLRenderingContext() {}
    // jsdom draws nothing: a canvas that hands out a stand-in context is a browser with WebGL
    getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function fakeGetContext(kind) {
      return /webgl/.test(kind) ? { getExtension: () => ({ loseContext() {} }) } : null
    }
    resetWebglProbe()
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(performance.now()), 16))
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id))
    userAgent = window.navigator.userAgent
  })
  afterEach(() => {
    delete window.WebGLRenderingContext
    HTMLCanvasElement.prototype.getContext = getContext
    resetWebglProbe()
    vi.unstubAllGlobals()
    Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true })
    delete window.matchMedia
    document.documentElement.removeAttribute('data-theme')
  })

  it('loads the 3D only when the house nears the screen, then plays it once from the folded box', async () => {
    render(<UnfoldHouse locale="bg" />)
    const figure = document.querySelector('figure.uh')
    expect(figure.dataset.status).toBe('idle')
    expect(canvas.mounted).toBe(0)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    expect(figure.dataset.status).toBe('live')
    show(0.8) // the "mostly on screen" observer reports again once the scene is there
    expect(canvas.scene.setPose).toHaveBeenCalledWith(0)
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument()
    expect(document.querySelector('.uh-step-label').textContent).toBe('Доставка в сгънат вид')
    // the canvas carries the text alternative; the poster steps aside
    expect(screen.getByRole('img', { name: /Триизмерна анимация/ })).toBeInTheDocument()
    expect(poster().getAttribute('alt')).toBe('')
  })

  it('does not play on its own for reduced motion, and the stage ticks jump', async () => {
    window.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} })
    render(<UnfoldHouse locale="en" />)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    show(0.8)
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    const ticks = within(document.querySelector('.uh-ticks')).getAllByRole('button')
    expect(ticks).toHaveLength(6)
    fireEvent.click(ticks[2])
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(2)
    expect(document.querySelector('.uh-step-label').textContent).toBe('The floor comes down')
  })

  it('carries on into the roof and veranda when that version is picked on the finished house', async () => {
    window.matchMedia = () => ({ matches: false })
    render(<UnfoldHouse locale="en" autoplay={false} />)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'With roof and veranda' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(within(document.querySelector('.uh-ticks')).getAllByRole('button')).toHaveLength(8)
    expect(screen.getByRole('slider', { name: 'Unfolding stage' })).toHaveAttribute('max', '7000')
  })

  it('follows the theme and the model switch, and keeps the poster for the prerender browser', async () => {
    render(<UnfoldHouse locale="bg" autoplay={false} />)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    act(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await vi.waitFor(() => expect(canvas.scene.setTheme).toHaveBeenLastCalledWith(true))
    fireEvent.click(screen.getByRole('button', { name: /^58\s*м²$/ }))
    expect(canvas.scene.setModel).toHaveBeenCalledWith('58')
  })

  it('never asks for the 3D in the prerender script\'s browser', () => {
    Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 Chrome/125 NVCPrerender/1.0', configurable: true })
    render(<UnfoldHouse locale="bg" />)
    expect(document.querySelector('figure.uh').dataset.status).toBe('static')
    expect(observers).toHaveLength(0)
  })

  it('pressing play before the 3D has arrived plays as soon as it does', async () => {
    render(<UnfoldHouse locale="en" autoplay={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    await screen.findByTestId('fake-canvas')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('starts every play from the folded box at the usual viewpoint, and never drifts for reduced motion', async () => {
    render(<UnfoldHouse locale="en" />)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    show(0.8)
    // the autoplay put the camera back before it started
    expect(canvas.scene.resetView).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(canvas.scene.drift).toHaveBeenCalled())

    // a replay from the end does it again
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.change(screen.getByRole('slider', { name: 'Unfolding stage' }), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(canvas.scene.resetView).toHaveBeenCalledTimes(2)
  })

  it('does not turn the camera while playing when the visitor prefers reduced motion', async () => {
    window.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} })
    render(<UnfoldHouse locale="en" />)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await vi.waitFor(() => expect(canvas.scene.setPose.mock.calls.length).toBeGreaterThan(4))
    expect(canvas.scene.drift).not.toHaveBeenCalled()
  })

  it('offers "play again" only at the very end: in the last stage it plays on from there', async () => {
    render(<UnfoldHouse locale="en" autoplay={false} />)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    fireEvent.change(screen.getByRole('slider', { name: 'Unfolding stage' }), { target: { value: '4500' } })
    expect(document.querySelector('.uh-step-label').textContent).toBe('The finished house')
    const play = screen.getByRole('button', { name: 'Play' })
    canvas.scene.setPose.mockClear()
    fireEvent.click(play)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await vi.waitFor(() => expect(canvas.scene.setPose).toHaveBeenCalled())
    // it carried on from 4.5, it did not start again from the folded box
    expect(Math.min(...canvas.scene.setPose.mock.calls.map((c) => c[0]))).toBeGreaterThanOrEqual(4.5)
    expect(canvas.scene.resetView).not.toHaveBeenCalled()
  })

  it('keeps the scrubber and ticks still until the 3D is there, and a scrub is not undone by the autoplay', async () => {
    render(<UnfoldHouse locale="en" />)
    const slider = screen.getByRole('slider', { name: 'Unfolding stage' })
    // idle: the picture is the poster, which the scrubber could not move
    expect(slider).toBeDisabled()
    expect(within(document.querySelector('.uh-ticks')).getAllByRole('button')[0]).toBeDisabled()
    show(0.2) // near the screen: the 3D loads, but the house is not yet mostly on screen
    await screen.findByTestId('fake-canvas')
    expect(slider).not.toBeDisabled()
    fireEvent.change(slider, { target: { value: '2000' } })
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(2)
    show(0.8) // now mostly on screen: the autoplay would start from the folded box
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(2)
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
  })

  it('moves a whole stage per arrow key on the scrubber', async () => {
    window.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} })
    render(<UnfoldHouse locale="en" autoplay={false} />)
    show(0.8)
    await screen.findByTestId('fake-canvas')
    const slider = screen.getByRole('slider', { name: 'Unfolding stage' })
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(canvas.scene.setPose).toHaveBeenLastCalledWith(5)
  })

  it('stays on the poster, without fetching the 3D, where WebGL exists but gives no context', () => {
    HTMLCanvasElement.prototype.getContext = () => null
    resetWebglProbe()
    render(<UnfoldHouse locale="bg" />)
    expect(document.querySelector('figure.uh').dataset.status).toBe('static')
    show(0.8)
    expect(canvas.mounted).toBe(0)
    expect(screen.queryByTestId('fake-canvas')).toBeNull()
  })
})
