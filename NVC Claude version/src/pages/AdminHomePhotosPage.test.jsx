import React from 'react'
import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminHomePhotosPage from './AdminHomePhotosPage.jsx'
import { PHOTO_SLOTS, PHOTO_SLOT_GROUPS, PHOTO_SLOT_NAMES, photoSlotOf } from '../lib/photoSlotNames.js'
import { PANEL_ORDER, PHOTO_SLOT_GROUP_HEADINGS, PHOTO_SLOT_PANEL } from '../lib/photoSlotDefaults.js'

// "Снимки на сайта". What is pinned here: every slot of the registry renders under its page's
// heading, with its label, BEFORE anything has been uploaded (a screen that only lists what
// exists cannot show where a photo belongs), each empty one showing the picture the site shows
// in its place; the hero cards name the page each slide links to and are the only ones with
// arrows; the team, the factory, Interiors and the doors have no gallery picker and the
// decorative slots and model cards no description box; each verb hits the address and body the
// API binds — FormData with `file`, `{ imageKey }` for a gallery pick, `{ a, b }` for a swap,
// DELETE to clear; a HEIC or a file over 25 MB never leaves the browser; a refused upload shows
// the server's sentence (in Bulgarian where it is one the owner can meet) on its own card without
// taking the slots away; the re-read after a write never empties the screen and focus comes back
// to the card; a name the screen does not know still shows; and an expired session asks for
// sign-in instead of looking broken.

const render = (ui) =>
  rtlRender(<MemoryRouter initialEntries={['/admin/home-photos']}>{ui}</MemoryRouter>)

const json = (body, status = 200) => Promise.resolve({
  ok: status < 400,
  status,
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
})

const NAMES = [...PHOTO_SLOT_NAMES]
const label = (name, lang = 'bg') => PHOTO_SLOT_PANEL[name].label[lang]

// The admin list's "index", as HomePhotoService.PanelIndexOf gives it.
const indexOf = (name) => {
  const slot = photoSlotOf(name)
  if (!slot) return name
  if (slot.kind === 'hero') return name.slice('hero-'.length)
  return slot.modelKey ?? slot.pageKey ?? name
}

const emptySlot = (name) => ({
  name,
  kind: photoSlotOf(name)?.kind ?? 'photo',
  index: indexOf(name),
  imageKey: null, url: null, alt: null, updatedAt: null, updatedByUpn: null,
})

const filledSlot = (name, alt = '') => ({
  ...emptySlot(name),
  imageKey: `home/${NAMES.indexOf(name) + 1}/${name}.webp`,
  url: `/api/img/home/${NAMES.indexOf(name) + 1}/${name}.webp`,
  alt,
  updatedAt: '2026-10-16T09:00:00Z',
  updatedByUpn: 'maria@nvc-home4you.eu',
})

const EMPTY = { slots: NAMES.map(emptySlot), names: NAMES }

const FILLED_NAMES = {
  'hero-1': 'Front porch',
  'hero-2': 'Front porch',
  'page-steel-houses': 'Къща в Петрич',
  'about-hero': 'Екипът пред склада',
  'about-team-radina-ivanova': '',
  'model-58': '',
}

// The gallery picker is off where a house photo would make the page's words untrue.
const UNPICKABLE = [
  ...NAMES.filter((n) => n.startsWith('about-team-')),
  'factory-floor', 'interiors-kitchen', 'interiors-hero', 'interiors-works', 'doors-hero',
]

const FILLED = {
  slots: NAMES.map((name) => (name in FILLED_NAMES ? filledSlot(name, FILLED_NAMES[name]) : emptySlot(name))),
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
    if (u.includes('/api/admin/home-photos/') && u.endsWith('/alt') && method === 'POST') return json(FILLED.slots[0])
    if (u.includes('/api/admin/home-photos/') && method === 'DELETE') return json(null, 204)
    if (u.endsWith('/api/admin/gallery') && method === 'GET') return json(HOUSES)
    // The shell's own identity check and badges — not what these tests are about.
    return json({})
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const card = (text) => screen.getByText(text, { selector: 'strong' }).closest('li')
// The hidden file input the card's "Качи снимка — …" button operates.
const fileInput = (text) => card(text).querySelector('input[type=file]')
const section = (heading) => screen.getByRole('heading', { level: 2, name: heading }).closest('section')
const ready = () => screen.findByText(label('hero-1'), { selector: 'strong' })
const posts = () => calls.filter((c) => c.method === 'POST')

describe('AdminHomePhotosPage', () => {
  it('is "Снимки на сайта", and promises "до 2 минути", never "веднага"', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    expect(screen.getByRole('heading', { level: 1, name: 'Снимки на сайта' })).toBeInTheDocument()
    expect(screen.getByText(/Промените се виждат на сайта до 2 минути/)).toBeInTheDocument()
    expect(screen.queryByText(/веднага/)).not.toBeInTheDocument()
  })

  it('renders every slot under its page, in page order, before any photo has been uploaded', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual([
      'Начална страница', 'Продуктови страници', 'Доставка', 'Партньори', 'За нас', 'Вътрешни ремонти', 'Интериорни врати',
    ])
    for (const group of PHOTO_SLOT_GROUPS) {
      const slotsOnScreen = [...section(PHOTO_SLOT_GROUP_HEADINGS[group].bg).querySelectorAll('li[data-slot]')].map((li) => li.dataset.slot)
      expect(slotsOnScreen.sort(), group).toEqual(PHOTO_SLOTS.filter((s) => s.group === group).map((s) => s.name).sort())
    }
    // Top to bottom as each page shows them, which is not always the API's order.
    expect([...document.querySelectorAll('li[data-slot]')].map((li) => li.dataset.slot)).toEqual(PANEL_ORDER)
    for (const name of NAMES) expect(card(label(name)), name).toBeInTheDocument()
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(NAMES.length)

    // Each empty slot shows what the site shows there, marked as the default; the steel page's
    // default is no photo, so its box says that instead.
    expect(screen.getAllByText('По подразбиране')).toHaveLength(NAMES.length - 1)
    expect(within(card(label('page-steel-houses'))).getByText('Без снимка')).toBeInTheDocument()

    // Every slot can take an upload, each button naming its place; all but the team, the
    // factory, Interiors and the doors can take a gallery photo too.
    expect(screen.getAllByRole('button', { name: /^Качи снимка — / })).toHaveLength(NAMES.length)
    expect(within(card(label('hero-3'))).getByRole('button', { name: `Качи снимка — ${label('hero-3')}` })).toBeInTheDocument()
    expect(UNPICKABLE).toHaveLength(11)
    expect(screen.getAllByRole('button', { name: /^От галерията — / })).toHaveLength(NAMES.length - UNPICKABLE.length)
    for (const name of UNPICKABLE) {
      expect(within(card(label(name))).queryByRole('button', { name: /От галерията/ }), name).not.toBeInTheDocument()
    }
    // Nothing to clear yet.
    expect(screen.queryByRole('button', { name: /Върни снимката по подразбиране|Премахни снимката/ })).not.toBeInTheDocument()
  })

  it("shows an empty slot's default: the page's photo through the resizer, a /public file as it is, or the initials", async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const tile = card('Плочка „Вътрешни ремонти“').querySelector('img')
    expect(tile.getAttribute('src')).toBe('/api/img/content/bvk4n834b-rce-eg-vb.webp?w=320')
    expect(within(card('Плочка „Вътрешни ремонти“')).getByText('По подразбиране')).toBeInTheDocument()

    expect(card('За нас — главна снимка').querySelector('img').getAttribute('src')).toBe('/delivery/crane-lift-800.webp')
    expect(card('Врати — главна снимка').querySelector('img').getAttribute('src')).toBe('/internal-doors/catalogue/rooms/cover.webp')
    expect(card('Екип: Владимир Владимиров').querySelector('img').getAttribute('src')).toBe('/about/team/vladimir-vladimirov.webp')

    // Radina has no photo yet: the page draws her initials, and so does the panel.
    const radina = card('Екип: Радина Иванова')
    expect(radina.querySelector('img')).toBeNull()
    expect(within(radina).getByText('РИ')).toBeInTheDocument()
    expect(within(radina).getByText('По подразбиране')).toBeInTheDocument()

    // Each place says what kind of photo suits it.
    expect(within(radina).getByText(/квадратна, лицето в средата/i)).toBeInTheDocument()
    expect(within(card(label('hero-1'))).getByText(/16:10/)).toBeInTheDocument()
  })

  it('names on every hero card the page its slide links to, and gives arrows to the hero slides only', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    expect(card('Снимка 5 · води към „Доставка и монтаж“')).toBeInTheDocument()
    expect(card('Снимка 2 · води към „Модулни къщи“')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Наляво — / })).toHaveLength(5)
    expect(screen.getAllByRole('button', { name: /^Надясно — / })).toHaveLength(5)
    for (const group of PHOTO_SLOT_GROUPS.filter((g) => g !== 'home')) {
      expect(within(section(PHOTO_SLOT_GROUP_HEADINGS[group].bg)).queryByRole('button', { name: /Наляво|Надясно/ })).not.toBeInTheDocument()
    }
    expect(within(card('Плочка „Модулни къщи“')).queryByRole('button', { name: /Наляво|Надясно/ })).not.toBeInTheDocument()
  })

  it("uploading a team photo posts the file to that person's slot", async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const file = new File(['RIFF'], 'radina.webp', { type: 'image/webp' })
    await userEvent.upload(fileInput('Екип: Радина Иванова'), file)

    await waitFor(() => {
      const post = posts()[0]
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/home-photos/about-team-radina-ivanova/file')
      expect(post.body).toBeInstanceOf(FormData)
      expect(post.body.get('file')).toBe(file)
    })
    // The list is re-read after the write rather than patched locally.
    await waitFor(() => {
      expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/admin/home-photos')).length).toBeGreaterThan(1)
    })
    // On the card it was for, where the owner is looking — not at the top of a long page.
    expect(await within(card('Екип: Радина Иванова')).findByText('Готово — снимката за „Екип: Радина Иванова“ е запазена. На сайта се вижда до 2 минути.')).toBeInTheDocument()
    // And told to a screen reader, wherever the card is.
    expect(screen.getByRole('status')).toHaveTextContent('Готово — снимката за „Екип: Радина Иванова“ е запазена.')
  })

  it('re-reads the list after a write without emptying the screen', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    let release
    listAnswer = () => new Promise((resolve) => { release = () => resolve(json(FILLED)) })
    await userEvent.upload(fileInput('Екип: Радина Иванова'), new File(['RIFF'], 'r.webp', { type: 'image/webp' }))

    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.url.endsWith('/api/admin/home-photos'))).toHaveLength(2))
    // Mid re-read: every card still there, no loading screen.
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(NAMES.length)
    expect(screen.queryByText('Зареждане…')).not.toBeInTheDocument()

    release()
    expect(await within(card('Екип: Радина Иванова')).findByText(/^Готово — /)).toBeInTheDocument()
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(NAMES.length)
  })

  it('says so, without losing the slots, when the change is saved but the list cannot be re-read', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    listAnswer = () => json({ errors: ['boom'] }, 500)
    await userEvent.upload(fileInput('Екип: Радина Иванова'), new File(['RIFF'], 'r.webp', { type: 'image/webp' }))

    const radina = card('Екип: Радина Иванова')
    expect(await within(radina).findByRole('alert')).toHaveTextContent('Промяната е запазена, но списъкът не се обнови. Презаредете страницата.')
    expect(within(radina).getByText(/^Готово — /)).toBeInTheDocument()
    expect(document.querySelectorAll('li[data-slot]')).toHaveLength(NAMES.length)
  })

  it('uploading into a hero slot posts to that slot', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const file = new File(['RIFF'], 'porch.webp', { type: 'image/webp' })
    await userEvent.upload(fileInput(label('hero-2')), file)

    await waitFor(() => expect(posts()[0]?.url).toContain('/api/admin/home-photos/hero-2/file'))
    expect(fileInput(label('hero-2'))).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    // The notice names the slide plainly: the card's label already quotes the page it links to.
    expect(await within(card(label('hero-2'))).findByText('Готово — снимката за „Снимка 2 в началото“ е запазена. На сайта се вижда до 2 минути.')).toBeInTheDocument()
  })

  it('refuses a HEIC in the browser, in words the owner can act on, and sends nothing', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const user = userEvent.setup({ applyAccept: false })
    await user.upload(fileInput('За нас — главна снимка'), new File(['ftyp'], 'IMG_0001.HEIC', { type: '' }))

    const alert = await within(card('За нас — главна снимка')).findByRole('alert')
    expect(alert).toHaveTextContent('HEIC/HEIF')
    expect(alert).toHaveTextContent('Запазете я като JPEG, PNG или WebP')
    expect(alert).toHaveTextContent('качете направо от телефона')
    expect(posts()).toHaveLength(0)
  })

  it('refuses a file over 25 MB in the browser, saying its size, and sends nothing', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const big = new File(['x'], 'IMG_0002.JPG', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 30 * 1024 * 1024 })
    await userEvent.upload(fileInput('Врати — главна снимка'), big)

    const alert = await within(card('Врати — главна снимка')).findByRole('alert')
    expect(alert).toHaveTextContent('Снимката е 30 MB, а най-много може 25 MB.')
    expect(posts()).toHaveLength(0)
  })

  it('says a failed upload in Bulgarian: no connection, or a file the server found too large', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    uploadAnswer = () => Promise.reject(new TypeError('Failed to fetch'))
    await userEvent.upload(fileInput('58 m²'), new File(['x'], 'a.webp', { type: 'image/webp' }))
    expect(await within(card('58 m²')).findByRole('alert')).toHaveTextContent('Няма връзка със сървъра — промяната не е запазена.')
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()

    // IIS's own 413 (or 404.13) carries no sentence of the API's: only the status.
    uploadAnswer = () => Promise.resolve({ ok: false, status: 413, json: () => Promise.reject(new Error('not json')), text: () => Promise.resolve('') })
    await userEvent.upload(fileInput('58 m²'), new File(['x'], 'b.webp', { type: 'image/webp' }))
    await waitFor(() => expect(within(card('58 m²')).getByRole('alert')).toHaveTextContent('Снимката е над 25 MB.'))
  })

  it('warns, without refusing, about a photo that does not suit its place', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 900, height: 1200, close: vi.fn() }))
    render(<AdminHomePhotosPage />)
    await ready()

    await userEvent.upload(fileInput('Врати — главна снимка'), new File(['x'], 'door.jpg', { type: 'image/jpeg' }))

    await waitFor(() => expect(posts()[0]?.url).toContain('/api/admin/home-photos/doors-hero/file'))
    const warning = await within(card('Врати — главна снимка')).findByText(/900 px/)
    expect(warning).toHaveTextContent('вертикална, а мястото е хоризонтално')
    expect(screen.getByRole('status')).toHaveTextContent('900 px')
  })

  it('picking from the gallery dialog posts the image key to the chosen slot', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const hero3 = label('hero-3')
    await userEvent.click(within(card(hero3)).getByRole('button', { name: `От галерията — ${hero3}` }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Избери снимка от галерията' })).toBeInTheDocument()
    // Houses with photos are listed by their Bulgarian title; the one without photos is not.
    expect(await within(dialog).findByRole('heading', { name: 'Вила-Офис 58' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Празен модел')).not.toBeInTheDocument()
    // Thumbnails through the resizer, not the full originals.
    expect(within(dialog).getByRole('button', { name: 'Вила-Офис 58 — 1' }).querySelector('img').getAttribute('src'))
      .toBe('/api/img/gallery/8/7cfe-front.webp?w=240')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Вила-Офис 58 — 2' }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/pick'))
      expect(post).toBeTruthy()
      expect(post.url).toContain('/api/admin/home-photos/hero-3/pick')
      expect(JSON.parse(post.body)).toEqual({ imageKey: 'gallery/8/8aa1-side.webp' })
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it("a refused upload shows the server's sentence, in Bulgarian, on its card, and keeps the slots on screen", async () => {
    uploadAnswer = () => json({ errors: ['That file could not be read as an image.'] }, 400)
    render(<AdminHomePhotosPage />)
    await ready()

    const file = new File(['x'], 'notes.webp', { type: 'image/webp' })
    await userEvent.upload(fileInput('58 m²'), file)

    expect(await within(card('58 m²')).findByRole('alert')).toHaveTextContent('Файлът не можа да се прочете като снимка. Качете JPEG, PNG или WebP.')
    // Still every slot behind the alert — a refused upload is not a broken page.
    expect(card(label('hero-5'))).toBeInTheDocument()
    expect(card('73 m²')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Качи снимка — / })).toHaveLength(NAMES.length)
  })

  it("shows a sentence of the API's it has no words for as the API said it", async () => {
    uploadAnswer = () => json({ errors: ['Something new went wrong.'] }, 400)
    render(<AdminHomePhotosPage />)
    await ready()

    await userEvent.upload(fileInput('58 m²'), new File(['x'], 'n.webp', { type: 'image/webp' }))
    expect(await within(card('58 m²')).findByRole('alert')).toHaveTextContent('Something new went wrong.')
  })

  it('moving a hero photo left swaps it with its left neighbour', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const [one, two] = [label('hero-1'), label('hero-2')]
    // The first slot has nowhere to go; the second one does.
    expect(within(card(one)).getByRole('button', { name: `Наляво — ${one}` })).toBeDisabled()
    expect(within(card(label('hero-5'))).getByRole('button', { name: `Надясно — ${label('hero-5')}` })).toBeDisabled()
    await userEvent.click(within(card(two)).getByRole('button', { name: `Наляво — ${two}` }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/swap'))
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toEqual({ a: 'hero-2', b: 'hero-1' })
    })
    expect(await within(card(two)).findByText(/Редът е сменен\./)).toBeInTheDocument()
    // The arrow the owner pressed has the focus back once the buttons are enabled again.
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-label', `Наляво — ${two}`))
  })

  it('offers to restore the default where there is one, and to remove the photo where the default is initials or nothing', async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const clears = screen.getAllByRole('button', { name: /^(Върни снимката по подразбиране|Премахни снимката) — / })
    expect(clears).toHaveLength(Object.keys(FILLED_NAMES).length)
    expect(within(card(label('hero-1'))).getByRole('button', { name: /^Върни снимката по подразбиране — / })).toBeInTheDocument()
    expect(within(card('За нас — главна снимка')).getByRole('button', { name: /^Върни снимката по подразбиране — / })).toBeInTheDocument()
    expect(within(card('Сглобяеми къщи по проект')).getByRole('button', { name: /^Премахни снимката — / })).toBeInTheDocument()

    // After the clear the server lists Radina's slot empty, so the button pressed is gone.
    listAnswer = () => json({
      ...FILLED,
      slots: FILLED.slots.map((s) => (s.name === 'about-team-radina-ivanova' ? emptySlot(s.name) : s)),
    })
    await userEvent.click(within(card('Екип: Радина Иванова')).getByRole('button', { name: 'Премахни снимката — Екип: Радина Иванова' }))

    await waitFor(() => {
      const del = calls.find((c) => c.method === 'DELETE')
      expect(del).toBeTruthy()
      expect(del.url).toMatch(/\/api\/admin\/home-photos\/about-team-radina-ivanova$/)
    })
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1)
    expect(await within(card('Екип: Радина Иванова')).findByText(/До 2 минути мястото на сайта се връща към вида си по подразбиране/)).toBeInTheDocument()
    // Focus lands on the same card's first button, not on <body> at the top of the page.
    await waitFor(() => expect(document.activeElement).toHaveAttribute('aria-label', 'Качи снимка — Екип: Радина Иванова'))
  })

  it("shows a filled slot's photo through the resizer, and asks for a description only where the page uses one", async () => {
    render(<AdminHomePhotosPage />)
    await ready()

    const about = card('За нас — главна снимка')
    expect(about.querySelector('img').getAttribute('src')).toBe(`/api/img/home/${NAMES.indexOf('about-hero') + 1}/about-hero.webp?w=320`)
    expect(within(about).getByText(/от maria@nvc-home4you\.eu/)).toBeInTheDocument()

    // About's main photo and the steel page's photo have words on the page; the hero slides and
    // the team are decorative (alt=""), so they have no box.
    const input = within(about).getByLabelText('Описание на снимката (по избор)')
    expect(input).toHaveValue('Екипът пред склада')
    const hint = document.getElementById(input.getAttribute('aria-describedby'))
    expect(hint).toHaveTextContent('Използва се само в българския сайт')
    expect(within(card('Сглобяеми къщи по проект')).getByLabelText('Описание на снимката (по избор)')).toBeInTheDocument()
    expect(within(card(label('hero-1'))).queryByLabelText('Описание на снимката (по избор)')).not.toBeInTheDocument()
    expect(within(card('Екип: Радина Иванова')).queryByLabelText('Описание на снимката (по избор)')).not.toBeInTheDocument()
    // A model card's alt is the model's size whatever the photo, so it asks for none either.
    expect(card('58 m²').querySelector('img').getAttribute('src')).toContain('/api/img/home/7/model-58.webp')
    expect(within(card('58 m²')).queryByLabelText('Описание на снимката (по избор)')).not.toBeInTheDocument()
    // The team member's photo is drawn round, as the About page draws it.
    expect(card('Екип: Радина Иванова').querySelector('img')).toHaveClass('adm-hp-img--round')

    await userEvent.clear(input)
    await userEvent.type(input, 'Нашият екип')
    input.blur()
    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/about-hero/alt'))
      expect(post).toBeTruthy()
      expect(JSON.parse(post.body)).toEqual({ alt: 'Нашият екип' })
    })
  })

  it('lists the three product pages in their own group, each saying what it shows while empty', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    expect(within(section('Продуктови страници')).getAllByRole('listitem')).toHaveLength(3)
    expect(within(card('Контейнерни модули')).getByText('Празно: контейнер, доставен на парцела на клиент.')).toBeInTheDocument()
    expect(within(card('Модулни къщи')).getByText(/Паралия Кариани \(58 м²\)/)).toBeInTheDocument()
    expect(within(card('Сглобяеми къщи по проект')).getByText('Празно: страницата е без снимка.')).toBeInTheDocument()
    expect(within(card('Доставка и монтаж')).getByText('Празно: кран вдига модул от камиона.')).toBeInTheDocument()
    expect(within(card('Партньори — снимка')).getByText('Празно: кран вдига модул от камиона (снимката на доставката).')).toBeInTheDocument()
  })

  it('jumps to a page section from the row of page buttons', async () => {
    listAnswer = () => json(EMPTY)
    render(<AdminHomePhotosPage />)
    await ready()

    const nav = screen.getByRole('navigation', { name: 'Страници' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Интериорни врати' }))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(Element.prototype.scrollIntoView.mock.contexts.at(-1)).toBe(section('Интериорни врати'))
    // The keyboard carries on from the section, not from the row of buttons.
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Интериорни врати' }))
  })

  it('shows a name the screen does not know under "Други", and a slot the server does not know yet as not usable', async () => {
    const withoutTile = NAMES.filter((n) => n !== 'home-tile-interiors')
    listAnswer = () => json({
      slots: [...withoutTile.map(emptySlot), emptySlot('steel-step-1')],
      names: [...withoutTile, 'steel-step-1'],
    })
    render(<AdminHomePhotosPage />)
    await ready()

    const other = section('Други')
    expect(within(other).getByText('steel-step-1', { selector: 'strong' })).toBeInTheDocument()

    const tile = card('Плочка „Вътрешни ремонти“')
    expect(within(tile).getByText(/Сървърът още не познава това място/)).toBeInTheDocument()
    expect(within(tile).getByRole('button', { name: 'Качи снимка — Плочка „Вътрешни ремонти“' })).toBeDisabled()
    expect(within(tile).getByRole('button', { name: /От галерията/ })).toBeDisabled()
  })

  it('shows the English words when the panel is in English', async () => {
    window.localStorage.setItem('nvc_admin_lang_v1', 'en')
    try {
      listAnswer = () => json(EMPTY)
      render(<AdminHomePhotosPage />)
      expect(await screen.findByRole('heading', { level: 2, name: 'Product pages' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 1, name: 'Site photos' })).toBeInTheDocument()
      for (const name of ['page-modular-builds', 'about-hero', 'doors-hero', 'hero-5', 'about-team-radina-ivanova']) {
        expect(screen.getByText(label(name, 'en'), { selector: 'strong' })).toBeInTheDocument()
      }
      expect(within(card('Steel-frame prefab houses to your plan')).getByText('No photo')).toBeInTheDocument()
    } finally {
      window.localStorage.removeItem('nvc_admin_lang_v1')
    }
  })

  it('asks for sign-in rather than looking broken when the session has expired', async () => {
    listAnswer = () => json({}, 401)
    render(<AdminHomePhotosPage />)

    expect(await screen.findByRole('heading', { name: 'Необходим е вход' })).toBeInTheDocument()
  })
})
