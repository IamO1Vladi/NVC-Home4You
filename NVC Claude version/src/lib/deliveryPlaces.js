// Delivery places: the offline town/village table behind the delivery page's "type your town"
// box. Pure functions, no React.
//
// The data is two column-array JSON chunks, src/content/shared/deliveryPlaces/bg.json and
// gr.json, written by scripts/delivery/build-distances.mjs (see its header for the inputs,
// the OSRM routing and the cross-border method). Place names and road distances are derived
// from OpenStreetMap data, © OpenStreetMap contributors, available under the ODbL.
//
// Chunk format (one per country):
//   {
//     "v": "2026-10-15",            // data version
//     "c": "BG" | "GR",             // country
//     "scale": 10000,               // lat/lon are stored as integers × scale (4 decimals)
//     "regions": [[native, latin]], // BG oblast (Cyrillic + Latin) / GR regional unit (Greek + Latin)
//     "cols": ["name","bg","en","el","r","t","lat","lon","km","kmV"],
//     "data": { "<col>": [ ...one value per place... ] }
//   }
//   name  native name (BG Cyrillic, GR Greek)
//   bg    name:bg when it differs from name, else ""
//   en    name:en / int_name / name:latin when it differs from romanize(name), else ""
//   el    name:el when it differs from name, else ""
//   r     index into regions, or -1
//   t     3 = city, 2 = town, 1 = village
//   lat, lon  integers, divide by scale
//   km    one-way road km from Marikostinovo (integer), null = unroutable ("on request")
//   kmV   one-way road km from Varna (integer), null = unroutable

export const BASES = Object.freeze({
  marikostinovo: Object.freeze({ lat: 41.43165, lon: 23.33813 }),
  varna: Object.freeze({ lat: 43.2141, lon: 27.9147 }),
})

export const PLACE_COLUMNS = Object.freeze(['name', 'bg', 'en', 'el', 'r', 't', 'lat', 'lon', 'km', 'kmV'])

const TYPE_NAMES = { 3: 'city', 2: 'town', 1: 'village' }

// ---------------------------------------------------------------------------------------------
// Normalisation: Cyrillic, Greek and Latin all fold to one Latin "skeleton", so the same town
// typed in any script lands on the same key. The skeleton is for matching only, never shown.

const CYR_SKELETON = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: '', ю: 'iu', я: 'ia', ѝ: 'i', ё: 'io',
  ы: 'i', э: 'e', і: 'i', ї: 'i', є: 'e', ґ: 'g', ј: 'i', љ: 'li', њ: 'ni', ѓ: 'g', ќ: 'k',
  џ: 'dz', ѕ: 'dz', ђ: 'd', ћ: 'c',
}

const GREEK_SKELETON_PAIRS = {
  ου: 'u', ει: 'i', οι: 'i', αι: 'e', υι: 'i', αυ: 'av', ευ: 'ev', ηυ: 'iv',
  μπ: 'b', ντ: 'd', γκ: 'g', γγ: 'g', γξ: 'ks', γχ: 'h', τσ: 'ts', τζ: 'z',
}

const GREEK_SKELETON = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 't', ι: 'i', κ: 'k', λ: 'l',
  μ: 'm', ν: 'n', ξ: 'ks', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'i', φ: 'f',
  χ: 'h', ψ: 'ps', ω: 'o',
}

const DIAERESIS = '̈'

// Lower-case, decompose, and drop every combining mark except the Greek diaeresis (which
// splits a diphthong: "αϊ" is two sounds, "αι" is one).
function decompose(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-̇̉-ͯ]/g, '')
}

function greekToSkeleton(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (!(c in GREEK_SKELETON)) {
      out += c
      continue
    }
    const pair = c + (s[i + 1] ?? '')
    if (pair in GREEK_SKELETON_PAIRS && s[i + 2] !== DIAERESIS) {
      out += GREEK_SKELETON_PAIRS[pair]
      i += 1
      continue
    }
    out += GREEK_SKELETON[c]
  }
  return out
}

function cyrillicToSkeleton(s) {
  let out = ''
  for (const c of s) out += c in CYR_SKELETON ? CYR_SKELETON[c] : c
  return out
}

const LATIN_FOLDS = [
  [/ß/g, 'ss'], [/æ/g, 'ae'], [/ø/g, 'o'], [/ł/g, 'l'], [/đ/g, 'd'], [/œ/g, 'oe'],
  // "dj" is the French-style spelling of дж (Kardjali = Кърджали = Kardzhali).
  [/dj/g, 'dz'],
  [/y/g, 'i'], [/j/g, 'i'], [/w/g, 'v'], [/q/g, 'k'],
  [/kh/g, 'h'], [/ch/g, 'h'], [/ph/g, 'f'], [/th/g, 't'], [/sh/g, 's'], [/zh/g, 'z'],
  [/ou/g, 'u'], [/ei/g, 'i'], [/oi/g, 'i'], [/ai/g, 'e'], [/af/g, 'av'], [/ef/g, 'ev'],
  [/\bmp/g, 'b'], [/\bnt/g, 'd'], [/gk/g, 'g'],
  [/c/g, 'k'], [/x/g, 'ks'],
  [/([a-z])\1+/g, '$1'],
]

/**
 * Fold any spelling of a place name (Cyrillic, Greek, Latin, any accents) to a lower-case
 * Latin skeleton used only for matching. "Бургас", "Burgas" and "Μπουργκάς" all give "burgas";
 * "Паралия Кариани" gives "paralia kariani", a prefix of Παραλία Καριανής → "paralia karianis".
 */
export function normalize(input) {
  let s = decompose(input)
  s = greekToSkeleton(s)
  s = cyrillicToSkeleton(s)
  s = s.replace(/[̀-ͯ]/g, '')
  for (const [re, to] of LATIN_FOLDS) s = s.replace(re, to)
  return s.replace(/[^a-z0-9]+/g, ' ').trim()
}

// ---------------------------------------------------------------------------------------------
// Romanisation for display (not matching): Bulgarian Streamlined System, Greek ELOT 743
// (simplified). Used when a place has no Latin name of its own.

const CYR_DISPLAY = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya', ѝ: 'i', ё: 'yo',
}

const GREEK_DISPLAY = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l',
  μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f',
  χ: 'ch', ψ: 'ps', ω: 'o',
}
const GREEK_VOICELESS = new Set(['θ', 'κ', 'ξ', 'π', 'σ', 'ς', 'τ', 'φ', 'χ', 'ψ'])
const isGreekLetter = (c) => c !== undefined && c in GREEK_DISPLAY

function greekToDisplay(s) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const n = s[i + 1]
    if (!isGreekLetter(c)) {
      if (c !== DIAERESIS) out += c
      continue
    }
    const wordStart = !isGreekLetter(s[i - 1])
    const pairOk = n !== undefined && s[i + 2] !== DIAERESIS
    if (pairOk) {
      const pair = c + n
      if (pair === 'ου') { out += 'ou'; i++; continue }
      if (pair === 'αυ' || pair === 'ευ' || pair === 'ηυ') {
        const after = s[i + 2]
        const f = after === undefined || !isGreekLetter(after) || GREEK_VOICELESS.has(after)
        out += GREEK_DISPLAY[c] + (f ? 'f' : 'v')
        i++
        continue
      }
      if (pair === 'μπ') { out += wordStart ? 'b' : 'mp'; i++; continue }
      if (pair === 'ντ') { out += wordStart ? 'd' : 'nt'; i++; continue }
      if (pair === 'γγ') { out += 'ng'; i++; continue }
      if (pair === 'γκ') { out += wordStart ? 'g' : 'gk'; i++; continue }
      if (pair === 'γξ') { out += 'nx'; i++; continue }
      if (pair === 'γχ') { out += 'nch'; i++; continue }
    }
    out += GREEK_DISPLAY[c]
  }
  return out
}

function cyrillicToDisplay(s) {
  // "-ия" at the end of a word is "-ia" (София → Sofia), per the Streamlined System.
  const t = s.replace(/ия(?=$|[^а-яѝё])/g, 'ia')
  let out = ''
  for (const c of t) out += c in CYR_DISPLAY ? CYR_DISPLAY[c] : c
  return out
}

function titleCase(s) {
  return s.replace(/(^|[\s\-‐(/'’.])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase())
}

/** A readable Latin form of a Bulgarian or Greek name ("Παραλία Καριανής" → "Paralia Karianis"). */
export function romanize(name) {
  if (!name) return ''
  // Cyrillic first, on composed text: decomposing would turn й into и + breve.
  const cyr = cyrillicToDisplay(String(name).normalize('NFC').toLowerCase())
  const latin = greekToDisplay(decompose(cyr)).replace(/[̀-ͯ]/g, '')
  return titleCase(latin)
}

const hasCyrillic = (s) => /[Ѐ-ӿ]/.test(s)
const hasGreek = (s) => /[Ͱ-Ͽἀ-῿]/.test(s)

// ---------------------------------------------------------------------------------------------
// The other country's names in the reader's own script. A Bulgarian reader of a Greek village
// gets it in Cyrillic, a Greek reader of a Bulgarian one in Greek, never the Latin fallback
// (which put "Kariani · Kavala" beside "Кариани" in the page's own table). These spell the
// name as it sounds: OSM's name:bg for Greek places is mostly the Ottoman-era or historical
// Bulgarian name (Кале чифлик for Νέα Πέραμος, Дедеагач for Αλεξανδρούπολη), which nobody
// types today and a salesperson cannot find on a map.

const GREEK_CYR = {
  α: 'а', β: 'в', γ: 'г', δ: 'д', ε: 'е', ζ: 'з', η: 'и', θ: 'т', ι: 'и', κ: 'к', λ: 'л',
  μ: 'м', ν: 'н', ξ: 'кс', ο: 'о', π: 'п', ρ: 'р', σ: 'с', ς: 'с', τ: 'т', υ: 'и', φ: 'ф',
  χ: 'х', ψ: 'пс', ω: 'о',
}
// Written once in Bulgarian: Ελασσόνα → Еласона, Ιερισσός → Иерисос.
const GREEK_DOUBLES = new Set(['λ', 'ν', 'π', 'σ', 'ρ', 'μ', 'τ', 'κ'])

/** "Νέα Πέραμος" → "Неа Перамос", "Νέα Ηρακλείτσα" → "Неа Ираклица", "Κάριανη" → "Кариани". */
export function greekToCyrillic(name) {
  const s = decompose(name)
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const n = s[i + 1]
    if (!isGreekLetter(c)) {
      if (c !== DIAERESIS) out += c
      continue
    }
    const wordStart = !isGreekLetter(s[i - 1])
    const pairOk = n !== undefined && s[i + 2] !== DIAERESIS
    if (pairOk) {
      const pair = c + n
      if (wordStart && pair === 'γι' && s[i + 2] === 'α') { out += 'я'; i += 2; continue }
      if (wordStart && pair === 'γι' && s[i + 2] === 'ο' && s[i + 3] === 'υ') { out += 'ю'; i += 3; continue }
      if (pair === 'ου') { out += 'у'; i++; continue }
      if (pair === 'αι') { out += 'е'; i++; continue }
      if (pair === 'ει' || pair === 'οι' || pair === 'υι') { out += 'и'; i++; continue }
      if (pair === 'αυ' || pair === 'ευ') {
        const after = s[i + 2]
        const f = after === undefined || !isGreekLetter(after) || GREEK_VOICELESS.has(after)
        out += GREEK_CYR[c] + (f ? 'ф' : 'в')
        i++
        continue
      }
      if (pair === 'μπ') { out += wordStart ? 'б' : 'мп'; i++; continue }
      if (pair === 'ντ') { out += wordStart ? 'д' : 'нт'; i++; continue }
      if (pair === 'γκ') { out += wordStart ? 'г' : 'нг'; i++; continue }
      if (pair === 'γγ') { out += 'нг'; i++; continue }
      if (pair === 'τσ') { out += 'ц'; i++; continue }
      if (pair === 'τζ') { out += 'дз'; i++; continue }
      // "-ία" at the end of a word is "-ия" (Αγία → Агия, Πιερία → Пиерия).
      if (pair === 'ια' && !isGreekLetter(s[i + 2])) { out += 'ия'; i++; continue }
      if (c === n && GREEK_DOUBLES.has(c)) { out += GREEK_CYR[c]; i++; continue }
    }
    out += GREEK_CYR[c]
  }
  return titleCase(out)
}

const CYR_GREEK = {
  а: 'α', б: 'μπ', в: 'β', г: 'γκ', д: 'ντ', е: 'ε', ж: 'ζ', з: 'ζ', и: 'ι', й: 'ι', к: 'κ',
  л: 'λ', м: 'μ', н: 'ν', о: 'ο', п: 'π', р: 'ρ', с: 'σ', т: 'τ', у: 'ου', ф: 'φ', х: 'χ',
  ц: 'τσ', ч: 'τσ', ш: 'σ', щ: 'στ', ъ: 'α', ь: 'ι', ю: 'ιου', я: 'ια', ѝ: 'ι',
}
const isCyrLetter = (c) => c !== undefined && c in CYR_GREEK

/**
 * "Стара Кресна" → "Σταρα Κρεσνα", without the accent a Greek name would carry: where the
 * stress falls is not written in Bulgarian. The towns a Greek reader is likely to look up
 * have their accented name from OSM or NAME_FIXES; this is for the villages that have none.
 */
export function cyrillicToGreek(name) {
  const s = String(name ?? '').normalize('NFC').toLowerCase().replace(/[\u0300-\u036f]/g, '')
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (!isCyrLetter(c)) {
      out += c
      continue
    }
    const wordStart = !isCyrLetter(s[i - 1])
    if (c === 'д' && s[i + 1] === 'ж') { out += 'τζ'; i++; continue }
    // мб, нд, нг are what μπ, ντ, γκ already say (Ямбол → Γιάμπολ, Сандански → Σαντάνσκι).
    if (c === 'м' && s[i + 1] === 'б') { out += 'μπ'; i++; continue }
    if (c === 'н' && s[i + 1] === 'д') { out += 'ντ'; i++; continue }
    if (c === 'н' && s[i + 1] === 'г') { out += 'γκ'; i++; continue }
    if (wordStart && c === 'я') { out += 'για'; continue }
    if (wordStart && c === 'ю') { out += 'γιου'; continue }
    out += CYR_GREEK[c]
  }
  // A final sigma at the end of every word.
  return titleCase(out.replace(/σ(?=$|[^\p{L}])/gu, 'ς'))
}

// The other country's regions in the reader's script, by the chunk's own names: the Bulgarian
// oblasts in Greek (by the Cyrillic name), the Greek regional units in Bulgarian (by the Latin
// one; the chunk's Greek is a genitive with "Π.Ε." in front). Hand-written, as an atlas writes
// them; a region missing here shows no region rather than a Latin one.
const REGION_EL = {
  Враца: 'Βράτσα', Кюстендил: 'Κιουστεντίλ', Софийска: 'Περιφέρεια Σόφιας', Благоевград: 'Μπλαγκόεβγκραντ',
  Перник: 'Πέρνικ', Монтана: 'Μοντάνα', 'София-град': 'Σόφια', 'Стара Загора': 'Στάρα Ζαγόρα',
  Бургас: 'Μπουργκάς', 'Велико Търново': 'Βέλικο Τάρνοβο', Кърджали: 'Κάρτζαλι', Ловеч: 'Λόβετς',
  Плевен: 'Πλέβεν', Смолян: 'Σμόλιαν', Хасково: 'Χάσκοβο', Пазарджик: 'Πάζαρτζικ', Пловдив: 'Φιλιππούπολη',
  Габрово: 'Γκάμπροβο', Сливен: 'Σλίβεν', Ямбол: 'Γιάμπολ', Търговище: 'Τάργκοβιστε', Шумен: 'Σούμεν',
  Варна: 'Βάρνα', Видин: 'Βιδίνιο', Силистра: 'Σιλίστρα', Русе: 'Ρούσε', Разград: 'Ράζγκραντ', Добрич: 'Ντόμπριτς',
}
const REGION_BG = {
  Chania: 'Ханя', Islands: 'Острови', Messenia: 'Месиния', Laconia: 'Лакония', Lasithi: 'Ласити',
  Rethymno: 'Ретимно', Milos: 'Милос', Thira: 'Санторини', Kalymnos: 'Калимнос', Heraklion: 'Ираклио',
  'Karpathos-Kasos': 'Карпатос и Касос', Kos: 'Кос', Kefallonia: 'Кефалония', Corfu: 'Корфу',
  Thesprotia: 'Теспротия', Preveza: 'Превеза', Larisa: 'Лариса', Phthiotis: 'Фтиотида', Magnesia: 'Магнезия',
  Boeotia: 'Беотия', Euboea: 'Евбея', Chalkidiki: 'Халкидики', Achaia: 'Ахая', Arcadia: 'Аркадия',
  Argolis: 'Арголида', 'Aetolia-Acarnania': 'Етолия и Акарнания', Elis: 'Илия', Grevena: 'Гревена',
  Sporades: 'Спорадите', Zakynthos: 'Закинтос', Corinthia: 'Коринтия', 'West Attica': 'Западна Атика',
  Arta: 'Арта', Lefkada: 'Лефкада', Ithaca: 'Итака', Evrytania: 'Евритания', Ioannina: 'Янина',
  Karditsa: 'Кардица', Trikala: 'Трикала', Phocis: 'Фокида', 'Kea-Kythnos': 'Кеа и Китнос', Chios: 'Хиос',
  Lesbos: 'Лесбос', Paros: 'Парос', Syros: 'Сирос', Mykonos: 'Миконос', 'East Attica': 'Източна Атика',
  'Central Athens': 'Централна Атина', Piraeus: 'Пирея', 'West Athens': 'Западна Атина', Andros: 'Андрос',
  Tinos: 'Тинос', Naxos: 'Наксос', Ikaria: 'Икария', Samos: 'Самос', Lemnos: 'Лимнос', Pieria: 'Пиерия',
  Thessaloniki: 'Солун', Serres: 'Сяр', Kastoria: 'Костур', Florina: 'Лерин', Pella: 'Пела', Kozani: 'Козани',
  Imathia: 'Иматия', Kilkis: 'Кукуш', Kavala: 'Кавала', Rodopi: 'Родопи', Evros: 'Еврос', Thasos: 'Тасос',
  Drama: 'Драма', Xanthi: 'Ксанти', Rhodes: 'Родос',
}

// ---------------------------------------------------------------------------------------------
// Decoding and loading

// Display names the OSM data gets wrong for a reader, fixed when a chunk is decoded; the OSM
// name stays a search key. OSM's name:el for Бургас is the historical "Πύργος" (a Greek reader
// today knows it as Μπουργκάς, as the page's example table says), for Царево the archaic
// "Βασιλικόν Πύργου", and some are misspelt (Μαρικονστίνοβο, Κούμοβγκραντ). For a Greek place
// the Bulgarian names below are the ones Bulgarian still uses today (Солун, Сяр, Костур...);
// any other OSM name:bg is shown only when it spells the Greek name (Лариса, Ханя), otherwise
// the Greek name is spelt out in Cyrillic.
const NAME_FIXES = {
  BG: {
    Бургас: { el: 'Μπουργκάς' },
    Марикостиново: { el: 'Μαρικοστίνοβο' },
    Крумовград: { el: 'Κρούμοβγκραντ' },
    Царево: { el: 'Τσάρεβο' },
    'Гоце Делчев': { el: 'Γκότσε Ντέλτσεβ' },
    Ивайловград: { el: 'Ιβάιλοβγκραντ' },
    Светослав: { el: 'Σβέτοσλαβ' },
  },
  GR: {
    Θεσσαλονίκη: { bg: 'Солун' },
    Σέρρες: { bg: 'Сяр' },
    Καβάλα: { bg: 'Кавала' },
    Δράμα: { bg: 'Драма' },
    Ξάνθη: { bg: 'Ксанти' },
    Αθήνα: { bg: 'Атина' },
    Πειραιάς: { bg: 'Пирея' },
    Ιωάννινα: { bg: 'Янина' },
    Κέρκυρα: { bg: 'Корфу' },
    Φλώρινα: { bg: 'Лерин' },
    Καστοριά: { bg: 'Костур' },
    Έδεσσα: { bg: 'Воден' },
    Κιλκίς: { bg: 'Кукуш' },
    Αλεξανδρούπολη: { bg: 'Александруполис' },
    Κομοτηνή: { bg: 'Комотини' },
  },
}

// Whether OSM's other-script name only spells the native one (Лариса for Λάρισα, "Паралия
// Кариани" for "Παραλία Καριανής"), rather than being another name altogether (Седес for Θέρμη).
function spells(other, native) {
  const a = normalize(other)
  const b = normalize(native)
  return Boolean(a && b) && (a === b || a.startsWith(b) || b.startsWith(a))
}

// Builds the row decoder for one column-array chunk.
function chunkDecoder(chunk) {
  if (!chunk || !chunk.data || !Array.isArray(chunk.data.name)) {
    throw new Error('deliveryPlaces: malformed chunk')
  }
  const { c: country, data } = chunk
  const scale = chunk.scale || 10000
  const regions = (chunk.regions || []).map(([native, latin]) => ({
    native,
    latin: latin || romanize(native),
    // The region for the other country's reader, in their script ('' when not listed).
    foreign: (country === 'GR' ? REGION_BG[latin] : REGION_EL[native]) || '',
  }))
  const col = (k, i, d) => (Array.isArray(data[k]) ? data[k][i] : d)
  const row = (i) => {
    const name = data.name[i]
    const bgOsm = col('bg', i, '') || ''
    const en = col('en', i, '') || ''
    const elOsm = col('el', i, '') || ''
    const fix = NAME_FIXES[country]?.[name] || {}
    // The name in each local script: the native one, a fix, OSM's when it is the same name,
    // or the native one spelt out.
    let bg
    let el
    if (country === 'GR') {
      // A few OSM name:el values are in Latin letters; the Greek name is then shown instead.
      el = (hasGreek(elOsm) && !/[A-Za-z]/.test(elOsm) ? elOsm : '') || (hasGreek(name) ? name : '')
      bg = fix.bg || (bgOsm && spells(bgOsm, name) ? bgOsm : '') || (hasGreek(name) ? greekToCyrillic(name) : bgOsm)
    } else {
      bg = bgOsm || (hasCyrillic(name) ? name : '')
      el = fix.el || elOsm || (hasCyrillic(bg) ? cyrillicToGreek(bg) : '')
    }
    const r = col('r', i, -1)
    const rank = col('t', i, 1)
    const km = col('km', i, null)
    const kmV = col('kmV', i, null)
    const place = {
      country,
      name,
      bg,
      el,
      en: en || romanize(name),
      region: r >= 0 && regions[r] ? regions[r] : null,
      rank,
      type: TYPE_NAMES[rank] || 'village',
      lat: data.lat[i] / scale,
      lon: data.lon[i] / scale,
      km: {
        marikostinovo: km === undefined ? null : km,
        varna: kmV === undefined ? null : kmV,
      },
    }
    const keys = new Set()
    for (const v of new Set([name, bg, bgOsm, en, el, elOsm, place.en])) {
      const k = normalize(v)
      if (k) keys.add(k)
    }
    // ъ is also written "u" in older and foreign spellings (Turnovo, Kurdzhali).
    const native = place.bg || name
    if (native.includes('ъ') || native.includes('Ъ')) {
      keys.add(normalize(native.replace(/ъ/g, 'у').replace(/Ъ/g, 'У')))
    }
    Object.defineProperty(place, 'keys', { value: [...keys], enumerable: false })
    return place
  }
  return { n: data.name.length, row }
}

/** Turn one column-array chunk into place objects (with their match keys precomputed). */
export function decodeChunk(chunk) {
  const { n, row } = chunkDecoder(chunk)
  const places = new Array(n)
  for (let i = 0; i < n; i++) places[i] = row(i)
  return places
}

// The same, in slices of a few milliseconds with a yield between them. Folding ~15-20k names
// costs a few hundred ms on a desktop and over a second on a mid-range phone; done in one go
// that would freeze the page the moment the table arrives.
const SLICE_MS = 8
const yieldToPage = () => new Promise((r) => setTimeout(r, 0))
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

async function decodeChunkSliced(chunk) {
  const { n, row } = chunkDecoder(chunk)
  const places = new Array(n)
  let t = now()
  for (let i = 0; i < n; i++) {
    places[i] = row(i)
    if ((i & 63) === 63 && now() - t > SLICE_MS) {
      await yieldToPage()
      t = now()
    }
  }
  return places
}

const NOT_BUILT =
  'Delivery places data has not been built yet: run scripts/delivery/build-distances.mjs ' +
  '(writes src/content/shared/deliveryPlaces/bg.json and gr.json).'

// The two chunks are split into their own bundles by Vite and fetched in parallel on first
// use, so the table never weighs on the page that merely links to it. import.meta.glob (not a
// plain import()) keeps the build green before the data exists: no match is an empty object.
function defaultLoaders() {
  return import.meta.glob(
    ['../content/shared/deliveryPlaces/bg.json', '../content/shared/deliveryPlaces/gr.json'],
    { import: 'default' },
  )
}

let cached = null

/**
 * Load both countries' places (BG first, then GR), decoded and cached.
 * @param {{loaders?: Record<string, () => Promise<object>>}} [opts] loaders for tests; the
 *   default is the two JSON chunks. Calls with custom loaders are not cached.
 */
export function loadPlaces(opts = {}) {
  if (opts.loaders) return loadFrom(opts.loaders)
  if (!cached) {
    cached = loadFrom(defaultLoaders()).catch((err) => {
      cached = null
      throw err
    })
  }
  return cached
}

async function loadFrom(loaders) {
  const fns = Object.keys(loaders).sort().map((k) => loaders[k])
  if (fns.length < 2) throw new Error(NOT_BUILT)
  const chunks = await Promise.all(fns.map((f) => f()))
  const ordered = chunks
    .map((c) => (c && c.default && c.default.data ? c.default : c))
    .sort((a, b) => (a.c === b.c ? 0 : a.c === 'BG' ? -1 : 1))
  let places = []
  for (const c of ordered) places = places.concat(await decodeChunkSliced(c))
  return places
}

/** Forget the cached table (tests). */
export function forgetPlaces() {
  cached = null
}

// ---------------------------------------------------------------------------------------------
// Display

/**
 * The name to show for a locale: bg → Cyrillic, el → Greek (the other country's places spelt
 * out in that script when they have no name of their own in it), en → Latin.
 */
export function displayName(place, locale = 'en') {
  if (!place) return ''
  if (locale === 'bg') return place.bg || place.en || place.name
  if (locale === 'el') return place.el || place.en || place.name
  return place.en || romanize(place.name) || place.name
}

/**
 * The region to show for a locale: the native one for the reader's own country, the
 * hand-written one in the reader's script for the other ('' when there is none: never Latin
 * on a Bulgarian or Greek page), and the Latin one in English.
 */
export function displayRegion(place, locale = 'en') {
  const r = place && place.region
  if (!r) return ''
  if (locale === 'bg') return place.country === 'BG' ? r.native : r.foreign || ''
  if (locale === 'el') return place.country === 'GR' ? r.native : r.foreign || ''
  return r.latin || r.native
}

// ---------------------------------------------------------------------------------------------
// Search

// Words that belong to a pasted street address, not to the town. Listed as typed and folded
// through normalize(), because search compares folded words ("street" folds to "stret",
// "площад" to "plostad"). STREET_WORDS also mark a comma part as the street, not the town.
const fold = (words) => new Set(words.map(normalize))
const STREET_WORDS = fold([
  'ul', 'ulitsa', 'bul', 'bulevard', 'zk', 'kv', 'pl', 'ploshtad', 'bl', 'vh', 'et', 'ap',
  'odos', 'od', 'leof', 'leoforos', 'plateia', 'str', 'street', 'st', 'ave', 'avenue', 'blvd',
  'road', 'rd',
])
const ADDRESS_WORDS = new Set([
  ...STREET_WORDS,
  ...fold([
    'gr', 'grad', 'selo', 'obl', 'oblast', 'obshtina', 'pk', 'tk', 'dimos', 'nomos', 'periferia',
    'no', 'nr', 'bulgaria', 'balgaria', 'greece', 'elas', 'elada', 'hellas',
  ]),
])

// "Beach of" words. Paralia Kariani, the published case, is the village Κάριανη in OSM; the
// beach is no place of its own. When a two-word query matches nothing whole and is retried word
// by word, these words are skipped, or the village called simply Παραλία would win.
const BEACH_WORDS = fold(['Παραλία', 'Паралия', 'Paralia', 'плаж', 'plazh', 'beach'])

// A query part, cleaned of address words, numbers and initials; `street` when it named a street.
function cleanPart(part) {
  const all = normalize(part).split(' ')
  const q = all.filter((w) => w.length > 1 && !/\d/.test(w) && !ADDRESS_WORDS.has(w)).join(' ')
  return { q, street: all.some((w) => STREET_WORDS.has(w)) }
}

function matchTier(q, qWords, key) {
  if (key === q) return 3
  if (key.startsWith(q)) return 2
  const kWords = key.split(' ')
  const used = new Array(kWords.length).fill(false)
  for (const w of qWords) {
    const j = kWords.findIndex((kw, idx) => !used[idx] && kw.startsWith(w))
    if (j < 0) return 0
    used[j] = true
  }
  return 1
}

function nearestKm(place) {
  const { marikostinovo: m, varna: v } = place.km
  if (m == null && v == null) return Infinity
  return Math.min(m ?? Infinity, v ?? Infinity)
}

function rank(qs, places) {
  const hits = []
  for (const place of places) {
    let score = 0
    for (const { q, words, street } of qs) {
      for (const key of place.keys) {
        const t = matchTier(q, words, key)
        // A hit in the street part of an address ranks just below the same hit elsewhere.
        const sc = t && t * 2 - (street ? 1 : 0)
        if (sc > score) score = sc
      }
      if (score === 6) break
    }
    if (score > 0) hits.push({ place, score, tier: Math.ceil(score / 2) })
  }
  return hits
}

/**
 * Ranked suggestions for what a visitor typed: exact > prefix > word-prefix; ties go to the
 * bigger place, then the shorter distance. A pasted address is split at commas and each part
 * is tried, so "София, бул. Черни връх 1" still finds Sofia (and ranks it above the village
 * Черни връх, because that part is the street). An address without commas that matches
 * nothing as a whole is retried word by word ("Бургас ул. Александровска 12").
 * @returns {{place: object, name: string, region: string, tier: number}[]}
 */
export function search(query, places, { limit = 8, locale = 'en' } = {}) {
  if (!query || !places || places.length === 0) return []
  const raw = String(query)
  const parts = [raw, ...(raw.includes(',') ? raw.split(',') : [])].map(cleanPart).filter((p) => p.q)
  if (parts.length === 0) return []
  const seen = new Set()
  const qs = []
  for (const p of parts) {
    if (seen.has(p.q)) continue
    seen.add(p.q)
    qs.push({ ...p, words: p.q.split(' ') })
  }

  let hits = rank(qs, places)
  if (hits.length === 0) {
    const singles = []
    for (const p of qs) {
      if (p.words.length < 2) continue
      for (const w of p.words) {
        if (w.length < 3 || BEACH_WORDS.has(w)) continue
        // A Greek genitive folds to the name plus "s": "Παραλία Καριανής" (the beach of
        // Κάριανη) is tried as "karianis" and as "kariani".
        for (const v of w.length > 4 && w.endsWith('s') ? [w, w.slice(0, -1)] : [w]) {
          if (seen.has(v)) continue
          seen.add(v)
          singles.push({ q: v, words: [v], street: p.street })
        }
      }
    }
    if (singles.length) hits = rank(singles, places)
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.place.rank - a.place.rank ||
      nearestKm(a.place) - nearestKm(b.place) ||
      displayName(a.place, locale).length - displayName(b.place, locale).length,
  )
  return hits.slice(0, limit).map(({ place, tier }) => ({
    place,
    tier,
    name: displayName(place, locale),
    region: displayRegion(place, locale),
  }))
}

// ---------------------------------------------------------------------------------------------
// Geometry and distances

const R_KM = 6371.0088

/** Great-circle distance in km. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180
  const dLat = (lat2 - lat1) * toRad
  const dLon = (lon2 - lon1) * toRad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * The place nearest to a map tap.
 * @returns {{place: object, km: number} | null} null when there are no places, or the nearest
 *   is further than maxKm.
 */
export function nearestPlace(lat, lon, places, { maxKm = Infinity } = {}) {
  if (!places || places.length === 0 || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const cosLat = Math.cos((lat * Math.PI) / 180)
  let best = null
  let bestD = Infinity
  for (const p of places) {
    const dx = (p.lon - lon) * cosLat
    const dy = p.lat - lat
    const d = dx * dx + dy * dy
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  const km = haversineKm(lat, lon, best.lat, best.lon)
  return km <= maxKm ? { place: best, km } : null
}

/**
 * One-way road km for a product. Box houses ship from Marikostinovo or Varna, whichever is
 * nearer; containers and projects ship from Marikostinovo.
 * @returns {{km: number|null, base: 'marikostinovo'|'varna'|null}} km null = on request.
 */
export function distanceFor(place, product = 'box') {
  if (!place || !place.km) return { km: null, base: null }
  const m = place.km.marikostinovo ?? null
  const v = place.km.varna ?? null
  if (product === 'box') {
    if (m == null && v == null) return { km: null, base: null }
    if (v != null && (m == null || v < m)) return { km: v, base: 'varna' }
    return { km: m, base: 'marikostinovo' }
  }
  return m == null ? { km: null, base: null } : { km: m, base: 'marikostinovo' }
}
