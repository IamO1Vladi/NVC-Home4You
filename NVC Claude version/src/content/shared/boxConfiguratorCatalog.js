const byLocale = (locale, en, bg) => (locale === 'bg' ? bg : en)
const INTERNAL_WALLS_BASE_37 = 1300
const scaleInternalWallsPrice = (area) => Math.round((INTERNAL_WALLS_BASE_37 * area) / 37)
const refPage = (page) => `catalog/page-${page}.png`

function translateDisplayLabelBg(label = '') {
  const entries = [
    ['Blue grey stone', 'Синьо-сив камък'],
    ['Blue grey', 'Синьо-сиво'],
    ['Soft white', 'Меко бяло'],
    ['Light stone', 'Светъл камък'],
    ['Stone grey', 'Каменно сиво'],
    ['Espresso brown', 'Еспресо кафяво'],
    ['Golden oak', 'Златист дъб'],
    ['Warm beige', 'Топъл беж'],
    ['Warm oak', 'Топъл дъб'],
    ['Walnut brown', 'Орехово кафяво'],
    ['Walnut stone', 'Орехов камък'],
    ['Graphite stone', 'Графитен камък'],
    ['Graphite', 'Графит'],
    ['Light grey', 'Светло сиво'],
    ['Honey oak', 'Меден дъб'],
    ['Honey stone', 'Меден камък'],
    ['Olive wood', 'Маслинено дърво'],
    ['Sand beige', 'Пясъчен беж'],
    ['Slate grey', 'Шистово сиво'],
    ['Cool stone', 'Студен камък'],
    ['Rust brown', 'Ръждиво кафяво'],
    ['Terracotta', 'Теракота'],
    ['Charcoal ribbed', 'Тъмносив оребрен'],
    ['Warm cedar ribbed', 'Топъл кедър оребрен'],
    ['White ribbed', 'Бял оребрен'],
    ['Speckled stone', 'Петнист камък'],
    ['Redwood ribbed', 'Червеникав оребрен'],
    ['Golden teak grain', 'Златист тик дървесен фладер'],
    ['Mist blue grain', 'Мъгливо син фладер'],
    ['Espresso grain', 'Еспресо фладер'],
    ['Honey oak grain', 'Меден дъб фладер'],
    ['Whitewashed redwood', 'Изсветлен червен фладер'],
    ['Classic mahogany', 'Класически махагон'],
    ['Terracotta grain', 'Теракотен фладер'],
    ['Stacked slate', 'Наслоен шист'],
    ['White marble', 'Бял мрамор'],
    ['Light stone stack', 'Светъл каменен стек'],
    ['Dark stone stack', 'Тъмен каменен стек'],
    ['Olive block stone', 'Маслинен блок камък'],
    ['Red brick', 'Червена тухла'],
    ['Terrazzo white', 'Бял терацо'],
    ['Sand limestone', 'Пясъчен варовик'],
  ]
  for (const [en, bg] of entries) {
    if (label === en || label.startsWith(`${en} `)) return `${bg}${label.slice(en.length)}`
  }
  return label
}

export function euro(value, locale = 'en') {
  return new Intl.NumberFormat(locale === 'bg' ? 'bg-BG' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

const OUTSIDE_PANEL_OPTIONS = [
  {
    "key": "panel-charcoal-ribbed",
    "label": "Charcoal ribbed",
    "swatch": "#31342f",
    "thumbImage": "thumbs/outside/panel-charcoal-ribbed.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-warm-cedar-ribbed",
    "label": "Warm cedar ribbed",
    "swatch": "#794428",
    "thumbImage": "thumbs/outside/panel-warm-cedar-ribbed.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-white-ribbed",
    "label": "White ribbed",
    "swatch": "#ccd6da",
    "thumbImage": "thumbs/outside/panel-white-ribbed.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-speckled-stone",
    "label": "Speckled stone",
    "swatch": "#7b7c81",
    "thumbImage": "thumbs/outside/panel-speckled-stone.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-redwood-ribbed",
    "label": "Redwood ribbed",
    "swatch": "#853c22",
    "thumbImage": "thumbs/outside/panel-redwood-ribbed.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-golden-teak-grain",
    "label": "Golden teak grain",
    "swatch": "#874a26",
    "thumbImage": "thumbs/outside/panel-golden-teak-grain.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-mist-blue-grain",
    "label": "Mist blue grain",
    "swatch": "#80949f",
    "thumbImage": "thumbs/outside/panel-mist-blue-grain.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-espresso-grain",
    "label": "Espresso grain",
    "swatch": "#5b4236",
    "thumbImage": "thumbs/outside/panel-espresso-grain.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-honey-oak-grain",
    "label": "Honey oak grain",
    "swatch": "#825b3d",
    "thumbImage": "thumbs/outside/panel-honey-oak-grain.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-whitewashed-redwood",
    "label": "Whitewashed redwood",
    "swatch": "#a56758",
    "thumbImage": "thumbs/outside/panel-whitewashed-redwood.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-classic-mahogany",
    "label": "Classic mahogany",
    "swatch": "#773820",
    "thumbImage": "thumbs/outside/panel-classic-mahogany.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-terracotta-grain",
    "label": "Terracotta grain",
    "swatch": "#994a2f",
    "thumbImage": "thumbs/outside/panel-terracotta-grain.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-stacked-slate",
    "label": "Stacked slate",
    "swatch": "#9b9a93",
    "thumbImage": "thumbs/outside/panel-stacked-slate.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-white-marble",
    "label": "White marble",
    "swatch": "#b2b7bd",
    "thumbImage": "thumbs/outside/panel-white-marble.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-light-stone-stack",
    "label": "Light stone stack",
    "swatch": "#a4a6a6",
    "thumbImage": "thumbs/outside/panel-light-stone-stack.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-dark-stone-stack",
    "label": "Dark stone stack",
    "swatch": "#655f51",
    "thumbImage": "thumbs/outside/panel-dark-stone-stack.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-olive-block-stone",
    "label": "Olive block stone",
    "swatch": "#595747",
    "thumbImage": "thumbs/outside/panel-olive-block-stone.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-red-brick",
    "label": "Red brick",
    "swatch": "#ad624e",
    "thumbImage": "thumbs/outside/panel-red-brick.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-terrazzo-white",
    "label": "Terrazzo white",
    "swatch": "#b6bbba",
    "thumbImage": "thumbs/outside/panel-terrazzo-white.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  },
  {
    "key": "panel-sand-limestone",
    "label": "Sand limestone",
    "swatch": "#b7aa91",
    "thumbImage": "thumbs/outside/panel-sand-limestone.webp",
    "referenceImage": "catalog/side-panel-colours.png"
  }
]

const STEEL_FRAME_COLOR_OPTIONS = [
  { key: 'black', label: 'Black', swatch: '#22262b' },
  { key: 'white', label: 'White', swatch: '#f2f3ee' },
  { key: 'grey', label: 'Grey', swatch: '#8d9499' },
]

const KITCHEN_BENCH_META = {
  "yl-4003": {
    "thumbImage": "thumbs/kitchen-bench/yl-4003.webp",
    "swatch": "#b9bbbf",
    "displayLabel": "Light stone",
    "referenceImage": "catalog/page-24.png"
  },
  "yl-1001": {
    "thumbImage": "thumbs/kitchen-bench/yl-1001.webp",
    "swatch": "#adaeae",
    "displayLabel": "Light stone 2",
    "referenceImage": "catalog/page-24.png"
  },
  "yl-4108": {
    "thumbImage": "thumbs/kitchen-bench/yl-4108.webp",
    "swatch": "#bdc1c2",
    "displayLabel": "Light stone 3",
    "referenceImage": "catalog/page-24.png"
  },
  "yl-6919": {
    "thumbImage": "thumbs/kitchen-bench/yl-6919.webp",
    "swatch": "#c5c9ca",
    "displayLabel": "Soft white",
    "referenceImage": "catalog/page-24.png"
  },
  "yl-9001": {
    "thumbImage": "thumbs/kitchen-bench/yl-9001.webp",
    "swatch": "#bfc3c6",
    "displayLabel": "Light stone 4",
    "referenceImage": "catalog/page-25.png"
  },
  "yl-6930": {
    "thumbImage": "thumbs/kitchen-bench/yl-6930.webp",
    "swatch": "#d0ceca",
    "displayLabel": "Soft white 2",
    "referenceImage": "catalog/page-25.png"
  },
  "yl-6926": {
    "thumbImage": "thumbs/kitchen-bench/yl-6926.webp",
    "swatch": "#c2c3c6",
    "displayLabel": "Light stone 5",
    "referenceImage": "catalog/page-25.png"
  },
  "yl-7808": {
    "thumbImage": "thumbs/kitchen-bench/yl-7808.webp",
    "swatch": "#bcc2c9",
    "displayLabel": "Blue grey stone",
    "referenceImage": "catalog/page-25.png"
  },
  "yl-6908": {
    "thumbImage": "thumbs/kitchen-bench/yl-6908.webp",
    "swatch": "#cac9c5",
    "displayLabel": "Soft white 3",
    "referenceImage": "catalog/page-26.png"
  },
  "yl-6915": {
    "thumbImage": "thumbs/kitchen-bench/yl-6915.webp",
    "swatch": "#c9c6c1",
    "displayLabel": "Light stone 6",
    "referenceImage": "catalog/page-26.png"
  },
  "yl-9011": {
    "thumbImage": "thumbs/kitchen-bench/yl-9011.webp",
    "swatch": "#b09d8a",
    "displayLabel": "Warm beige",
    "referenceImage": "catalog/page-26.png"
  },
  "yl-9016": {
    "thumbImage": "thumbs/kitchen-bench/yl-9016.webp",
    "swatch": "#b4b7ba",
    "displayLabel": "Light stone 7",
    "referenceImage": "catalog/page-26.png"
  },
  "yl-4008": {
    "thumbImage": "thumbs/kitchen-bench/yl-4008.webp",
    "swatch": "#aaadb1",
    "displayLabel": "Light stone 8",
    "referenceImage": "catalog/page-27.png"
  },
  "yl-7849": {
    "thumbImage": "thumbs/kitchen-bench/yl-7849.webp",
    "swatch": "#bbbfbe",
    "displayLabel": "Light stone 9",
    "referenceImage": "catalog/page-27.png"
  },
  "yl-6905": {
    "thumbImage": "thumbs/kitchen-bench/yl-6905.webp",
    "swatch": "#b8bbbc",
    "displayLabel": "Light stone 10",
    "referenceImage": "catalog/page-27.png"
  },
  "yl-6932": {
    "thumbImage": "thumbs/kitchen-bench/yl-6932.webp",
    "swatch": "#b4b8bb",
    "displayLabel": "Light stone 11",
    "referenceImage": "catalog/page-27.png"
  },
  "yl-6947": {
    "thumbImage": "thumbs/kitchen-bench/yl-6947.webp",
    "swatch": "#c8c8cb",
    "displayLabel": "Soft white 4",
    "referenceImage": "catalog/page-28.png"
  },
  "yl-6805": {
    "thumbImage": "thumbs/kitchen-bench/yl-6805.webp",
    "swatch": "#a3a3a6",
    "displayLabel": "Light stone 12",
    "referenceImage": "catalog/page-28.png"
  },
  "yl-1016": {
    "thumbImage": "thumbs/kitchen-bench/yl-1016.webp",
    "swatch": "#bbbbbe",
    "displayLabel": "Light stone 13",
    "referenceImage": "catalog/page-28.png"
  },
  "yl-6988": {
    "thumbImage": "thumbs/kitchen-bench/yl-6988.webp",
    "swatch": "#babbbd",
    "displayLabel": "Light stone 14",
    "referenceImage": "catalog/page-28.png"
  },
  "yl-6903": {
    "thumbImage": "thumbs/kitchen-bench/yl-6903.webp",
    "swatch": "#d2d1cc",
    "displayLabel": "Soft white 5",
    "referenceImage": "catalog/page-29.png"
  },
  "yl-6937": {
    "thumbImage": "thumbs/kitchen-bench/yl-6937.webp",
    "swatch": "#bcc1ba",
    "displayLabel": "Light stone 15",
    "referenceImage": "catalog/page-29.png"
  },
  "yl-6902": {
    "thumbImage": "thumbs/kitchen-bench/yl-6902.webp",
    "swatch": "#bcbcc0",
    "displayLabel": "Light stone 16",
    "referenceImage": "catalog/page-29.png"
  }
}
const SPC_META = {
  "spc-7005": {
    "thumbImage": "thumbs/spc/spc-7005.webp",
    "swatch": "#a98d62",
    "displayLabel": "Walnut brown",
    "referenceImage": "catalog/page-76.png"
  },
  "spc-7006": {
    "thumbImage": "thumbs/spc/spc-7006.webp",
    "swatch": "#53483e",
    "displayLabel": "Espresso brown",
    "referenceImage": "catalog/page-76.webp"
  },
  "spc-7007": {
    "thumbImage": "thumbs/spc/spc-7007.webp",
    "swatch": "#95673d",
    "displayLabel": "Espresso brown 2",
    "referenceImage": "catalog/page-76.png"
  },
  "spc-7008": {
    "thumbImage": "thumbs/spc/spc-7008.webp",
    "swatch": "#6c4023",
    "displayLabel": "Espresso brown 3",
    "referenceImage": "catalog/page-77.png"
  },
  "spc-7009": {
    "thumbImage": "thumbs/spc/spc-7009.webp",
    "swatch": "#805f3b",
    "displayLabel": "Espresso brown 4",
    "referenceImage": "catalog/page-77.png"
  },
  "spc-8005": {
    "thumbImage": "thumbs/spc/spc-8005.webp",
    "swatch": "#76321b",
    "displayLabel": "Rust brown",
    "referenceImage": "catalog/page-77.png"
  },
  "spc-8006": {
    "thumbImage": "thumbs/spc/spc-8006.webp",
    "swatch": "#909397",
    "displayLabel": "Stone grey",
    "referenceImage": "catalog/page-78.png"
  },
  "spc-8007": {
    "thumbImage": "thumbs/spc/spc-8007.webp",
    "swatch": "#bdb395",
    "displayLabel": "Golden oak",
    "referenceImage": "catalog/page-78.png"
  },
  "spc-8008": {
    "thumbImage": "thumbs/spc/spc-8008.webp",
    "swatch": "#857d6b",
    "displayLabel": "Golden oak 2",
    "referenceImage": "catalog/page-78.png"
  },
  "spc-8009": {
    "thumbImage": "thumbs/spc/spc-8009.webp",
    "swatch": "#865d38",
    "displayLabel": "Espresso brown 5",
    "referenceImage": "catalog/page-79.png"
  },
  "spc-9005": {
    "thumbImage": "thumbs/spc/spc-9005.webp",
    "swatch": "#a99a7d",
    "displayLabel": "Golden oak 3",
    "referenceImage": "catalog/page-79.png"
  },
  "spc-9006": {
    "thumbImage": "thumbs/spc/spc-9006.webp",
    "swatch": "#a2acb5",
    "displayLabel": "Blue grey",
    "referenceImage": "catalog/page-79.png"
  },
  "spc-9007": {
    "thumbImage": "thumbs/spc/spc-9007.webp",
    "swatch": "#acb2be",
    "displayLabel": "Slate grey",
    "referenceImage": "catalog/page-80.png"
  },
  "spc-9008": {
    "thumbImage": "thumbs/spc/spc-9008.webp",
    "swatch": "#908273",
    "displayLabel": "Walnut brown 2",
    "referenceImage": "catalog/page-80.png"
  },
  "spc-9009": {
    "thumbImage": "thumbs/spc/spc-9009.webp",
    "swatch": "#7e3c21",
    "displayLabel": "Rust brown 2",
    "referenceImage": "catalog/page-80.png"
  },
  "spc-9010": {
    "thumbImage": "thumbs/spc/spc-9010.webp",
    "swatch": "#c1996e",
    "displayLabel": "Warm oak",
    "referenceImage": "catalog/page-81.png"
  },
  "spc-9011": {
    "thumbImage": "thumbs/spc/spc-9011.webp",
    "swatch": "#7b7c7b",
    "displayLabel": "Stone grey 2",
    "referenceImage": "catalog/page-81.png"
  },
  "spc-9012": {
    "thumbImage": "thumbs/spc/spc-9012.webp",
    "swatch": "#4c4f53",
    "displayLabel": "Graphite",
    "referenceImage": "catalog/page-81.png"
  }
}
const PVC_META = {
  "pvc-001": {
    "thumbImage": "thumbs/pvc/pvc-001.webp",
    "swatch": "#989ea0",
    "displayLabel": "Stone grey",
    "referenceImage": "catalog/page-82.png"
  },
  "pvc-002": {
    "thumbImage": "thumbs/pvc/pvc-002.webp",
    "swatch": "#99968f",
    "displayLabel": "Stone grey 2",
    "referenceImage": "catalog/page-82.webp"
  },
  "pvc-003": {
    "thumbImage": "thumbs/pvc/pvc-003.webp",
    "swatch": "#5c6d85",
    "displayLabel": "Blue grey stone",
    "referenceImage": "catalog/page-82.png"
  },
  "pvc-004": {
    "thumbImage": "thumbs/pvc/pvc-004.webp",
    "swatch": "#ab9585",
    "displayLabel": "Warm beige",
    "referenceImage": "catalog/page-82.png"
  },
  "pvc-005": {
    "thumbImage": "thumbs/pvc/pvc-005.webp",
    "swatch": "#966e47",
    "displayLabel": "Walnut stone",
    "referenceImage": "catalog/page-82.png"
  },
  "pvc-006": {
    "thumbImage": "thumbs/pvc/pvc-006.webp",
    "swatch": "#56514a",
    "displayLabel": "Graphite stone",
    "referenceImage": "catalog/page-82.png"
  },
  "pvc-007": {
    "thumbImage": "thumbs/pvc/pvc-007.webp",
    "swatch": "#778aa8",
    "displayLabel": "Blue grey stone 2",
    "referenceImage": "catalog/page-82.png"
  },
  "pvc-008": {
    "thumbImage": "thumbs/pvc/pvc-008.webp",
    "swatch": "#799ab6",
    "displayLabel": "Blue grey stone 3",
    "referenceImage": "catalog/page-82.png"
  },
  "pvc-009": {
    "thumbImage": "thumbs/pvc/pvc-009.webp",
    "swatch": "#989593",
    "displayLabel": "Stone grey 3",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-010": {
    "thumbImage": "thumbs/pvc/pvc-010.webp",
    "swatch": "#c3ad8c",
    "displayLabel": "Warm beige 2",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-011": {
    "thumbImage": "thumbs/pvc/pvc-011.webp",
    "swatch": "#98938b",
    "displayLabel": "Stone grey 4",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-012": {
    "thumbImage": "thumbs/pvc/pvc-012.webp",
    "swatch": "#8c8a87",
    "displayLabel": "Stone grey 5",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-013": {
    "thumbImage": "thumbs/pvc/pvc-013.webp",
    "swatch": "#98a6ab",
    "displayLabel": "Blue grey stone 4",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-014": {
    "thumbImage": "thumbs/pvc/pvc-014.webp",
    "swatch": "#829bbc",
    "displayLabel": "Blue grey stone 5",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-015": {
    "thumbImage": "thumbs/pvc/pvc-015.webp",
    "swatch": "#a9b9c3",
    "displayLabel": "Blue grey stone 6",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-016": {
    "thumbImage": "thumbs/pvc/pvc-016.webp",
    "swatch": "#c8baaf",
    "displayLabel": "Sand beige",
    "referenceImage": "catalog/page-83.png"
  },
  "pvc-017": {
    "thumbImage": "thumbs/pvc/pvc-017.webp",
    "swatch": "#b7b6b5",
    "displayLabel": "Light stone",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-018": {
    "thumbImage": "thumbs/pvc/pvc-018.webp",
    "swatch": "#ccc3ad",
    "displayLabel": "Sand beige 2",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-019": {
    "thumbImage": "thumbs/pvc/pvc-019.webp",
    "swatch": "#98a5b8",
    "displayLabel": "Blue grey stone 7",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-020": {
    "thumbImage": "thumbs/pvc/pvc-020.webp",
    "swatch": "#51689c",
    "displayLabel": "Cool stone",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-021": {
    "thumbImage": "thumbs/pvc/pvc-021.webp",
    "swatch": "#8f897b",
    "displayLabel": "Walnut stone 2",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-022": {
    "thumbImage": "thumbs/pvc/pvc-022.webp",
    "swatch": "#56554f",
    "displayLabel": "Graphite stone 2",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-023": {
    "thumbImage": "thumbs/pvc/pvc-023.webp",
    "swatch": "#b69d4c",
    "displayLabel": "Honey stone",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-024": {
    "thumbImage": "thumbs/pvc/pvc-024.webp",
    "swatch": "#a4a09b",
    "displayLabel": "Light stone 2",
    "referenceImage": "catalog/page-84.png"
  },
  "pvc-025": {
    "thumbImage": "thumbs/pvc/pvc-025.webp",
    "swatch": "#c2976e",
    "displayLabel": "Warm oak",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-026": {
    "thumbImage": "thumbs/pvc/pvc-026.webp",
    "swatch": "#413b38",
    "displayLabel": "Graphite",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-027": {
    "thumbImage": "thumbs/pvc/pvc-027.webp",
    "swatch": "#6c4f3c",
    "displayLabel": "Espresso brown",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-028": {
    "thumbImage": "thumbs/pvc/pvc-028.webp",
    "swatch": "#c5c0a8",
    "displayLabel": "Honey oak",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-029": {
    "thumbImage": "thumbs/pvc/pvc-029.webp",
    "swatch": "#7ea8cc",
    "displayLabel": "Blue grey",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-030": {
    "thumbImage": "thumbs/pvc/pvc-030.webp",
    "swatch": "#4c6385",
    "displayLabel": "Blue grey 2",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-031": {
    "thumbImage": "thumbs/pvc/pvc-031.webp",
    "swatch": "#999592",
    "displayLabel": "Stone grey 6",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-032": {
    "thumbImage": "thumbs/pvc/pvc-032.webp",
    "swatch": "#3e3e3e",
    "displayLabel": "Graphite 2",
    "referenceImage": "catalog/page-85.png"
  },
  "pvc-033": {
    "thumbImage": "thumbs/pvc/pvc-033.webp",
    "swatch": "#c0ad92",
    "displayLabel": "Warm oak 2",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-034": {
    "thumbImage": "thumbs/pvc/pvc-034.webp",
    "swatch": "#d3cfc6",
    "displayLabel": "Honey oak 2",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-035": {
    "thumbImage": "thumbs/pvc/pvc-035.webp",
    "swatch": "#7d9dbf",
    "displayLabel": "Blue grey 3",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-036": {
    "thumbImage": "thumbs/pvc/pvc-036.webp",
    "swatch": "#a5a895",
    "displayLabel": "Olive wood",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-037": {
    "thumbImage": "thumbs/pvc/pvc-037.webp",
    "swatch": "#c5b289",
    "displayLabel": "Golden oak",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-038": {
    "thumbImage": "thumbs/pvc/pvc-038.webp",
    "swatch": "#716c67",
    "displayLabel": "Graphite 3",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-039": {
    "thumbImage": "thumbs/pvc/pvc-039.webp",
    "swatch": "#c0b7b2",
    "displayLabel": "Terracotta",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-040": {
    "thumbImage": "thumbs/pvc/pvc-040.webp",
    "swatch": "#aba89f",
    "displayLabel": "Stone grey 7",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-041": {
    "thumbImage": "thumbs/pvc/pvc-041.webp",
    "swatch": "#837d7a",
    "displayLabel": "Stone grey 8",
    "referenceImage": "catalog/page-86.png"
  },
  "pvc-042": {
    "thumbImage": "thumbs/pvc/pvc-042.webp",
    "swatch": "#7f7f80",
    "displayLabel": "Stone grey 9",
    "referenceImage": "catalog/page-86.png"
  }
}
const CARBON_META = {
  "carbon-gf005": {
    "thumbImage": "thumbs/carbon/carbon-gf005.webp",
    "swatch": "#9f9885",
    "displayLabel": "Golden oak",
    "referenceImage": "catalog/carbon-crystal-sheet.png"
  },
  "carbon-gf002": {
    "thumbImage": "thumbs/carbon/carbon-gf002.webp",
    "swatch": "#aaaaa2",
    "displayLabel": "Light grey",
    "referenceImage": "catalog/carbon-crystal-sheet.png"
  },
  "carbon-wl6603": {
    "thumbImage": "thumbs/carbon/carbon-wl6603.webp",
    "swatch": "#695f53",
    "displayLabel": "Espresso brown",
    "referenceImage": "catalog/carbon-crystal-sheet.png"
  },
  "carbon-wl6608": {
    "thumbImage": "thumbs/carbon/carbon-wl6608.webp",
    "swatch": "#aaa19c",
    "displayLabel": "Stone grey",
    "referenceImage": "catalog/carbon-crystal-sheet.webp"
  },
  "carbon-wl6607": {
    "thumbImage": "thumbs/carbon/carbon-wl6607.webp",
    "swatch": "#b5ad9c",
    "displayLabel": "Golden oak 2",
    "referenceImage": "catalog/carbon-crystal-sheet.png"
  },
  "carbon-wl5601": {
    "thumbImage": "thumbs/carbon/carbon-wl5601.webp",
    "swatch": "#c7c1bf",
    "displayLabel": "Light grey 2",
    "referenceImage": "catalog/carbon-crystal-sheet.png"
  }
}

function makeCodeOption(key, code, meta, prefix = '', locale = 'en') {
  const rawDisplay = meta?.displayLabel || ''
  const localizedDisplay = locale === 'bg' ? translateDisplayLabelBg(rawDisplay) : rawDisplay
  return {
    key,
    code,
    label: prefix ? `${prefix} ${code}` : code,
    summaryLabel: code,
    displayLabel: localizedDisplay,
    swatch: meta?.swatch || '',
    thumbImage: meta?.thumbImage || '',
    referenceImage: meta?.referenceImage || '',
  }
}

export function getBoxConfiguratorCatalog(locale = 'en') {
  const t = (en, bg) => byLocale(locale, en, bg)

  const models = [
    {
      key: '37',
      label: t('37 m²', '37 м²'),
      area: 37,
      dimensionsOpen: '5900x6410x2600',
      dimensionsFolded: '5900x2410x2600',
      basePrice: 14000,
      balconyPrice: 16700,
      internalWallsPrice: scaleInternalWallsPrice(37),
      heroImage: 'models/model-37-standard.webp',
      standardHeroImage: 'models/model-37-standard.webp',
      balconyHeroImage: 'models/model-37-balcony.webp',
      overviewImage: 'models/model-37-overview.webp',
      standardOverviewImage: 'models/model-37-overview.webp',
      balconyOverviewImage: 'models/model-37-overview.webp',
      plans: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
    },
    {
      key: '58',
      label: t('58 m²', '58 м²'),
      area: 58,
      dimensionsOpen: '9000x6410x2600',
      dimensionsFolded: '9000x2410x2600',
      basePrice: 23000,
      balconyPrice: 25500,
      internalWallsPrice: scaleInternalWallsPrice(58),
      heroImage: 'models/model-58-standard.webp',
      standardHeroImage: 'models/model-58-standard.webp',
      balconyHeroImage: 'models/model-58-balcony.webp',
      overviewImage: 'models/model-58-overview.web',
      standardOverviewImage: 'models/model-58-overview.webp',
      balconyOverviewImage: 'models/model-58-overview.webp',
      plans: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
    },
    {
      key: '73',
      label: t('73 m²', '73 м²'),
      area: 73,
      dimensionsOpen: '11800x6410x2600',
      dimensionsFolded: '11800x2410x2600',
      basePrice: 25500,
      balconyPrice: 28000,
      internalWallsPrice: scaleInternalWallsPrice(73),
      heroImage: 'models/model-73-standard.png',
      standardHeroImage: 'models/model-73-standard.webp',
      balconyHeroImage: 'models/model-73-balcony.webp',
      overviewImage: 'models/model-73-overview.webp',
      standardOverviewImage: 'models/model-73-overview.webp',
      balconyOverviewImage: 'models/model-73-overview.webp',
      plans: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
    },
  ]

  const planMeta = {
    A1: t('Living room and kitchen + 1 bedroom', 'Хол и кухня + 1 спалня'),
    A2: t('Compact 1 bedroom', 'Компактна 1 спалня'),
    A3: t('2 bedroom + living room and kitchen', '2 спалня + хол и кухня'),
    A4: t('3 bedrooms', '3 спални'),
    A5: t('3 bedrooms + workplace', '3 спални + раборен кът'),
    A6: t('4 bedrooms', '4 спални'),
    B1: t('Living room and kitchen + 1 bedroom', 'Хол и кухня  + 1 спалня'),
    B2: t('Living room and kithcen + 2 bedrooms', 'Хол и кухня  + 2 спални'),
    B3: t('Living room and kitchen+ 3 bedrooms', 'Хол и кухня  + 3 спални'),
    B4: t('Living room and kitchen + 4 bedrooms', 'Хол и кухня + 4 спални'),
    B5: t('5 bedrooms', '5 спални'),
    B6: t('6 bedrooms', '6 спални'),
    C1: t('Living room, kitchen and a dinning place + 1 bedroom', 'Хол, кухня и трапезария + 1 спалня'),
    C2: t('Living room, kitchen and a workspace + 2 bedroom', 'Хол, кухня и работен кът + 2 спалня'),
    C3: t('Living room and kitchen  + 3 bedroom', 'Хол и кухня + 3 спалня'),
    C4: t('Living room and kitchen  + 4 bedroom', 'Хол и кухня + 4 спалня'),
    C5: t('4 bedrooms', '4 спални'),
    C6: t('5 bedrooms', '5 спални'),
  }

  const planWallFactor = {
    A1: 0.72,
    A2: 0.78,
    A3: 0.9,
    A4: 1.05,
    A5: 1.18,
    A6: 1.28,
    B1: 0.86,
    B2: 0.98,
    B3: 1.1,
    B4: 1.16,
    B5: 1.26,
    B6: 1.36,
    C1: 0.95,
    C2: 1.05,
    C3: 1.15,
    C4: 1.22,
    C5: 1.32,
    C6: 1.42,
  }

  const planOptions = Object.keys(planMeta).map((key) => ({
    key,
    label: key,
    subtitle: planMeta[key],
    image: `plan-${key}.webp`,
    // Blank-wall version of the same plan, used as the canvas when the buyer
    // clicks to place their own windows (so existing windows don't confuse them).
    noWindowImage: `plan-${key}-nowindows.webp`,
    wallFactor: planWallFactor[key] || 1,
  }))

  const bathroomOptions = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'].map((key) => ({
    key,
    label: key,
    subtitle: t('Bathroom concept', 'Концепция за баня'),
    image: `bath-${key}.webp`,
  }))

  const kitchenOptions = ['F1', 'F2', 'F3', 'F4', 'F5'].map((key) => ({
    key,
    label: key,
    subtitle: t('Kitchen concept', 'Концепция за кухня'),
    image: `kitchen-${key}.webp`,
  }))

  const windowFrameOptions = [
    { key: 'pvc', label: 'PVC', note: t('60 mm frame • U ≤ 1.4 • 35 dB', '60 мм рамка • U ≤ 1.4 • 35 dB') },
    { key: 'aluminium', label: t('Aluminium', 'Алуминий'), note: t('60 mm frame • U ≤ 1.4 • 35 dB', '60 мм рамка • U ≤ 1.4 • 35 dB') },
  ]

  const steelFrameColorOptions = STEEL_FRAME_COLOR_OPTIONS.map((item) => ({
    ...item,
    label: item.key === 'black' ? t('Black', 'Черно') : item.key === 'white' ? t('White', 'Бяло') : t('Grey', 'Сиво'),
  }))

  const windowStyleOptions = [
    { key: 'broken-bridge', label: t('Broken bridge aluminium', 'Алуминиева с прекъснат термомост'), thumbImage: 'thumbs/windows/window-broken-bridge.webp', referenceImage: refPage(65) },
    { key: 'titanium-alloy', label: t('Titanium alloy window', 'Титаниева дограма'), thumbImage: 'thumbs/windows/window-titanium-alloy.webp', referenceImage: refPage(65) },
    { key: 'plastic-steel', label: t('Plastic steel window', 'PVC прозорец'), thumbImage: 'thumbs/windows/window-plastic-steel.webp', referenceImage: refPage(65) },
    { key: 'dark-frame-slider', label: t('Dark frame slider', 'Тъмен плъзгащ профил'), thumbImage: 'thumbs/windows/window-dark-frame-slider.webp', referenceImage: refPage(66) },
    { key: 'wide-slider', label: t('Wide slider', 'Широк плъзгащ профил'), thumbImage: 'thumbs/windows/window-wide-slider.webp', referenceImage: refPage(66) },
    { key: 'door-light-combo', label: t('Door + sidelight combo', 'Комбинация врата + страничен светлик'), thumbImage: 'thumbs/windows/window-door-light-combo.webp', referenceImage: refPage(67) },
  ]

  const exteriorDoorOptions = [
    { key: 'broken-bridge-door-a', label: t('Broken bridge aluminium door A', 'Алуминиева врата с термомост A'), thumbImage: 'thumbs/exterior-doors/brokenTypeA.webp', referenceImage: 'catalog/page-07-new.png' },
    { key: 'white-broken-bridge-door', label: t('White broken bridge aluminium door', 'Бяла алуминиева врата с термомост'), thumbImage: 'thumbs/exterior-doors/brokenTypeB.webp', referenceImage: 'catalog/page-07-new.png' },
    { key: 'broken-bridge-door', label: t('Broken bridge aluminium door B', 'Алуминиева врата с термомост B'), thumbImage: 'thumbs/exterior-doors/door-slider-black.webp', referenceImage: 'catalog/page-07-new.png' },
    { key: 'white-titanium-door', label: t('White titanium door', 'Бяла титаниева врата'), thumbImage: 'thumbs/exterior-doors/door-titanium-white.webp', referenceImage: 'catalog/page-07-new.png' },
    { key: 'anti-theft-door', label: t('Anti-theft door', 'Антивзломна врата'), thumbImage: 'thumbs/exterior-doors/door-solid-black.webp', referenceImage: 'catalog/page-07-new.png' },
  ]

  const exteriorFinishGroups = [{
    key: 'outside-panels',
    label: t('Outside panels', 'Външни панели'),
    options: OUTSIDE_PANEL_OPTIONS.map((item) => {
      const localized = locale === 'bg' ? translateDisplayLabelBg(item.label) : item.label
      return { ...item, label: localized, displayLabel: localized, summaryLabel: localized }
    }),
  }]

  const deckingColorOptions = [
    { key: 'red-pine', label: t('Red Pine', 'Червен бор'), swatch: '#a77158', thumbImage: 'thumbs/decking/decking-red-pine.webp', referenceImage: refPage(16) },
    { key: 'coffee-brown', label: t('Coffee Brown', 'Кафяво кафе'), swatch: '#695447', thumbImage: 'thumbs/decking/decking-coffee-brown.webp', referenceImage: refPage(16) },
    { key: 'walnut', label: t('Walnut', 'Орех'), swatch: '#8f6856', thumbImage: 'thumbs/decking/decking-walnut.webp', referenceImage: refPage(16) },
    { key: 'teak', label: t('Teak', 'Тик'), swatch: '#b99459', thumbImage: 'thumbs/decking/decking-teak.webp', referenceImage: refPage(16) },
    { key: 'black', label: t('Black', 'Черно'), swatch: '#343434', thumbImage: 'thumbs/decking/decking-black.webp', referenceImage: refPage(16) },
    { key: 'light-gray', label: t('Light Gray', 'Светло сиво'), swatch: '#9b9993', thumbImage: 'thumbs/decking/decking-light-gray.webp', referenceImage: refPage(16) },
    { key: 'blue-gray', label: t('Blue Gray', 'Синьо сиво'), swatch: '#54606a', thumbImage: 'thumbs/decking/decking-blue-gray.webp', referenceImage: refPage(16) },
    { key: 'red-wood', label: t('Red Wood', 'Червено дърво'), swatch: '#b15a3f', thumbImage: 'thumbs/decking/decking-red-wood.webp', referenceImage: refPage(16) },
  ]

  const interiorPanelColorOptions = [
    { key: 'panel-white-texture', label: t('White textured panel', 'Бял текстуриран панел'), swatch: '#f0efea', thumbImage: 'thumbs/interior-panels/panel-white-texture.webp' },
    { key: 'panel-greige', label: t('Greige panel', 'Грейдж панел'), swatch: '#d8d6cd', thumbImage: 'thumbs/interior-panels/panel-greige.webp' },
    { key: 'panel-light-grey', label: t('Light grey panel', 'Светлосив панел'), swatch: '#cfd0ca', thumbImage: 'thumbs/interior-panels/panel-light-grey.webp' },
    { key: 'panel-pearl-grey', label: t('Pearl grey panel', 'Перлено сив панел'), swatch: '#c4c7ca', thumbImage: 'thumbs/interior-panels/panel-pearl-grey.webp' },
    { key: 'panel-oak-beige', label: t('Oak beige panel', 'Дъбово-бежов панел'), swatch: '#c7ad7f', thumbImage: 'thumbs/interior-panels/panel-oak-beige.webp' },
    { key: 'panel-dark-walnut', label: t('Dark walnut panel', 'Тъмен орехов панел'), swatch: '#5e5243', thumbImage: 'thumbs/interior-panels/panel-dark-walnut.webp' },
    { key: 'panel-olive-wood', label: t('Olive wood panel', 'Маслинено дърво'), swatch: '#505038', thumbImage: 'thumbs/interior-panels/panel-olive-wood.webp' },
    { key: 'panel-mahogany', label: t('Mahogany panel', 'Махагонов панел'), swatch: '#61200f', thumbImage: 'thumbs/interior-panels/panel-mahogany.webp' },
    { key: 'panel-stone-white', label: t('Stone white panel', 'Каменнобял панел'), swatch: '#ecece4', thumbImage: 'thumbs/interior-panels/panel-stone-white.webp' },
    { key: 'panel-concrete-grey', label: t('Concrete grey panel', 'Бетонносив панел'), swatch: '#c2c2bc', thumbImage: 'thumbs/interior-panels/panel-concrete-grey.webp' },
    { key: 'panel-graphite-stone', label: t('Graphite stone panel', 'Графитен камък'), swatch: '#5d6870', thumbImage: 'thumbs/interior-panels/panel-graphite-stone.webp' },
    { key: 'panel-mustard-gold', label: t('Mustard gold panel', 'Горчица злато'), swatch: '#c8a863', thumbImage: 'thumbs/interior-panels/panel-mustard-gold.webp' },
    { key: 'panel-warm-tan', label: t('Warm tan panel', 'Топъл тен панел'), swatch: '#c88d4f', thumbImage: 'thumbs/interior-panels/panel-warm-tan.webp' },
    { key: 'panel-wine-red', label: t('Wine red panel', 'Виненочервен панел'), swatch: '#4e0603', thumbImage: 'thumbs/interior-panels/panel-wine-red.webp' },
    { key: 'panel-deep-green', label: t('Deep green panel', 'Тъмнозелен панел'), swatch: '#35453f', thumbImage: 'thumbs/interior-panels/panel-deep-green.webp' },
    { key: 'panel-soft-sage', label: t('Soft sage panel', 'Сейдж панел'), swatch: '#c6c9c2', thumbImage: 'thumbs/interior-panels/panel-soft-sage.webp' },
    { key: 'panel-warm-white', label: t('Warm white panel', 'Топло бял панел'), swatch: '#ececef', thumbImage: 'thumbs/interior-panels/panel-warm-white.webp' },
    { key: 'panel-charcoal-blue', label: t('Charcoal blue panel', 'Въгленово син панел'), swatch: '#445256', thumbImage: 'thumbs/interior-panels/panel-charcoal-blue.webp' },
  ]

  const uvPanelOptions = [
    { key: 'uv-001', code: 'UV-001', label: t('Gloss white marble', 'Гланцов бял мрамор'), displayLabel: t('Gloss white marble', 'Гланцов бял мрамор'), summaryLabel: 'UV-001', swatch: '#f2f1ee', thumbImage: 'thumbs/uv/uv-001.webp' },
    { key: 'uv-002', code: 'UV-002', label: t('Soft marble vein', 'Мек мраморен жил'), displayLabel: t('Soft marble vein', 'Мек мраморен жил'), summaryLabel: 'UV-002', swatch: '#ddd8d2', thumbImage: 'thumbs/uv/uv-002.webp' },
    { key: 'uv-003', code: 'UV-003', label: t('Warm marble', 'Топъл мрамор'), displayLabel: t('Warm marble', 'Топъл мрамор'), summaryLabel: 'UV-003', swatch: '#ccb797', thumbImage: 'thumbs/uv/uv-003.webp' },
    { key: 'uv-004', code: 'UV-004', label: t('Concrete grey', 'Бетонно сиво'), displayLabel: t('Concrete grey', 'Бетонно сиво'), summaryLabel: 'UV-004', swatch: '#b7b7b2', thumbImage: 'thumbs/uv/uv-004.webp' },
    { key: 'uv-005', code: 'UV-005', label: t('Warm beige stone', 'Топъл бежов камък'), displayLabel: t('Warm beige stone', 'Топъл бежов камък'), summaryLabel: 'UV-005', swatch: '#d6ccb9', thumbImage: 'thumbs/uv/uv-005.webp' },
  ]

  const kitchenBenchOptions = [
  "yl-4003",
  "yl-1001",
  "yl-4108",
  "yl-6919",
  "yl-9001",
  "yl-6930",
  "yl-6926",
  "yl-7808",
  "yl-6908",
  "yl-6915",
  "yl-9011",
  "yl-9016",
  "yl-4008",
  "yl-7849",
  "yl-6905",
  "yl-6932",
  "yl-6947",
  "yl-6805",
  "yl-1016",
  "yl-6988",
  "yl-6903",
  "yl-6937",
  "yl-6902"
].map((key) => makeCodeOption(key, key.toUpperCase(), KITCHEN_BENCH_META[key], '', locale))
  const spcFloorOptions = [
  "spc-7005",
  "spc-7006",
  "spc-7007",
  "spc-7008",
  "spc-7009",
  "spc-8005",
  "spc-8006",
  "spc-8007",
  "spc-8008",
  "spc-8009",
  "spc-9005",
  "spc-9006",
  "spc-9007",
  "spc-9008",
  "spc-9009",
  "spc-9010",
  "spc-9011",
  "spc-9012"
].map((key) => makeCodeOption(key, key.split('-')[1], SPC_META[key], 'SPC', locale))
  const pvcFloorOptions = [
  "pvc-001",
  "pvc-002",
  "pvc-003",
  "pvc-004",
  "pvc-005",
  "pvc-006",
  "pvc-007",
  "pvc-008",
  "pvc-009",
  "pvc-010",
  "pvc-011",
  "pvc-012",
  "pvc-013",
  "pvc-014",
  "pvc-015",
  "pvc-016",
  "pvc-017",
  "pvc-018",
  "pvc-019",
  "pvc-020",
  "pvc-021",
  "pvc-022",
  "pvc-023",
  "pvc-024",
  "pvc-025",
  "pvc-026",
  "pvc-027",
  "pvc-028",
  "pvc-029",
  "pvc-030",
  "pvc-031",
  "pvc-032",
  "pvc-033",
  "pvc-034",
  "pvc-035",
  "pvc-036",
  "pvc-037",
  "pvc-038",
  "pvc-039",
  "pvc-040",
  "pvc-041",
  "pvc-042"
].map((key) => makeCodeOption(key, key.toUpperCase(), PVC_META[key], '', locale))
  const carbonCrystalOptions = [
  "carbon-gf005",
  "carbon-gf002",
  "carbon-wl6603",
  "carbon-wl6608",
  "carbon-wl6607",
  "carbon-wl5601"
].map((key) => makeCodeOption(key, ({
  "carbon-gf005": "GF005",
  "carbon-gf002": "GF002",
  "carbon-wl6603": "WL6603",
  "carbon-wl6608": "WL6608",
  "carbon-wl6607": "WL6607",
  "carbon-wl5601": "WL5601"
})[key], CARBON_META[key], 'Carbon Crystal', locale))

  const insideDoorStyleOptions = [
    { key: 'inside-01', label: t('Classic white', 'Класическа бяла'), thumbImage: 'thumbs/inside-doors/inside-01.webp', referenceImage: 'thumbs/inside-doors/inside-01.png' },
    { key: 'inside-02', label: t('Dark walnut', 'Тъмен орех'), thumbImage: 'thumbs/inside-doors/inside-02.webp', referenceImage: 'thumbs/inside-doors/inside-02.png' },
    { key: 'inside-03', label: t('Sage classic', 'Сейдж класик'), thumbImage: 'thumbs/inside-doors/inside-03.webp', referenceImage: 'thumbs/inside-doors/inside-03.png' },
    { key: 'inside-04', label: t('Light oak contour', 'Светъл дъб контур'), thumbImage: 'thumbs/inside-doors/inside-04.webp', referenceImage: 'thumbs/inside-doors/inside-04.png' },
    { key: 'inside-05', label: t('Charcoal segmented', 'Антрацит сегмент'), thumbImage: 'thumbs/inside-doors/inside-05.webp', referenceImage: 'thumbs/inside-doors/inside-05.png' },
    { key: 'inside-06', label: t('Taupe minimal', 'Тауп минимал'), thumbImage: 'thumbs/inside-doors/inside-06.webp', referenceImage: 'thumbs/inside-doors/inside-06.png' },
    { key: 'inside-07', label: t('Frosted glass white', 'Бяла с матирано стъкло'), thumbImage: 'thumbs/inside-doors/inside-07.webp', referenceImage: 'thumbs/inside-doors/inside-07.png' },
  ]

  const kitchenExtraOptions = [
    { key: 'furnace', label: t('Furnace cabinet', 'Шкаф за бойлер / котле') },
    { key: 'washingMachine', label: t('Washing machine slot', 'Ниша за пералня') },
    { key: 'dishwasherCabinet', label: t('Dishwasher cabinet', 'Шкаф за съдомиялна') },
  ]

  const pricing = {
    heatingPerM2: 38,
    frenchWindowOpenable: 200,
    frenchWindowFixed: 150,
    internalWallsBase37: INTERNAL_WALLS_BASE_37,
    insideDoorPerDoor: 130,
  }

  const references = {
    frame: 'window-frame-reference.png',
    windows: 'window-style-reference.png',
    doors: 'door-reference.png',
    specs: 'ref-page-11.webp',
    pricesStandard: 'ref-page-12.png',
    pricesBalcony: 'ref-page-13.png',
  }

  return {
    models,
    planOptions,
    bathroomOptions,
    kitchenOptions,
    windowFrameOptions,
    steelFrameColorOptions,
    windowStyleOptions,
    exteriorDoorOptions,
    exteriorFinishGroups,
    deckingColorOptions,
    interiorPanelColorOptions,
    uvPanelOptions,
    kitchenBenchOptions,
    spcFloorOptions,
    pvcFloorOptions,
    carbonCrystalOptions,
    insideDoorStyleOptions,
    kitchenExtraOptions,
    pricing,
    references,
  }
}
