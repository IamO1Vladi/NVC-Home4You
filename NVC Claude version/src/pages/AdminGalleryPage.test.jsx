import React from 'react'
import { render as rtlRender, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminGalleryPage from './AdminGalleryPage.jsx'

// ROADMAP #37, the panel's half. The server keeps a retitled model's old address and 301s
// it; this section is what lets whoever retitled it SEE that, rather than take it on trust.
// The one thing it must never do is say "none" when it simply could not ask — that would
// tell the owner an address was lost when it was not.

const render = (ui) => rtlRender(<MemoryRouter initialEntries={['/admin/gallery']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const HOUSE = {
  id: 6, quickbaseRecordId: 6, title: 'Container house 6000mm 3000mm', titleBg: 'Жилищен фургон 6000мм 3000мм',
  titleEl: 'Σπίτι τύπου κοντέινερ 6000 mm × 3000 mm', description: '', descriptionBg: '', descriptionEl: '',
  price: 9900, currency: 'EUR', categoryKey: 'wagon', catalogId: null, isPublished: true, sortOrder: 1,
  updatedAt: '2026-10-04T09:00:00Z', lastModifiedBy: 'owner@nvc.eu', images: [],
}

let retired

beforeEach(() => {
  retired = () => json([])
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/api/admin/me')) return json({ name: 'Owner' })
    if (u.includes('/counts')) return json({ pending: 0, notReachedOut: 0 })
    if (u.endsWith('/api/admin/gallery/categories')) return json(['prefab', 'wagon', 'modular', 'garage'])
    if (u.endsWith('/retired-addresses')) return retired()
    if (u.endsWith('/api/admin/gallery')) return json([HOUSE])
    return json({})
  }))
})

async function openEditor() {
  render(<AdminGalleryPage />)
  const row = (await screen.findByText(HOUSE.title)).closest('li')
  await userEvent.click(within(row).getByRole('button', { name: /Редактирай|Edit/ }))
  return screen.findByRole('heading', { name: /Стари адреси|Old addresses/ })
}

describe('AdminGalleryPage — old addresses (#37)', () => {
  it('lists the addresses that now redirect to the model, readable rather than percent-encoded', async () => {
    retired = () => json([
      { locale: 'el', path: '/el/gkaleri/σπίτι-τύπου-container-6000-mm-3000-mm', retiredAt: '2026-10-04T09:00:00Z', retiredByUpn: 'owner@nvc.eu' },
    ])

    const heading = await openEditor()
    const section = heading.closest('section')

    expect(await within(section).findByText('/el/gkaleri/σπίτι-τύπου-container-6000-mm-3000-mm')).toBeTruthy()
    expect(within(section).getByText(/owner@nvc\.eu/)).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/gallery/6/retired-addresses'), expect.anything())
  })

  it('says plainly when a model has never moved', async () => {
    const section = (await openEditor()).closest('section')
    expect(await within(section).findByText(/Няма|None/)).toBeTruthy()
  })

  it('for a hidden model, says its old addresses only redirect once it is published', async () => {
    // The server serves only published houses' old addresses; the hint must not overpromise.
    HOUSE.isPublished = false
    try {
      retired = () => json([
        { locale: 'en', path: '/en/gallery/container-house-6000mm-3000mm', retiredAt: '2026-10-04T09:00:00Z', retiredByUpn: null },
      ])
      const section = (await openEditor()).closest('section')
      expect(await within(section).findByText(/скрит|hidden/)).toBeTruthy()
    } finally {
      HOUSE.isPublished = true
    }
  })

  it('a failed read says so, and never claims there are none', async () => {
    retired = () => json({ error: 'boom' }, 500)

    const section = (await openEditor()).closest('section')

    await waitFor(() => expect(within(section).getByText(/не можаха да се заредят|could not be loaded/)).toBeTruthy())
    expect(within(section).queryByText(/Няма —|None —/)).toBeNull()
  })
})
