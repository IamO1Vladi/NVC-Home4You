import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// jsdom has neither an SVG nor a canvas renderer for Leaflet's vector layers, so the route
// lines are left out; the map, its controls and its markers are real Leaflet.
vi.mock('react-leaflet', async (importOriginal) => ({
  ...(await importOriginal()),
  Polyline: () => null,
}))

import LogisticsWorld from './LogisticsWorld.jsx'
// The map is the partner page's now: the logistics page that also drew it was retired into the
// delivery page on 2026-10-15.
import bgPartner from '../content/bg/partner.js'
import elPartner from '../content/el/partner.js'
import enPartner from '../content/en/partner.js'
import { routeMapDestinations } from '../content/shared/routeMap.js'

// The route map on /…/partner (it was also on /…/logistics until that page was retired). Its destination names used to be English
// literals inside this component, so the Greek page offered "Piraeus, GR" in a Greek
// sentence's select; Leaflet's own controls said "Zoom in" and "Marker" on every page.

// What the selects said before the names moved to content. en and bg must keep saying it.
const BEFORE = {
  sea: [
    'Rotterdam, NL', 'Hamburg, DE', 'Antwerp, BE', 'Piraeus, GR', 'Valencia, ES', 'Constanța, RO',
    'Varna, BG', 'Los Angeles, US', 'New York, US', 'Santos, BR', 'Callao, PE',
  ],
  air: [
    'Sofia (SOF), BG', 'Athens (ATH), GR', 'Frankfurt (FRA), DE', 'Paris (CDG), FR',
    'London (LHR), UK', 'New York (JFK), US', 'Los Angeles (LAX), US', 'São Paulo (GRU), BR',
  ],
  rail: ['Duisburg, DE', 'Hamburg, DE', 'Warsaw, PL', 'Budapest, HU', 'Sofia, BG'],
}

/** The option texts of each mode's select, switching modes with the chips as a visitor would. */
function optionsByMode(content) {
  const read = (label) =>
    [...screen.getByRole('combobox', { name: label }).querySelectorAll('option')].map((o) => o.textContent)
  const result = { sea: read(content.seaDestinationLabel) }
  fireEvent.click(screen.getByRole('button', { name: content.modeAir }))
  result.air = read(content.airDestinationLabel)
  fireEvent.click(screen.getByRole('button', { name: content.modeRail }))
  result.rail = read(content.railDestinationLabel)
  return result
}

const attributionLink = (container) =>
  container.querySelector('.leaflet-control-attribution a[href="https://leafletjs.com"]')

describe('LogisticsWorld', () => {
  it('names every destination in Greek on the Greek partner page', () => {
    const world = elPartner.logisticsWorld
    render(<LogisticsWorld content={world} />)

    const options = optionsByMode(world)
    expect(options.sea).toEqual(Object.values(world.destinations.sea))
    expect(options.air).toEqual(Object.values(world.destinations.air))
    expect(options.rail).toEqual(Object.values(world.destinations.rail))
    expect(options.sea).toContain('Πειραιάς, Ελλάδα')
    expect(options.air).toContain('Αθήνα (ATH), Ελλάδα')
    expect(screen.getByLabelText(world.legendLabel)).toHaveTextContent('Λάεμ Τσαμπάνγκ')
  })

  it('the Greek partner page draws the shared Greek list', () => {
    const world = elPartner.logisticsWorld
    render(<LogisticsWorld content={world} />)

    expect(optionsByMode(world).sea).toEqual(Object.values(routeMapDestinations.el.sea))
  })

  it.each([
    ['en', enPartner.logisticsWorld],
    ['bg', bgPartner.logisticsWorld],
  ])('%s offers exactly the names it did before', (_, world) => {
    render(<LogisticsWorld content={world} />)
    expect(optionsByMode(world)).toEqual(BEFORE)
  })

  it("puts Leaflet's controls in Greek on the Greek page", () => {
    const { container } = render(<LogisticsWorld content={elPartner.logisticsWorld} />)

    const zoomIn = container.querySelector('.leaflet-control-zoom-in')
    const zoomOut = container.querySelector('.leaflet-control-zoom-out')
    expect(zoomIn).toHaveAttribute('title', 'Μεγέθυνση')
    expect(zoomIn).toHaveAttribute('aria-label', 'Μεγέθυνση')
    expect(zoomOut).toHaveAttribute('title', 'Σμίκρυνση')
    expect(attributionLink(container)).toHaveAttribute('title', 'Βιβλιοθήκη JavaScript για διαδραστικούς χάρτες')
    expect(attributionLink(container)).toHaveTextContent('Leaflet')

    const markers = [...container.querySelectorAll('img.leaflet-marker-icon')]
    expect(markers).toHaveLength(4) // three origins and the chosen destination
    for (const m of markers) expect(m).toHaveAttribute('alt', 'Σημείο στον χάρτη')
  })

  // bg and en name the controls too since 2026-10-15 (bg as the delivery calculator's map).
  it.each([
    ['bg', bgPartner.logisticsWorld, { zoomIn: 'Приближи', zoomOut: 'Отдалечи', marker: 'Точка на картата' }],
    ['en', enPartner.logisticsWorld, { zoomIn: 'Zoom in', zoomOut: 'Zoom out', marker: 'Map pin' }],
  ])("names Leaflet's controls on the %s page", (_, world, expected) => {
    const { container } = render(<LogisticsWorld content={world} />)
    expect(container.querySelector('.leaflet-control-zoom-in')).toHaveAttribute('title', expected.zoomIn)
    expect(container.querySelector('.leaflet-control-zoom-out')).toHaveAttribute('title', expected.zoomOut)
    for (const m of container.querySelectorAll('img.leaflet-marker-icon')) expect(m).toHaveAttribute('alt', expected.marker)
  })

  it("leaves Leaflet's own wording alone where the content has none", () => {
    const { container } = render(<LogisticsWorld content={{ ...enPartner.logisticsWorld, mapControls: undefined }} />)

    expect(container.querySelectorAll('.leaflet-control-zoom')).toHaveLength(1)
    expect(container.querySelector('.leaflet-control-zoom-in')).toHaveAttribute('title', 'Zoom in')
    expect(container.querySelector('.leaflet-control-zoom-out')).toHaveAttribute('title', 'Zoom out')
    expect(attributionLink(container)).toHaveAttribute('title', 'A JavaScript library for interactive maps')
    for (const m of container.querySelectorAll('img.leaflet-marker-icon')) expect(m).toHaveAttribute('alt', 'Marker')
  })

  it('the mode chips are buttons that say which one is on', () => {
    const world = bgPartner.logisticsWorld
    render(<LogisticsWorld content={world} />)
    const sea = screen.getByRole('button', { name: world.modeSea })
    const air = screen.getByRole('button', { name: world.modeAir })
    for (const chip of [sea, air]) expect(chip).toHaveAttribute('type', 'button')
    expect(sea).toHaveAttribute('aria-pressed', 'true')
    expect(air).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(air)
    expect(sea).toHaveAttribute('aria-pressed', 'false')
    expect(air).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: world.modeLabel })).toContainElement(sea)
  })

  it('draws the plain OpenStreetMap tiles and credits their contributors', () => {
    const { container } = render(<LogisticsWorld content={bgPartner.logisticsWorld} />)
    const tile = container.querySelector('img.leaflet-tile')
    expect(tile).not.toBeNull()
    expect(tile.getAttribute('src')).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/)
    const credit = container.querySelector('.leaflet-control-attribution')
    expect(credit).toHaveTextContent('© OpenStreetMap contributors')
    expect(credit.querySelector('a[href="https://www.openstreetmap.org/copyright"]')).not.toBeNull()
  })
})
