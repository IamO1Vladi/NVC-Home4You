import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import FloorPlannerPage from './FloorPlannerPage.jsx'
import PlannerEditor from '../components/planner/PlannerEditor.jsx'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import { readConfiguratorPrefill } from '../lib/configPrefill.js'
import { STORAGE_KEY, buildPlanShareUrl, decodePlanShare } from '../lib/floorPlan.js'
import { getTemplate, templateLayout } from '../content/shared/plannerModels.js'
import bgContent from '../content/bg/floorPlanner.js'
import elContent from '../content/el/floorPlanner.js'
import enContent from '../content/en/floorPlanner.js'

// The floor planner's editor (src/components/planner/PlannerEditor.jsx), mounted the way the
// page mounts it. These pin what a visitor sees and what the page relies on: room names in the
// page's language, the "Your project" summary, the locked bathroom, refusals that say why,
// the old plans in visitors' browsers, and the offer that carries the plan.

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
  sessionStorage.clear()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SAVED))
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.useRealTimers()
})

function renderEditor(props = {}, { onOpenOffer = vi.fn() } = {}) {
  const utils = render(
    <ModalActionsProvider onOpenOffer={onOpenOffer} onOpenQuestion={() => {}}>
      <PlannerEditor content={enContent} modelKey="c6x3" onModelKeyChange={() => {}} {...props} />
    </ModalActionsProvider>
  )
  return { ...utils, onOpenOffer }
}

/** The room names drawn on the plan itself, in order (one per room; an open space once). */
function namesOnPlan(container, groupLabel) {
  return [...container.querySelectorAll(`.fp-canvas g[aria-label="${groupLabel}"] text`)].map((t) => t.dataset.room)
}

/** The project card's room rows: [name, area]. */
function projectRooms() {
  const card = screen.getByRole('region', { name: /Your project|Вашият проект|Το έργο σας/ })
  return [...card.querySelectorAll('.fp-room-row')].map((row) => [
    row.querySelector('.fp-room-name').firstChild.textContent,
    row.querySelector('.fp-room-area').textContent,
  ])
}

const toast = (container) => container.querySelector('.fp-toast')?.textContent || ''

// The editor takes the keyboard after a click inside it, as a visitor's click would.
const activate = (container) => fireEvent.pointerDown(container.querySelector('.fp-grid'))

describe('room names follow the page’s language', () => {
  it('shows default-named rooms in Greek on /el, whatever language they were saved in', () => {
    const { container } = renderEditor({ content: elContent })

    expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Υπνοδωμάτιο', 'Κουζίνα', 'Our den'])
  })

  it('shows the same plan in English on /en', () => {
    const { container } = renderEditor()

    expect(namesOnPlan(container, 'labels')).toEqual(['Bedroom', 'Kitchen', 'Our den'])
  })

  it('stops storing default names as text once the plan is saved again', async () => {
    renderEditor({ content: elContent })

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.c6x3.rooms.map((r) => r.label)).toEqual([null, null, 'Our den'])
    })
  })

  it('resolves default names in a layout file made in another language (More → Open file)', async () => {
    localStorage.clear()
    const onModelKeyChange = vi.fn()
    const { container } = renderEditor({ content: elContent, modelKey: undefined, onModelKeyChange })
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
    // jsdom's File may lack Blob.text(), which the editor reads the file with.
    file.text = () => Promise.resolve(JSON.stringify(layout))

    fireEvent.click(screen.getByRole('button', { name: 'Περισσότερα' }))
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })

    await waitFor(() => expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Μπάνιο', 'Αποθήκη']))
    expect(onModelKeyChange).toHaveBeenCalledWith('c7x3')
  })

  it('the name field shows the Greek default, and a type change follows the type', () => {
    const { container } = renderEditor({ content: elContent })

    fireEvent.click(screen.getByRole('button', { name: /Υπνοδωμάτιο/ }))
    const inspector = screen.getByRole('region', { name: 'Επιλογή' })
    expect(within(inspector).getByRole('textbox')).toHaveValue('Υπνοδωμάτιο')

    fireEvent.change(within(inspector).getByRole('combobox', { name: 'Τύπος' }), { target: { value: 'office' } })
    expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Γραφείο', 'Κουζίνα', 'Our den'])
  })

  it('a typed name survives a type change', () => {
    const { container } = renderEditor({ content: elContent })

    fireEvent.click(screen.getByRole('button', { name: /Our den/ }))
    const inspector = screen.getByRole('region', { name: 'Επιλογή' })
    fireEvent.change(within(inspector).getByRole('combobox', { name: 'Τύπος' }), { target: { value: 'bed' } })

    expect(namesOnPlan(container, 'Ονόματα δωματίων')).toEqual(['Υπνοδωμάτιο', 'Κουζίνα', 'Our den'])
  })

  it('names the laminate floor in Greek in the inspector', () => {
    renderEditor({ content: elContent })

    fireEvent.click(screen.getByRole('button', { name: /Our den/ }))
    const inspector = screen.getByRole('region', { name: 'Επιλογή' })
    expect(within(inspector).getByDisplayValue('Πλαστικοποιημένο παρκέ')).toBeInTheDocument()
  })
})

describe('assistive text', () => {
  it('labels the redo shortcut and the drawing layers in Greek on /el', () => {
    const { container } = renderEditor({ content: elContent })

    expect(screen.getByRole('button', { name: 'Επανάληψη' })).toHaveAttribute('title', 'Ctrl/⌘+Y ή Ctrl/⌘+Shift+Z')
    const groups = [...container.querySelectorAll('.fp-canvas svg g[role="group"]')].map((g) => g.getAttribute('aria-label'))
    expect(groups).toEqual(['Δωμάτια', 'Τοίχοι', 'Ονόματα δωματίων', 'Πόρτες και παράθυρα', 'Διαστάσεις επιλεγμένου στοιχείου'])
  })

  it('keeps the English wording on /en', () => {
    const { container } = renderEditor()

    expect(screen.getByRole('button', { name: 'Redo' })).toHaveAttribute('title', 'Ctrl/⌘+Y or Ctrl/⌘+Shift+Z')
    const groups = [...container.querySelectorAll('.fp-canvas svg g[role="group"]')].map((g) => g.getAttribute('aria-label'))
    expect(groups).toEqual(['rooms', 'walls', 'labels', 'openings', 'selected-dimensions'])
  })

  it('never shows a visitor an internal wall id', () => {
    renderEditor({ modelKey: 'b57', pendingPlan: templateLayout(getTemplate('B2')) })
    fireEvent.click(screen.getByRole('button', { name: /^Bathroom/ }))

    expect(document.body.textContent).not.toMatch(/outer_|re_|bathroom_fixed|entrance_/)
  })
})

describe('PlannerEditor contract', () => {
  const TEMPLATE = {
    modelKey: 'b73',
    plan: {
      rooms: [{ id: 't-living', type: 'living', label: null, x: 0, y: 4, w: 6.26, h: 3, finish: 'wood', locked: false }],
      walls: [],
      openings: [{ id: 't-win', kind: 'window', host: { type: 'wall', wallId: 'outer_left', at: 2 } }],
    },
  }

  it('reports the summary of the current plan, on the catalogue footprint, the locked bathroom included', async () => {
    localStorage.clear()
    const onSummaryChange = vi.fn()
    renderEditor({ modelKey: 'b57', onSummaryChange })

    await waitFor(() => expect(onSummaryChange).toHaveBeenCalled())
    const summary = onSummaryChange.mock.calls.at(-1)[0]
    expect(summary).toMatchObject({
      modelKey: 'b57',
      widthM: 6.26,
      depthM: 9,
      footprintM2: 56.34,
      totalRoomsM2: 3.17,
      bedrooms: 0,
      doors: 2,
      windows: 0,
      template: null,
      terrace: { key: 'standard', included: true, price: 0 },
    })
    expect(summary.rooms).toEqual([
      { id: 'bathroom_fixed', type: 'bath', name: 'Bathroom', label: null, locked: true, areaM2: 3.17, parts: ['bathroom_fixed'], kitchen: false },
    ])
  })

  it('loads a pending template onto its model once, as one undo step', async () => {
    localStorage.clear()
    const onModelKeyChange = vi.fn()
    const onPendingPlanApplied = vi.fn()
    const onSummaryChange = vi.fn()
    const props = { modelKey: 'c6x3', onModelKeyChange, onPendingPlanApplied, onSummaryChange }
    const { rerender } = renderEditor({ ...props, pendingPlan: TEMPLATE })

    expect(onModelKeyChange).toHaveBeenCalledWith('b73')
    expect(onPendingPlanApplied).toHaveBeenCalledTimes(1)
    expect(onPendingPlanApplied).toHaveBeenCalledWith(true)

    // The shell follows onModelKeyChange; the same object again is not reloaded.
    rerender(
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
        <PlannerEditor content={enContent} {...props} modelKey="b73" pendingPlan={TEMPLATE} />
      </ModalActionsProvider>
    )
    expect(onPendingPlanApplied).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onSummaryChange.mock.calls.at(-1)[0]).toMatchObject({ modelKey: 'b73', windows: 1, doors: 2 }))
    expect(onSummaryChange.mock.calls.at(-1)[0].rooms.map((r) => r.id)).toEqual(['bathroom_fixed', 't-living'])

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(onSummaryChange.mock.calls.at(-1)[0].rooms.map((r) => r.id)).toEqual(['bathroom_fixed']))
  })

  it('reports a pending plan it cannot read', () => {
    const onPendingPlanApplied = vi.fn()
    renderEditor({ pendingPlan: { nothing: true }, onPendingPlanApplied })

    expect(onPendingPlanApplied).toHaveBeenCalledWith(false)
  })

  it('a catalogue template shows its rooms with m², the open living room as one, and names the layout', async () => {
    localStorage.clear()
    const onSummaryChange = vi.fn()
    renderEditor({ modelKey: 'b57', pendingPlan: templateLayout(getTemplate('B2')), onSummaryChange })

    expect(projectRooms()).toEqual([
      ['Bathroom', '3.17 m²'],
      ['Living room with kitchen', '30.85 m²'],
      ['Bedroom', '11.16 m²'],
      ['Bedroom', '11.16 m²'],
    ])
    expect(screen.getByText('Catalogue layout B2')).toBeInTheDocument()
    await waitFor(() => expect(onSummaryChange.mock.calls.at(-1)[0]).toMatchObject({ template: 'B2', templateEdited: false, bedrooms: 2 }))
    expect(onSummaryChange.mock.calls.at(-1)[0].rooms[1]).toMatchObject({ name: 'Living room with kitchen', parts: ['b2_living', 'b2_living_core'] })
  })

  it('the terrace option changes the summary and is kept per model', async () => {
    localStorage.clear()
    const onSummaryChange = vi.fn()
    renderEditor({ modelKey: 'b57', onSummaryChange })

    fireEvent.change(screen.getByLabelText('Terrace'), { target: { value: 'long-58' } })
    await waitFor(() => expect(onSummaryChange.mock.calls.at(-1)[0].terrace).toMatchObject({ key: 'long-58', included: false }))
    expect(screen.getByText(/^\+ €/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('floorplanner.v4.terrace'))).toEqual({ b57: 'long-58' })
  })
})

describe('the locked bathroom and other refusals say why', () => {
  beforeEach(() => localStorage.clear())

  it('Delete on the bathroom keeps it and says it is fixed', () => {
    const { container } = renderEditor({ modelKey: 'b57' })

    fireEvent.click(screen.getByRole('button', { name: /^Bathroom/ }))
    activate(container)
    fireEvent.keyDown(window, { key: 'Delete' })

    expect(namesOnPlan(container, 'labels')).toEqual(['Bathroom'])
    expect(toast(container)).toMatch(/fixed/)
  })

  it('the inspector says the bathroom does not move, and offers no Delete', () => {
    renderEditor({ modelKey: 'b57' })
    fireEvent.click(screen.getByRole('button', { name: /^Bathroom/ }))
    const inspector = screen.getByRole('region', { name: 'Selected' })

    expect(inspector).toHaveTextContent('Fixed by the model’s drawing')
    expect(within(inspector).queryByRole('button', { name: /Delete/ })).toBeNull()
  })

  it('the Erase tool removes a room, and refuses the bathroom out loud', () => {
    const { container } = renderEditor({ modelKey: 'b57', pendingPlan: templateLayout(getTemplate('B2')) })
    fireEvent.click(screen.getByRole('button', { name: /^Erase/ }))

    fireEvent.pointerDown(container.querySelector('rect[data-room-id="bathroom_fixed"]'))
    expect(toast(container)).toMatch(/fixed/)

    fireEvent.pointerDown(container.querySelector('rect[data-room-id="b2_bed_r2"]'))
    expect(projectRooms().map(([name]) => name)).toEqual(['Bathroom', 'Living room with kitchen', 'Bedroom'])
  })

  it('the bathroom’s place is the catalogue drawing’s', () => {
    const { container } = renderEditor({ modelKey: 'b37' })
    const bath = container.querySelector('rect[data-room-id="bathroom_fixed"]')

    expect([bath.getAttribute('x'), bath.getAttribute('y'), bath.getAttribute('height')]).toEqual(['2.46', '0', '2.4'])
  })
})

describe('capture: the page scrolls until the visitor clicks into the editor', () => {
  it('keys do nothing before a click inside, work after it, and Esc gives them back', () => {
    const { container } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: /Our den/ }))

    fireEvent.keyDown(window, { key: 'Delete' })
    expect(namesOnPlan(container, 'labels')).toHaveLength(3)

    activate(container)
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(namesOnPlan(container, 'labels')).toEqual(['Bedroom', 'Kitchen'])

    fireEvent.keyDown(window, { key: 'w' })
    expect(screen.getByRole('button', { name: /^Wall/ })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('button', { name: /^Wall/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the plan starts released: the wheel scrolls the page, and the canvas only hints how to zoom', () => {
    const { container } = renderEditor()
    const svg = container.querySelector('.fp-svg')
    const before = svg.getAttribute('viewBox')

    const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
    svg.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(false)
    expect(svg.getAttribute('viewBox')).toBe(before)

    const ctrlWheel = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true })
    act(() => {
      svg.dispatchEvent(ctrlWheel)
    })
    expect(ctrlWheel.defaultPrevented).toBe(true)
    expect(svg.getAttribute('viewBox')).not.toBe(before)
  })

  it('the help dialog lists the shortcuts and closes on Esc', () => {
    renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    const dialog = screen.getByRole('dialog', { name: 'How the planner works' })

    expect(dialog).toHaveTextContent('Erase tool')
    expect(dialog).toHaveTextContent('Select tool')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Clear asks first', () => {
    const { container } = renderEditor()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear the plan' }))
    expect(namesOnPlan(container, 'labels')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(namesOnPlan(container, 'labels')).toEqual([])
    expect(screen.getByText('Start your plan')).toBeInTheDocument()
  })
})

describe('plans saved on the old footprints', () => {
  // The 58 m² as the planner stored it before the catalogue sizes (6.41 m wide), and a
  // container plan, which did not change.
  const OLD = {
    b57: {
      rooms: [
        { id: 'bathroom_fixed', type: 'bath', label: null, x: 2.435, y: 0, w: 1.54, h: 3, finish: 'tile', locked: true },
        { id: 'right', type: 'bed', label: null, x: 3.975, y: 0, w: 2.435, h: 4, finish: 'wood', locked: false },
        { id: 'sliver', type: 'storage', label: null, x: 6.3, y: 6, w: 0.11, h: 2, finish: 'wood', locked: false },
      ],
      walls: [],
      openings: [],
    },
    c6x3: SAVED.c6x3,
  }

  it('keeps what fits, says so once, and stores the plan with its new footprint', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(OLD))
    const { unmount } = renderEditor({ modelKey: 'b57' })

    expect(document.querySelector('.fp-notice')).toHaveTextContent('Box house 58 m² now uses the catalogue’s dimensions')
    expect(document.querySelector('.fp-notice')).toHaveTextContent('removed: 1')
    expect(projectRooms().map(([name]) => name)).toEqual(['Bathroom', 'Bedroom'])

    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).b57.footprint).toEqual({ widthM: 6.26, depthM: 9 }))
    unmount()

    renderEditor({ modelKey: 'b57' })
    expect(document.querySelector('.fp-notice')).toBeNull()
  })

  it('never crashes on damaged storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ b57: { rooms: [null, 5, { x: 'a' }] }, c6x3: 'oops', nope: [] }))
    renderEditor({ modelKey: 'b57' })
    expect(projectRooms().map(([name]) => name)).toEqual(['Bathroom'])

    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(() => renderEditor({ modelKey: 'c6x3' })).not.toThrow()
  })
})

describe('Send for an offer', () => {
  it('opens the offer form with the plan in the message: model, layout, footprint, rooms with m², a link back', () => {
    localStorage.clear()
    window.history.replaceState(null, '', '/bg/planirane-na-razpredelenie')
    const { onOpenOffer } = renderEditor({ content: bgContent, locale: 'bg', modelKey: 'b57', pendingPlan: templateLayout(getTemplate('B2')) })

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати за оферта' }))
    expect(onOpenOffer).toHaveBeenCalledTimes(1)

    const prefill = readConfiguratorPrefill('/bg/planirane-na-razpredelenie')
    expect(prefill).toMatchObject({ source: 'floor-planner', sourcePath: '/bg/planirane-na-razpredelenie', modelLabel: 'Бокс къща 58 м²' })
    expect(prefill.knownTotal).toBeGreaterThan(0)
    const text = prefill.offerText
    expect(text).toContain('Модел: Бокс къща 58 м²')
    expect(text).toContain('Разпределение от каталога: B2')
    // length × width, the catalogue's order
    expect(text).toContain('Външни размери: 9,00\u00a0×\u00a06,26\u00a0м (56,34\u00a0м²)')
    expect(text).toContain('Тераса: Стандарт · къса страна (включена)')
    expect(text).toContain('– Баня (фиксирана): 3,17 м²')
    expect(text).toContain('– Дневна с кухня: 30,85 м²')
    expect(text).toContain('– Спалня: 11,16 м²')

    // The link reopens this very plan.
    const link = text.split('\n').at(-1)
    expect(link).toMatch(/^http.*\/bg\/planirane-na-razpredelenie#plan=/)
    const shared = decodePlanShare(link.slice(link.indexOf('#')))
    expect(shared).toMatchObject({ modelKey: 'b57', template: 'B2', terrace: 'standard' })
    expect(shared.plan.rooms).toHaveLength(4)

    // Another page's offer form does not get it.
    expect(readConfiguratorPrefill('/bg/galeriq')).toBeNull()
  })

  it('a shared #plan= link opens that plan once and drops the hash', async () => {
    localStorage.clear()
    window.history.replaceState(null, '', '/en/floor-planner')
    const { onOpenOffer } = renderEditor({ modelKey: 'b57', pendingPlan: templateLayout(getTemplate('B3')) })
    fireEvent.click(screen.getByRole('button', { name: 'Send for an offer' }))
    expect(onOpenOffer).toHaveBeenCalled()
    const link = readConfiguratorPrefill('/en/floor-planner').offerText.split('\n').at(-1)
    document.body.innerHTML = ''
    localStorage.clear()

    window.history.replaceState(null, '', link.slice(link.indexOf('/en/')))
    const onModelKeyChange = vi.fn()
    renderEditor({ modelKey: 'c6x3', onModelKeyChange })

    expect(onModelKeyChange).toHaveBeenCalledWith('b57')
    expect(window.location.hash).toBe('')
  })
})

describe('the editor after the review (2026-10-15)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('says what the plan area is next to the model named by its catalogue area', () => {
    renderEditor({ modelKey: 'b57' })
    expect(screen.getByText('Area of the outline')).toBeInTheDocument()
    expect(screen.getByText(/named by its area in the catalogue/)).toBeInTheDocument()
    // outside size in the catalogue's order, length × width
    // (the matcher's spaces stand for the no-break ones: Testing Library normalizes both)
    expect(screen.getByText('9.00 × 6.26 m')).toBeInTheDocument()
    document.body.innerHTML = ''

    // a container is named by its size, so it needs no such note
    renderEditor({ modelKey: 'c6x3' })
    expect(screen.queryByText(/named by its area in the catalogue/)).toBeNull()
  })

  it('names a loaded container shell by its size, never its internal key or as a catalogue layout', () => {
    window.history.replaceState(null, '', '/en/floor-planner')
    const { onOpenOffer } = renderEditor({ modelKey: 'c6x3', pendingPlan: templateLayout(getTemplate('c6x3-shell')) })
    expect(screen.getByText('Started from: Shell 6 × 3 m')).toBeInTheDocument()
    expect(screen.queryByText(/c6x3-shell/)).toBeNull()
    expect(screen.queryByText(/Catalogue layout/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Send for an offer' }))
    expect(onOpenOffer).toHaveBeenCalled()
    const text = readConfiguratorPrefill('/en/floor-planner').offerText
    expect(text).toContain('Started from: Shell 6 × 3 m')
    expect(text).not.toContain('c6x3-shell')
  })

  it('calls a container shell "the whole unit" in the editor too, never a living room', () => {
    window.history.replaceState(null, '', '/en/floor-planner')
    const { container } = renderEditor({ modelKey: 'c6x3', pendingPlan: templateLayout(getTemplate('c6x3-shell')) })

    // The room list in "Your project" and the label drawn on the plan
    expect(container.querySelector('.fp-room-name')).toHaveTextContent('The whole unit')
    expect(container.querySelector('.fp-canvas').textContent).toContain('The whole unit')
    expect(container.querySelector('.fp-canvas').textContent).not.toContain('Living room')

    fireEvent.click(screen.getByRole('button', { name: 'Send for an offer' }))
    const text = readConfiguratorPrefill('/en/floor-planner').offerText
    expect(text).toContain('The whole unit')
    expect(text).not.toContain('Living room')
  })

  it('puts the tool tip and the wheel hint on two lines, with no separator between them', () => {
    const { container } = renderEditor({ modelKey: 'b57' })
    const hint = container.querySelector('.fp-hint')
    expect(hint.querySelector('.fp-hint-sep')).toBeNull()
    expect(hint.children).toHaveLength(2)
    expect(hint.textContent).not.toContain('·')
  })

  it('a shared link sets its terrace on the link\'s model, not on the one the browser was on', async () => {
    window.history.replaceState(
      null,
      '',
      buildPlanShareUrl(
        { modelKey: 'b73', plan: { rooms: [], walls: [], openings: [] }, terrace: 'long-73' },
        { pathname: '/en/floor-planner' }
      )
    )
    renderEditor({ modelKey: undefined })

    await waitFor(() => expect(screen.getByLabelText('Terrace')).toHaveValue('long-73'))
    expect(screen.getByLabelText('Model')).toHaveValue('b73')
    expect(JSON.parse(localStorage.getItem('floorplanner.v4.terrace'))).toEqual({ b73: 'long-73' })
  })

  it('moves the view with one finger on empty plan when Select is the tool', () => {
    // jsdom lays nothing out: 100 screen pixels are one metre here
    const proto = window.SVGSVGElement.prototype
    const saved = { createSVGPoint: proto.createSVGPoint, getScreenCTM: proto.getScreenCTM }
    proto.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x / 100, y: this.y / 100 } } })
    proto.getScreenCTM = () => ({ inverse: () => ({}) })
    try {
      const { container } = renderEditor({ modelKey: 'b73' })
      for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
      const svg = container.querySelector('svg.fp-svg')
      const before = svg.getAttribute('viewBox')
      // jsdom has no PointerEvent: a mouse event of the pointer's type, with the finger's fields
      const finger = (type, clientY) => {
        const ev = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 300, clientY })
        Object.defineProperty(ev, 'pointerType', { value: 'touch' })
        Object.defineProperty(ev, 'pointerId', { value: 3 })
        act(() => {
          svg.dispatchEvent(ev)
        })
      }
      finger('pointerdown', 400)
      finger('pointermove', 250)
      finger('pointerup', 250)
      expect(svg.getAttribute('viewBox')).not.toBe(before)
      // a mouse press on the same empty plan selects, it does not move the view
      const after = svg.getAttribute('viewBox')
      fireEvent.pointerDown(svg, { button: 0, clientX: 300, clientY: 400 })
      fireEvent.pointerMove(svg, { clientX: 300, clientY: 250 })
      fireEvent.pointerUp(svg, { clientX: 300, clientY: 250 })
      expect(svg.getAttribute('viewBox')).toBe(after)
    } finally {
      Object.assign(proto, saved)
    }
  })

  it('leaves Space to a focused button: it presses Help instead of arming the pan', () => {
    const { container } = renderEditor({ modelKey: 'b57' })
    activate(container)
    const help = screen.getByRole('button', { name: 'Help' })
    help.focus()
    // not prevented, so the browser presses the button as it does everywhere
    expect(fireEvent.keyDown(help, { key: ' ', code: 'Space' })).toBe(true)
    help.blur()
    // on the plan itself Space is the pan key, and the page must not scroll
    expect(fireEvent.keyDown(container.querySelector('.fp-grid'), { key: ' ', code: 'Space' })).toBe(false)
  })

  it('takes the "start your plan" card off the floor once a drawing tool is picked', () => {
    const { container } = renderEditor({ modelKey: 'b57' })
    expect(container.querySelector('.fp-empty-card')).not.toBeNull()
    activate(container)
    for (const key of ['w', 'd', 'n', 'e']) {
      fireEvent.keyDown(window, { key })
      expect(container.querySelector('.fp-empty-card')).toBeNull()
    }
    fireEvent.keyDown(window, { key: 'v' })
    expect(container.querySelector('.fp-empty-card')).not.toBeNull()
  })

  it('says so when a layout file saved on an old footprint had to be cut to fit', async () => {
    const { container } = renderEditor({ modelKey: 'b73' })
    const layout = {
      kind: 'floorplanner-layout',
      version: 1,
      modelKey: 'b73',
      // the 73 m² as the planner drew it before the catalogue sizes: 6.41 m wide
      plan: {
        rooms: [{ id: 'old-bed', type: 'bed', label: null, x: 3.975, y: 3.2, w: 2.435, h: 5, finish: 'wood', locked: false }],
        walls: [],
        openings: [],
      },
    }
    const file = new File([JSON.stringify(layout)], 'layout-b73.json', { type: 'application/json' })
    file.text = () => Promise.resolve(JSON.stringify(layout))
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })

    await waitFor(() => expect(container.querySelector('.fp-notice')).toHaveTextContent('Box house 73 m² now uses the catalogue’s dimensions'))
  })
})

describe('the page around the editor, by screen width', () => {
  let savedMatchMedia
  let queries
  // matchMedia as the browser answers it: the editor's width query, print, nothing else
  function mockScreen({ wide = true, print = false } = {}) {
    queries = {}
    window.matchMedia = (q) => {
      if (!queries[q]) {
        const listeners = []
        queries[q] = {
          media: q,
          matches: q === 'print' ? print : /min-width/.test(q) ? wide : false,
          addEventListener: (_, fn) => listeners.push(fn),
          removeEventListener: (_, fn) => listeners.splice(listeners.indexOf(fn), 1),
          fire: () => listeners.forEach((fn) => fn()),
        }
      }
      return queries[q]
    }
  }
  function renderPage({ content = enContent, locale = 'en' } = {}) {
    const onOpenOffer = vi.fn()
    const utils = render(
      <MemoryRouter>
        <ModalActionsProvider onOpenOffer={onOpenOffer} onOpenQuestion={() => {}}>
          <FloorPlannerPage content={content} locale={locale} />
        </ModalActionsProvider>
      </MemoryRouter>
    )
    return { ...utils, onOpenOffer }
  }
  let scrolledTo
  let savedScroll
  beforeEach(() => {
    savedMatchMedia = window.matchMedia
    savedScroll = Element.prototype.scrollIntoView
    scrolledTo = []
    Element.prototype.scrollIntoView = function scrollIntoView() { scrolledTo.push(this.id) }
    window.history.replaceState(null, '', '/en/floor-planner')
  })
  afterEach(() => {
    window.matchMedia = savedMatchMedia
    Element.prototype.scrollIntoView = savedScroll
    window.history.replaceState(null, '', '/')
  })

  it('"Blank plan" really starts a blank plan, as one step the planner can undo', async () => {
    mockScreen({ wide: true })
    localStorage.setItem('floorplanner.v4.model', 'c6x3')
    renderPage()
    expect(projectRooms().map(([name]) => name)).toEqual(['Bedroom', 'Kitchen', 'Our den'])

    fireEvent.click(screen.getByRole('link', { name: 'Blank plan' }))
    await waitFor(() => expect(projectRooms()).toEqual([]))
    expect(document.getElementById('fpp-loaded')).toHaveTextContent('A blank plan is open in the planner')
    await waitFor(() => expect(scrolledTo).toContain('editor'))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(projectRooms().map(([name]) => name)).toEqual(['Bedroom', 'Kitchen', 'Our den']))
  })

  it('opening a catalogue plan scrolls to the line that confirms it, so the plan fills the screen', async () => {
    mockScreen({ wide: true })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Open plan B2 in the planner' }))
    await waitFor(() => expect(scrolledTo).toContain('fpp-loaded'))
    expect(document.getElementById('fpp-loaded')).toHaveTextContent('Plan B2 is loaded in the planner')
  })

  it('names a container shell by its size in the loaded line', async () => {
    mockScreen({ wide: true })
    renderPage()
    fireEvent.click(screen.getByRole('tab', { name: 'Containers' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open plan Container 7×3 in the planner' }))
    await waitFor(() => expect(document.getElementById('fpp-loaded')).toHaveTextContent('Shell 7 × 3 m is loaded in the planner'))
    expect(document.body.textContent).not.toContain('c7x3-shell')
  })

  it('on a phone nothing in the hero or the steps promises drawing', () => {
    mockScreen({ wide: false })
    const { onOpenOffer } = renderPage()
    expect(document.querySelector('.fpp-hero a[href="#editor"]')).toBeNull()
    expect(screen.getByText(enContent.hero.leadPhone.replace('{count}', '18'))).toBeInTheDocument()
    expect(screen.queryByText(/or draw your own/)).toBeNull()
    expect(screen.getByText('Each plan with its rooms and their areas')).toBeInTheDocument()
    expect(screen.getByText(enContent.how.steps[1].textPhone)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'The planner needs a wider screen' })).toBeInTheDocument()

    const hero = document.querySelector('.fpp-hero')
    fireEvent.click(within(hero).getByRole('button', { name: 'Ask for an offer' }))
    expect(onOpenOffer).toHaveBeenCalledTimes(1)
  })

  it('keeps the editor, and its print sheet, while printing lays the page out at paper width', () => {
    mockScreen({ wide: true, print: true })
    const { container } = renderPage()
    expect(container.querySelector('.fp-grid')).not.toBeNull()
    const width = queries['(min-width: 900px)']
    width.matches = false
    act(() => width.fire())
    expect(container.querySelector('.fp-grid')).not.toBeNull()
    act(() => window.dispatchEvent(new Event('beforeprint')))
    expect(document.querySelector('.fp-print-root')).not.toBeNull()
    act(() => window.dispatchEvent(new Event('afterprint')))

    // outside printing the same change does take the editor off a narrow screen
    queries.print.matches = false
    act(() => width.fire())
    expect(container.querySelector('.fp-grid')).toBeNull()
  })

  it('on a phone a plan\'s link shows that plan read-only, with its rooms', async () => {
    mockScreen({ wide: false })
    window.history.replaceState(
      null,
      '',
      buildPlanShareUrl(
        { modelKey: 'b57', plan: templateLayout(getTemplate('B2')).plan, template: 'B2', terrace: 'standard' },
        { pathname: '/en/floor-planner' }
      )
    )
    renderPage()
    const shared = screen.getByRole('region', { name: 'The plan from the link' })
    expect(within(shared).getByRole('img', { name: 'Box house 58 m² · B2' })).toBeInTheDocument()
    const names = [...shared.querySelectorAll('.fpp-rooms-name')].map((n) => n.textContent)
    expect(names).toEqual(['Bathroom (fixed in place)', 'Living room with kitchen', 'Bedroom', 'Bedroom'])
    await waitFor(() => expect(scrolledTo).toContain('fpp-shared'))
    // the link stays as it is: on a computer the editor will open it
    expect(window.location.hash).toMatch(/^#plan=/)
  })
})

describe('the page around the editor', () => {
  it('renders with the editor in it', () => {
    localStorage.clear()
    const { container } = render(
      <MemoryRouter>
        <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}}>
          <FloorPlannerPage content={enContent} locale="en" />
        </ModalActionsProvider>
      </MemoryRouter>
    )
    expect(container.querySelector('.fp-grid')).not.toBeNull()
  })
})
