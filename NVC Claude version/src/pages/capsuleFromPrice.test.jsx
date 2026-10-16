import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ModalActionsProvider } from '../context/ModalActions.jsx'
import ModularHousesPage from './ModularHousesPage.jsx'
import ModularBuildsPage from './ModularBuildsPage.jsx'
import SteelHousesPage from './SteelHousesPage.jsx'
import modularHouses from '../content/bg/modularHouses.js'
import modularBuilds from '../content/bg/modularBuilds.js'
import steelHouses from '../content/bg/steelHouses.js'
import { paths } from '../routes/paths.js'
import { euro } from '../content/shared/boxConfiguratorCatalog.js'
import { forgetHomePhotos } from '../lib/homePhotos.js'

// "Box houses from" is never the capsule's price, in either of its categories (the owner's two
// new gallery sections, 2026-10-17). With today's prices the capsule (55,000) is far from the
// cheapest, so nothing would show it; here two capsules are made the cheapest houses in the
// gallery on purpose, one still filed under modular (found by its id) and one filed under
// capsule (found by its category). Every "from" for the Box houses must still be the 18 m²
// house's 10,500: the Box houses page's hero, and the sibling cards on the containers and the
// steel-frame houses pages. The comparison row on the Box houses page is the capsules' own.

const item = (id, category, price, title, titleBg) => ({
  id, category, price, currency: 'EUR', title, titleBg, titleEl: title,
  description: `<p>${title}</p>`, descriptionBg: `<p>${titleBg}</p>`, descriptionEl: `<p>${title}</p>`,
  coverUrl: `/api/img/gallery/${id}/cover.webp`, images: [`/api/img/gallery/${id}/cover.webp`], catalogId: null,
})

const GALLERY = [
  item(13, 'wagon', 4300, 'Container House – 6000mm*3000mm', 'Жилищен фургон - 6000мм*3000мм'),
  item(6, 'wagon', 4800, 'Container House – 7000mm*3000mm', 'Жилищен фургон - 7000мм*3000мм'),
  item(8, 'wagon', 6500, 'Container House – 8000*3000mm with pitched roof', 'Контейнерна къща – 8000*3000мм с двускатен покрив'),
  item(14, 'wagon', 5200, 'Container house with cladding - 6000mm*3000mm', 'Жилищен фургон с декоративен панел - 6000мм*3000мм'),
  item(7, 'wagon', 5600, 'Container house with cladding - 7000mm*3000mm', 'Жилищен фургон с декоративен панел - 7000мм*3000мм'),
  item(12, 'wagon', 4950, 'Panoramic Office Container - 6000*3000mm', 'Панорамен офис контейнер -  6000*3000мм'),
  item(10, 'modular', 14000, 'Expandable House – 37 m²', 'Разгъваема Къща – 37 м²'),
  item(100016, 'modular', 10500, 'Expandable House – 18 m²', 'Разгъваема Къща – 18 м²'),
  // Hypothetical prices, below every Box house.
  item(100015, 'modular', 5000, 'Space house', 'Космическа къща - капсула'),
  item(100030, 'capsule', 6000, 'Space house II', 'Космическа капсула II'),
]

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

beforeEach(() => {
  forgetHomePhotos()
  vi.stubGlobal('fetch', vi.fn((url) => {
    const u = String(url)
    if (u.includes('/api/gallery')) return json({ items: GALLERY })
    if (u.includes('/api/cases-page')) return json({ cases: [], reviews: [] })
    if (u.includes('/api/reviews/featured')) return json({ items: [], averageRating: 0, totalCount: 0 })
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const flat = (s) => String(s).replace(/\s/g, ' ')

function renderWith(path, page) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ModalActionsProvider onOpenOffer={() => {}} onOpenQuestion={() => {}} onRequestModel={() => {}}>
        {page}
      </ModalActionsProvider>
    </MemoryRouter>,
  )
}

describe('the Box houses "from", with the capsules made the cheapest', () => {
  it('the Box houses page quotes the 18 m² house, and gives each capsule its wide card', async () => {
    const { container } = renderWith(paths.modularHouses.bg, <ModularHousesPage locale="bg" content={modularHouses} />)
    await waitFor(() => expect(container.querySelector('#item-100016')).not.toBeNull())

    expect(flat(container.querySelector('.pp-price').textContent)).toContain(flat(euro(10500, 'bg')))
    expect(flat(container.querySelector('.pp-price').textContent)).not.toContain(flat(euro(5000, 'bg')))

    for (const id of [100015, 100030]) {
      const card = container.querySelector(`#item-${id}`)
      expect(card.classList.contains('pp-unit--wide'), String(id)).toBe(true)
      expect(card.textContent).toContain(modularHouses.capsule.basis)
    }
    // The Space capsule's written lines are its own; another capsule gets none of them.
    expect(container.querySelector('#item-100015').textContent).toContain(modularHouses.capsule.lines[0])
    expect(container.querySelector('#item-100030').textContent).not.toContain(modularHouses.capsule.lines[0])

    const table = flat(container.querySelector('table.pp-spec').textContent)
    expect(table).toContain(flat(modularHouses.compare.boxPrice.replace('{price}', euro(10500, 'bg'))))
    expect(table).toContain(flat(modularHouses.compare.capsulePrice.replace('{price}', euro(5000, 'bg'))))
  })

  it('the containers page\'s sibling card quotes the 18 m² house', async () => {
    const { container } = renderWith(paths.modularBuilds.bg, <ModularBuildsPage locale="bg" content={modularBuilds} />)
    await waitFor(() => expect(container.querySelectorAll('article.pp-unit')).toHaveLength(6))

    const houses = within(container.querySelector('.pp-siblings')).getByRole('link', { name: new RegExp(modularBuilds.siblings.houses.label) })
    expect(houses.textContent).toContain(modularBuilds.siblings.houses.price.replace('{price}', euro(10500, 'bg')))
  })

  it('the steel-frame houses page\'s sibling card quotes the 18 m² house', async () => {
    const { container } = renderWith(paths.steelHouses.bg, <SteelHousesPage locale="bg" content={steelHouses} />)
    await waitFor(() => expect(container.querySelectorAll('.pp-sib-price')).toHaveLength(2))

    const prices = [...container.querySelectorAll('.pp-sib-price')].map((p) => p.textContent)
    expect(prices[1]).toBe(`${steelHouses.ready.from} ${euro(10500, 'bg')} ${steelHouses.ready.houses.basis}`)
  })
})
