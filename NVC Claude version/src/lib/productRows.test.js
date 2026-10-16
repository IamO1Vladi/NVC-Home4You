import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { buildPriceSections } from '../content/shared/prices.js'
import { toLocalizedItem } from '../gallery/galleryUtils.js'
import { absoluteUrl, displayTitle, lowest, modelRequest, pickRows, productJsonLdItems, rowById, useProductRows } from './productRows.js'

// The product pages' one data source. The rows must be exactly buildPriceSections' rows (so
// a product page and /bg/ceni cannot disagree), a "from" figure must skip unknown values
// rather than count them, and a card's enquiry must carry what the gallery's carries.

// A slice of /api/gallery as it answered on 2026-10-12.
const GALLERY = [
  { id: 13, category: 'wagon', price: 4300, currency: 'EUR', title: 'Container House – 6000mm*3000mm', titleBg: 'Жилищен фургон - 6000мм*3000мм', coverUrl: '/api/img/gallery/1/a.webp', description: '<p>Galvanised steel frame, <b>2.3 mm</b>.</p>' },
  { id: 8, category: 'wagon', price: 6500, currency: 'EUR', title: 'Container House – 8000*3000mm with pitched roof', titleBg: 'Контейнерна къща – 8000*3000мм с двускатен покрив', coverUrl: '/api/img/gallery/3/b.webp', description: '' },
  { id: 10, category: 'modular', price: 14000, currency: 'EUR', title: 'Expandable House – 37 m²', titleBg: 'Разгъваема Къща – 37 м²', coverUrl: '/api/img/gallery/8/c.webp', description: 'A house.' },
  { id: 100016, category: 'modular', price: 10500, currency: 'EUR', title: 'Expandable House – 18 m²', titleBg: 'Разгъваема Къща – 18 м²', coverUrl: '/api/img/gallery/16/d.webp', description: 'Small.' },
  // A house added in the admin panel that prices.js has no assembly cost for yet, cheaper than
  // every other so that counting it would show. (The 18 m² house has had one since 2026-10-17.)
  { id: 100099, category: 'modular', price: 9000, currency: 'EUR', title: 'A new house', titleBg: 'Нова къща', coverUrl: '/api/img/gallery/99/e.webp', description: 'New.' },
]

const localized = (locale, base) => GALLERY.map((item) => toLocalizedItem(item, locale, base))

describe('lowest', () => {
  it('takes the smallest value and skips null, empty and non-numbers', () => {
    const rows = [{ v: 300 }, { v: null }, { v: 120 }, { v: '' }, { v: 'n/a' }, { v: undefined }]
    expect(lowest(rows, (r) => r.v)).toBe(120)
  })

  it('is null when nothing has a value, never zero or Infinity', () => {
    expect(lowest([], (r) => r.v)).toBeNull()
    expect(lowest([{ v: null }], (r) => r.v)).toBeNull()
    expect(lowest(undefined)).toBeNull()
  })

  it('gives the finished "from" figure only over houses whose assembly is known', () => {
    const { box } = buildPriceSections(localized('en', '/en/gallery'))
    // The new house has no assembly cost, so its €9,000 is not a finished price; the cheapest
    // finished one is the 18 m² house, 10,500 + 1,000 net assembly × 1.2.
    expect(lowest(box, (r) => (r.assemblyGross == null ? null : r.total))).toBe(10500 + 1200)
    // The house alone, as the home strip quotes it, does include it.
    expect(lowest(box, (r) => r.house)).toBe(9000)
  })
})

describe('rowById and pickRows', () => {
  const { wagon } = buildPriceSections(localized('en', '/en/gallery'))

  it('finds a row whatever type the id comes in', () => {
    expect(rowById(wagon, '13')?.total).toBe(4300)
    expect(rowById(wagon, 99)).toBeNull()
  })

  it('keeps the order asked for and drops ids the gallery does not have', () => {
    expect(pickRows(wagon, [8, 404, 13]).map((r) => r.id)).toEqual([8, 13])
  })
})

describe('modelRequest', () => {
  it('builds what the gallery item page hands to requestModel, with the Bulgarian title and page', () => {
    const item = localized('en', '/en/gallery')[0]
    expect(modelRequest({ item })).toEqual({
      id: 13,
      title: 'Container House – 6000mm*3000mm',
      titleBg: 'Жилищен фургон - 6000мм*3000мм',
      path: '/bg/galeriq/жилищен-фургон-6000мм-3000мм',
      catalogId: '',
    })
    // The same page whichever language the card was read in.
    expect(modelRequest(localized('bg', '/bg/galeriq')[0]).path).toBe('/bg/galeriq/жилищен-фургон-6000мм-3000мм')
    expect(modelRequest(null)).toBeNull()
  })
})

describe('displayTitle', () => {
  // The dimensions' × with a non-breaking space either side, so they wrap as one.
  const X = '\u00a0×\u00a0'
  it('tidies the punctuation of the four container titles as staff typed them, and only that', () => {
    expect(displayTitle('Жилищен фургон - 6000мм*3000мм')).toBe(`Жилищен фургон – 6000мм${X}3000мм`)
    expect(displayTitle('Панорамен офис контейнер -  6000*3000мм')).toBe(`Панорамен офис контейнер – 6000${X}3000мм`)
    expect(displayTitle('Жилищен фургон с декоративен панел - 6000мм*3000мм')).toBe(`Жилищен фургон с декоративен панел – 6000мм${X}3000мм`)
    expect(displayTitle('Контейнерна къща – 8000*3000мм с двускатен покрив')).toBe(`Контейнерна къща – 8000${X}3000мм с двускатен покрив`)
    expect(displayTitle('Panoramic Office Container - 6000*3000mm')).toBe(`Panoramic Office Container – 6000${X}3000mm`)
  })

  it('leaves a tidy title, a joined hyphen and an empty one alone', () => {
    expect(displayTitle('Σπίτι τύπου Container – 6000 mm × 3000 mm')).toBe('Σπίτι τύπου Container – 6000 mm × 3000 mm')
    expect(displayTitle('Φουτουριστική κατοικία-κάψουλα')).toBe('Φουτουριστική κατοικία-κάψουλα')
    expect(displayTitle(null)).toBe('')
  })

  it('is not what an enquiry carries: sales gets the raw title to match the gallery record', () => {
    const { wagon } = buildPriceSections(localized('bg', '/bg/galeriq'))
    expect(modelRequest(rowById(wagon, 13)).title).toBe('Жилищен фургон - 6000мм*3000мм')
  })
})

describe('productJsonLdItems', () => {
  it('publishes the card figure in EUR with absolute urls to the gallery page and the cover', () => {
    const { wagon } = buildPriceSections(localized('bg', '/bg/galeriq'))
    const [first, second] = productJsonLdItems(wagon, { category: 'Контейнери' })

    expect(first).toMatchObject({
      id: 'gal-13',
      url: 'https://nvc-home4you.eu/bg/galeriq/жилищен-фургон-6000мм-3000мм',
      // The card heading's form of the title, not the raw one staff typed.
      name: 'Жилищен фургон – 6000мм\u00a0×\u00a03000мм',
      image: 'https://nvc-home4you.eu/api/img/gallery/1/a.webp',
      price: 4300,
      currency: 'EUR',
      category: 'Контейнери',
    })
    // The gallery's rich text, flattened.
    expect(first.description).toBe('Galvanised steel frame, 2.3 mm.')
    // No description in the gallery: the title stands in, so the product is not dropped.
    expect(second.description).toBe(second.name)
  })

  it('keeps the gallery headings, paragraphs and list items apart as sentences', () => {
    const rows = [{
      id: 13,
      total: 4300,
      item: {
        title: 'Жилищен фургон',
        description: '<h3>Описание</h3><p>Цената включва монтаж.</p><ul><li>Ел. и ВиК инсталации: напълно изградени</li><li>Баня</li><li>Душ трей</li></ul>',
      },
    }]
    expect(productJsonLdItems(rows)[0].description)
      .toBe('Описание. Цената включва монтаж. Ел. и ВиК инсталации: напълно изградени. Баня. Душ трей')
  })

  it('leaves out a row whose figure is unknown instead of publishing it at zero', () => {
    const { box } = buildPriceSections(localized('en', '/en/gallery'))
    const items = productJsonLdItems(box, { pick: (r) => (r.assemblyGross == null ? null : r.total) })
    expect(items.map((i) => i.id)).toEqual(['gal-100016', 'gal-10'])
  })
})

describe('absoluteUrl', () => {
  it('prefixes site paths and leaves absolute urls alone', () => {
    expect(absoluteUrl('/bg/ceni')).toBe('https://nvc-home4you.eu/bg/ceni')
    expect(absoluteUrl('api/img/x.webp')).toBe('https://nvc-home4you.eu/api/img/x.webp')
    expect(absoluteUrl('https://example.org/a')).toBe('https://example.org/a')
    expect(absoluteUrl('')).toBe('')
  })
})

describe('useProductRows', () => {
  it('serves buildPriceSections over the localized gallery, with gallery pages in the locale', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: GALLERY }) })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useProductRows('bg'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/gallery'))
    expect(result.current.error).toBeFalsy()
    expect(result.current.galleryPath).toBe('/bg/galeriq')
    expect(result.current.items).toHaveLength(GALLERY.length)

    // Exactly the rows the prices page renders.
    const expected = buildPriceSections(localized('bg', '/bg/galeriq'))
    expect(result.current.wagon.map((r) => [r.id, r.total])).toEqual(expected.wagon.map((r) => [r.id, r.total]))
    expect(result.current.box.map((r) => [r.id, r.total])).toEqual(expected.box.map((r) => [r.id, r.total]))
    expect(result.current.wagon[0].item.url).toBe('/bg/galeriq/жилищен-фургон-6000мм-3000мм')
    vi.unstubAllGlobals()
  })
})
