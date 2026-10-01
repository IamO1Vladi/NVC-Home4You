import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import FloorPlannerPage from './FloorPlannerPage.jsx'
import elContent from '../content/el/floorPlanner.js'
import enContent from '../content/en/floorPlanner.js'

// The floor planner keeps its plans in ONE localStorage key shared by /bg, /en and /el (and
// in downloadable layout files). Room names used to be stored as literal text in whatever
// language the room was drawn in, so a plan drawn on /en said "Bedroom" on the Greek page.
// Default names are now resolved from the room's type at render time; a typed name is kept.

const STORAGE_KEY = 'floorplanner.v4'

// A plan as an older build saved it: two default names in other languages, one typed name.
const SAVED = {
  c6x3: {
    rooms: [
      { id: 'r-bed', type: 'bed', label: 'Bedroom', x: 0, y: 0, w: 2, h: 3, finish: 'wood', locked: false },
      { id: 'r-kit', type: 'kitchen', label: 'Кухня', x: 2, y: 0, w: 2, h: 3, finish: 'tile', locked: false },
      { id: 'r-den', type: 'living', label: 'Our den', x: 4, y: 0, w: 2, h: 3, finish: 'laminate', locked: false },
    ],
    walls: [],
    openings: [],
  },
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SAVED))
})

afterEach(() => {
  localStorage.clear()
})

/** The room names drawn on the plan itself, in order. */
function namesOnPlan(container, groupLabel) {
  return [...container.querySelectorAll(`g[aria-label="${groupLabel}"] text`)].map((t) => t.textContent)
}

describe('FloorPlannerPage room names', () => {
  it('shows default-named rooms in Greek on /el, whatever language they were saved in', () => {
    const { container } = render(<FloorPlannerPage content={elContent} />)

    expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Υπνοδωμάτιο', 'Κουζίνα', 'Our den'])
  })

  it('shows the same plan in English on /en', () => {
    const { container } = render(<FloorPlannerPage content={enContent} />)

    expect(namesOnPlan(container, 'labels')).toEqual(['Bedroom', 'Kitchen', 'Our den'])
  })

  it('stops storing default names as text once the plan is saved again', async () => {
    render(<FloorPlannerPage content={elContent} />)

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.c6x3.rooms.map((r) => r.label)).toEqual([null, null, 'Our den'])
    })
  })

  it('resolves default names in a layout file made in another language', async () => {
    localStorage.clear()
    const { container } = render(<FloorPlannerPage content={elContent} />)
    const layout = {
      kind: 'floorplanner-layout',
      version: 1,
      modelKey: 'c7x3',
      plan: {
        rooms: [
          { id: 'f-bath', type: 'bath', label: 'Bathroom', x: 0, y: 0, w: 2, h: 3, finish: 'tile', locked: false },
          { id: 'f-store', type: 'storage', label: 'Склад', x: 2, y: 0, w: 2, h: 3, finish: 'concrete', locked: false },
        ],
        walls: [],
        openings: [],
      },
    }
    const file = new File([JSON.stringify(layout)], 'layout-c7x3.json', { type: 'application/json' })
    // jsdom's File may lack Blob.text(), which the page reads the file with.
    file.text = () => Promise.resolve(JSON.stringify(layout))
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})

    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })

    await waitFor(() => expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Μπάνιο', 'Αποθήκη']))
    expect(alert).not.toHaveBeenCalled()
  })

  it('the name field shows the Greek default, and a type change follows the type', () => {
    const { container } = render(<FloorPlannerPage content={elContent} />)

    fireEvent.click(screen.getByRole('button', { name: /Υπνοδωμάτιο/ }))
    const inspector = container.querySelectorAll('.fp-note')[1]
    expect(within(inspector).getByRole('textbox')).toHaveValue('Υπνοδωμάτιο')

    fireEvent.change(within(inspector).getByRole('combobox', { name: 'Τύπος' }), { target: { value: 'office' } })
    expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Γραφείο', 'Κουζίνα', 'Our den'])
  })

  it('a typed name survives a type change', () => {
    const { container } = render(<FloorPlannerPage content={elContent} />)

    fireEvent.click(screen.getByRole('button', { name: /Our den/ }))
    const inspector = container.querySelectorAll('.fp-note')[1]
    fireEvent.change(within(inspector).getByRole('combobox', { name: 'Τύπος' }), { target: { value: 'bed' } })

    expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Υπνοδωμάτιο', 'Κουζίνα', 'Our den'])
  })

  it('names the laminate floor in Greek', () => {
    render(<FloorPlannerPage content={elContent} />)

    expect(screen.getByRole('button', { name: /Our den/ })).toHaveTextContent('Πλαστικοποιημένο παρκέ')
  })
})

describe('FloorPlannerPage assistive text', () => {
  it('labels the redo shortcut and the drawing layers in Greek on /el', () => {
    const { container } = render(<FloorPlannerPage content={elContent} />)

    expect(screen.getByRole('button', { name: 'Επανάληψη' })).toHaveAttribute('title', 'Ctrl/⌘+Y ή Ctrl/⌘+Shift+Z')
    const groups = [...container.querySelectorAll('svg g[role="group"]')].map((g) => g.getAttribute('aria-label'))
    expect(groups).toEqual([
      'Δωμάτια',
      'Τοίχοι',
      'Ονόματα δωματίων',
      'Διαστάσεις επιλεγμένου στοιχείου',
      'Πόρτες και παράθυρα',
    ])
  })

  it('keeps the English wording on /en', () => {
    const { container } = render(<FloorPlannerPage content={enContent} />)

    expect(screen.getByRole('button', { name: 'Redo' })).toHaveAttribute('title', 'Ctrl/⌘+Y or Ctrl/⌘+Shift+Z')
    const groups = [...container.querySelectorAll('svg g[role="group"]')].map((g) => g.getAttribute('aria-label'))
    expect(groups).toEqual(['rooms', 'walls', 'labels', 'selected-dimensions', 'openings'])
  })
})
