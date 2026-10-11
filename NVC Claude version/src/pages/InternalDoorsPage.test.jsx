import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import InternalDoorsPage from './InternalDoorsPage.jsx'
import elContent from '../content/el/internalDoors.js'
import bgContent from '../content/bg/internalDoors.js'
import { submitInBackground } from '../lib/backgroundSubmit.js'
import { clearRep, saveRep } from '../lib/repAttribution.js'

vi.mock('../lib/backgroundSubmit.js', () => ({ submitInBackground: vi.fn() }))

// The doors page builds its own /api/offer request rather than going through the site-wide
// offer modal, and it used to leave the language out. The server then answered in its
// default, so a Greek visitor got an English autoresponder and the lead was filed with no
// language — which also made the first staff reply's subject English (Greek audit, #11).
//
// Opening the form is part of every test on purpose: from 5a7fe40 until this test existed
// the button threw a ReferenceError (setters for state that had been removed), so the form
// never opened and no doors enquiry could be sent at all, in any language.

function sendEnquiry(content, locale) {
  render(<InternalDoorsPage content={content} locale={locale} />)

  fireEvent.click(screen.getByRole('button', { name: content.review.cta }))
  fireEvent.change(screen.getByPlaceholderText(content.forms.name), { target: { value: 'Νίκος' } })
  fireEvent.change(screen.getByPlaceholderText(content.forms.email), { target: { value: 'nikos@example.com' } })
  fireEvent.submit(screen.getByPlaceholderText(content.forms.email).closest('form'))

  expect(submitInBackground).toHaveBeenCalledTimes(1)
  return submitInBackground.mock.calls[0][0]
}

describe('InternalDoorsPage enquiry', () => {
  beforeEach(() => {
    submitInBackground.mockClear()
  })

  it('a Greek doors enquiry is sent as Greek', () => {
    const request = sendEnquiry(elContent, 'el')

    expect(request.url).toMatch(/\/api\/offer$/)
    expect(request.payload).toMatchObject({ name: 'Νίκος', email: 'nikos@example.com', locale: 'el' })
  })

  it('a Bulgarian one as Bulgarian', () => {
    expect(sendEnquiry(bgContent, 'bg').payload.locale).toBe('bg')
  })

  // The doors page posts its own /api/offer, so the representative link (#38) has to reach
  // it separately from the site-wide modal: the remembered slug, and the honeypot the
  // server drops bots by, which a human never fills.
  it('carries the representative the visitor arrived through, and an empty honeypot', () => {
    saveRep('dtodorov')
    try {
      const { payload } = sendEnquiry(bgContent, 'bg')
      expect(payload).toMatchObject({ rep: 'dtodorov', website: '' })
    } finally {
      clearRep()
    }
  })

  it('sends no representative when there was none', () => {
    expect(sendEnquiry(elContent, 'el').payload).toMatchObject({ rep: '', website: '' })
  })

  it('renders the honeypot where no visitor can reach it, and sends whatever a bot puts in it', () => {
    render(<InternalDoorsPage content={bgContent} locale="bg" />)
    fireEvent.click(screen.getByRole('button', { name: bgContent.review.cta }))
    const form = screen.getByPlaceholderText(bgContent.forms.email).closest('form')

    // Off-screen, out of the tab order and hidden from assistive tech — and never
    // display:none, which the better bots skip (HoneypotField).
    const trap = form.querySelector('input[name="website"]')
    expect(trap).not.toBeNull()
    expect(trap.tabIndex).toBe(-1)
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(trap.closest('[aria-hidden="true"]').style.display).not.toBe('none')
    expect(screen.queryByRole('textbox', { name: /website/i })).toBeNull()

    // A form-filler fills every field it finds.
    fireEvent.change(trap, { target: { value: 'http://spam.example' } })
    fireEvent.change(screen.getByPlaceholderText(bgContent.forms.name), { target: { value: 'Bot' } })
    fireEvent.change(screen.getByPlaceholderText(bgContent.forms.email), { target: { value: 'bot@example.com' } })
    fireEvent.submit(form)

    expect(submitInBackground).toHaveBeenCalledTimes(1)
    expect(submitInBackground.mock.calls[0][0].payload).toMatchObject({ website: 'http://spam.example' })
  })
})
