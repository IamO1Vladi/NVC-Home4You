// The FAQ hub, /bg/chesto-zadavani-vyprosi: „Често задавани въпроси".
//
// WORDS ONLY, AND ONLY WHAT THE OWNER HAS CONFIRMED. Every answer below is built from a sentence
// the site already stands behind, and says where it comes from: the About page's terms (the
// contract, documents, quality check, customs, insurance and tracking, unloading, prices,
// visits, the factory), the product pages and the prices list (the container's kitchen and
// assembly, the other sizes, what Box assembly includes and leaves out), the configurator
// catalogue (the bathroom and kitchen choices, the standard terrace, the appliances, the
// layouts), the steel-frame page (priced per project, delivery and customs ours) and the
// warranty annex (shared/warranty.js). The old answers nothing backed are gone: finish
// "packages", payment in stages and financing partners.
//
// Every figure is a {placeholder} that lib/faqHub.js hubFigures() fills from a module; none is
// typed here (FAQPage.test.jsx, warrantyFacts.test.js).
//
// The hub also shows the delivery, partner, internal doors and interiors pages' questions
// (gathered by lib/questions.js, in their pages' words), so the crane, the lead time, the
// partners, the doors and the renovations are not answered a second time here. `id` is the
// same in all three languages and becomes <details id="q-{id}">; `topic` is a key of
// HUB_TOPICS (lib/faqHub.js); `link` is a page the answer continues on.
//
// The rules the copy keeps: ONE factory, „нашата фабрика в Китай", never named, never
// suppliers; nothing about who connects a Box house to the utilities. No seo block: the title,
// description, canonical and hreflangs come from routeMeta.js.
export default {
  breadcrumb: 'Често задавани въпроси',
  home: 'Начало',

  hero: {
    eyebrow: 'Въпроси и отговори',
    h1: 'Често задавани въпроси',
    lead: 'Цени и ДДС, доставка и кран, гаранция и документи, партньори, врати и ремонти: отговорите на едно място.',
  },

  search: {
    label: 'Търсете във въпросите',
    placeholder: 'Например: кран, гаранция, митница',
    clear: 'Изчистете търсенето',
  },
  topicsLabel: 'Теми',
  all: 'Всички',
  // {n} questions, said after a search or a topic changes what is shown.
  count: { one: '{n} въпрос', other: '{n} въпроса' },
  empty: {
    text: 'Няма въпрос, който да отговаря на търсенето.',
    reset: 'Покажете всички въпроси',
    ask: 'Задайте въпрос',
  },

  // Each topic's name, and the words of the link that ends its section (to the page in
  // HUB_TOPICS).
  topics: {
    buying: { label: 'Покупка и цени', link: 'Цените на всички модели, с ДДС →' },
    containers: { label: 'Контейнери', link: 'Контейнерите: модели, цени и спецификация →' },
    box: { label: 'Бокс къщи', link: 'Бокс къщите: размери, цени и гаранция →' },
    steel: { label: 'Стоманени къщи', link: 'Къщите по проект: как работим →' },
    delivery: { label: 'Доставка и монтаж', link: 'Доставка и монтаж: калкулатор и примерни цени →' },
    warranty: { label: 'Гаранция и документи', link: 'Договорът, документите и гаранцията →' },
    company: { label: 'Посещения и фирмата', link: 'За нас: кои сме и къде сме →' },
    partners: { label: 'Партньори', link: 'Условията за партньори и запитване →' },
    doors: { label: 'Интериорни врати', link: 'Интериорните врати: типове, цветове и запитване →' },
    renovations: { label: 'Вътрешни ремонти', link: 'Вътрешните ремонти: какво правим и безплатен оглед →' },
  },

  items: [
    // About page, inWriting.prices; the Box assembly "from" for the catalogue's models, the only
    // ones with an assembly price in prices.js (the 18 m² house and the capsule have none yet).
    {
      id: 'prices-vat',
      topic: 'buying',
      q: 'Цените с ДДС ли са и какво се плаща отделно?',
      a: 'Цените на контейнерите са с ДДС и с монтажа. Цените на Бокс къщите са с ДДС, а монтажът е отделно, без ДДС: от {boxAssembly} за моделите {areas} м². Доставката и кранът се смятат отделно, без ДДС.',
    },
    // About page, inWriting.contract.
    {
      id: 'contract',
      topic: 'buying',
      q: 'Получавам ли писмен договор?',
      a: 'Да. Продаваме с писмен договор, а гаранцията е записана в приложение към него.',
    },

    // The containers page: its kitchen row, its assembly line, its sizes to order.
    {
      id: 'container-kitchen',
      topic: 'containers',
      q: 'Има ли кухня в контейнера?',
      a: 'Кухнята не е включена. Има помещение, което може да се ползва за кухня.',
      link: { pathKey: 'modularBuilds', hash: 'specs', label: 'Какво има във всеки контейнер →' },
    },
    {
      id: 'container-assembly',
      topic: 'containers',
      q: 'Монтажът включен ли е в цената на контейнера?',
      a: 'Да. Монтажът е включен в цената на всеки модел: {containerAssembly} от нея са за монтажа.',
      link: { pathKey: 'modularBuilds', hash: 'assembly', label: 'Монтаж и доставка на контейнер →' },
    },
    {
      id: 'container-sizes',
      topic: 'containers',
      q: 'Има ли контейнери с други размери?',
      a: 'Другите размери от каталога нямаме на склад, но можем да ги поръчаме за вас. Попитайте ни.',
      link: { pathKey: 'modularBuilds', hash: 'units', label: 'Контейнерите на склад, с цени →' },
    },

    // The delivery page's Box card (sea freight and customs in the house price) and the
    // configurator catalogue (bathrooms, kitchens, the standard terrace, all in the base price).
    {
      id: 'box-price',
      topic: 'box',
      q: 'Какво включва цената на Бокс къщата?',
      a: 'ДДС, морския превоз от Китай и митницата. За моделите {areas} м² в цената са и напълно оборудваната баня ({bathrooms} варианта по избор), кухнята ({kitchens} варианта по избор, а още {kitchensExtra} — срещу доплащане) и стандартната тераса на късата страна, {terrace}. Монтажът е отделно, а кранът, основата и доставката до парцела не са включени.',
      link: { pathKey: 'modularHouses', hash: 'sizes', label: 'Размерите и цените на Бокс къщите →' },
    },
    // The configurator's appliance note.
    {
      id: 'box-appliances',
      topic: 'box',
      q: 'Включени ли са кухненските уреди?',
      a: 'Не. Уредите не ги доставяме и не ги таксуваме: в конфигуратора посочвате къде ще стои всеки, за да изработим кухнята по мярка, а подготовката за тях (ел. изводи и ВиК) е включена в цената. Мивката обаче я продаваме ние и я избирате в конфигуратора.',
      link: { pathKey: 'boxConfigurator', label: 'Сглобете къщата си в конфигуратора →' },
    },
    // The prices list's "what assembly covers / does not cover".
    {
      id: 'box-assembly',
      topic: 'box',
      q: 'Какво включва монтажът на Бокс къщата?',
      a: 'Поставянето на къщата на подготвената основа и довършителните работи до ключ: къщата е готова за нанасяне. Монтажът не включва крана, основата и доставката до парцела. Кранът е задължителен: около {boxCrane} без ДДС, а според мястото може и повече.',
      link: { pathKey: 'prices', label: 'Цената на монтажа за всеки модел →' },
    },
    // The floor planner (owner, 2026-10-15): the catalogue's layouts, the bathroom and the
    // entrance door fixed by the model's drawing.
    {
      id: 'box-layouts',
      topic: 'box',
      q: 'Мога ли да избера разпределението?',
      a: 'Да. Започнете от едно от {layouts} разпределения от каталога за моделите {areas} м² или начертайте свое в планера и ни го изпратете за оферта. Банята и входната врата са фиксирани: стоят там, където ги поставя техническият чертеж на модела.',
      link: { pathKey: 'planner', label: 'Разпределенията в планера →' },
    },

    // The steel-frame page: its hero, the prices list's card and its "Доставка и митница" step.
    {
      id: 'steel-price',
      topic: 'steel',
      q: 'Колко струва къща със стоманена конструкция?',
      a: 'Всяка къща е отделен проект, затова няма каталожна цена. Изпратете ни своя проект или скица и ще ви направим оферта по него, а ако нямате проект, ще го изготвим за вас.',
      link: { pathKey: 'steelHouses', label: 'Как работим по вашия проект →' },
    },
    {
      id: 'steel-delivery',
      topic: 'steel',
      q: 'Поемате ли доставката и митницата на къща по проект?',
      a: 'Да. Доставяме елементите до вашия парцел и поемаме митническото оформяне. Цената на доставката е в офертата за проекта.',
      link: { pathKey: 'steelHouses', hash: 'pp-process', label: 'Стъпките от проекта до предаването →' },
    },

    // After the delivery page's six: customs (About, inWriting.customs, and the delivery page's
    // Box card), the foundation (the product pages, with the prices list's tip), unloading and
    // insurance (About, inWriting).
    {
      id: 'customs',
      topic: 'delivery',
      q: 'Вие ли се занимавате с митницата?',
      a: 'Да, за всичко, което доставяме. При Бокс къщите морският превоз от Китай и митницата вече са в цената на къщата.',
    },
    {
      id: 'foundation',
      topic: 'delivery',
      q: 'Каква основа е нужна?',
      a: 'Зависи от мястото, затова ни се обадете или ни попитайте за вашия терен. Основата не е включена в цената. {foundationNote}',
    },
    {
      id: 'unloading',
      topic: 'delivery',
      q: 'Кой разтоварва къщата?',
      a: 'В нашата база разтоварването е за наша сметка. Превозът от базата до вашия адрес и разтоварването там са за ваша сметка, освен ако не се договорим друго.',
    },
    {
      id: 'insurance',
      topic: 'delivery',
      q: 'Застраховате ли и проследявате ли пратката?',
      a: 'Да. Предлагаме застраховка на транспорта и проследяване на пратката.',
    },

    // The warranty annex (shared/warranty.js), for containers and Box houses only. The partner
    // page shows the same question (id 'warranty') and leaves its markup to this page.
    {
      id: 'warranty',
      topic: 'warranty',
      q: 'Каква гаранция имат контейнерите и Бокс къщите?',
      a: 'За контейнерите и Бокс къщите: носещата стоманена конструкция — {structureYears} години; термопанелите — {panelYears} години; дограмата (профили и стъклопакети) — {joineryYears} години; санитарните уреди и ВиК арматурата — {sanitaryYears} години. Останалите елементи се проверяват визуално при предаването. Гаранцията покрива фабрични дефекти и тече от датата на предаване — при нормална употреба, подходяща основа, добро отводняване и без неразрешена намеса от трети лица. Не покрива механични повреди, неправилен транспорт или разтоварване, които не са извършени от нас, неподходяща основа, липса на вентилация, лошо отводняване, течове от външни връзки, конденз, по-късни ремонти или промени от купувача или от трети лица, както и форсмажорни обстоятелства.',
    },
    // About page, inWriting.documents and inWriting.qc.
    {
      id: 'documents',
      topic: 'warranty',
      q: 'Какви документи идват с контейнера или Бокс къщата?',
      a: 'С контейнера или Бокс къщата получавате CE сертификат, списък на материалите и чертежите.',
    },
    {
      id: 'quality-check',
      topic: 'warranty',
      q: 'Проверявате ли качеството, преди да изпратите поръчката?',
      a: 'Да. Преди да изпратим поръчката, проверяваме качеството ѝ в нашата фабрика.',
    },

    // About page: the base, visits by appointment, the hours (the footer's), the factory, the
    // story's first year, the homes delivered and the VAT number (shared/company.js).
    {
      id: 'visits',
      topic: 'company',
      q: 'Мога ли да ви посетя? Какво е работното ви време?',
      a: 'Да, в базата ни в Марикостиново, край Петрич, само след предварителна уговорка. Работно време: {hours}.',
    },
    {
      id: 'factory',
      topic: 'company',
      q: 'Къде се правят контейнерите и Бокс къщите?',
      a: 'В нашата фабрика в Китай. Митницата поемаме ние, а после ги докарваме до вашия адрес.',
    },
    {
      id: 'company',
      topic: 'company',
      q: 'Каква фирма е NVC Home4You?',
      a: 'Българска фирма от Марикостиново, край Петрич. Започнахме през {founded} г. като логистична фирма, а днес продаваме и доставяме контейнери, Бокс къщи и къщи със стоманена конструкция по проект. Доставили сме {homes} дома. ДДС номер: {vat}.',
    },
  ],

  // The cards before the closing card; {containerMin} and {boxMin} from shared/partnerTerms.js.
  siblings: {
    heading: 'Къде още да погледнете',
    go: 'Разгледайте →',
    delivery: { label: 'Доставка и монтаж', desc: 'Колко струва доставката до вас, с калкулатор.' },
    prices: { label: 'Цени', desc: 'Къщата, монтажът и ДДС за всеки модел, в една таблица.' },
    partner: { label: 'Партньори', desc: 'По-ниски цени за няколко броя: контейнери от {containerMin}, Бокс къщи от {boxMin} в една поръчка.' },
    about: { label: 'За нас', desc: 'Кои сме, нашият екип и базата ни в Марикостиново.' },
  },

  finalTitle: 'Не намерихте отговор на своя въпрос?',
}
