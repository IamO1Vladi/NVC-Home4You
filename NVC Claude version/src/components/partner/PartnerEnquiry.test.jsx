import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PartnerEnquiry, { LIMITS, partnerBlock } from './PartnerEnquiry.jsx'
import bg from '../../content/bg/partner.js'
import en from '../../content/en/partner.js'
import { _resetSubmissions } from '../../lib/backgroundSubmit.js'
import { LEAD_TIMES } from '../../content/shared/deliveryRates.js'
import { PARTNER_MIN_UNITS } from '../../content/shared/partnerTerms.js'

// The partner form (2026-10-15). What these pin: the POST is the site's ordinary offer plus
// exactly the contract's "partner" block (no key the server does not know, no empty key, every
// value from its list, texts trimmed and cut); role, quantity, country, name, phone and email
// are required, phone included; the Box lead-time note; analytics with what kind of enquiry it
// was and nothing about who sent it.

const f = bg.form

function renderForm(props = {}) {
  return render(
    <MemoryRouter>
      <PartnerEnquiry locale="bg" content={f} {...props} />
    </MemoryRouter>,
  )
}

const posted = () => fetch.mock.calls.filter(([url]) => String(url).endsWith('/api/offer'))
const bodyOf = (call) => JSON.parse(call[1].body)

// A field by its whole label: "Име *" must not also find "Имейл *".
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const field = (label) => new RegExp(`^${escape(label)}( \\*)?( \\(.*\\))?$`)
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const choose = (label) => fireEvent.click(screen.getByLabelText(label))
const submit = () => fireEvent.click(screen.getByRole('button', { name: f.submit }))

function fillRequired({ phone = '+30 69 1234 5678' } = {}) {
  choose(f.role.options.reseller)
  choose(f.quantity.options['6-10'])
  type(field(f.country.label), 'GR')
  type(field(f.name.label), '  Νίκος Παπαδόπουλος ')
  if (phone !== null) type(field(f.phone.label), phone)
  type(field(f.email.label), 'nikos@example.gr')
}

beforeEach(() => {
  _resetSubmissions()
  window.localStorage.clear()
  window.dataLayer = []
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete window.dataLayer
  delete window.fbq
})

describe('PartnerEnquiry', () => {
  it('posts the offer with exactly the contract\'s partner block', async () => {
    renderForm()
    fillRequired()
    type(field(f.sector.label), 'shop')
    choose(f.products.options.container)
    choose(f.products.options.box58)
    type(field(f.timing.label), '1-3m')
    choose(f.logistics.options.own)
    type(field(f.region), '  Солун  ')
    type(field(f.company), ' Papadopoulos AE ')
    type(field(f.vatId), ' EL123456789 ')
    type(field(f.message.label), ' Нужни са ни за сезона. ')
    submit()

    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0])).toEqual({
      name: 'Νίκος Παπαδόπουλος',
      email: 'nikos@example.gr',
      phone: '+30 69 1234 5678',
      project: 'Нужни са ни за сезона.',
      modelId: '',
      locale: 'bg',
      rep: '',
      website: '',
      partner: {
        role: 'reseller',
        sector: 'shop',
        products: ['container', 'box58'],
        quantity: '6-10',
        timing: '1-3m',
        country: 'GR',
        region: 'Солун',
        company: 'Papadopoulos AE',
        vatId: 'EL123456789',
        logistics: 'own',
      },
    })
  })

  it('leaves out every optional key that holds nothing', async () => {
    renderForm()
    fillRequired()
    submit()
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0]).partner).toEqual({ role: 'reseller', quantity: '6-10', country: 'GR' })
    expect(bodyOf(posted()[0]).project).toBe('')
  })

  it('sends the products in the form\'s order and cuts the texts to the server\'s lengths', () => {
    const block = partnerBlock(
      { role: 'ownSite', quantity: '25+', country: 'nonEU', products: ['steel', 'box37', 'nonsense'], sector: 'casino', timing: 'never', logistics: 'teleport' },
      { region: 'р'.repeat(200), company: 'c'.repeat(200), vatId: '9'.repeat(200) },
    )
    expect(block).toEqual({
      role: 'ownSite',
      products: ['box37', 'steel'],
      quantity: '25+',
      country: 'nonEU',
      region: 'р'.repeat(LIMITS.region),
      company: 'c'.repeat(LIMITS.company),
      vatId: '9'.repeat(LIMITS.vatId),
    })
  })

  it('sends nothing until the required fields are there, and says which', async () => {
    renderForm()
    submit()
    expect(await screen.findByRole('alert')).toHaveTextContent(f.invalid)
    for (const text of [f.role.error, f.quantity.error, f.country.error, f.name.error, f.phone.error, f.email.error]) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    // The first thing to fix has the focus: the role's first chip.
    expect(document.activeElement).toBe(screen.getByLabelText(f.role.options.reseller))
    expect(posted()).toHaveLength(0)
  })

  it('requires a phone, unlike the retail form', async () => {
    renderForm()
    fillRequired({ phone: null })
    submit()
    expect(await screen.findByText(f.phone.error)).toBeInTheDocument()
    expect(screen.getByLabelText(field(f.phone.label))).toHaveAttribute('aria-invalid', 'true')
    expect(posted()).toHaveLength(0)

    type(field(f.phone.label), '0888 123 456')
    submit()
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0]).phone).toBe('0888 123 456')
  })

  it('rejects an email that is not one', async () => {
    renderForm()
    fillRequired()
    type(field(f.email.label), 'nikos.example.gr')
    submit()
    expect(await screen.findByText(f.email.error)).toBeInTheDocument()
    expect(posted()).toHaveLength(0)
  })

  it('carries the honeypot and the representative\'s slug as the offer form does', async () => {
    window.localStorage.setItem('nvc_rep_v1', JSON.stringify({ slug: 'dtodorov', savedAt: Date.now() }))
    const { container } = renderForm()
    fillRequired()
    fireEvent.change(container.querySelector('input[name="website"]'), { target: { value: 'http://spam' } })
    submit()
    await waitFor(() => expect(posted()).toHaveLength(1))
    expect(bodyOf(posted()[0])).toMatchObject({ rep: 'dtodorov', website: 'http://spam' })
  })

  describe('the Box lead-time note', () => {
    const note = () => screen.queryByRole('status')

    it('appears when a Box house is wanted within a month', () => {
      renderForm()
      choose(f.products.options.box37)
      expect(note()).toBeNull()
      type(field(f.timing.label), 'month')
      expect(note()).toHaveTextContent(`${LEAD_TIMES.boxProductionDays}`)
      expect(note()).toHaveTextContent(LEAD_TIMES.boxToAddressMonths)
      expect(note().textContent).not.toMatch(/\{\w+\}/)
    })

    it('does not appear for containers alone, or a later date', () => {
      renderForm()
      choose(f.products.options.container)
      type(field(f.timing.label), 'month')
      expect(note()).toBeNull()
      choose(f.products.options.box73)
      expect(note()).not.toBeNull()
      type(field(f.timing.label), '3-6m')
      expect(note()).toBeNull()
    })
  })

  it('names the two thresholds from partnerTerms.js under the quantity', () => {
    renderForm()
    const hint = screen.getByText((_, el) => el?.classList?.contains('pe-hint'))
    expect(hint).toHaveTextContent(`${PARTNER_MIN_UNITS.container}`)
    expect(hint).toHaveTextContent(`${PARTNER_MIN_UNITS.box}`)
  })

  it('takes its role from a door button', () => {
    const { rerender } = renderForm({ preset: { role: 'ownSite', n: 1 } })
    expect(screen.getByLabelText(f.role.options.ownSite)).toBeChecked()
    rerender(
      <MemoryRouter>
        <PartnerEnquiry locale="bg" content={f} preset={{ role: 'reseller', n: 2 }} />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText(f.role.options.reseller)).toBeChecked()
  })

  it('counts the lead once the server has it, with no personal data', async () => {
    window.fbq = vi.fn()
    renderForm()
    fillRequired()
    type(field(f.company), 'Papadopoulos AE')
    type(field(f.vatId), 'EL123456789')
    type(field(f.message.label), 'secret plans')
    submit()

    await waitFor(() => expect(window.dataLayer.some((e) => e.event === 'request_quote_success')).toBe(true))
    const event = window.dataLayer.find((e) => e.event === 'request_quote_success')
    expect(event).toEqual({
      event: 'request_quote_success',
      form_type: 'partner',
      lead_source: 'partner-page',
      role: 'reseller',
      quantity: '6-10',
      rep: '',
    })
    const sent = JSON.stringify([window.dataLayer, window.fbq.mock.calls])
    for (const personal of ['Νίκος', 'nikos@example.gr', '1234 5678', 'Papadopoulos', 'EL123456789', 'secret plans', 'GR']) {
      expect(sent).not.toContain(personal)
    }
  })

  it('counts nothing when the server refuses', async () => {
    fetch.mockImplementation(() => Promise.resolve({ ok: false, status: 400 }))
    renderForm()
    fillRequired()
    submit()
    await waitFor(() => expect(posted()).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 0))
    expect(window.dataLayer.some((e) => e.event === 'request_quote_success')).toBe(false)
  })

  it('reads natively in English', () => {
    render(
      <MemoryRouter>
        <PartnerEnquiry locale="en" content={en.form} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(en.form.heading)
    expect(screen.getByRole('link', { name: en.form.privacyLink })).toHaveAttribute('href', '/en/privacy-and-cookies')
  })
})
