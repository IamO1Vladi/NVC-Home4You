// One page scroll lock, shared by the overlays that freeze the page behind them.
//
// WHY A COUNT. Each overlay used to set the body's overflow to 'hidden' when it opened and
// to '' when it closed, which is only right while a single overlay is open at a time.
// "Request an offer" in the gallery's product modal opens the offer form and THEN closes
// the product modal (its back navigation lands a moment later), so the product modal's
// cleanup unlocked the page underneath the offer form that had just locked it, and the
// page scrolled behind the form. Holders are counted instead: the first one in remembers
// what the overflow was, and only the last one out puts it back.

let holders = 0
let originalOverflow = ''

/**
 * Locks the page scroll until the returned function is called. Call it from an effect and
 * return its result as the cleanup. Releasing twice is harmless, so one stray cleanup can
 * never unlock the page under another holder.
 */
export function lockScroll() {
  if (typeof document === 'undefined') return () => {}
  if (holders === 0) {
    const current = document.body.style.overflow
    // An uncounted overlay's 'hidden' (the header drawer, a lightbox) is that overlay's to
    // undo, and it can close first: a back navigation closes the drawer under an open offer
    // form. Putting its 'hidden' back on the last release would lock a page with nothing open.
    originalOverflow = current === 'hidden' ? '' : current
  }
  holders += 1
  document.body.style.overflow = 'hidden'

  let released = false
  return () => {
    if (released) return
    released = true
    holders -= 1
    if (holders === 0) document.body.style.overflow = originalOverflow
  }
}
