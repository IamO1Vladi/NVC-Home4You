// The FAQ hub, /bg/chesto-zadavani-vyprosi: „Често задавани въпроси".
//
// WORDS ONLY, AND ONLY WHAT THE OWNER HAS CONFIRMED. Every answer below is built from a sentence
// the site already stands behind, and says where it comes from: the About page's terms (the
// contract, documents, quality check, customs, insurance and tracking, unloading, prices,
// visits, the factory), the prices list, the warranty annex (shared/warranty.js), and the
// owner's answers of 2026-10-17 (payment, financing, the permit, moving a unit later, the
// insulation, customs inside every price). The old answers nothing backed stay gone: finish
// "packages" and payment in stages.
//
// Every figure is a {placeholder} that lib/faqHub.js hubFigures() fills from a module; none is
// typed here (FAQPage.test.jsx, warrantyFacts.test.js).
//
// The hub also shows the delivery, partner, internal doors and interiors pages' questions
// (gathered by lib/questions.js) and, since 2026-10-17, the containers, Box houses and
// steel-frame pages' (lib/productQuestions.js), in their pages' words, so the crane, the lead
// time, the products, the partners, the doors and the renovations are not answered a second
// time here. `id` is the same in all three languages and becomes <details id="q-{id}">;
// `topic` is a key of HUB_TOPICS (lib/faqHub.js); `link` is a page the answer continues on.
//
// The rules the copy keeps: ONE factory, „нашата фабрика в Китай", never named, never
// suppliers; nothing about who connects a Box house or a container to the utilities; nothing
// about heating or air conditioning. No seo block: the title, description, canonical and
// hreflangs come from routeMeta.js.
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
    // About page, inWriting.prices; the cheapest Box assembly in prices.js (every Box house has
    // one since the 18 m² house's of 2026-10-17); the capsule arrives ready (owner, 2026-10-17).
    {
      id: 'prices-vat',
      topic: 'buying',
      q: 'Цените с ДДС ли са и какво се плаща отделно?',
      a: 'Цените на контейнерите са с ДДС и с монтажа. Цените на Бокс къщите са с ДДС, а монтажът е отделно, без ДДС: от {boxAssembly} според модела. Капсулата пристига готова и няма монтаж. Доставката и кранът се смятат отделно, без ДДС.',
    },
    // About page, inWriting.contract.
    {
      id: 'contract',
      topic: 'buying',
      q: 'Получавам ли писмен договор?',
      a: 'Да. Продаваме с писмен договор, а гаранцията е записана в приложение към него.',
    },
    // The owner, 2026-10-17 (Q1): {atOrder} and {afterDelivery} from shared/company.js. Partners
    // pay everything in advance (partner.js, the partners topic below).
    {
      id: 'payment',
      topic: 'buying',
      q: 'Как се плаща контейнерът или къщата?',
      a: 'При поръчката плащате {atOrder}% от цената, а останалите {afterDelivery}% — след доставката. Монтажът се плаща, след като е завършен. За партньорите условията са други: цялата сума предварително, по договор.',
    },
    // The owner, 2026-10-17 (Q2): {financing} and {bank} from shared/company.js.
    {
      id: 'financing',
      topic: 'buying',
      q: 'Може ли покупката да се финансира?',
      a: 'Да. Можете да получите финансиране до {financing} чрез {bank}.',
    },
    // The owner, 2026-10-17 (Q3), asked for containers and Box houses: no building permit, a permit
    // for a temporary structure, the documents for it ours. Nothing about the steel-frame houses.
    {
      id: 'permit',
      topic: 'buying',
      q: 'Нужно ли е разрешение за строеж за контейнер или Бокс къща?',
      a: 'Не. Нужно е разрешение за временна постройка, а необходимите за него документи ви осигуряваме ние.',
    },
    // The owner, 2026-10-17 (Q9).
    {
      id: 'moving',
      topic: 'buying',
      q: 'Мога ли по-късно да преместя контейнера или Бокс къщата?',
      a: 'Да. Контейнерът може да се разглоби и да се премести, а Бокс къщата — да се сгъне и да се премести отново.',
    },
    // The owner, 2026-10-17 (Q8): {boxRoofMm} from shared/insulation.js. Heating and air
    // conditioning were not answered, so the answer says nothing of them.
    {
      id: 'insulation',
      topic: 'buying',
      q: 'Изолирани ли са покривът и подът?',
      a: 'Покривът е изолиран: при Бокс къщите с {boxRoofMm} мм каменна вата, а при контейнерите — с минерална вата. Подът не е изолиран в стандартното изпълнение; изолация на пода можем да добавим срещу доплащане.',
    },

    // After the delivery page's six: customs (About, inWriting.customs, the delivery page's Box
    // card, and the owner's 2026-10-17 answer: in the container price and the steel-house quote
    // too), the foundation (the product pages, with the prices list's tip), unloading and
    // insurance (About, inWriting).
    {
      id: 'customs',
      topic: 'delivery',
      q: 'Вие ли се занимавате с митницата?',
      a: 'Да, за всичко, което доставяме. Митницата е включена в цената на контейнерите и в офертата за къща със стоманена конструкция, а при Бокс къщите морският превоз от Китай и митницата вече са в цената на къщата.',
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
