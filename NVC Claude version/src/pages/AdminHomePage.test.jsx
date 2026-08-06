import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render as rtlRender, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminHomePage from './AdminHomePage.jsx'

// /admin is the panel's front door. It used to be the review queue with no navigation on it,
// so these cover the thing that actually broke: can someone who has been told "go to /admin"
// find the other two sections without being given their URLs.

const render = (ui) => rtlRender(<MemoryRouter initialEntries={['/admin']}>{ui}</MemoryRouter>)

function mockApi({ pending = 0, houses = [], cases = [], status = 200 } = {}) {
  const json = (body, code = 200) =>
    Promise.resolve({
      ok: code >= 200 && code < 300,
      status: code,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })

  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (status === 401) return json({}, 401)
    if (u.includes('/reviews/counts')) return json({ pending, approved: 4, rejected: 1 })
    if (u.includes('/api/admin/gallery')) return json(houses)
    if (u.includes('/api/admin/cases')) return json(cases)
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi Petrov', email: 'vladi@nvc-home4you.eu' })
    return json([])
  }))
}

describe('AdminHomePage', () => {
  beforeEach(() => { window.localStorage.clear() })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('offers a way into every section', async () => {
    mockApi()
    render(<AdminHomePage />)

    // The blurb, not the name — "Отзиви" is also the nav label, so it is not unique.
    await screen.findByText(/Одобрявайте нови отзиви/)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/admin/reviews')
    expect(hrefs).toContain('/admin/gallery')
    expect(hrefs).toContain('/admin/cases')
  })

  it('says how many reviews are waiting, so the queue is not something to remember to check', async () => {
    mockApi({ pending: 3 })
    render(<AdminHomePage />)

    expect(await screen.findByText(/3 чакат одобрение/)).toBeTruthy()
  })

  it('says so plainly when nothing needs attention', async () => {
    mockApi({ pending: 0 })
    render(<AdminHomePage />)

    expect(await screen.findByText('Всичко е прегледано')).toBeTruthy()
  })

  it('counts drafts separately, since a draft is invisible to visitors', async () => {
    mockApi({
      houses: [{ id: 1, isPublished: true }, { id: 2, isPublished: false }],
      cases: [{ id: 1, isPublished: true }],
    })
    render(<AdminHomePage />)

    expect(await screen.findByText(/2 модела · 1 в чернова/)).toBeTruthy()
    expect(screen.getByText(/1 проект · всички публикувани/)).toBeTruthy()
  })

  it('asks for sign-in rather than looking broken when the session has expired', async () => {
    mockApi({ status: 401 })
    render(<AdminHomePage />)

    expect(await screen.findByRole('heading', { name: 'Необходим е вход' })).toBeTruthy()
  })
})
