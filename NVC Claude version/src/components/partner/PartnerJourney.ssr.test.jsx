// @vitest-environment node
import React from 'react'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import PartnerJourney from './PartnerJourney.jsx'
import bg from '../../content/bg/partner.js'
import en from '../../content/en/partner.js'
import el from '../../content/el/partner.js'

// The poster with no DOM at all (no window, no document): what a server or a snapshot gets
// before any script runs is the opening frame with every label, nothing waiting to be shown.

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;')

describe('PartnerJourney on the server', () => {
  it.each([['bg', bg], ['en', en], ['el', el]])('renders the poster with every label (%s)', (locale, content) => {
    expect(typeof window).toBe('undefined')
    const j = content.journey
    const html = renderToString(<PartnerJourney content={j} />)
    expect(html).toContain('role="img"')
    expect(html).toContain(`aria-label="${escape(j.summary)}"`)
    expect(html).toContain('viewBox="0 16 450 246"')
    expect(html).toContain(escape(j.captions.factory))
    for (const name of j.steps) expect(html).toContain(escape(name))
    for (const m of ['sea', 'rail', 'air']) expect(html).toContain(escape(j.modes[m]))
    for (const p of ['yours', 'ours', 'oursWhere']) expect(html).toContain(escape(j.places[p]))
    expect(html).toContain(`aria-label="${escape(j.pause)}"`)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-current="step"')
    // The frame is baked in: the camera's transform and the ship, and nothing else's vehicle.
    expect(html).toMatch(/data-k="cam" transform="translate\(225 139\) scale\(1\.000\)/)
    expect(html).toMatch(/data-k="sea" data-m="sea" transform="translate\(410\.0 /)
    expect(html).toContain('data-k="air" data-m="air" style="display:none"')
    // The world itself is fully shown: no opacity on it, no hidden caption.
    expect(html).toMatch(/<g data-k="w"><g data-k="cam"/)
    expect(html).not.toContain('is-out')
    expect(html).not.toContain('is-still')
    // The still panels are in the markup too, with their words: CSS shows them under reduced
    // motion, so that visitor never sees the stage swapped for them after the script runs.
    expect(html).toContain(`class="pj-sb" role="group" aria-label="${escape(j.storyboard)}"`)
    expect(html.match(/<figure>/g)).toHaveLength(3)
    for (const k of ['factory', 'sea', 'yours']) expect(html).toContain(escape(j.captions[k]))
    // No class that only a script sets after the first paint.
    expect(html).toContain('<div class="pj">')
  })

  it('switches layout with CSS only: reduced motion is a media query, narrow a container query', () => {
    const css = fs.readFileSync(new URL('../../style/PartnerJourney.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.pj\{[^}]*container-type:inline-size/)
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\.pj-stage[^}]*display:none/)
    expect(css).toMatch(/@container \(max-width:479px\)\{[^@]*\.pj-long\{ display:none \}/)
    expect(css).not.toContain('is-narrow')
  })
})
