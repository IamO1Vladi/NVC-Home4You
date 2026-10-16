import React, { Suspense, lazy, useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import ScrollManager, { HOLD_MS, WAIT_MS, hashTarget } from './ScrollManager.jsx'

// The scroll after a navigation (2026-10-16). Until then the router left the window where it
// was: the FAQ link at the foot of the About page opened the FAQ page 1273px down. What these
// pin: a new page starts at its top, or at its #hash once that element renders; back and
// forward are left to the browser; a new ?query on the same page (the gallery's filters) and the
// gallery's modal over its list do not move the page; a hash on the same page scrolls smoothly
// unless the visitor asked for reduced motion.

let navigate
function Navigator() {
  navigate = useNavigate()
  return null
}

// A page whose #late element arrives after the page itself, as a lazy route's content does.
function LatePage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 30)
    return () => clearTimeout(timer)
  }, [])
  return <main>{ready ? <section id="late">late</section> : <p>loading</p>}</main>
}

function renderApp(entry = '/a') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ScrollManager />
      <Navigator />
      <Routes>
        <Route path="/a" element={<main><section id="top-of-a">a</section><section id="faq">faq</section></main>} />
        <Route path="/b" element={<main><section id="warranty">b</section></main>} />
        <Route path="/late" element={<LatePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

let scrollTo
let scrolled
let targets
function setReducedMotion(reduce) {
  vi.stubGlobal('matchMedia', (query) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }))
}

beforeEach(() => {
  scrollTo = vi.fn()
  vi.stubGlobal('scrollTo', scrollTo)
  scrolled = []
  targets = []
  Element.prototype.scrollIntoView = vi.fn(function scrollIntoView(options) {
    scrolled.push({ id: this.id, options })
    targets.push(this)
  })
  setReducedMotion(false)
})

afterEach(() => {
  cleanup()
  delete Element.prototype.scrollIntoView
  vi.unstubAllGlobals()
})

const go = (to, options) => act(() => { navigate(to, options) })

describe('ScrollManager', () => {
  it('leaves the first load to the browser', () => {
    renderApp('/a#faq')
    expect(scrollTo).not.toHaveBeenCalled()
    expect(scrolled).toEqual([])
  })

  it('opens another page at its top, on a link and on a redirect', () => {
    renderApp()
    go('/b')
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
    go('/a', { replace: true })
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrolled).toEqual([])
  })

  it('leaves back and forward to the browser', () => {
    renderApp()
    go('/b')
    scrollTo.mockClear()
    go(-1)
    go(1)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(scrolled).toEqual([])
  })

  it('opens another page at its #hash, with a jump, once the element is there', async () => {
    renderApp()
    go('/b#warranty')
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
    expect(scrolled).toEqual([{ id: 'warranty', options: { block: 'start', behavior: 'auto' } }])

    scrolled = []
    go('/late#late')
    expect(scrolled).toEqual([])
    await act(() => new Promise((resolve) => setTimeout(resolve, 80)))
    expect(scrolled).toEqual([{ id: 'late', options: { block: 'start', behavior: 'auto' } }])
  })

  it('scrolls to a #hash on the same page smoothly, or with a jump for reduced motion', () => {
    renderApp()
    go('/a#faq')
    expect(scrollTo).not.toHaveBeenCalled()
    expect(scrolled).toEqual([{ id: 'faq', options: { block: 'start', behavior: 'smooth' } }])

    setReducedMotion(true)
    go('/a#top-of-a')
    expect(scrolled.at(-1)).toEqual({ id: 'top-of-a', options: { block: 'start', behavior: 'auto' } })
  })

  it('a link to the page you are on, without a hash, goes to its top', () => {
    renderApp('/a#faq')
    go('/a')
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
  })

  it('does not move the page for a new ?query on it (the gallery\'s filters)', () => {
    renderApp()
    go('/a?category=box', { replace: true })
    go('/a?category=wagon')
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does not move the list under the gallery\'s product modal', () => {
    renderApp()
    go('/b', { state: { backgroundLocation: { pathname: '/a' } } })
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('treats a hash that is not an element id as no hash', () => {
    renderApp()
    go('/b#cfg=N4Ig')
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0)
    expect(scrolled).toEqual([])
    expect(hashTarget('#cfg=N4Ig')).toBeNull()
    expect(hashTarget('#q-delivery-crane')).toBe('q-delivery-crane')
    expect(hashTarget('#%D0%B0')).toBeNull()
    expect(hashTarget('')).toBeNull()
  })

  it('gives up on a #hash whose element never comes', async () => {
    vi.useFakeTimers()
    try {
      renderApp()
      go('/b#nowhere')
      act(() => { vi.advanceTimersByTime(WAIT_MS + 1000) })
      expect(scrolled).toEqual([])
    } finally {
      vi.useRealTimers()
    }
    // It has stopped watching: an element with that id arriving now is not scrolled to.
    const late = document.createElement('section')
    late.id = 'nowhere'
    try {
      await act(async () => {
        document.body.append(late)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      expect(scrolled).toEqual([])
    } finally {
      late.remove()
    }
  })

  it('takes no element from the page Suspense hides while the next one loads, though the id is the same', async () => {
    let resolve
    const loading = new Promise((done) => { resolve = done })
    const LazyB = lazy(() => loading)
    render(
      <MemoryRouter initialEntries={['/a']}>
        <ScrollManager />
        <Navigator />
        <Suspense fallback={<p>loading</p>}>
          <Routes>
            <Route path="/a" element={<main id="page-a"><section id="shared">a</section></main>} />
            <Route path="/b" element={<LazyB />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    )
    go('/b#shared')
    // /a is still in the document, display:none, with its own #shared: not the target.
    expect(document.getElementById('page-a').style.display).toBe('none')
    expect(targets).toEqual([])

    await act(async () => {
      resolve({ default: () => <main id="page-b"><section id="shared">b</section></main> })
      await loading
    })
    expect(targets.map((el) => el.closest('main').id)).toEqual(['page-b'])
  })

  describe('a new page\'s #hash, while the page settles', () => {
    let observers
    beforeEach(() => {
      observers = []
      vi.stubGlobal('ResizeObserver', class {
        constructor(callback) {
          this.callback = callback
          this.watching = false
          observers.push(this)
        }
        observe(el) {
          this.target = el
          this.watching = true
        }
        disconnect() { this.watching = false }
        // What the browser does when the watched element changes size.
        grow() { if (this.watching) this.callback([]) }
      })
    })
    const AT_TOP = { id: 'warranty', options: { block: 'start', behavior: 'auto' } }

    it('is brought back each time the page grows (data arriving above it)', () => {
      renderApp()
      go('/b#warranty')
      expect(scrolled).toEqual([AT_TOP])
      expect(observers).toHaveLength(1)
      expect(observers[0].target.tagName).toBe('MAIN')
      observers[0].grow()
      observers[0].grow()
      expect(scrolled).toEqual([AT_TOP, AT_TOP, AT_TOP])
    })

    it.each(['wheel', 'touchstart', 'keydown', 'pointerdown'])('is let go once the visitor takes over (%s)', (type) => {
      renderApp()
      go('/b#warranty')
      act(() => { window.dispatchEvent(new Event(type)) })
      observers[0].grow()
      expect(scrolled).toEqual([AT_TOP])
    })

    it('is let go after HOLD_MS, and on leaving the page', () => {
      vi.useFakeTimers()
      try {
        renderApp()
        go('/b#warranty')
        act(() => { vi.advanceTimersByTime(HOLD_MS) })
        observers[0].grow()
        expect(scrolled).toEqual([AT_TOP])
      } finally {
        vi.useRealTimers()
      }
      go('/a')
      go('/b#warranty')
      go('/a')
      observers[1].grow()
      expect(scrolled).toEqual([AT_TOP, AT_TOP])
    })

    it('is not held on the same page: that scroll is the visitor\'s own', () => {
      renderApp()
      go('/a#faq')
      expect(observers).toEqual([])
    })
  })
})
