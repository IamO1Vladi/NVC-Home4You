// A specification as a real table: a row header per property (th scope="row") and either one
// value column (label | value) or one column per product being compared (Box house |
// capsule). The old pages drew specs as dashed tiles and hover cards, which a screen reader
// reads as loose text and a phone hid entirely.
//
// ON A PHONE THE TABLE STACKS instead of scrolling sideways (ProductPage.css): each row
// becomes a small block, the property as its heading and, in a comparison, every value
// labelled with its column's name from a small span the phone layout shows (aria-hidden:
// the column header already names the cell to a screen reader). A comparison of exactly
// two products (pp-spec--two) keeps its two values side by side under the property. Setting display on
// table parts drops their table semantics in some browsers, so the parts also carry their
// roles explicitly; redundant on a wide screen, and what keeps the table a table on a narrow
// one.
//
// Values are rendered as given, so a cell may hold a link (the delivery calculator). Only
// facts the gallery or the owner has stated go in here; the page's content file says where
// each one comes from.
import React from 'react'

/**
 * @param caption     the table's name, printed as its <caption>
 * @param labelledBy  the id of a heading that already names it; then no caption is printed
 * @param columns     the column headers, first the one over the property names, e.g.
 *                    ['Характеристика', 'Бокс къща', 'Капсула'] for a comparison; omit for a
 *                    plain label | value table, which then has no header row
 * @param rows        [{ label, value }] or, in a comparison, [{ label, values: [...] }]
 * @param className   extra class on the table
 */
export default function SpecTable({ caption, labelledBy, columns, rows = [], className = '' }) {
  const heads = Array.isArray(columns) && columns.length >= 2 ? columns : null
  const valueHeads = heads ? heads.slice(1) : [null]
  const compare = valueHeads.length > 1
  // Two products fit side by side under each property even on a phone, which is what a
  // comparison is for; three or more stay stacked there, each value under its label.
  const classes = ['pp-spec']
  if (compare) classes.push('pp-spec--compare')
  if (valueHeads.length === 2) classes.push('pp-spec--two')
  if (className) classes.push(className)

  return (
    <table
      className={classes.join(' ')}
      role="table"
      aria-labelledby={!caption && labelledBy ? labelledBy : undefined}
    >
      {caption ? <caption>{caption}</caption> : null}
      {heads ? (
        <thead role="rowgroup">
          <tr role="row">
            {heads.map((head, i) => <th key={`${i}-${head}`} scope="col" role="columnheader">{head}</th>)}
          </tr>
        </thead>
      ) : null}
      <tbody role="rowgroup">
        {rows.map((row) => {
          const values = Array.isArray(row.values) ? row.values : [row.value]
          return (
            <tr key={row.label} role="row">
              <th scope="row" role="rowheader">{row.label}</th>
              {valueHeads.map((head, i) => (
                <td key={`${i}-${head}`} role="cell">
                  {compare ? <span className="pp-spec-col" aria-hidden="true">{head}</span> : null}
                  {values[i] ?? '—'}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
