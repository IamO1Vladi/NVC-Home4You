// Where the window stands after the router changes the page. BrowserRouter does no scrolling of
// its own, so until 2026-10-16 a link at the foot of one page opened the next one at the same
// height (the FAQ link at the bottom of About landed 1273px down the FAQ page).
//
// - A link or a redirect to ANOTHER page (PUSH or REPLACE, the pathname changes): the top of
//   it; with a #hash, that element, once it is on the page (a lazy route and its data render
//   after the URL changes, so it waits for it, up to WAIT_MS), and kept there while the page
//   settles (HOLD_MS): the gallery's and the cases' data arrive after the element and push it
//   down (the hub's link to the containers' #specs ended 3049px under the screen on a phone).
// - A link to the page you are on, with no #hash: its top, as a fresh load would be.
// - The same page with a new ?query and no #hash (the gallery's filters): nothing; the visitor
//   is working with the page where they are.
// - A #hash on the same page: that element.
// - Back and forward (POP): nothing, the browser restores the position it remembers.
// - The gallery's product modal, opened over the list it came from (state.backgroundLocation):
//   nothing, the list stays where it was under the modal.
//
// The top of a new page is a jump. The way to a #hash on the same page is smooth, unless the
// visitor asked for reduced motion. A hash that is not an element id (the configurator's
// #cfg=…, the planner's shared plan) counts as no hash. Pages that handle their own anchors
// (#q- questions, #zapitvane, #item-N) still do; this only brings the element into view.
//
// While a lazy route loads, React's Suspense keeps the page being left in the DOM, display:none.
// An element there with the same id (About's #in-writing, when the language changes on it) is
// not the target: only an element on show is (shownById).
import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export const WAIT_MS = 4000
export const HOLD_MS = 2500
// The visitor taking the scrolling over ends the hold at once.
const TAKE_OVER = ['wheel', 'touchstart', 'keydown', 'pointerdown']

const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/** "#warranty" -> "warranty"; "", "#", "#cfg=…" and other non-ids -> null. */
export function hashTarget(hash) {
  let id = String(hash || '').replace(/^#/, '')
  try { id = decodeURIComponent(id) } catch { return null }
  return /^[A-Za-z][\w:.-]*$/.test(id) ? id : null
}

/**
 * The element with this id that is on show, or null: one inside a display:none element (the
 * page Suspense hides while the next one loads) does not count. `id` is a hashTarget(), so it
 * holds no quote and the selector is safe.
 */
export function shownById(id) {
  for (const el of document.querySelectorAll(`[id="${id}"]`)) {
    let hidden = false
    for (let node = el; node && !hidden; node = node.parentElement) hidden = node.style?.display === 'none'
    if (!hidden) return el
  }
  return null
}

/** Calls found(element) once an element with this id is on show; returns a stop(). */
export function whenPresent(id, found, waitMs = WAIT_MS) {
  const now = shownById(id)
  if (now) {
    found(now)
    return () => {}
  }
  if (typeof MutationObserver !== 'function') return () => {}
  let timer = null
  const observer = new MutationObserver(() => {
    const el = shownById(id)
    if (!el) return
    stop()
    found(el)
  })
  function stop() {
    observer.disconnect()
    clearTimeout(timer)
  }
  observer.observe(document.body, { childList: true, subtree: true })
  timer = setTimeout(stop, waitMs)
  return stop
}

/**
 * Brings `el` to the top now, and again each time its page changes size, for up to holdMs or
 * until the visitor scrolls, taps or presses a key. What grows is the page's <main> (the html,
 * the body and #root are the window's height), so that is what is watched. Returns a stop().
 */
export function holdInView(el, holdMs = HOLD_MS) {
  const place = () => { if (el.isConnected) el.scrollIntoView?.({ block: 'start', behavior: 'auto' }) }
  place()
  if (typeof ResizeObserver !== 'function') return () => {}
  const observer = new ResizeObserver(place)
  observer.observe(el.closest('main') || document.body)
  const timer = setTimeout(stop, holdMs)
  TAKE_OVER.forEach((type) => window.addEventListener(type, stop, { passive: true }))
  function stop() {
    observer.disconnect()
    clearTimeout(timer)
    TAKE_OVER.forEach((type) => window.removeEventListener(type, stop))
  }
  return stop
}

export default function ScrollManager() {
  const location = useLocation()
  const type = useNavigationType()
  const previous = useRef(location)

  useEffect(() => {
    const from = previous.current
    previous.current = location
    if (from === location || type === 'POP') return undefined
    if (location.state?.backgroundLocation) return undefined

    const samePage = from.pathname === location.pathname
    const id = hashTarget(location.hash)

    if (!id) {
      const sameQuery = from.search === location.search
      if (!samePage || sameQuery) window.scrollTo(0, 0)
      return undefined
    }

    if (samePage) {
      const behavior = reducedMotion() ? 'auto' : 'smooth'
      return whenPresent(id, (el) => el.scrollIntoView?.({ block: 'start', behavior }))
    }

    window.scrollTo(0, 0)
    let release = () => {}
    const stopWaiting = whenPresent(id, (el) => { release = holdInView(el) })
    return () => {
      stopWaiting()
      release()
    }
  }, [location, type])

  return null
}
