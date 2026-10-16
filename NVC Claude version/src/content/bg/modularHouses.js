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
// are the gallery descriptions'; the capsule lines are gallery item 100015's and nothing more,
// and its "arrives ready, no assembly" is the owner's answer of 2026-10-17;
// the hero photo and the proof card are the Paralia Kariani case on /api/cases-page; the
// delivery line (Bulgaria and Greece, other countries on request) is the owner's answer of
// 2026-10-15, and what that case in Greece shows. It also carries the page's place name for search, with the title.
// The lead time in arrival.delivery ({production} and {months}) is the owner's of 2026-10-15,
// read from deliveryRates.js, and the foundation tip the page shows is his too (pricesCopy's
// foundationNote, beside arrival.foundationAsk). The permit is the FAQ hub's answer
// (faq.js, id "permit", the owner's of 2026-10-17), not this page's.
// The "not included" list is NOT here either: the page reads it from
// pricesCopy so this page and /bg/ceni say it in the same words.
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
    plannerLink: 'Разпределения и 3D разгъване в планера →',
    // To the partner page's enquiry form (#zapitvane): more than one unit, or for resale.
    partnerLink: 'Повече от един брой или за препродажба? →',
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

  // The lines are gallery item 100015's; the basis is the owner's answer of 2026-10-17: the
  // capsule needs no assembly, it arrives ready.
  capsule: {
    // Its Product markup's category once it is filed under its own "capsule" (2026-10-17),
    // the gallery's own name for it (content/bg/gallery.js filters.categories.capsule).
    schemaCategory: 'Космическа капсула',
    basis: 'с ДДС; пристига готова, не се нуждае от монтаж',
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
    capsulePrice: '{price}; пристига готова, не се нуждае от монтаж',
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
    deliveryLink: 'Изчислете доставката до вас →',
    includedHeading: 'Какво включва монтажът',
    excludedHeading: 'Какво не е включено',
    foundationAsk: 'Каква основа е нужна, зависи от мястото. Обадете се или ни попитайте.',
  },

  // The warranty as the owner gave it on 2026-10-15, from the annex to our Box-house sales
  // contract. The lead names the Box houses and the capsule, which carries the same warranty
  // (owner, 2026-10-17). {years} is the row's figure from shared/warranty.js, by its key.
  warranty: {
    heading: 'Гаранция',
    lead: 'За разгъваемите (Бокс) къщи и капсулата.',
    rows: [
      { key: 'structure', label: 'Конструкция', text: '{years}\u00a0години — носещата стоманена рамка' },
      { key: 'panels', label: 'Панели', text: '{years}\u00a0години — термопанелите (сандвич панели)' },
      { key: 'joinery', label: 'Дограма', text: '{years}\u00a0години — профилите и стъклопакетите' },
      { key: 'sanitary', label: 'Санитария', text: '{years}\u00a0години — санитарните уреди и ВиК арматурата в банята и кухнята' },
    ],
    conditions: 'Гаранцията покрива фабрични дефекти и тече от датата на предаване — при нормална употреба, подходяща основа, добро отводняване и без неразрешена намеса от трети лица. При предаването останалите елементи се проверяват визуално за съответствие с фабричното качество.',
    excluded: 'Гаранцията не покрива механични повреди, неправилен транспорт или разтоварване, които не са извършени от нас, неподходяща основа, липса на вентилация, лошо отводняване, течове от външни връзки, конденз, по-късни ремонти или промени от купувача или от трети лица, както и форсмажорни обстоятелства.',
  },

  proof: {
    heading: 'Доставена при клиент',
    sub: 'Една от нашите разгъваеми къщи, вече на мястото си.',
    // Two of the case's own photos, shown only while the case still lists them.
    photos: [
      { url: '/api/img/cases/1/5f6e02eabc11410c89ab824cb2496488.webp', alt: 'Дневната и кухнята в къщата в Паралия Кариани' },
      { url: '/api/img/cases/1/268f1b6801134d16ab11f700ac46faf5.webp', alt: 'Банята с душ кабина в къщата в Паралия Кариани' },
    ],
    // To the case's own card on the cases page (#case-<id>), named for what it shows.
    more: 'Къщата в Паралия Кариани →',
    stars: '{rating} от 5',
  },

  // The page's questions (lib/productQuestions.js), marked up here and gathered by the FAQ hub
  // under „Бокс къщи". What the price includes, the appliances, what assembly covers and the
  // layouts moved here from the hub (2026-10-17), with their figures from the configurator
  // catalogue and deliveryRates.js. Who assembles and how long ({workers}, {assemblyDays}), the
  // 18 m² house's assembly ({smallAssembly}, {smallAssemblyGross}) and the lead times
  // ({production}, {months}) are the owner's answers of 2026-10-17, from prices.js and
  // deliveryRates.js; so is the capsule arriving ready. Never who connects the utilities.
  faq: {
    heading: 'Въпроси',
    // To the hub's Box houses topic (#t-box).
    more: 'Още въпроси →',
    items: [
      {
        id: 'box-price',
        q: 'Какво включва цената на Бокс къщата?',
        a: 'ДДС, морския превоз от Китай и митницата. За моделите {areas} м² в цената са и напълно оборудваната баня ({bathrooms} варианта по избор), кухнята ({kitchens} варианта по избор, а още {kitchensExtra} — срещу доплащане) и стандартната тераса на късата страна, {terrace}. Монтажът е отделно, а кранът, основата и доставката до парцела не са включени.',
        link: { pathKey: 'modularHouses', hash: 'sizes', label: 'Размерите и цените на Бокс къщите →' },
      },
      {
        id: 'box-assembly',
        q: 'Какво включва монтажът на Бокс къщата?',
        a: 'Поставянето на къщата на подготвената основа и довършителните работи до ключ: къщата е готова за нанасяне. Монтажът не включва крана, основата и доставката до парцела. Кранът е задължителен: около {boxCrane} без ДДС, а според мястото може и повече.',
        link: { pathKey: 'prices', label: 'Цената на монтажа за всеки модел →' },
      },
      {
        id: 'box-assembly-crew',
        q: 'Кой монтира Бокс къщата и колко време отнема?',
        a: 'Монтират я {workers} наши работници, на място при вас, за {assemblyDays} дни.',
      },
      {
        id: 'box-assembly-18',
        q: 'Колко струва монтажът на къщата от 18 м²?',
        a: 'Монтажът на разгъваемата къща от 18 м² струва {smallAssembly} без ДДС, или {smallAssemblyGross} с ДДС.',
      },
      {
        id: 'box-lead-times',
        q: 'Еднакъв ли е срокът за всички размери?',
        a: 'Да. Всяка Бокс къща, от 18 до 74 м², се произвежда до {production} дни и пристига на вашия адрес за около {months} месеца.',
      },
      {
        id: 'capsule-ready',
        q: 'Нужен ли е монтаж за капсулата?',
        a: 'Не. Капсулата пристига готова и няма монтаж. Доставката, кранът, срокът — около {months} месеца до вашия адрес — и гаранцията са същите като при Бокс къщите.',
      },
      {
        id: 'box-layouts',
        q: 'Мога ли да избера разпределението?',
        a: 'Да. Започнете от едно от {layouts} разпределения от каталога за моделите {areas} м² или начертайте свое в планера и ни го изпратете за оферта. Банята и входната врата са фиксирани: стоят там, където ги поставя техническият чертеж на модела.',
        link: { pathKey: 'planner', label: 'Разпределенията в планера →' },
      },
      {
        id: 'box-appliances',
        q: 'Включени ли са кухненските уреди?',
        a: 'Не. Уредите не ги доставяме и не ги таксуваме: в конфигуратора посочвате къде ще стои всеки, за да изработим кухнята по мярка, а подготовката за тях (ел. изводи и ВиК) е включена в цената. Мивката обаче я продаваме ние и я избирате в конфигуратора.',
        link: { pathKey: 'boxConfigurator', label: 'Сглобете къщата си в конфигуратора →' },
      },
    ],
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
