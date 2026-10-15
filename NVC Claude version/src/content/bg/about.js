// The About page, /bg/za-nas: "За нас".
//
// WORDS ONLY, and only what the owner has confirmed. Every figure is a {placeholder} the page
// fills from a module, never typed here: {days}, {production} and {months} from
// shared/deliveryRates.js LEAD_TIMES, {years} from shared/warranty.js (the structure's years,
// and said of the structure only), {score} and {count} from the live reviews, {rating} from the
// published case. AboutPage.test.jsx fails if a figure is typed.
//
// The rules the copy keeps (owner, 2026-10-12 and 2026-10-15): ONE factory, "нашата фабрика в
// Китай", never suppliers, never factories, never a name; delivery "в целия ЕС" as the home page
// words it, with Bulgaria and Greece priced by the calculator and other countries on request;
// customs is ours for everything; transport insurance and tracking are offered; the photos are
// the owner's own (the crane lift, the delivery clips, the factory floor, the Kariani case).
//
// `pending` is what waits for the owner's answer. The page NEVER renders it (the test checks
// every string in it against the rendered page); when he answers, the text moves into a section.
//
// No seo block: the title, description, canonical, hreflangs and share picture come from
// routeMeta.js.
export default {
  breadcrumb: 'За нас',
  home: 'Начало',

  hero: {
    eyebrow: 'За нас',
    h1: 'NVC Home4You: контейнери и Бокс къщи от Марикостиново, Петрич',
    lead: 'Продаваме контейнери за живеене, разгъваеми Бокс къщи и къщи със стоманена конструкция по проект. Контейнерите и Бокс къщите идват от нашата фабрика в Китай, митницата поемаме ние, а после ги докарваме до вашия адрес.',
    offer: 'Заяви оферта',
    call: 'Обадете се',
    photoAlt: 'Кран сваля дълъг модул от камион върху бетонна площадка',
  },

  // The tiles, each a figure and what it is; the reviews tile is left out until the reviews
  // answer, and is never shown as a zero.
  facts: {
    heading: 'Какво можете да очаквате',
    tiles: {
      container: { value: 'до {days}\u00a0дни', label: 'контейнер от склада до вашия адрес' },
      production: { value: 'до {production}\u00a0дни', label: 'изработка на Бокс къща в нашата фабрика' },
      toAddress: { value: 'около {months}\u00a0месеца', label: 'Бокс къща от поръчката до вашия адрес' },
      warranty: { value: '{years}\u00a0години', label: 'гаранция на носещата конструкция' },
      reviews: { value: '{score}', label: 'от 5, средно от {count} потвърдени отзива' },
    },
    everywhere: 'Доставяме в целия ЕС. За адрес в България или Гърция калкулаторът показва цената веднага, а за друга държава я изчисляваме по запитване.',
    calculator: 'Сметнете доставката →',
  },

  // The story without a date: the years wait for the owner (see `pending`).
  story: {
    heading: 'Кои сме',
    paragraphs: [
      'Започнахме с интериорни ремонти. Там видяхме колко често хората трябва да избират между качество, яснота и цена, и затова се насочихме към сглобяемите и модулните къщи.',
      'Днес продаваме и доставяме контейнери, Бокс къщи и къщи по проект от базата си в Марикостиново, край Петрич. Цените на контейнерите и Бокс къщите са публикувани с ДДС, а спецификацията на всеки модел казва какво влиза в цената.',
    ],
    terms: [
      { key: 'base', label: 'Базата ни', text: 'Марикостиново, 2850 Петрич.', map: 'Вижте на картата' },
      { key: 'factory', label: 'Къде се правят', text: 'Контейнерите и Бокс къщите — в нашата фабрика в Китай.' },
      { key: 'answer', label: 'Кой отговаря', text: 'Истински човек, по телефона или по имейла — до 24 часа.' },
    ],
  },

  journey: {
    heading: 'От нашата фабрика до вашия парцел',
    sub: 'Снимки и кадри от нашата фабрика и от наши доставки.',
    factory: {
      title: 'В нашата фабрика в Китай',
      text: 'Тук се изработват контейнерите и Бокс къщите, които продаваме.',
      alt: 'Производствен цех с рамки и стенни панели на модули',
    },
    // In this order, each beside its clip in public/delivery/journey-<id>.mp4.
    clips: [
      { id: 'port', title: 'На пристанището', text: 'Сгънатата Бокс къща пристига с кораба; митницата поемаме ние.' },
      { id: 'yard', title: 'В нашата база', text: 'Разтоварваме я от морския контейнер, за наша сметка.' },
      { id: 'truck', title: 'На камиона', text: 'С кран я качваме на камиона, който я докарва до вас.' },
      { id: 'plot', title: 'На вашия парцел', text: 'Кранът я поставя на основата.' },
    ],
    more: 'Доставка и монтаж: цени и калкулатор →',
  },

  // The published case (/api/cases-page, id "2"), as the delivery page draws it; not drawn if it
  // is ever unpublished. Its photo is shown only while the case still lists it.
  proof: {
    heading: 'Доставена при клиент',
    case: {
      id: '2',
      line: '58 м² с веранда · Паралия Кариани, Гърция · {year}',
      result: 'Бокс къща, доставена и монтирана до ключ.',
      name: 'Вангелис',
    },
    photo: {
      url: '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
      alt: 'Разгъваема къща от 58 м² с веранда, доставена в Паралия Кариани, Гърция',
    },
    stars: '{rating} от 5',
    more: 'Вижте проекта →',
  },

  inWriting: {
    heading: 'Какво поемаме ние и какво остава за вас',
    sub: 'Договорът, митницата, транспортът и цените.',
    terms: [
      { key: 'contract', label: 'Договор', text: 'Продаваме с писмен договор, а гаранцията е записана в приложение към него.' },
      { key: 'customs', label: 'Митница', text: 'Поемаме я ние, за всичко, което доставяме.' },
      { key: 'insurance', label: 'Застраховка и проследяване', text: 'Предлагаме застраховка на транспорта и проследяване на пратката.' },
      { key: 'unloading', label: 'Разтоварване', text: 'В нашата база е за наша сметка. Превозът от базата до вашия адрес и разтоварването там са за ваша сметка, освен ако не се договорим друго.' },
      { key: 'prices', label: 'Цени', text: 'Цените на контейнерите са с ДДС и с монтажа. Цените на Бокс къщите са с ДДС, а монтажът е отделно. Доставката и кранът се смятат отделно, без ДДС.', link: 'Всички цени →' },
    ],
  },

  // WarrantyTerms' shape; each row's {years} is filled from shared/warranty.js.
  warranty: {
    heading: 'Гаранция на контейнерите и Бокс къщите',
    lead: 'Сроковете са записани в приложението към нашия договор.',
    rows: [
      { key: 'structure', label: 'Конструкция', text: '{years}\u00a0години — носещата стоманена рамка' },
      { key: 'panels', label: 'Панели', text: '{years}\u00a0години — термопанелите (сандвич панели)' },
      { key: 'joinery', label: 'Дограма', text: '{years}\u00a0години — профилите и стъклопакетите' },
      { key: 'sanitary', label: 'Санитария', text: '{years}\u00a0години — санитарните уреди и ВиК арматурата в банята' },
    ],
    conditions: 'Гаранцията покрива фабрични дефекти и тече от датата на предаване — при нормална употреба, подходяща основа, добро отводняване и без неразрешена намеса от трети лица. При предаването останалите елементи се проверяват визуално за съответствие с фабричното качество.',
    excluded: 'Гаранцията не покрива механични повреди, неправилен транспорт или разтоварване, които не са извършени от нас, неподходяща основа, липса на вентилация, лошо отводняване, течове от външни връзки, конденз, по-късни ремонти или промени от купувача или от трети лица, както и форсмажорни обстоятелства.',
  },

  siblings: {
    heading: 'Къде още да погледнете',
    go: 'Разгледайте →',
    cases: { label: 'Казуси и отзиви', desc: 'Доставени къщи и какво казват клиентите ни.' },
    faq: { label: 'Въпроси', desc: 'Цени, доставка, монтаж и гаранция.' },
    gallery: { label: 'Галерия с цени', desc: 'Моделите със снимки и цени с ДДС.' },
    delivery: { label: 'Доставка и монтаж', desc: 'Колко струва доставката до вас, с калкулатор.' },
  },

  finalTitle: 'Да поговорим за вашия проект?',

  // WAITING FOR THE OWNER, NEVER RENDERED. `ask` is the question, `draft` the words the page
  // would print once he confirms them. Until then neither may appear anywhere on the page.
  pending: {
    founding: {
      ask: 'Кога е основана фирмата и от коя година продавате контейнери и Бокс къщи? На сайта има 2019, 2021 и 2022.',
      draft: 'Основана през 2019 г.',
    },
    since: {
      ask: 'Вярно ли е „Строим домове от 2022 г.“?',
      draft: 'Строим домове от 2022 г.',
    },
    people: {
      ask: 'Може ли да покажем име, роля и снимка на хората, които отговарят на клиентите?',
      draft: 'Нашият екип',
    },
    legal: {
      ask: 'Какво е юридическото име на фирмата и какъв е ЕИК/ДДС номерът?',
      draft: 'ЕИК',
    },
    homes: {
      ask: 'Актуално ли е „87 доставени дома“ и брои ли контейнерите и къщите заедно?',
      draft: '87 доставени дома',
    },
    documents: {
      ask: 'Получават ли и обикновените купувачи CE сертификат, списък на материалите и чертежи?',
      draft: 'CE сертификат, списък на материалите и чертежи',
    },
    factoryQc: {
      ask: 'Има ли проверка на качеството в нашата фабрика преди изпращане?',
      draft: 'Проверка на качеството преди изпращане',
    },
    visits: {
      ask: 'Може ли всеки клиент да посети базата в Марикостиново по уговорка?',
      draft: 'Посещения в базата по уговорка',
    },
    hours: {
      ask: 'Вярно ли е работното време пон–пет 07:00–19:00?',
      draft: 'Работно време',
    },
  },
}
