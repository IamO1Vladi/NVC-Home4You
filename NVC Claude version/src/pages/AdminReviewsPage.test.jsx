import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminReviewsPage from './AdminReviewsPage.jsx'

// The moderation UI is staff-facing and acts on live content, so these cover the states
// that matter: what a moderator sees, that a 401 asks them to sign in rather than looking
// broken, and that clicking Approve actually calls the API.

const pendingReview = {
  id: 1, status: 'pending', name: 'Иван Петров', company: 'Строй ЕООД',
  email: 'ivan@example.bg', location: 'Пловдив', product: 'boxHouse',
  comment: 'Много добро качество.', rating: 5, createdAt: '2026-07-30T10:00:00Z',
}

const approvedReview = {
  id: 2, status: 'approved', name: 'Maria S', company: '', email: 'maria@example.com',
  location: 'Sofia', product: 'modularBuilds', comment: '', rating: 3,
  createdAt: '2026-07-28T09:00:00Z',
}

function mockApi({ items = [pendingReview], status = 200 } = {}) {
  const calls = []
  const json = (body, code = 200) =>
    Promise.resolve({ ok: code >= 200 && code < 300, status: code, json: async () => body })

  const fetchMock = vi.fn((url, opts) => {
    const u = String(url)
    calls.push({ url: u, method: opts?.method || 'GET' })
    if (status === 401) return json({}, 401)
    if (u.includes('/counts')) return json({ pending: 1, approved: 11, rejected: 1 })
    if (u.includes('/api/admin/me')) return json({ name: 'Vladi', email: 'vladi@nvc-home4you.eu' })
    if (/\/reviews\/\d+\/(approve|reject|pending)/.test(u)) return json({ ok: true })
    return json(items)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, calls }
}

describe('AdminReviewsPage', () => {
  beforeEach(() => { window.localStorage.clear() })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('renders the moderation queue for a signed-in moderator', async () => {
    mockApi()
    render(<AdminReviewsPage />)

    expect(await screen.findByText('Иван Петров')).toBeTruthy()
    expect(screen.getByText('Много добро качество.')).toBeTruthy()
    // Admin view shows the submitter's email; the public feed never does.
    expect(screen.getByText(/ivan@example\.bg/)).toBeTruthy()
  })

  it('shows who is signed in', async () => {
    mockApi()
    render(<AdminReviewsPage />)

    expect(await screen.findByText('vladi@nvc-home4you.eu')).toBeTruthy()
  })

  it('asks the moderator to sign in when the session has expired', async () => {
    mockApi({ status: 401 })
    render(<AdminReviewsPage />)

    // A 401 must read as "sign in", not as a server fault.
    expect(await screen.findByText(/Нямате достъп/)).toBeTruthy()
    expect(screen.queryByText('Иван Петров')).toBeNull()
  })

  it('approving calls the approve endpoint for that review', async () => {
    const { calls } = mockApi()
    render(<AdminReviewsPage />)
    await screen.findByText('Иван Петров')

    await userEvent.click(screen.getByRole('button', { name: 'Одобри' }))

    await waitFor(() => {
      expect(calls.some(c => c.url.endsWith('/api/admin/reviews/1/approve') && c.method === 'POST')).toBe(true)
    })
  })

  it('an already-approved review offers no Approve button', async () => {
    mockApi({ items: [approvedReview] })
    render(<AdminReviewsPage />)
    await screen.findByText('Maria S')

    // It shows "live on the site" instead — approving again is meaningless.
    expect(screen.queryByRole('button', { name: 'Одобри' })).toBeNull()
    expect(screen.getByText('Публикуван на сайта')).toBeTruthy()
  })

  it('switches between Bulgarian and English and remembers the choice', async () => {
    mockApi()
    const { unmount } = render(<AdminReviewsPage />)
    await screen.findByText('Иван Петров')

    expect(screen.getByRole('heading', { name: 'Отзиви за одобрение' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('heading', { name: 'Reviews awaiting moderation' })).toBeTruthy()

    unmount()
    render(<AdminReviewsPage />)
    // Reopening the panel keeps the language the moderator chose.
    expect(await screen.findByRole('heading', { name: 'Reviews awaiting moderation' })).toBeTruthy()
  })

  it('renders a review with no comment without breaking', async () => {
    mockApi({ items: [approvedReview] })
    render(<AdminReviewsPage />)

    expect(await screen.findByText('(без коментар)')).toBeTruthy()
  })
})
