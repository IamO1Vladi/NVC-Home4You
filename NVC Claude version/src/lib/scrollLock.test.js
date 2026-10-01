import { afterEach, describe, expect, it } from 'vitest'
import { lockScroll } from './scrollLock.js'

afterEach(() => {
  document.body.style.overflow = ''
})

describe('lockScroll', () => {
  it('keeps the page locked until the last holder lets go', () => {
    const releaseGallery = lockScroll()
    const releaseOffer = lockScroll()

    // The product modal closes under the offer form.
    releaseGallery()
    expect(document.body.style.overflow).toBe('hidden')

    releaseOffer()
    expect(document.body.style.overflow).toBe('')
  })

  it('ignores a second release from the same holder', () => {
    const releaseA = lockScroll()
    const releaseB = lockScroll()

    releaseA()
    releaseA()
    expect(document.body.style.overflow).toBe('hidden')

    releaseB()
    expect(document.body.style.overflow).toBe('')
  })

  it('never restores a hidden overflow that an uncounted overlay left behind', () => {
    // The header drawer sets 'hidden' itself. A back navigation can close it while the offer
    // form is still open; putting its 'hidden' back afterwards would lock a page with
    // nothing open on it.
    document.body.style.overflow = 'hidden'
    const release = lockScroll()

    document.body.style.overflow = ''      // the drawer closes and undoes its own lock
    release()

    expect(document.body.style.overflow).toBe('')
  })

  it('restores any other value it found', () => {
    document.body.style.overflow = 'auto'
    const release = lockScroll()
    expect(document.body.style.overflow).toBe('hidden')

    release()
    expect(document.body.style.overflow).toBe('auto')
  })
})
