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
// The homes count ({homes}, shared/company.js) and the opening hours ({hours}, the home content's
// contact band, which the footer prints too) were confirmed by the owner on 2026-10-16.
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
      homes: { value: '{homes}', label: 'доставени дома' },
      container: { value: 'до {days}\u00a0дни', label: 'контейнер от склада до вашия адрес' },
      production: { value: 'до {production}\u00a0дни', label: 'изработка на Бокс къща в нашата фабрика' },
      toAddress: { value: 'около {months}\u00a0месеца', label: 'Бокс къща от поръчката до вашия адрес' },
      warranty: { value: '{years}\u00a0години', label: 'гаранция на носещата конструкция' },
      reviews: { value: '{score}', label: 'от 5, средно от {count} потвърдени отзива' },
    },
    everywhere: 'Доставяме в целия ЕС. За адрес в България или Гърция калкулаторът показва цената веднага, а за друга държава я изчисляваме по запитване.',
    calculator: 'Сметнете доставката →',
  },

  // The story as the owner told it (2026-10-15): a logistics firm in 2021, containers from
  // 2024, Box houses from 2025, steel-frame houses from 2026. The years are his, typed here; the
  // first must equal shared/company.js foundingYear. {vat} is filled from shared/company.js.
  story: {
    heading: 'Кои сме',
    lead: 'NVC Home4You е българска фирма от Марикостиново, край Петрич. Започнахме с логистиката и стъпка по стъпка стигнахме до домовете, които продаваме днес.',
    timelineLabel: 'Нашият път по години',
    timeline: [
      { year: '2021', title: 'Логистика', text: 'Основаваме NVC Home4You като логистична фирма.' },
      // A step with a pathKey links to the page of what it started (paths.js key, words in `link`).
      { year: '2024', title: 'Контейнери', text: 'Започваме да внасяме контейнери за живеене.', pathKey: 'modularBuilds', link: 'Контейнерите за живеене →' },
      { year: '2025', title: 'Бокс къщи', text: 'Добавяме разгъваемите Бокс къщи.', pathKey: 'modularHouses', link: 'Бокс къщите →' },
      { year: '2026', title: 'Стоманени къщи', text: 'Започваме да правим и къщи със стоманена конструкция, по проект.', pathKey: 'steelHouses', link: 'Къщите по проект →' },
    ],
    todayHeading: 'Днес',
    paragraphs: [
      'Продаваме и доставяме контейнери, Бокс къщи и къщи по проект от базата си в Марикостиново. Цените на контейнерите и Бокс къщите са публикувани с ДДС, а спецификацията на всеки модел казва какво влиза в цената.',
    ],
    // The interiors service: the owner's own builder team, Sofia to Petrich, priced after a visit.
    renovation: {
      text: 'Със собствен екип строители правим и ремонти на бани и кухни, в района от София до Петрич.',
      link: 'Вътрешни ремонти →',
    },
    terms: [
      { key: 'base', label: 'Базата ни', text: 'Марикостиново, 2850 Петрич.', map: 'Вижте на картата' },
      { key: 'visits', label: 'Посещения', text: 'Можете да ни посетите в базата само след предварителна уговорка.' },
      { key: 'hours', label: 'Работно време', text: '{hours}' },
      { key: 'factory', label: 'Къде се правят', text: 'Контейнерите и Бокс къщите — в нашата фабрика в Китай.' },
      { key: 'answer', label: 'Кой отговаря', text: 'Истински човек, по телефона или по имейла — до 24 часа.' },
      { key: 'company', label: 'Фирма', text: 'NVC Home4You, ДДС номер {vat}' },
    ],
  },

  // The people, as the owner named them (2026-10-15). `slug` keys the photo in
  // shared/company.js TEAM_PHOTOS; until a photo is there the card shows the initials.
  team: {
    heading: 'Нашият екип',
    sub: 'Хората зад NVC Home4You: тримата управители, продажбите и нашите строители.',
    people: [
      { slug: 'vladimir-vladimirov', name: 'Владимир Владимиров', role: 'Управител', area: 'Маркетинг и инженеринг' },
      { slug: 'tsvetelin-bonin', name: 'Цветелин Бонин', role: 'Управител', area: 'Правни въпроси и клиенти' },
      { slug: 'nikolay-lekov', name: 'Николай Леков', role: 'Управител', area: 'Логистика и производство' },
      { slug: 'radina-ivanova', name: 'Радина Иванова', role: 'Мениджър продажби', area: '' },
      { slug: 'vasil-vasilev', name: 'Васил Василев', role: 'Строител', area: '' },
      { slug: 'ivan-vasilev', name: 'Иван Василев', role: 'Строител', area: '' },
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
    // To the case's own card on the cases page (#case-<id>), named for what it shows.
    more: 'Къщата в Паралия Кариани →',
  },

  inWriting: {
    heading: 'Какво поемаме ние и какво остава за вас',
    sub: 'Договорът, документите, митницата, транспортът и цените.',
    terms: [
      { key: 'contract', label: 'Договор', text: 'Продаваме с писмен договор, а гаранцията е записана в приложение към него.' },
      { key: 'documents', label: 'Документи', text: 'С контейнера или Бокс къщата получавате CE сертификат, списък на материалите и чертежите.' },
      { key: 'qc', label: 'Проверка на качеството', text: 'Преди да изпратим поръчката, проверяваме качеството ѝ в нашата фабрика.' },
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
    partner: { label: 'За фирми и партньори', desc: 'Контейнери и Бокс къщи за търговци и поръчки на едро.' },
    doors: { label: 'Интериорни врати', desc: 'Врати в комплект с каса, панти, дръжка и первази — и монтаж, ако желаете.' },
  },

  finalTitle: 'Да поговорим за вашия проект?',
}
