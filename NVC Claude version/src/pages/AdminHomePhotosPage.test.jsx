import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminHomePhotosPage from './AdminHomePhotosPage.jsx'

// The home page photos screen. What is pinned here: all eight slots render with their
// labels BEFORE anything has been uploaded (a screen that only lists what exists cannot
// show where a photo belongs); each verb hits the address and body the API binds —
// FormData with `file`, `{ imageKey }` for a gallery pick, `{ a, b }` for a swap, DELETE
// to clear; a refused upload shows the server's sentence without taking the slots away;
// and an expired session asks for sign-in instead of looking broken.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/home-photos']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const NAMES = ['hero-1', 'hero-2', 'hero-3', 'hero-4', 'hero-5', 'model-37', 'model-58', 'model-73']

const emptySlot = (name) => ({
  name,
  kind: name.startsWith('hero') ? 'hero' : 'model',
  index: name.startsWith('hero') ? Number(name.slice(5)) : name.slice(6),
  imageKey: null, url: null, alt: null, updatedAt: null, updatedByUpn: null,
})

const EMPTY = { slots: NAMES.map(emptySlot), names: NAMES }

const FILLED = {
  slots: NAMES.map((name) => (name === 'hero-1' || name === 'hero-2'
    ? {
      ...emptySlot(name),
      imageKey: `home/1/${name}.webp`, url: `/api/img/home/1/${name}.webp`, alt: 'Front porch',
      updatedAt: '2026-10-10T09:00:00Z', updatedByUpn: 'maria@nvc-home4you.eu',
    }
    : emptySlot(name))),
  names: NAMES,
}

const HOUSES = [
  {
    id: 8, title: 'Villa-Office 58', titleBg: 'Вила-Офис 58', isPublished: true,
    images: [
      { id: 21, imageKey: 'gallery/8/7cfe-front.webp', url: '/api/img/gallery/8/7cfe-front.webp', sortOrder: 0, altText: null },
      { id: 22, imageKey: 'gallery/8/8aa1-side.webp', url: '/api/img/gallery/8/8aa1-side.webp', sortOrder: 1, altText: null },
    ],
  },
  { id: 9, title: 'Empty model', titleBg: 'Празен модел', isPublished: true, images: [] },
]

let calls = []
let listAnswer = () => json(FILLED)
let uploadAnswer = () => json(FILLED.slots[1])

beforeEach(() => {
  calls = []
  listAnswer = () => json(FILLED)
  uploadAnswer = () => json(FILLED.slots[1])
  Element.prototype.scrollIntoView = vi.fn()

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    const u = String(url)
    const method = options.method || 'GET'
    calls.push({ url: u, method, body: options.body })

    if (u.endsWith('/api/admin/home-photos') && method === 'GET') return listAnswer()
    if (u.includes('/api/admin/home-photos/') && u.endsWith('/file') && method === 'POST') return uploadAnswer()
    if (u.endsWith('/api/admin/home-photos/swap') && method === 'POST') return json({ ok: true })
    if (u.includes('/api/admin/home-photos/') && u.endsWith('/pick') && method === 'POST') return json(FILLED.slots[2])
    if (u.includes('/api/admin/home-photos/') && method === 'DELETE') return json(null, 204)
    if (u.endsWith('/api/admin/gallery') && method === 'GET') return json(HOUSES)
    // The shell's own identity check and badges — not what these tests are about.
    return json({})
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const card = (label) => screen.getByText(label, { selector: 'strong' }).closest('li')

describe('AdminHomePhotosPage', () => {
  it('renders all eight slots with their labels before any photo has been uploaded', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)

    expect(await screen.findByText('Снимка 1', { selector: 'strong' })).toBeInTheDocument()
    for (const n of [2, 3, 4, 5]) expect(screen.getByText(`Снимка ${n}`, { selector: 'strong' })).toBeInTheDocument()
    for (const label of ['37 m²', '58 m²', '73 m²']) expect(screen.getByText(label, { selector: 'strong' })).toBeInTheDocument()

    // Every slot says what the site shows while it is empty, and offers the two ways to fill it.
    expect(screen.getAllByText('По подразбиране')).toHaveLength(8)
    expect(screen.getAllByRole('button', { name: /^Замени$/ })).toHaveLength(8)
    expect(screen.getAllByRole('button', { name: 'От галерията' })).toHaveLength(8)
    // Nothing to clear yet.
    expect(screen.queryByRole('button', { name: /Изчисти/ })).not.toBeInTheDocument()
  })

  it('uploading into a hero slot posts the file to that slot', async () => {
    render(<AdminHomePhotosPage />)
    await screen.findByText('Снимка 1', { selector: 'strong' })

    const file = new File(['RIFF'], 'porch.webp', { type: 'image/webp' })
    await userEvent.upload(screen.getByLabelText('Замени — Снимка 2'), file)

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/home-photos/hero-2/file')
      expect(post.body).toBeInstanceOf(FormData)
      expect(post.body.get('file')).toBe(file)
    })
    // The list is re-read after the write rather than patched locally.
    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/admin/home-photos')).length).toBeGreaterThan(1)
    })
    expect(await screen.findByText(/Готово — „Снимка 2“ е на сайта\./)).toBeInTheDocument()
  })

  it('picking from the gallery dialog posts the image key to the chosen slot', async () => {
    render(<AdminHomePhotosPage />)
    await screen.findByText('Снимка 1', { selector: 'strong' })

    await userEvent.click(within(card('Снимка 3')).getByRole('button', { name: 'От галерията' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Избери снимка от галерията' })).toBeInTheDocument()
    // Houses with photos are listed by their Bulgarian title; the one without photos is not.
    expect(await within(dialog).findByRole('heading', { name: 'Вила-Офис 58' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Празен модел')).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Вила-Офис 58 — 2' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/pick'))
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/home-photos/hero-3/pick')
      expect(JSON.parse(post.body)).toEqual({ imageKey: 'gallery/8/8aa1-side.webp' })
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('a refused upload shows the server sentence and keeps the slots on screen', async () => {
    uploadAnswer = () => json({ errors: ['That file could not be read as an image.'] }, 400)
    render(<AdminHomePhotosPage />)
    await screen.findByText('Снимка 1', { selector: 'strong' })

    const file = new File(['x'], 'notes.txt', { type: 'image/webp' })
    await userEvent.upload(screen.getByLabelText('Замени — 58 m²'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('That file could not be read as an image.')
    // Still eight slots behind the alert — a refused upload is not a broken page.
    expect(screen.getByText('Снимка 5', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('73 m²', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Замени$/ })).toHaveLength(8)
  })

  it('moving a hero photo left swaps it with its left neighbour', async () => {
    render(<AdminHomePhotosPage />)
    await screen.findByText('Снимка 1', { selector: 'strong' })

    // The first slot has nowhere to go; the second one does.
    expect(within(card('Снимка 1')).getByRole('button', { name: 'Наляво — Снимка 1' })).toBeDisabled()
    await userEvent.click(within(card('Снимка 2')).getByRole('button', { name: 'Наляво — Снимка 2' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/swap'))
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/home-photos/swap')
      expect(JSON.parse(post.body)).toEqual({ a: 'hero-2', b: 'hero-1' })
    })
    expect(await screen.findByText('Редът е сменен.')).toBeInTheDocument()
  })

  it('clearing a slot sends DELETE for that slot only', async () => {
    render(<AdminHomePhotosPage />)
    await screen.findByText('Снимка 1', { selector: 'strong' })

    // Only the two filled slots can be cleared.
    expect(screen.getAllByRole('button', { name: /^Изчисти/ })).toHaveLength(2)
    await userEvent.click(within(card('Снимка 1')).getByRole('button', { name: 'Изчисти — Снимка 1' }))

    await waitFor(() => {
      const del = calls.find((c) => c.method === 'DELETE')
      expect(del).toBeTruthy()
      expect(del.url).toMatch(/\/api\/admin\/home-photos\/hero-1$/)
    })
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1)
  })

  it('asks for sign-in rather than looking broken when the session has expired', async () => {
    listAnswer = () => json({}, 401)
    render(<AdminHomePhotosPage />)

    expect(await screen.findByRole('heading', { name: 'Необходим е вход' })).toBeInTheDocument()
  })
})
