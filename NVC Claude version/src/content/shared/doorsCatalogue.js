// The internal-doors range as the owner's own catalogue shows it: "Врати каталог NVC-1" (the PDF
// file, 33 pages, A4 landscape), sent by the owner on 2026-10-15 and transcribed here the same day.
// Names, codes and sizes below are the catalogue's own, and every entry carries the page it came
// from. But the owner (2026-10-15, after sending it): "the catalogue is a little old; follow the
// CURRENT information". So where the doors page's confirmed facts differ (frames 70–180 mm, three
// standard colours per type), the page keeps them (components/doors/doorOptions.js) and uses
// this file for the photos, drawings, colour samples and extra detail.
//
// Internal doors are a separate product from the Box houses: sold on their own to builders,
// developers, shops and individuals, no set minimum, priced (and delivered) on request by the
// quantity ordered, with fitting by NVC on request. So there are NO prices here, and nothing
// here may invent one, a delivery time or a certificate.
//
// The images were cut from the PDF (embedded photos where they were cleaner, page renders for
// the drawings) into public/internal-doors/catalogue/ as WebP; doorsCatalogue.test.js checks
// every path exists and every file is used. Sizes are millimetres as printed on the drawings.
// Words shown to visitors are { bg, en, el }; bg is the catalogue's own wording.

const IMG = '/internal-doors/catalogue'

export const DOORS_CATALOGUE_SOURCE = {
  // The owner's PDF, named without its extension (brochure.test.js keeps PDF names out of content/).
  file: 'Врати каталог NVC-1',
  pages: 33,
  received: '2026-10-15',
}

// Page 2: the four properties the catalogue calls out on its sample door. (It does not list
// sound insulation; the owner confirmed that claim separately on 2026-10-15.)
export const DOOR_FEATURES = [
  { key: 'water', page: 2, name: { bg: 'Водоустойчива', en: 'Water-resistant', el: 'Ανθεκτική στο νερό' } },
  { key: 'fire', page: 2, name: { bg: 'Противопожарна', en: 'Fire-resistant', el: 'Πυράντοχη' } },
  { key: 'eco', page: 2, name: { bg: 'Екосъобразни материали', en: 'Eco-friendly materials', el: 'Φιλικά προς το περιβάλλον υλικά' } },
  { key: 'termite', page: 2, name: { bg: 'Противотермитна обработка', en: 'Anti-termite treatment', el: 'Αντιτερμιτική επεξεργασία' } },
]

// Page 1, the catalogue cover: a room with a white door with decorative lines.
export const DOORS_COVER = {
  src: `${IMG}/rooms/cover.webp`,
  page: 1,
  alt: {
    bg: 'Хол с бяла врата с декоративни линии',
    en: 'A living room with a white door with decorative lines',
    el: 'Σαλόνι με λευκή πόρτα με διακοσμητικές γραμμές',
  },
}

const c = (bg, en, el) => ({ bg, en, el })

// A door photo from the type pages (3–9): a cut-out of one leaf in its frame, about 600 px
// tall. The catalogue names no colours and does not say which BJX finish each photo shows, so
// each one carries only the colour a visitor sees, never a code. A photo that stands for one of
// a type's three standard colours (doorOptions.js STANDARD_FINISHES) carries that colour's
// owner-confirmed name from the page (content/*/internalDoors.js colors), so a photo has one
// name everywhere: wallpaper 1–3, decorative lines 1–3, metal lines 3, 5, 6 and glass 2, 3, 6.
const photo = (type, n, page, colour, detail) => ({
  src: `${IMG}/doors/${type}-${n}.webp`,
  page,
  colour,
  ...(detail ? { detail } : {}),
})

// The hinged door types. The catalogue shows each on its own photo page(s) and again on a page
// with a room photo and a technical drawing (pages 13–17). Decorative lines come in two widths
// there (narrow, page 14; wide, page 15), both under the one photo page 4.
export const DOOR_TYPES = [
  {
    key: 'wallpaper',
    name: c('Тапетни врати', 'Concealed (flush) doors', 'Αφανείς πόρτες'),
    singular: c('Тапетна врата', 'Concealed (flush) door', 'Αφανής πόρτα'),
    pages: [3, 13],
    room: `${IMG}/rooms/wallpaper.webp`,
    roomAlt: c('Хол с бяла тапетна врата', 'A living room with a white concealed (flush) door', 'Σαλόνι με λευκή αφανή πόρτα'),
    drawing: `${IMG}/drawings/wallpaper.webp`,
    photos: [
      photo('wallpaper', 1, 3, c('Светъл', 'Light', 'Ανοιχτό')),
      photo('wallpaper', 2, 3, c('Опушен', 'Smoked', 'Καπνιστό')),
      photo('wallpaper', 3, 3, c('Тъмен', 'Dark', 'Σκούρο')),
    ],
  },
  {
    key: 'decor-lines',
    name: c('Врати с декоративни линии', 'Doors with decorative lines', 'Πόρτες με διακοσμητικές γραμμές'),
    pages: [4, 14, 15],
    variants: [
      {
        key: 'narrow',
        name: c('Врати с тесни декоративни линии', 'Doors with narrow decorative lines', 'Πόρτες με λεπτές διακοσμητικές γραμμές'),
        page: 14,
        room: `${IMG}/rooms/decor-lines-narrow.webp`,
        roomAlt: c('Бяла врата с тесни декоративни линии в хол', 'A white door with narrow decorative lines in a living room', 'Λευκή πόρτα με λεπτές διακοσμητικές γραμμές σε σαλόνι'),
        drawing: `${IMG}/drawings/decor-lines-narrow.webp`,
      },
      {
        key: 'wide',
        name: c('Врати с широки декоративни линии', 'Doors with wide decorative lines', 'Πόρτες με φαρδιές διακοσμητικές γραμμές'),
        page: 15,
        room: `${IMG}/rooms/decor-lines-wide.webp`,
        roomAlt: c('Бяла врата с широки декоративни линии в хол', 'A white door with wide decorative lines in a living room', 'Λευκή πόρτα με φαρδιές διακοσμητικές γραμμές σε σαλόνι'),
        drawing: `${IMG}/drawings/decor-lines-wide.webp`,
      },
    ],
    photos: [
      photo('decor-lines', 1, 4, c('Бяло', 'White', 'Λευκό'), c('с две полета', 'with two panels', 'με δύο ταμπλάδες')),
      photo('decor-lines', 2, 4, c('Антрацит', 'Charcoal', 'Ανθρακί')),
      photo('decor-lines', 3, 4, c('Салвия', 'Sage', 'Φασκομηλί')),
    ],
  },
  {
    key: 'metal-lines',
    name: c('Врати с метални линии', 'Doors with metal lines', 'Πόρτες με μεταλλικές γραμμές'),
    pages: [5, 6, 7, 17],
    room: `${IMG}/rooms/metal-lines.webp`,
    roomAlt: c('Бяла врата с метални линии', 'A white door with metal lines', 'Λευκή πόρτα με μεταλλικές γραμμές'),
    drawing: `${IMG}/drawings/metal-lines.webp`,
    photos: [
      photo('metal-lines', 1, 5, c('Светъл дъб', 'Light oak', 'Ανοιχτή δρυς'), c('с дъга около дръжката', 'with an arc around the handle', 'με τόξο γύρω από το πόμολο')),
      photo('metal-lines', 2, 5, c('Тъмно дърво', 'Dark wood', 'Σκούρο ξύλο'), c('с правоъгълен контур', 'with a rectangular outline', 'με ορθογώνιο περίγραμμα')),
      photo('metal-lines', 3, 6, c('Сиво', 'Grey', 'Γκρι'), c('с хоризонтална и вертикална линия', 'with a horizontal and a vertical line', 'με οριζόντια και κάθετη γραμμή')),
      photo('metal-lines', 4, 6, c('Бяло', 'White', 'Λευκό'), c('с хоризонтална и вертикална линия', 'with a horizontal and a vertical line', 'με οριζόντια και κάθετη γραμμή')),
      photo('metal-lines', 5, 6, c('Дъб', 'Oak', 'Δρυς'), c('с хоризонтална и вертикална линия', 'with a horizontal and a vertical line', 'με οριζόντια και κάθετη γραμμή')),
      photo('metal-lines', 6, 6, c('Тъмно дърво', 'Dark wood', 'Σκούρο ξύλο'), c('с хоризонтална и вертикална линия', 'with a horizontal and a vertical line', 'με οριζόντια και κάθετη γραμμή')),
      photo('metal-lines', 7, 7, c('Сиво', 'Grey', 'Γκρι'), c('с вертикални линии', 'with vertical lines', 'με κάθετες γραμμές')),
      photo('metal-lines', 8, 7, c('Тъмносиво', 'Dark grey', 'Σκούρο γκρι'), c('с хоризонтална линия', 'with a horizontal line', 'με οριζόντια γραμμή')),
      photo('metal-lines', 9, 7, c('Бяло', 'White', 'Λευκό'), c('с черен контур', 'with a black outline', 'με μαύρο περίγραμμα')),
      photo('metal-lines', 10, 7, c('Сиво', 'Grey', 'Γκρι'), c('със златист декоративен контур', 'with a gold decorative outline', 'με χρυσό διακοσμητικό περίγραμμα')),
    ],
  },
  {
    key: 'glass',
    name: c('Врати със стъкло', 'Doors with glass', 'Πόρτες με τζάμι'),
    pages: [8, 9, 16],
    room: `${IMG}/rooms/glass.webp`,
    roomAlt: c('Врата в тъмно дърво със стъкло', 'A dark wood door with glass', 'Πόρτα σε σκούρο ξύλο με τζάμι'),
    drawing: `${IMG}/drawings/glass.webp`,
    photos: [
      photo('glass', 1, 8, c('Тъмно дърво', 'Dark wood', 'Σκούρο ξύλο'), c('стъкло горе, поле долу', 'glass above, a panel below', 'τζάμι πάνω, ταμπλάς κάτω')),
      photo('glass', 2, 8, c('Топло бяло', 'Warm white', 'Θερμό λευκό'), c('стъкло по цялата височина', 'full-height glass', 'τζάμι σε όλο το ύψος')),
      photo('glass', 3, 8, c('Черно', 'Black', 'Μαύρο'), c('стъкло по цялата височина', 'full-height glass', 'τζάμι σε όλο το ύψος')),
      photo('glass', 4, 9, c('Бяло', 'White', 'Λευκό'), c('стъкло горе, поле долу', 'glass above, a panel below', 'τζάμι πάνω, ταμπλάς κάτω')),
      photo('glass', 5, 9, c('Бяло', 'White', 'Λευκό'), c('с тясна вертикална ивица', 'with a narrow vertical strip', 'με στενή κάθετη λωρίδα')),
      photo('glass', 6, 9, c('Сиво', 'Grey', 'Γκρι'), c('с тясно вертикално стъкло', 'with a narrow vertical glass strip', 'με στενό κάθετο τζάμι')),
    ],
  },
]

// Pages 19–20: sliding doors, a two-leaf door on a top track (room photo and drawing on page
// 19) and six frame and glass styles (page 20, no names or codes in the catalogue).
export const SLIDING_DOORS = {
  key: 'sliding',
  name: c('Плъзгащи се врати', 'Sliding doors', 'Συρόμενες πόρτες'),
  pages: [19, 20],
  room: `${IMG}/rooms/sliding.webp`,
  roomAlt: c('Плъзгаща се врата с тъмна рамка към трапезария', 'A dark-framed sliding door to a dining area', 'Συρόμενη πόρτα με σκούρο πλαίσιο προς τραπεζαρία'),
  drawing: `${IMG}/drawings/sliding.webp`,
  styles: [
    { key: 'sliding-1', page: 20, src: `${IMG}/sliding/sliding-1.webp`, look: c('Тъмна рамка, прозрачно стъкло', 'Dark frame, clear glass', 'Σκούρο πλαίσιο, διάφανο τζάμι') },
    { key: 'sliding-2', page: 20, src: `${IMG}/sliding/sliding-2.webp`, look: c('Тъмна рамка, стъкло с хоризонтални разделители', 'Dark frame, glass with horizontal bars', 'Σκούρο πλαίσιο, τζάμι με οριζόντιες γραμμές') },
    { key: 'sliding-3', page: 20, src: `${IMG}/sliding/sliding-3.webp`, look: c('Бяла рамка, стъкло с решетка', 'White frame, glass with a grid', 'Λευκό πλαίσιο, τζάμι με κάναβο') },
    { key: 'sliding-4', page: 20, src: `${IMG}/sliding/sliding-4.webp`, look: c('Тъмна рамка, декоративна решетка', 'Dark frame, decorative lattice', 'Σκούρο πλαίσιο, διακοσμητικό καφασωτό') },
    { key: 'sliding-5', page: 20, src: `${IMG}/sliding/sliding-5.webp`, look: c('Черна рамка, стъкло на хоризонтални ивици', 'Black frame, horizontally striped glass', 'Μαύρο πλαίσιο, τζάμι με οριζόντιες ρίγες') },
    { key: 'sliding-6', page: 20, src: `${IMG}/sliding/sliding-6.webp`, look: c('Тъмна рамка, релефно стъкло на вертикални ивици', 'Dark frame, vertically fluted glass', 'Σκούρο πλαίσιο, ραβδωτό τζάμι') },
  ],
}

// Page 10 (repeated for the wall panels on page 23): "WPC покритие за врати (PVC покритие)",
// 25 finishes BJX-01 … BJX-25 with no names. `swatch` is the average colour of the printed
// sample (for a dot or a fallback); `src` is the sample itself, 80×128 px. The catalogue groups
// them as plain light colours (01–04), stone and concrete looks (05–07), dark textures (08–10),
// muted solids (11–14), strong solids (15–18) and wood grains (19–25); `group` keeps that.
const FINISH_GROUPS = [
  ['light', 1, 4],
  ['stone', 5, 7],
  ['dark', 8, 10],
  ['muted', 11, 14],
  ['solid', 15, 18],
  ['wood', 19, 25],
]
const FINISH_SWATCH = [
  '#efefe7', '#c9c8bb', '#c7c8bf', '#cdcfce', '#c2c3c3', '#b1afab', '#4d5356', '#3c3f44', '#3c424a', '#252b2f',
  '#a49a8c', '#726c62', '#584f51', '#6e604e', '#c9a75f', '#c18646', '#2c110d', '#333f39', '#706f6c', '#a89a8f',
  '#877661', '#9b815e', '#4d4231', '#48432c', '#321106',
]
export const FINISH_GROUP_NAMES = {
  light: c('Светли', 'Light', 'Ανοιχτά'),
  stone: c('Камък и бетон', 'Stone and concrete', 'Πέτρα και τσιμέντο'),
  dark: c('Тъмни', 'Dark', 'Σκούρα'),
  muted: c('Приглушени', 'Muted', 'Απαλά'),
  solid: c('Наситени', 'Strong colours', 'Έντονα'),
  wood: c('Дърво', 'Wood', 'Ξύλο'),
}
export const DOOR_FINISHES = FINISH_SWATCH.map((swatch, i) => {
  const n = String(i + 1).padStart(2, '0')
  const group = FINISH_GROUPS.find(([, a, b]) => i + 1 >= a && i + 1 <= b)[0]
  return { code: `BJX-${n}`, group, swatch, src: `${IMG}/finishes/bjx-${n}.webp`, page: 10 }
})
export const DOOR_FINISHES_TITLE = c('WPC покритие (PVC покритие)', 'WPC finish (PVC coating)', 'Επίστρωση WPC (επίστρωση PVC)')

// Page 11: "Каси размери", seven frame (jamb) profiles drawn in section. `widthMm` is the
// overall width printed on the drawing, `thicknessMm` the profile thickness (31 on every one),
// `slotMm` the 50 mm dimension at the slotted end, where the trim fits. The code's number is
// the nominal size; the catalogue does not say which wall thickness each frame fits.
export const DOOR_FRAMES = [
  [100, 103], [140, 143], [180, 183], [220, 223], [250, 253], [270, 273], [300, 303],
].map(([nominalMm, widthMm]) => ({
  code: `BT${nominalMm}`,
  nominalMm,
  widthMm,
  thicknessMm: 31,
  slotMm: 50,
  src: `${IMG}/frames/bt${nominalMm}.webp`,
  page: 11,
}))

// Page 12: "Перваз модели", fourteen trim (architrave and strip) profiles. Width × height as
// printed on each drawing. BTJX8015's drawing reads 58 × 17, which matches BT5817 rather than
// its own code (80 × 15?): listed as printed, flagged for the owner.
export const DOOR_TRIMS = [
  ['BT4043', 40, 43], ['BT5040C', 50, 40], ['BT5040P', 50, 40], ['BT6040', 60, 40],
  ['BT6031', 60, 31], ['BT7049', 70, 49], ['BT6044', 60, 44], ['BX4003', 40, 3],
  ['BX3205', 32, 4.6], ['BT2508', 25, 8.7], ['BX4524', 45, 24], ['BTJX8015', 58, 17],
  ['BTJX7514', 75, 14], ['BT5817', 58, 17],
].map(([code, widthMm, heightMm]) => ({
  code,
  widthMm,
  heightMm,
  src: `${IMG}/trims/${code.toLowerCase()}.webp`,
  page: 12,
}))

// Page 18: fifteen handles BSL-1 … BSL-15, each photographed with its rose or plate. The
// catalogue names them by code only; `look` is what the photo shows, for alt text.
const HANDLE_LOOKS = [
  c('Сребриста дръжка на дълга табела', 'Silver lever on a long backplate', 'Ασημί πόμολο σε μακριά πλάκα'),
  c('Тъмносива права дръжка, кръгла розетка', 'Dark grey straight lever, round rose', 'Σκούρο γκρι ίσιο πόμολο, στρογγυλή ροζέτα'),
  c('Тъмносива извита дръжка, кръгла розетка', 'Dark grey curved lever, round rose', 'Σκούρο γκρι καμπύλο πόμολο, στρογγυλή ροζέτα'),
  c('Хромирана дръжка с тъмна линия', 'Chrome lever with a dark inlay', 'Χρωμέ πόμολο με σκούρα γραμμή'),
  c('Сатенена дръжка със сива ръкохватка', 'Satin lever with a grey grip', 'Σατινέ πόμολο με γκρι λαβή'),
  c('Черна дръжка, кръгла розетка', 'Black lever, round rose', 'Μαύρο πόμολο, στρογγυλή ροζέτα'),
  c('Сатенена дръжка, квадратна розетка', 'Satin lever, square rose', 'Σατινέ πόμολο, τετράγωνη ροζέτα'),
  c('Графитена дръжка, кръгла розетка', 'Graphite lever, round rose', 'Πόμολο γραφίτη, στρογγυλή ροζέτα'),
  c('Дръжка с дървена ръкохватка', 'Lever with a wooden grip', 'Πόμολο με ξύλινη λαβή'),
  c('Квадратна дръжка с механизма', 'Square lever set with its latch', 'Τετράγωνο πόμολο με τον μηχανισμό του'),
  c('Златиста дръжка с черна розетка', 'Gold lever with a black rose', 'Χρυσό πόμολο με μαύρη ροζέτα'),
  c('Графитена релефна дръжка, квадратна розетка', 'Ribbed graphite lever, square rose', 'Ραβδωτό πόμολο γραφίτη, τετράγωνη ροζέτα'),
  c('Бронзова дръжка с орнамент, квадратна розетка', 'Bronze lever with an ornament, square rose', 'Μπρούντζινο πόμολο με διακοσμητικό, τετράγωνη ροζέτα'),
  c('Златиста заоблена дръжка', 'Gold rounded lever', 'Χρυσό στρογγυλεμένο πόμολο'),
  c('Черна топка', 'Black knob', 'Μαύρο στρογγυλό πόμολο'),
]
export const DOOR_HANDLES = HANDLE_LOOKS.map((look, i) => ({
  code: `BSL-${i + 1}`,
  look,
  src: `${IMG}/handles/bsl-${i + 1}.webp`,
  page: 18,
}))

// Page 18, bottom row: three door stops and five hinges, photographed without codes.
export const DOOR_HARDWARE = {
  stops: [
    { key: 'stop-1', look: c('Сребрист стопер', 'Silver door stop', 'Ασημί στοπ πόρτας') },
    { key: 'stop-2', look: c('Черен стопер', 'Black door stop', 'Μαύρο στοπ πόρτας') },
    { key: 'stop-3', look: c('Бронзов стопер', 'Bronze door stop', 'Μπρούντζινο στοπ πόρτας') },
  ].map((s) => ({ ...s, src: `${IMG}/hardware/${s.key}.webp`, page: 18 })),
  hinges: [
    { key: 'hinge-1', look: c('Сребриста панта', 'Silver hinge', 'Ασημί μεντεσές') },
    { key: 'hinge-2', look: c('Тъмна панта', 'Dark hinge', 'Σκούρος μεντεσές') },
    { key: 'hinge-3', look: c('Бронзова панта', 'Bronze hinge', 'Μπρούντζινος μεντεσές') },
    { key: 'hinge-4', look: c('Двучастна сребриста панта', 'Two-part silver hinge', 'Ασημί μεντεσές δύο τεμαχίων') },
    { key: 'hinge-5', look: c('Двучастна сребриста панта', 'Two-part silver hinge', 'Ασημί μεντεσές δύο τεμαχίων') },
  ].map((h) => ({ ...h, src: `${IMG}/hardware/${h.key}.webp`, page: 18 })),
}

// Pages 21–33: "Декоративни панели", wall panels in the same WPC finishes as the doors (page
// 23), plus PET and melamine finishes (page 24, no codes), six panel profiles (page 25),
// twenty-two accessory profiles (pages 26–27), the metal-line profiles and an installation
// scheme (page 28) and room examples (pages 21, 22, 29–33).
const PET_SWATCH = ['#cacdc6', '#f4f4f4', '#eef1ea', '#3c4847', '#beb5b0', '#d4d5cf', '#cac5be', '#f5f5f5']
const MELAMINE_SWATCH = ['#73695e', '#4b4c4d', '#a49b95', '#120805', '#faf6ef', '#ae9a80', '#73695e', '#030d23']

export const WALL_PANELS = {
  name: c('Декоративни панели', 'Decorative wall panels', 'Διακοσμητικά πάνελ τοίχου'),
  pages: [21, 33],
  rooms: [21, 22, 29, 30, 31, 32, 33].map((page, i) => ({
    src: `${IMG}/panels/rooms/room-${i + 1}.webp`,
    page,
    alt: c('Интериор с декоративни стенни панели', 'An interior with decorative wall panels', 'Εσωτερικός χώρος με διακοσμητικά πάνελ τοίχου'),
  })),
  // Page 22: two close-ups, a panel board with a concrete-look face and the hollow profile.
  board: { src: `${IMG}/panels/board.webp`, page: 22 },
  profile: { src: `${IMG}/panels/profile.webp`, page: 22 },
  finishes: {
    // Page 23 repeats page 10: the same 25 BJX finishes (DOOR_FINISHES).
    wpc: { title: DOOR_FINISHES_TITLE, codes: DOOR_FINISHES.map((f) => f.code), page: 23 },
    pet: {
      title: c('PET покритие', 'PET finish', 'Επίστρωση PET'),
      page: 24,
      items: PET_SWATCH.map((swatch, i) => ({ key: `pet-${i + 1}`, swatch, src: `${IMG}/panels/finishes/pet-${i + 1}.webp` })),
    },
    melamine: {
      title: c('Меламиново покритие', 'Melamine finish', 'Επίστρωση μελαμίνης'),
      page: 24,
      items: MELAMINE_SWATCH.map((swatch, i) => ({ key: `melamine-${i + 1}`, swatch, src: `${IMG}/panels/finishes/melamine-${i + 1}.webp` })),
    },
  },
  // Page 25: "Размери". Width and thickness as printed (313 / 413 / 613 × 9); the code's
  // number is the nominal width. V and P are two edge (joint) profiles; the catalogue does not
  // spell the letters out.
  sizes: [
    ['BQ300V', 300, 313, 'V'], ['BQ300P', 300, 313, 'P'],
    ['BQ400V', 400, 413, 'V'], ['BQ400P', 400, 413, 'P'],
    ['BQ600V', 600, 613, 'V'], ['BQ600P', 600, 613, 'P'],
  ].map(([code, nominalMm, widthMm, joint]) => ({
    code,
    nominalMm,
    widthMm,
    thicknessMm: 9,
    joint,
    src: `${IMG}/panels/sizes/${code.toLowerCase()}.webp`,
    page: 25,
  })),
  // Pages 26–27: "Аксесоари", profiles by code; width × height as printed on each drawing.
  accessories: [
    ['BTJX10015', 100, 15, 26], ['BTJX10021', 100, 21, 26], ['BKJ4010', 40, 10, 26],
    ['BKJ2810', 28, 9.5, 26], ['BYX5019', 50, 19, 26], ['BYX8024', 80, 24, 26],
    ['BQQX7027', 70, 27.5, 26], ['BQQX8036', 80, 35.4, 26], ['BKJ2311', 22.5, 11, 26],
    ['BKJ2116', 21, 15.5, 26], ['BKJ1309', 13, 8.5, 26],
    ['BKX10044', 100, 43.5, 27], ['BZSKX9026', 90, 26, 27], ['BTJX11020', 110, 20, 27],
    ['BKX9025', 90, 24, 27], ['BKX8531', 85, 31, 27], ['BKX8025', 80, 24.5, 27],
    ['BKX6037', 60, 37, 27], ['BKX6038', 60, 37.8, 27], ['BKX6034', 60, 34, 27],
    ['BTJX15024', 150, 24, 27], ['BCCB21009', 210, 9, 27],
  ].map(([code, widthMm, heightMm, page]) => ({
    code,
    widthMm,
    heightMm,
    src: `${IMG}/panels/accessories/${code.toLowerCase()}.webp`,
    page,
  })),
  // Page 28, left: "Метални линии", the metal joint and edge profiles by name (no codes). The
  // image carries the catalogue's Bulgarian labels, so other locales list the names in text.
  metalLines: {
    title: c('Метални линии', 'Metal lines', 'Μεταλλικές γραμμές'),
    src: `${IMG}/panels/metal-lines.webp`,
    page: 28,
    profiles: [
      c('Двойна I форма', 'Double I profile', 'Διπλό προφίλ Ι'),
      c('I форма', 'I profile', 'Προφίλ Ι'),
      c('Изпъкнал ъгъл', 'External corner', 'Εξωτερική γωνία'),
      c('Без фуга', 'No-gap joint', 'Αρμός χωρίς κενό'),
      c('Микро фуга', 'Micro-gap joint', 'Μικρός αρμός'),
      c('Завършваща лайсна', 'End trim', 'Τελικό προφίλ'),
      c('Вдлъбнат ъгъл', 'Internal corner', 'Εσωτερική γωνία'),
      c('Горна лайсна', 'Top trim', 'Άνω προφίλ'),
      c('Первазна лайсна', 'Skirting trim', 'Προφίλ σοβατεπί'),
      c('Декоративна лайсна', 'Decorative moulding', 'Διακοσμητικό προφίλ'),
    ],
  },
  // Page 28, right: "Схема за монтаж на стенния панел" (Bulgarian labels in the image).
  installScheme: {
    title: c('Схема за монтаж на стенния панел', 'How the wall panel is installed', 'Σχέδιο τοποθέτησης του πάνελ τοίχου'),
    src: `${IMG}/panels/install-scheme.webp`,
    page: 28,
  },
  // Page 33: a classic panelled wall with its moulding profiles, numbered 1–5 (no labels).
  classicScheme: { src: `${IMG}/panels/classic-scheme.webp`, page: 33 },
}
