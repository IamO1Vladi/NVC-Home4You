import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDocumentsPage, { formatSize } from './AdminDocumentsPage.jsx'

// The brochures screen (#16). Two things carry it and both are pinned here: the six wired
// documents render with all their slots BEFORE anything has been uploaded (a screen that
// only lists what exists cannot show where an upload belongs), and Replace is the only
// verb — no add, no delete, no retire anywhere in the DOM.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/documents']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const WIRED = [
  'modular-builds', 'standard-containers', 'villa-office',
  'sloped-roof', 'space-capsules', 'box-house',
]

const DOCS = [
  {
    id: 1, slug: 'villa-office', lang: 'bg', title: 'Вила-Офис',
    fileName: 'Вила-Офис.pdf', sizeBytes: 450860, isActive: true, wired: true,
    sortOrder: 2, createdAt: '2026-08-28T09:00:00Z', updatedAt: null, updatedByUpn: 'maria@nvc-home4you.eu',
  },
]

let calls = []
let listAnswer = () => json({ documents: DOCS, wired: WIRED, langs: ['bg', 'en', 'el'] })
let uploadAnswer = () => json({ ok: true, slug: 'villa-office', lang: 'el' })

beforeEach(() => {
  calls = []
  listAnswer = () => json({ documents: DOCS, wired: WIRED, langs: ['bg', 'en', 'el'] })
  uploadAnswer = () => json({ ok: true, slug: 'villa-office', lang: 'el' })

  vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body })

    if (String(url).includes('/api/admin/documents') && (options.method || 'GET') === 'GET')
      return listAnswer()
    if (String(url).includes('/file') && options.method === 'POST')
      return uploadAnswer()
    // The shell's own badges and identity checks — not what these tests are about.
    return json({})
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminDocumentsPage', () => {
  it('renders all six wired documents with three slots each, even before any upload', async () => {
    listAnswer = () => json({ documents: [], wired: WIRED, langs: ['bg', 'en', 'el'] })
    render(<AdminDocumentsPage />)

    // Six cards, named in the panel's own words.
    expect(await screen.findByText('Вила-Офис')).toBeInTheDocument()
    expect(screen.getByText('Модулни сгради — общ каталог')).toBeInTheDocument()
    expect(screen.getByText('Разгъваеми „Бокс“ къща')).toBeInTheDocument()

    // Every slot offers an upload; nothing has a file yet, so nothing offers Замени.
    expect(screen.getAllByRole('button', { name: /Качи/ })).toHaveLength(18)
    expect(screen.queryByRole('button', { name: /Замени/ })).not.toBeInTheDocument()
  })

  it('shows the uploaded edition, and names the fallback in the empty slots', async () => {
    render(<AdminDocumentsPage />)

    // The Bulgarian slot has its file, linked at the LIVE address the public site serves.
    const link = await screen.findByRole('link', { name: 'Вила-Офис.pdf' })
    expect(link).toHaveAttribute('href', '/api/brochures/villa-office.pdf?lang=bg')

    // The empty translations say what actually happens — the Bulgarian edition serves —
    // because "not translated yet" is a true state, not an error.
    expect(screen.getAllByText('Няма превод — показва се българското издание.').length).toBeGreaterThan(0)
  })

  it('uploading into a slot posts the file to that slug and language', async () => {
    render(<AdminDocumentsPage />)
    await screen.findByRole('link', { name: 'Вила-Офис.pdf' })

    const file = new File(['%PDF-1.4'], 'Вила-Офис-EL.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText('Вила-Офис — Гръцки')
    await userEvent.upload(input, file)

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/documents/villa-office/el/file')
      expect(post.body).toBeInstanceOf(FormData)
      expect(post.body.get('file')).toBe(file)
    })
  })

  it('a refused upload surfaces the server sentence and keeps the screen alive', async () => {
    uploadAnswer = () => json({ errors: ['Brochures are PDF files.'] }, 400)
    render(<AdminDocumentsPage />)
    await screen.findByRole('link', { name: 'Вила-Офис.pdf' })

    const file = new File(['x'], 'catalogue.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('Вила-Офис — Гръцки'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent('Brochures are PDF files.')
    // Still six cards behind the alert — a refused upload is not a broken page.
    expect(screen.getByText('Модулни сгради — общ каталог')).toBeInTheDocument()
  })

  it('offers no delete and no retire anywhere — Replace is the only verb', async () => {
    render(<AdminDocumentsPage />)
    await screen.findByRole('link', { name: 'Вила-Офис.pdf' })

    // The dangerous verbs the first design allowed are refused by the API, but this
    // screen does not even ask.
    expect(screen.queryByRole('button', { name: /Изтрий|Скрий|Delete|Retire/ })).not.toBeInTheDocument()
  })

  it('sizes read as megabytes, because a Canva export that skipped compression announces itself by one', () => {
    expect(formatSize(450860)).toMatch(/0[.,]4 MB/)
    expect(formatSize(16476921)).toMatch(/15[.,]7 MB/)
    expect(formatSize(0)).toBe('')
  })
})
