// src/content/bg/modularHouses.js
//
// The words of the modular houses page (/bg/modulni-kysthi). No price is written here: every
// figure on the page is computed from the gallery rows (src/lib/productRows.js) and printed
// with euro(); a pattern below marks where one goes with {price}, {house} or {assembly}.
// The title, description and breadcrumb come from routeMeta.js through the route, so this
// file has no seo block any more.
//
// Every fact is one the gallery, the configurator catalogue or the published case already
// states, or one the owner gave us (2026-10-12): the Box house sizes, frame, walls and glazing
// are the gallery descriptions'; the capsule lines are gallery item 100015's and nothing more;
// the hero photo and the proof card are the Paralia Kariani case on /api/cases-page; the
// delivery line (Bulgaria and Greece, other countries on request) is the owner's answer of
// 2026-10-15, and what that case in Greece shows. It also carries the page's place name for search, with the title. Do not
// add a lead time, a permit or a foundation recommendation here; there is none we can stand
// behind yet. The "not included" list is NOT here either: the page reads it from pricesCopy so
// this page and /bg/ceni say it in the same words.
export default {
  hero: {
    eyebrow: 'Разгъваеми къщи и капсули',
    h1: 'Модулни къщи за постоянно живеене',
    lead: 'Разгъваеми (Бокс) къщи от 18 до 74 м², които пристигат сгънати и се разгъват на място, и капсула от 38 м². Изберете размер и сглобете къщата си онлайн.',
    from: 'от',
    basis: 'къщата с ДДС, без монтаж',
    build: 'Сглоби онлайн',
    offer: 'Заяви оферта',
    facts: [
      'Напълно оборудвана баня',
      'Ел. и ВиК инсталация, изградени във фабриката',
      'Рамка от поцинкована стомана',
    ],
    // The default photo: the delivered 58 m² house from the published case. An admin photo
    // (/admin/home-photos, the page-modular-houses slot) replaces it and drops the chip,
    // since the chip names this house and the admin's photo may show another.
    photo: {
      url: '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
      alt: 'Разгъваема къща от 58 м² с веранда, доставена в Паралия Кариани, Гърция',
      position: '50% 45%',
    },
    adminAlt: 'Разгъваема модулна къща на NVC Home4You',
  },

  // The published case (/api/cases-page, id "2"). The API's text is Bulgarian only, so the
  // line, the result and the buyer's name are written here once per language; the photos,
  // the quote and the rating are read from the API, and the card is not drawn if the case is
  // ever unpublished.
  case: {
    id: '2',
    line: '58 м² с веранда · Паралия Кариани, Гърция · 2026',
    result: 'Доставена и монтирана до ключ.',
    name: 'Вангелис',
  },

  sizes: {
    heading: 'Изберете размер на разгъваемата къща',
    sub: 'Цената на къщата е с ДДС, а монтажът е отделно и е показан под нея. Моделите 37, 58 и 73 м² можете да сглобите в конфигуратора.',
    allPrices: 'Пълната таблица с цени →',
    allPhotos: 'Снимки на всички модулни къщи →',
    basis: 'с ДДС, без монтаж',
    assembly: '+ монтаж {price} с ДДС',
    assemblyOnRequest: 'Монтаж по запитване',
    variant: 'С веранда и двоен покрив: {house} + монтаж {assembly}',
    variantOnRequest: 'С веранда и двоен покрив: {house}, монтаж по запитване',
    build: 'Сглоби онлайн',
    ask: 'Заяви оферта за този модел',
    more: 'Подробно →',
    // One line per card, keyed by gallery id: what this size has that the others do not.
    diff: {
      100016: 'Най-малкият модел, с напълно оборудвани баня и кухня',
      10: 'Рамка 3,0 мм, баня 2,2 × 1,25 м',
      5: 'Рамка 3,5 мм, баня 2,4 × 1,25 м',
      9: 'Рамка 4,0 мм, баня 2,8 × 1,25 м',
      16: 'Покрив над цялата къща и балкон с ширина 2 м',
      17: 'Два етажа с вътрешно стълбище и балкон 2 м',
    },
  },

  capsule: {
    basis: 'с ДДС, монтаж по запитване',
    lines: [
      '38 м², 11,5 × 3,3 м',
      'Рамка от поцинкована стомана 3,5 мм',
      'Стени 100 мм с полиуретанова изолация и алуминиева обшивка',
      'Алуминиева дограма с прекъснат термомост и закалено двойно остъкляване',
      'Вход с интелигентна брава',
    ],
  },

  compare: {
    heading: 'Бокс къща или капсула',
    columns: ['Характеристика', 'Бокс къща', 'Капсула'],
    rows: [
      { label: 'Площ', values: ['18–74 м²', '38 м²'] },
      { label: 'Конструкция', values: ['Поцинкована стомана, 3,0 / 3,5 / 4,0 мм за 37 / 58 / 73 м²', 'Поцинкована стомана, 3,5 мм'] },
      { label: 'Стени', values: ['100 мм каменна вата 80 кг/м³, клас A по реакция на огън, и 16 мм полиуретанова фасада', '100 мм с полиуретанова изолация, алуминиева обшивка'] },
      { label: 'Дограма', values: ['Алуминиева с прекъснат термомост или PVC, двоен стъклопакет', 'Алуминиева с прекъснат термомост, закалено двойно остъкляване'] },
    ],
    priceLabel: 'Цена от',
    boxPrice: '{price}, без монтаж',
    capsulePrice: '{price}, монтаж по запитване',
  },

  // {folded} and {open} are the 37 m² model's widths from the configurator catalogue.
  arrival: {
    heading: 'Как пристига разгъваемата къща',
    paragraphs: [
      'Разгъваемата къща се произвежда във фабрика заедно с банята, кухнята, дограмата и инсталациите, които сте избрали. Пътува сгъната и се разгъва едва на мястото си — затова едни я наричат сгъваема, други разтегателна, а трети просто „бокс“ къща. Доставяме я в България и в Гърция, а за други страни — при запитване.',
      'При транспорт моделът от 37 м² е широк {folded} м, а разгънат — {open} м. На място къщата се поставя с кран върху подготвената основа и се разгъва. Инсталациите вътре са изградени още във фабриката.',
    ],
    // {rate}, {crane}, {production} and {months} come from deliveryRates.js, the owner's figures of 2026-10-15.
    delivery: 'Доставка до вашия парцел: около {rate} на километър, в двете посоки, от Марикостиново или от Варна — откъдето е по-близо до вас. Кранът е задължителен и струва около {crane}, а според мястото може и повече. Доставката и кранът са без ДДС. Къщата се произвежда до {production} дни и пристига на вашия адрес за около {months} месеца.',
    pricesLink: 'Цени с монтажа →',
    deliveryLink: 'Вижте разстоянието до вашия адрес →',
    includedHeading: 'Какво включва монтажът',
    excludedHeading: 'Какво не е включено',
    foundationAsk: 'Каква основа е нужна, зависи от мястото. Обадете се или ни попитайте.',
  },

  proof: {
    heading: 'Доставена при клиент',
    sub: 'Една от нашите разгъваеми къщи, вече на мястото си.',
    // Two of the case's own photos, shown only while the case still lists them.
    photos: [
      { url: '/api/img/cases/1/5f6e02eabc11410c89ab824cb2496488.webp', alt: 'Дневната и кухнята в къщата в Паралия Кариани' },
      { url: '/api/img/cases/1/268f1b6801134d16ab11f700ac46faf5.webp', alt: 'Банята с душ кабина в къщата в Паралия Кариани' },
    ],
    more: 'Вижте проекта →',
    stars: '{rating} от 5',
  },

  catalogues: {
    heading: 'Каталози (PDF)',
    subheading: 'Разгъваемите къщи и капсулите на хартия: за разпечатване или за изпращане на този, с когото решавате.',
    // The sizes are what /api/brochures served on 2026-10-12. A phone user should know a
    // file is 16 MB before tapping it; replace the figure when the admin uploads a new edition.
    items: [
      { brochureSlug: 'box-house', label: 'Разгъваеми (Бокс) къщи', note: '37 / 58 / 73 м² · 16 МБ' },
      { brochureSlug: 'space-capsules', label: 'Капсули', note: '3,4 МБ' },
    ],
  },

  siblings: {
    heading: 'Търсите друго?',
    go: 'Разгледайте →',
    from: 'от',
    withAssembly: 'с ДДС и монтаж',
    containers: {
      label: 'Контейнерни модули',
      desc: 'Контейнери за живеене и офис 6×3, 7×3 и 8×3 м, монтирани от нас.',
    },
    steel: {
      label: 'Сглобяеми къщи по проект',
      desc: 'Къща със стоманена конструкция по вашия проект, или ние ще изготвим проекта.',
    },
  },

  finalTitle: 'Да поговорим за вашата къща?',

  // Product markup only, never shown.
  listName: 'Модулни къщи',
  schemaCategory: 'Модулна къща',
}
