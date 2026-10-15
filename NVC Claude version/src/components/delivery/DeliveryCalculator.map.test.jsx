import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import DeliveryCalculator from './DeliveryCalculator.jsx'
import { CALCULATOR_STRINGS } from './calculatorStrings.fixture.js'
import { fixturePlaces } from './placesFixture.js'
import { loadPlaces } from '../../lib/deliveryPlaces.js'

// A tap on the map picks the nearest town within ~15 km, or says nothing is near. Leaflet is
// replaced by a stub that taps where it is told and shows what it was given; the real map's
// controls and credit are tested in DeliveryCalculator.test.jsx.
vi.mock('../../lib/deliveryPlaces.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadPlaces: vi.fn(),
}))
vi.mock('./DeliveryMap.jsx', () => ({
  default: ({ pins, line, onPick }) => (
    <div data-testid="map">
      <span data-testid="pins">{pins.map((p) => `${p.kind}:${p.label}`).join('|')}</span>
      <span data-testid="line">{line ? line.label : ''}</span>
      <button type="button" onClick={() => onPick(42.69, 23.33)}>tap-near-sofia</button>
      <button type="button" onClick={() => onPick(43.9, 21.0)}>tap-nowhere</button>
    </div>
  ),
}))

const S = CALCULATOR_STRINGS.bg
const flat = (t) => String(t ?? '').replace(/[\s  ]+/g, ' ').trim()

beforeEach(() => {
  vi.mocked(loadPlaces).mockReset()
  vi.mocked(loadPlaces).mockResolvedValue(fixturePlaces())
})

function renderCalc(product = 'container') {
  render(
    <MemoryRouter>
      <DeliveryCalculator locale="bg" content={S} initialProduct={product} />
    </MemoryRouter>,
  )
}

async function openMap() {
  fireEvent.click(screen.getByRole('button', { name: S.map.show }))
  await screen.findByTestId('map')
  await waitFor(() => expect(loadPlaces).toHaveBeenCalledTimes(1))
}

describe('the map', () => {
  it('a tap picks the nearest town and prices it; the pins and the line follow', async () => {
    renderCalc('container')
    await openMap()
    expect(screen.getByTestId('pins')).toHaveTextContent('base:Нашата база: Марикостиново')

    await waitFor(() => {
      fireEvent.click(screen.getByText('tap-near-sofia'))
      expect(screen.getByRole('combobox')).toHaveValue('София')
    })
    expect(flat(screen.getByLabelText(S.resultLabel).textContent)).toContain(flat('В двете посоки: 174 км × 2 = 348 км'))
    expect(screen.getByTestId('pins')).toHaveTextContent('base:Нашата база: Марикостиново|place:София')
    expect(flat(screen.getByTestId('line').textContent)).toBe(flat('174 км по пътя'))
  })

  it('a Box house shows both bases before a pick', async () => {
    renderCalc('box')
    await openMap()
    expect(screen.getByTestId('pins')).toHaveTextContent('Марикостиново|base:Нашата база: Варна')
  })

  it('a tap far from every town picks nothing and says so', async () => {
    renderCalc('container')
    await openMap()
    await waitFor(() => {
      fireEvent.click(screen.getByText('tap-nowhere'))
      expect(screen.getByText(S.map.nothingNear)).toBeInTheDocument()
    })
    expect(screen.getByRole('combobox')).toHaveValue('')
  })
})
