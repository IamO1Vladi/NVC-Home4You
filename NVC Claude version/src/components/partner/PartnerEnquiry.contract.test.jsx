import React from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PartnerEnquiry, { COUNTRIES, LIMITS, LOGISTICS, PRODUCTS, QUANTITIES, ROLES, SECTORS, TIMINGS } from './PartnerEnquiry.jsx'
import el from '../../content/el/partner.js'
import { _resetSubmissions } from '../../lib/backgroundSubmit.js'
import { REP_KEY } from '../../lib/repAttribution.js'
import fixture from './__fixtures__/partner-offer.json'
import lists from './__fixtures__/partner-lists.json'

// The form <-> server contract, pinned from both ends by ONE file. This test fills the real
// Greek form with every field and checks that the POST body is exactly __fixtures__/
// partner-offer.json; PartnerEnquiryTests.The_spa_fixture_is_accepted_and_stored_with_its_line
// (api-dotnet.Tests) binds that same file with MVC's JSON options and runs it through the
// controller. Change the payload on either side and one of the two fails.
//
// The fixture uses one value per list, so the lists themselves are pinned by a second file,
// __fixtures__/partner-lists.json, which PartnerEnquiryTests.The_lists_are_the_ones_the_form_contract_names
// compares with the server's: a key renamed or added on one side only fails a test.

const f = el.form
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const field = (label) => new RegExp(`^${escape(label)}( \\*)?( \\(.*\\))?$`)
const type = (label, value) => fireEvent.change(screen.getByLabelText(field(label)), { target: { value } })
const choose = (label) => fireEvent.click(screen.getByLabelText(label))

beforeEach(() => {
  _resetSubmissions()
  window.localStorage.clear()
  window.localStorage.setItem(REP_KEY, JSON.stringify({ slug: 'dtodorov', savedAt: Date.now() }))
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('sends exactly the payload the server\'s contract test binds', async () => {
  render(<MemoryRouter><PartnerEnquiry locale="el" content={f} /></MemoryRouter>)

  choose(f.role.options.reseller)
  type(f.sector.label, 'shop')
  type(f.timing.label, '1-3m')
  choose(f.products.options.box58)
  choose(f.products.options.container)
  choose(f.quantity.options['6-10'])
  choose(f.logistics.options.own)
  type(f.country.label, 'GR')
  type(f.region, ' Θεσσαλονίκη ')
  type(f.company, 'Domus EE')
  type(f.vatId, 'EL123456789 ')
  type(f.name.label, ' Νίκος Παπαδόπουλος')
  type(f.phone.label, '+30 231 000 0000')
  type(f.email.label, 'nikos@example.gr')
  type(f.message.label, 'Χρειαζόμαστε μονάδες για τη σεζόν. ')
  fireEvent.click(screen.getByRole('button', { name: f.submit }))

  await waitFor(() => expect(fetch).toHaveBeenCalled())
  const [url, init] = fetch.mock.calls.find(([u]) => String(u).endsWith('/api/offer'))
  expect(String(url)).toMatch(/\/api\/offer$/)
  expect(JSON.parse(init.body)).toEqual(fixture)
})

it('offers exactly the lists the server accepts', () => {
  expect({
    role: ROLES,
    sector: SECTORS,
    products: PRODUCTS,
    quantity: QUANTITIES,
    timing: TIMINGS,
    country: COUNTRIES,
    logistics: LOGISTICS,
    limits: LIMITS,
  }).toEqual(lists)
})
