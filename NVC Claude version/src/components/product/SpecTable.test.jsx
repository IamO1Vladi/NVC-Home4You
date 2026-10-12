import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import SpecTable from './SpecTable.jsx'

// A spec is a table a screen reader can walk: a name, a row header per property, column
// headers when products are compared.

describe('SpecTable', () => {
  it('is a captioned two-column table with a row header per property', () => {
    render(
      <SpecTable
        caption="What every container has"
        rows={[
          { label: 'Frame', value: 'Galvanised steel, 2.3 mm' },
          { label: 'Delivery', value: <a href="/en/delivery">€0.80/km</a> },
        ]}
      />,
    )
    const table = screen.getByRole('table', { name: 'What every container has' })
    expect(table.tagName).toBe('TABLE')
    expect(table.querySelector('thead')).toBeNull()

    const headers = within(table).getAllByRole('rowheader')
    expect(headers.map((th) => th.textContent)).toEqual(['Frame', 'Delivery'])
    headers.forEach((th) => expect(th).toHaveAttribute('scope', 'row'))
    expect(within(table).getByRole('link', { name: '€0.80/km' })).toHaveAttribute('href', '/en/delivery')
  })

  it('takes its name from a heading when one already names it', () => {
    render(
      <>
        <h2 id="spec-h">Technical data</h2>
        <SpecTable labelledBy="spec-h" rows={[{ label: 'Floors', value: '1–2' }]} />
      </>,
    )
    const table = screen.getByRole('table', { name: 'Technical data' })
    expect(table.querySelector('caption')).toBeNull()
  })

  it('compares products in columns, each value labelled for the stacked phone layout', () => {
    render(
      <SpecTable
        caption="Box house or capsule"
        columns={['Property', 'Box house', 'Capsule']}
        rows={[
          { label: 'Area', values: ['18–74 m²', '38 m²'] },
          { label: 'Price from', values: ['€10,500'] },
        ]}
      />,
    )
    const table = screen.getByRole('table', { name: 'Box house or capsule' })
    expect(table).toHaveClass('pp-spec--compare')

    const cols = within(table).getAllByRole('columnheader')
    expect(cols.map((th) => th.textContent)).toEqual(['Property', 'Box house', 'Capsule'])
    cols.forEach((th) => expect(th).toHaveAttribute('scope', 'col'))

    const rows = within(table).getAllByRole('row')
    const area = within(rows[1]).getAllByRole('cell')
    expect(area[0]).toHaveTextContent('Box house18–74 m²')
    // The phone label is hidden from screen readers; the column header names the cell.
    expect(area[0].querySelector('.pp-spec-col')).toHaveAttribute('aria-hidden', 'true')
    // A missing value is a dash, not an empty cell.
    expect(within(rows[2]).getAllByRole('cell')[1]).toHaveTextContent('—')
  })

  it('marks a comparison of exactly two products for the side-by-side phone layout', () => {
    const { container, rerender } = render(
      <SpecTable caption="Two" columns={['Property', 'Box house', 'Capsule']} rows={[{ label: 'Area', values: ['18–74 m²', '38 m²'] }]} />,
    )
    expect(container.querySelector('table')).toHaveClass('pp-spec--compare', 'pp-spec--two')

    rerender(<SpecTable caption="Three" columns={['Property', 'A', 'B', 'C']} rows={[{ label: 'Area', values: ['1', '2', '3'] }]} />)
    expect(container.querySelector('table')).toHaveClass('pp-spec--compare')
    expect(container.querySelector('table')).not.toHaveClass('pp-spec--two')

    rerender(<SpecTable caption="Plain" rows={[{ label: 'Frame', value: 'Steel' }]} className="extra" />)
    expect(container.querySelector('table').className).toBe('pp-spec extra')
  })
})
