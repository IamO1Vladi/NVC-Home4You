import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

import PlannerTemplates, {
  CONTAINERS_TAB,
  bedroomsText,
  fill,
  fitLabel,
  fmtList,
  fmtNumber,
  partitionSegments,
  roomsLine,
  sharedFrame,
  templateSummary,
  templatePlan,
  templatesForTab,
} from './PlannerTemplates.jsx'
import { getPlannerModel, getTemplate } from '../../content/shared/plannerModels.js'
import { usePlannerText } from './plannerText.js'
import bgContent from '../../content/bg/floorPlanner.js'
import enContent from '../../content/en/floorPlanner.js'

// The catalogue layouts section of the planner page. What these pin: each size tab lists that
// model's own catalogue layouts and nothing else; a card draws the plan the editor would load
// (the locked bathroom in its drawing position, the day space as ONE room with no line through
// it); on a wide screen a card hands its template to the page, on a phone it opens a read-only
// preview whose button sends that very plan; and the tabs behave as a tab list.

// usePlannerText's helpers outside a component, for the summary tests.
function textFor(content, locale) {
  let text
  function Probe() {
    text = usePlannerText(content, locale)
    return null
  }
  render(<Probe />)
  return text
}

function Harness(props) {
  const [tab, setTab] = useState(props.initialTab || 'b57')
  return <PlannerTemplates content={bgContent} locale="bg" tab={tab} onTabChange={setTab} {...props} />
}

describe('template helpers', () => {
  it('fills placeholders and leaves unknown ones as written', () => {
    expect(fill('План {key} · {area} м²', { key: 'B3', area: 58 })).toBe('План B3 · 58 м²')
    expect(fill('{nope}', {})).toBe('{nope}')
  })

  it('formats numbers and lists in the page language', () => {
    expect(fmtNumber(30.94, 'bg')).toBe('30,9')
    expect(fmtNumber(30.94, 'en')).toBe('30.9')
    expect(fmtList(['37', '58', '73'], 'bg')).toBe('37, 58 и 73')
    expect(fmtList(['37', '58', '73'], 'en')).toBe('37, 58 and 73')
  })

  it('says how many bedrooms in words', () => {
    expect(bedroomsText(bgContent.templates, 0)).toBe('Без спалня')
    expect(bedroomsText(bgContent.templates, 1)).toBe('1 спалня')
    expect(bedroomsText(bgContent.templates, 3)).toBe('3 спални')
  })

  it('lists one size per Box tab and the three shells on the containers tab', () => {
    expect(templatesForTab('b37').map((t) => t.key)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
    expect(templatesForTab('b73').map((t) => t.key)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6'])
    expect(templatesForTab('containers').map((t) => t.model)).toEqual(['c6x3', 'c7x3', 'c8x3'])
  })

  it('puts the locked bathroom where the model says, as the editor would', () => {
    const plan = templatePlan(getTemplate('B3'))
    const bath = plan.rooms.find((r) => r.id === 'bathroom_fixed')
    expect(bath).toMatchObject(getPlannerModel('b57').bathroom)
    expect(plan.openings.filter((o) => o.locked).map((o) => o.id).sort()).toEqual(['entrance_fixed', 'entrance_front_fixed'])
  })

  it('summarises a template as the editor summarises a plan: the L-shaped day space is one room', () => {
    const text = textFor(bgContent, 'bg')
    const summary = templateSummary(getTemplate('B3'), text, 'bg')
    const day = summary.rooms.find((r) => r.name === 'Дневна с кухня')
    expect(day.rects).toHaveLength(2)
    expect(day.areaM2).toBeCloseTo(22.14 + 8.71, 1)
    expect(summary.rooms.filter((r) => r.type === 'bed')).toHaveLength(3)
    expect(summary.rooms.find((r) => r.locked).type).toBe('bath')
    expect(summary).toMatchObject({ modelKey: 'b57', template: 'B3', templateEdited: false, terrace: { key: 'standard', included: true } })
    expect(roomsLine(summary.rooms, bgContent.templates, text.roomTypeLabel)).toBe('Дневна с кухня · 3 спални · Баня')
  })

  it('draws no partition between two rectangles of one open space', () => {
    const model = getPlannerModel('b37')
    const plan = templatePlan(getTemplate('A1'))
    const segments = partitionSegments(plan.rooms, model)
    const left = plan.rooms.find((r) => r.id === 'a1_living')
    const x = left.x + left.w
    // The living room's right side meets the core part of the same space below the
    // bathroom: that stretch is open; beside the bathroom the wall stays.
    const onLine = segments.filter((s) => s.v && Math.abs(s.c - x) < 1e-4)
    const bath = plan.rooms.find((r) => r.id === 'bathroom_fixed')
    expect(onLine.every((s) => s.b <= bath.y + bath.h + 1e-6)).toBe(true)
    expect(onLine.length).toBeGreaterThan(0)
  })
})

describe('PlannerTemplates', () => {
  it('shows the 58 m² layouts with their catalogue lines, and switches size', () => {
    render(<Harness />)

    const cards = screen.getAllByRole('article')
    expect(cards.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toHaveLength(6)
    expect(screen.getByRole('heading', { level: 3, name: 'Хол и кухня + 3 спални' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '58 м²' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: '37 м²' }))
    expect(screen.getByRole('tab', { name: '37 м²' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('article').map((c) => c.querySelector('.fpp-card-key').textContent.split(' · ')[0])).toEqual([
      'A1', 'A2', 'A3', 'A4', 'A5', 'A6',
    ])
  })

  it('moves along the tabs with the arrow keys', () => {
    render(<Harness />)
    const tab58 = screen.getByRole('tab', { name: '58 м²' })

    fireEvent.keyDown(tab58, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: '73 м²' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(screen.getByRole('tab', { name: '73 м²' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Контейнери' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(bgContent.templates.containersNote)).toBeInTheDocument()
  })

  it('draws each card from its template: one room shape per rectangle, bathroom included', () => {
    const { container } = render(<Harness />)
    const card = screen.getByRole('heading', { level: 3, name: 'Хол и кухня + 3 спални' }).closest('article')
    const plan = templatePlan(getTemplate('B3'))
    expect(card.querySelectorAll('.fpp-room')).toHaveLength(plan.rooms.length)
    expect(card.querySelector('.fpp-room--bath')).not.toBeNull()
    // the included deck is hatched in
    expect(card.querySelector('.fpp-deck-edge')).not.toBeNull()
    // pattern ids are unique per card, or every card would paint the first one's hatch
    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('on a wide screen a card hands its template to the page', () => {
    const onOpen = vi.fn()
    render(<Harness canEdit onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Отвори план B2 в планера' }))
    expect(onOpen).toHaveBeenCalledWith(getTemplate('B2'))
  })

  it('on a phone a card opens a read-only preview that sends exactly that plan', () => {
    const onSend = vi.fn()
    const onOpen = vi.fn()
    render(<Harness canEdit={false} onOpen={onOpen} onSend={onSend} />)

    expect(screen.queryByRole('button', { name: /в планера/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Виж план B3 отблизо' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'План B3 · 58 м²' })).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'План B3: Хол и кухня + 3 спални' })).toBeInTheDocument()
    const rooms = within(dialog).getAllByRole('listitem').map((li) => li.querySelector('.fpp-rooms-name').textContent)
    expect(rooms).toContain('Дневна с кухня')
    expect(rooms.filter((n) => n === 'Спалня')).toHaveLength(3)
    expect(rooms).toContain('Тераса 6,23\u00a0×\u00a02\u00a0м')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Изпрати този план за оферта' }))
    expect(onOpen).not.toHaveBeenCalled()
    expect(onSend).toHaveBeenCalledTimes(1)
    const [template, summary] = onSend.mock.calls[0]
    expect(template.key).toBe('B3')
    expect(summary.template).toBe('B3')
    expect(summary.rooms.map((r) => r.name)).toContain('Дневна с кухня')
  })

  it('speaks English on /en', () => {
    render(<PlannerTemplates content={enContent} locale="en" tab="b73" onTabChange={() => {}} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Ready layouts from the catalogue' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Open plan C\d in the planner$/ })).toHaveLength(6)
  })
})

describe('after the review (2026-10-15)', () => {
  it('lists the sizes with "or" where a house is one of them', () => {
    expect(fmtList(['37', '58', '73'], 'bg', 'disjunction')).toBe('37, 58 или 73')
    expect(fmtList(['37', '58', '73'], 'en', 'disjunction')).toBe('37, 58 or 73')
    expect(fmtList(['37', '58', '73'], 'el', 'disjunction')).toBe('37, 58 ή 73')
  })

  it('draws every card of a tab to one scale', () => {
    const frame = sharedFrame(templatesForTab(CONTAINERS_TAB), 'bg')
    // the 8 × 3 m unit is the largest: the 6 × 3 m one is drawn inside the same frame
    expect(frame).toEqual({ w: 8, d: 3 })
    const { container } = render(<Harness initialTab={CONTAINERS_TAB} />)
    const boxes = [...container.querySelectorAll('.fpp-card-plan svg')].map((svg) => svg.getAttribute('viewBox').split(' ').slice(2).map(Number))
    expect(boxes).toHaveLength(3)
    for (const [w, h] of boxes) {
      expect(w).toBeCloseTo(boxes[0][0], 6)
      expect(h).toBeCloseTo(boxes[0][1], 6)
    }
  })

  it('fills an open space once more underneath, so its rectangles meet without a seam', () => {
    const { container } = render(<Harness />)
    const card = screen.getByRole('heading', { level: 3, name: 'Хол и кухня + 2 спални' }).closest('article')
    expect(card.querySelectorAll('.fpp-room-under')).toHaveLength(1)
    // one shape made of the space's rectangles (B2's living room is three)
    expect(container.querySelector('.fpp-room-under').getAttribute('d').match(/M/g).length).toBeGreaterThan(1)
  })

  it('keeps a room name readable on screen, or leaves it to the list when the room is too narrow', () => {
    const bath = { name: 'Bathroom', area: '3,2', rect: { x: 0, y: 0, w: 1.32, h: 2.4 } }
    // a 73 m² preview on a phone: about 24 px per metre
    const small = fitLabel(bath, 24)
    expect(small.nameM * 24).toBeGreaterThanOrEqual(11)
    expect(small.showArea).toBe(true)
    expect(small.showName).toBe(false) // "Bathroom" at 11 px is wider than the 1.32 m room
    const corridor = fitLabel({ name: 'Διάδρομος', area: '6', rect: { x: 0, y: 0, w: 1.2, h: 5 } }, 40)
    expect(corridor.showName).toBe(false)
    // a wide room has room for both
    const living = fitLabel({ name: 'Дневна с кухня', area: '30,9', rect: { x: 0, y: 0, w: 6, h: 5 } }, 40)
    expect([living.showName, living.showArea]).toEqual([true, true])
  })

  it('on a phone a container is a shell with a bathroom to settle together, not a "living room"', () => {
    const onSend = vi.fn()
    render(<Harness initialTab={CONTAINERS_TAB} canEdit={false} onSend={onSend} />)
    expect(screen.getByText(bgContent.templates.containersNotePhone)).toBeInTheDocument()
    expect(screen.queryByText(/празен модул/i)).toBeNull()
    expect(screen.getAllByText(bgContent.templates.containerPhone)).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Виж план Контейнер 6×3 отблизо' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText(/Дневна/)).toBeNull()
    const names = [...dialog.querySelectorAll('.fpp-rooms-name')].map((n) => n.textContent)
    expect(names).toEqual(['Целият модул'])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Изпрати този план за оферта' }))
    expect(onSend.mock.calls[0][1].rooms.map((r) => r.name)).toEqual(['Целият модул'])
  })
})
