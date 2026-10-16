import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import DeliveryCalculator from './DeliveryCalculator.jsx'
import { CALCULATOR_STRINGS } from './calculatorStrings.fixture.js'
import { fixturePlaces } from './placesFixture.js'
import { buildOfferText, kmBand, quoteFor } from './deliveryQuote.js'
import { ModalActionsProvider } from '../../context/ModalActions.jsx'
import { CONFIG_PREFILL_KEY } from '../../lib/configPrefill.js'
import { decodeChunk, loadPlaces } from '../../lib/deliveryPlaces.js'
import { DELIVERY_RATES } from '../../content/shared/deliveryRates.js'
import { euro } from '../../lib/euro.js'

// The delivery calculator (owner's rates of 2026-10-15, none of them with VAT). The place
// table is mocked: the generated chunks may not exist yet, and the arithmetic must not depend
// on them. jsdom has no renderer for Leaflet's vector layers; the line is not under test.
vi.mock('../../lib/deliveryPlaces.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadPlaces: vi.fn(),
}))
vi.mock('react-leaflet', async (importOriginal) => ({
  ...(await importOriginal()),
  Polyline: () => null,
}))

const PLACES = fixturePlaces()
const S = CALCULATOR_STRINGS
const flat = (text) => String(text ?? '').replace(/[\s  ]+/g, ' ').trim()

beforeEach(() => {
  vi.mocked(loadPlaces).mockReset()
  vi.mocked(loadPlaces).mockResolvedValue(PLACES)
  window.sessionStorage.clear()
  window.dataLayer = []
})

function renderCalc({ locale = 'bg', product, onOpenOffer = vi.fn() } = {}) {
  const utils = render(
    <MemoryRouter>
      <ModalActionsProvider onOpenOffer={onOpenOffer} onOpenQuestion={vi.fn()}>
        <DeliveryCalculator locale={locale} content={S[locale]} initialProduct={product} />
      </ModalActionsProvider>
    </MemoryRouter>,
  )
  return { ...utils, onOpenOffer, s: S[locale] }
}

const field = () => screen.getByRole('combobox')

async function type(text) {
  const input = field()
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: text } })
  await screen.findByRole('listbox')
}

async function choose(text, optionName) {
  await type(text)
  // Not \b: JavaScript's word boundary is ASCII-only, and Cyrillic letters are not "word" characters.
  const option = await screen.findByRole('option', { name: new RegExp(`^${optionName}\\s*(,|$)`) })
  fireEvent.mouseDown(option)
}

const result = (s) => screen.getByLabelText(s.resultLabel)
const resultText = (s) => flat(result(s).textContent)

describe('arithmetic', () => {
  it('rounds the one-way km first and bills exactly twice that', () => {
    const sofia = PLACES.find((p) => p.name === 'София')
    for (const product of ['container', 'box']) {
      const q = quoteFor(product, sofia)
      expect(q.oneWayKm).toBe(174)
      expect(q.billableKm).toBe(2 * q.oneWayKm)
    }
  })

  it('a custom house carries no base and no km: its delivery is quoted with the project', () => {
    const sofia = PLACES.find((p) => p.name === 'София')
    expect(quoteFor('project', sofia)).toEqual({ product: 'project', status: 'quote', base: null, oneWayKm: null, billableKm: null })
  })

  it('container: billable km × the fixed rate, exact whole euros', () => {
    const banko = PLACES.find((p) => p.name === 'Банско')
    const q = quoteFor('container', banko)
    expect(q.oneWayKm).toBe(96)
    expect(q.transport).toBe(192 * DELIVERY_RATES.products.container.perKm)
    expect(q.base).toBe('marikostinovo')
  })

  it('box: from the closer base, transport rounded to tens, plus the crane', () => {
    const burgas = PLACES.find((p) => p.name === 'Бургас')
    const q = quoteFor('box', burgas)
    expect(q.base).toBe('varna')
    expect(q.oneWayKm).toBe(131)
    expect(q.billableKm).toBe(262)
    expect(q.transport).toBe(Math.round((262 * DELIVERY_RATES.products.box.perKm) / 10) * 10)
    expect(q.transport % 10).toBe(0)
    expect(q.total).toBe(q.transport + DELIVERY_RATES.products.box.crane.about)
    // A container to the same town still counts from Marikostinovo.
    expect(quoteFor('container', burgas).base).toBe('marikostinovo')
  })

  it('a place with no road km is on request, for every priced product', () => {
    const island = PLACES.find((p) => p.name === 'Αρχάνες')
    for (const product of ['container', 'box']) {
      expect(quoteFor(product, island)).toMatchObject({ status: 'onRequest', oneWayKm: null })
    }
  })

  it('bands the km for analytics', () => {
    expect([kmBand(null), kmBand(50), kmBand(174), kmBand(390), kmBand(500)]).toEqual([
      'on-request', '0-99', '100-199', '200-399', '400+',
    ])
  })
})

describe('the data loads on first interaction, not with the page', () => {
  it('does not load the places on render; loads them once on focus', async () => {
    renderCalc()
    expect(loadPlaces).not.toHaveBeenCalled()
    fireEvent.focus(field())
    fireEvent.focus(field())
    await waitFor(() => expect(loadPlaces).toHaveBeenCalledTimes(1))
  })

  it('loads on the first keystroke too, and shows a loading line meanwhile', async () => {
    let resolve
    vi.mocked(loadPlaces).mockReturnValue(new Promise((r) => { resolve = r }))
    const { s } = renderCalc()
    fireEvent.change(field(), { target: { value: 'Со' } })
    expect(loadPlaces).toHaveBeenCalledTimes(1)
    expect(screen.getByText(s.loading)).toBeInTheDocument()
    await act(async () => resolve(PLACES))
    expect(await screen.findByRole('option', { name: /^София/ })).toBeInTheDocument()
  })

  it('says so, with a retry, when the table cannot load', async () => {
    vi.mocked(loadPlaces).mockRejectedValueOnce(new Error('not built'))
    const { s } = renderCalc()
    fireEvent.focus(field())
    expect(await screen.findByRole('alert')).toHaveTextContent(s.loadError)
    fireEvent.click(screen.getByRole('button', { name: s.retry }))
    await waitFor(() => expect(loadPlaces).toHaveBeenCalledTimes(2))
  })
})

describe('the place field', () => {
  it('has a visible label and the example placeholder', () => {
    const { s } = renderCalc()
    expect(screen.getByLabelText(s.placeLabel)).toBe(field())
    expect(field()).toHaveAttribute('placeholder', 'напр. Банско')
  })

  it('"Бургас" suggests the Bulgarian town first, with its region', async () => {
    renderCalc()
    await type('Бургас')
    const options = screen.getAllByRole('option')
    expect(flat(options[0].textContent)).toBe('Бургас, обл. Бургас')
  })

  it('is a keyboard combobox: arrows move, Enter picks, Escape closes', async () => {
    const { s } = renderCalc()
    await type('Бур')
    const input = field()
    expect(input).toHaveAttribute('aria-expanded', 'true')
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThanOrEqual(2)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const second = flat(screen.getAllByRole('option')[1].querySelector('.dc-option-name').textContent)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue(second)
    expect(resultText(s)).toContain(s.km)
  })

  it('finds the town in a pasted address', async () => {
    renderCalc()
    await type('София, бул. Черни връх 1')
    expect(flat(screen.getAllByRole('option')[0].textContent)).toMatch(/^София/)
  })

  it('outside Bulgaria and Greece: the message and the enquiry button, no price', async () => {
    const { s } = renderCalc()
    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'Париж' } })
    expect(await screen.findByText(s.noMatch)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: s.enquiryPlain })).toBeInTheDocument()
    expect(resultText(s)).not.toMatch(/€/)
    expect(resultText(s)).not.toContain(s.km)
  })
})

describe('the result', () => {
  it('container: km one way, × 2, the fixed price without VAT, the crane and the crane-free lines', async () => {
    const { s } = renderCalc({ product: 'container' })
    await choose('Соф', 'София')
    const text = resultText(s)
    expect(text).toContain(flat('174 км по пътя от Марикостиново, в една посока'))
    expect(text).toContain(flat('В двете посоки: 174 км × 2 = 348 км'))
    expect(text).toContain(flat(euro(348, 'bg')))
    expect(text).toContain('фиксирана тарифа, без ДДС')
    expect(text).toContain(flat(`Около ${euro(DELIVERY_RATES.products.container.crane.about, 'bg')} без ДДС`))
    expect(text).toContain(flat(`до ${euro(DELIVERY_RATES.products.container.noCrane.travelMax, 'bg')} без ДДС`))
    expect(text).toContain(`и остават ${DELIVERY_RATES.products.container.noCrane.nights} нощи`)
    expect(text).toContain(s.container.assembly)
    for (const note of [s.notes.approx, s.notes.several, s.notes.foundation]) expect(text).toContain(note)
  })

  it('box: from the closer base, says which, "about" figures, crane required, assembly linked to prices', async () => {
    const { s } = renderCalc({ product: 'box' })
    await choose('Бургас', 'Бургас')
    const text = resultText(s)
    expect(text).toContain(flat('131 км по пътя от Варна, в една посока'))
    expect(text).toContain('Бокс къщата тръгва от Варна')
    expect(text).toContain(flat('В двете посоки: 131 км × 2 = 262 км'))
    expect(text).toContain(flat(`около ${euro(520, 'bg')}`))
    expect(text).toContain(flat(`около ${euro(DELIVERY_RATES.products.box.crane.about, 'bg')}`))
    expect(text).toContain(flat(`около ${euro(520 + DELIVERY_RATES.products.box.crane.about, 'bg')}`))
    expect(text).toContain('според мястото може и повече')
    expect(text).toContain('Бокс къща не се доставя без кран.')
    // No crane-free option for a Box house, and no container wording.
    expect(within(result(s)).queryByRole('heading', { name: s.container.noCraneTitle })).toBeNull()
    expect(text).not.toContain(s.container.noCrane.slice(0, 20))
    expect(text).not.toContain('фиксирана')
    // To the Box houses' own section of the prices page (2026-10-16), named for what it is.
    expect(within(result(s)).getByRole('link', { name: s.box.assemblyLink })).toHaveAttribute('href', '/bg/ceni#prices-box')
  })

  it('box at the Varna base: no "около 0 €" transport row, the total is the crane', async () => {
    const one = (v) => [v]
    const [varna] = decodeChunk({
      v: 'test', c: 'BG', scale: 10000, regions: [],
      data: { name: one('Варна'), bg: one(''), en: one(''), el: one(''), r: one(-1), t: one(3), lat: one(432141), lon: one(279147), km: one(620), kmV: one(1) },
    })
    vi.mocked(loadPlaces).mockResolvedValue([...PLACES, varna])
    const { s, onOpenOffer } = renderCalc({ product: 'box' })
    await choose('Варна', 'Варна')
    const text = resultText(s)
    expect(text).not.toContain(s.box.transportLabel)
    expect(text).not.toContain(flat(`около ${euro(0, 'bg')}`))
    expect(text).toContain(flat(`около ${euro(DELIVERY_RATES.products.box.crane.about, 'bg')}`))
    fireEvent.click(within(result(s)).getByRole('button', { name: s.enquiry }))
    expect(onOpenOffer).toHaveBeenCalled()
    const offer = JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY)).offerText
    expect(flat(offer)).not.toContain(flat(`около ${euro(0, 'bg')}`))
  })

  it('box to Sofia counts from Marikostinovo: 348 km → about 700 € + crane', async () => {
    const { s } = renderCalc({ product: 'box' })
    await choose('Соф', 'София')
    const text = resultText(s)
    expect(text).toContain('от Марикостиново')
    expect(text).toContain(flat(`около ${euro(700, 'bg')}`))
    expect(text).toContain(flat(`около ${euro(700 + DELIVERY_RATES.products.box.crane.about, 'bg')}`))
  })

  it('a custom house: quoted with the project, with no km, no base and no price', async () => {
    const { s } = renderCalc({ product: 'project' })
    await choose('Соф', 'София')
    const text = resultText(s)
    expect(text).toContain('Доставката се оферира с проекта; митницата поемаме ние.')
    expect(text).not.toContain(s.km)
    expect(text).not.toContain('Марикостиново')
    expect(text).not.toMatch(/€/)
    const offer = buildOfferText({ product: 'project', place: PLACES.find((p) => p.name === 'София'), quote: quoteFor('project', {}), locale: 'bg', s })
    expect(offer).toContain(s.offer.project)
    expect(offer).not.toContain(s.offer.distance)
    expect(offer).not.toContain('за таксуване')
  })

  it('an island the roads cannot reach: on request, with the enquiry button, no price', async () => {
    const { s } = renderCalc({ product: 'container' })
    await choose('Арх', 'Арханес')
    const text = resultText(s)
    expect(text).toContain(s.onRequest)
    expect(text).not.toMatch(/€/)
    expect(screen.getByRole('button', { name: s.enquiry })).toBeInTheDocument()
  })

  it('switching the product re-prices the same place', async () => {
    const { s } = renderCalc({ product: 'container' })
    await choose('Бургас', 'Бургас')
    expect(resultText(s)).toContain('от Марикостиново')
    fireEvent.click(screen.getByRole('radio', { name: s.products.box }))
    expect(resultText(s)).toContain('от Варна')
  })

  it('preselects the product the page passes', () => {
    const { s } = renderCalc({ product: 'box' })
    expect(screen.getByRole('radio', { name: s.products.box })).toBeChecked()
    expect(screen.getByRole('radio', { name: s.products.container })).not.toBeChecked()
  })
})

describe('the enquiry', () => {
  it('prefills the offer form with the estimate and opens it', async () => {
    const { s, onOpenOffer } = renderCalc({ product: 'box' })
    await choose('Бургас', 'Бургас')
    fireEvent.click(screen.getByRole('button', { name: s.enquiry }))

    expect(onOpenOffer).toHaveBeenCalledTimes(1)
    const data = JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY))
    expect(data).toMatchObject({
      source: 'delivery-calculator',
      sourcePath: window.location.pathname,
      modelLabel: 'Бокс къща',
      knownTotal: 0,
    })
    expect(typeof data.updatedAt).toBe('number')
    const offer = flat(data.offerText)
    expect(offer).toContain('Бокс къща')
    expect(offer).toContain('Бургас, обл. Бургас, България')
    expect(offer).toContain(flat('131 км в една посока от Варна; 262 км за таксуване'))
    expect(offer).toContain(flat(`около ${euro(520, 'bg')}`))
    expect(offer).toContain('без ДДС')
    expect(offer).toContain('Ориентировъчно')
    expect(flat(data.questionText)).toContain('Бургас')
  })

  it('keeps the prefill on what the card shows, for every offer button on the page', async () => {
    const { s } = renderCalc({ product: 'box' })
    const stored = () => JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY) || 'null')
    expect(stored()).toBeNull()
    await choose('Бургас', 'Бургас')
    // Written as soon as the estimate shows, before the enquiry button is ever pressed.
    expect(stored().offerText).toContain('Бургас')
    fireEvent.click(screen.getByRole('button', { name: s.enquiry }))
    await choose('Соф', 'София')
    expect(stored().offerText).toContain('София')
    expect(stored().offerText).not.toContain('Бургас')
    // Clearing the field takes the estimate out again.
    fireEvent.change(field(), { target: { value: '' } })
    expect(stored()).toBeNull()
  })

  it('never puts the place in the URL or in analytics', async () => {
    const { s } = renderCalc({ product: 'container' })
    await choose('Соф', 'София')
    fireEvent.click(screen.getByRole('button', { name: s.enquiry }))

    expect(decodeURIComponent(window.location.href)).not.toContain('София')
    const events = window.dataLayer.filter((e) => String(e.event).startsWith('delivery_'))
    expect(events.map((e) => e.event)).toEqual(['delivery_estimate', 'delivery_enquiry'])
    for (const e of events) {
      expect(Object.keys(e).sort()).toEqual(['event', 'kmBand', 'product'])
      expect(e).toMatchObject({ product: 'container', kmBand: '100-199' })
      expect(JSON.stringify(e)).not.toMatch(/София|Sofia/)
    }
  })

  it('outside BG/GR the enquiry carries what was typed and no figure', async () => {
    const { s } = renderCalc()
    fireEvent.focus(field())
    fireEvent.change(field(), { target: { value: 'Париж' } })
    fireEvent.click(await screen.findByRole('button', { name: s.enquiryPlain }))
    const data = JSON.parse(window.sessionStorage.getItem(CONFIG_PREFILL_KEY))
    expect(data.offerText).toContain('Париж')
    expect(data.offerText).toContain(s.offer.outside)
    expect(data.offerText).not.toMatch(/€/)
    expect(window.dataLayer.at(-1)).toEqual({ event: 'delivery_enquiry', product: 'container', kmBand: 'outside' })
  })
})

describe('locales', () => {
  it('en: English strings, Latin names, the same figures', async () => {
    const { s } = renderCalc({ locale: 'en', product: 'container' })
    expect(screen.getByLabelText('Town or village')).toBe(field())
    expect(screen.getByRole('radio', { name: 'Box house' })).toBeInTheDocument()
    await choose('Sof', 'Sofia')
    const text = resultText(s)
    expect(text).toContain(flat('174 km by road from Marikostinovo, one way'))
    expect(text).toContain(flat(euro(348, 'en')))
    expect(text).toContain('fixed rate, excl. VAT')
  })

  it('el: Greek strings, Greek names and regions', async () => {
    const { s } = renderCalc({ locale: 'el', product: 'box' })
    expect(screen.getByLabelText('Πόλη ή χωριό')).toBe(field())
    await type('Καρ')
    expect(flat(screen.getAllByRole('option')[0].textContent)).toBe('Παραλία Καριανής, Π.Ε. Καβάλας')
    fireEvent.mouseDown(screen.getAllByRole('option')[0])
    const text = resultText(s)
    expect(text).toContain(flat('117 χλμ οδικώς από το Μαρικοστίνοβο'))
    expect(text).toContain(flat(`περίπου ${euro(470, 'el')}`))
    expect(text).toContain('Σπίτι Box χωρίς γερανό δεν παραδίδεται.')
  })

  it.each(['bg', 'en', 'el'])('%s: the string set has every key the bg set has', (locale) => {
    const keys = (o, at = '') =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${at}${k}.`) : [`${at}${k}`]))
    expect(keys(S[locale]).sort()).toEqual(keys(S.bg).sort())
  })

  it.each(['bg', 'en', 'el'])('%s: no figure is typed into the strings (they come from deliveryRates.js)', (locale) => {
    const all = JSON.stringify(S[locale])
    expect(all).not.toMatch(/\d\s*€|€\s*\d|\b(550|100|0[.,]8)\b/)
  })
})

describe('the OpenStreetMap credit', () => {
  it('credits the names and km, with the ODbL link, before any pick and without the map', () => {
    const { s, container } = renderCalc()
    expect(container.querySelector('.leaflet-container')).toBeNull()
    const link = screen.getByRole('link', { name: 'ODbL' })
    expect(link).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright')
    expect(flat(link.parentElement.textContent)).toContain(s.notes.data)
    expect(s.notes.data).toContain('© OpenStreetMap contributors')
  })
})

describe('the map', () => {
  it('loads only when opened, with translated zoom controls and the OpenStreetMap credit', async () => {
    const { s, container } = renderCalc({ product: 'container' })
    expect(container.querySelector('.leaflet-container')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: s.map.show }))
    await waitFor(() => expect(container.querySelector('.leaflet-container')).not.toBeNull())
    expect(loadPlaces).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.leaflet-control-zoom-in')).toHaveAttribute('title', 'Приближи')
    expect(container.querySelector('.leaflet-control-zoom-out')).toHaveAttribute('title', 'Отдалечи')
    const credit = container.querySelector('.leaflet-control-attribution a[href="https://www.openstreetmap.org/copyright"]')
    expect(credit).not.toBeNull()
    expect(flat(credit.parentElement.textContent)).toContain('© OpenStreetMap contributors')
    expect(screen.getByRole('button', { name: s.map.hide })).toHaveAttribute('aria-expanded', 'true')
  })
})
