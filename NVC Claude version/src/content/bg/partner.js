// The partner page, /bg/stani-partnjor: „Партньори", for companies that resell our containers
// and Box houses or buy several for a site of their own.
//
// WORDS ONLY, AND ONLY THE OWNER'S. Every sentence here is one of his answers of 2026-10-15
// (lower prices by the number of units, a company ordering at least that many, 100% in advance
// under a contract, no territories, delivery to the partner or straight to the client, yard
// visits by appointment, the documents, the option to pay the factory and arrange the
// transport yourself) or one of the delivery facts already on the site. Anything he has not
// answered says nothing: a row or question marked `pending` is never rendered. The warranty
// was one until he answered it the same day (the annex to our Box-house sales contract, the
// same terms for containers); it speaks of containers and Box houses only, never of the
// steel-frame houses, which are quoted per project.
//
// „Нашата фабрика в Китай", always ONE factory: the owner's rule is that a customer knows of one.
//
// The figures are {placeholders} the page fills: {containerMin} and {boxMin} from
// shared/partnerTerms.js; {containerRate} {boxRate} {boxCrane} {days} {production} {months}
// {nights} {travel} from shared/deliveryRates.js; {structureYears} {panelYears} {joineryYears}
// {sanitaryYears} from shared/warranty.js. No seo block: the title, description, canonical and
// hreflangs come from routeMeta.js.
import delivery from './delivery.js'

export default {
  breadcrumb: 'Партньори',
  home: 'Начало',

  // ServiceJSONLD, no price: the page quotes a price per quantity, never a figure.
  service: {
    name: 'Контейнери и Бокс къщи за търговци и поръчки на едро',
    serviceType: 'Продажба на контейнери и разгъваеми къщи на търговци и фирми',
  },

  hero: {
    eyebrow: 'Партньори',
    h1: 'Контейнери и Бокс къщи за търговци и поръчки на едро',
    lead: 'Идват от нашата фабрика в Китай, контейнерите държим на склад в Марикостиново, а митницата поемаме ние. Вие ги препродавате или ги поставяте на своя обект — доставяме до вас или направо до вашия клиент.',
    facts: [
      'По-ниски цени според броя: контейнери от {containerMin} бр., Бокс къщи от {boxMin} бр.',
      'Контейнер от склада — при вас до {days} дни',
      'Митницата поемаме ние; предлагаме застраховка и проследяване на транспорта',
      'Пълни документи: CE сертификат, CAD чертежи, списък на материалите',
    ],
    primary: 'Изпратете запитване',
    call: 'Обадете се',
    photoAlt: 'Кран сваля дълъг модул от камион върху бетонна площадка',
    adminAlt: 'Контейнер или Бокс къща при доставка',
  },

  // The journey drawing in the hero's right column (components/partner/PartnerJourney.jsx):
  // factory, transport, warehouse. The FACTS it keeps: ONE factory, ours; by air only smaller
  // shipments, in crates, never a whole house; no transit times and no "faster than";
  // it arrives at your warehouse or ours at Marikostinovo. The hero photo now sits beside „Накратко".
  journey: {
    summary: 'Как пристига поръчката: от нашата фабрика в Китай по море, с влак или по въздух (по въздух само по-малки пратки, в каси), после с камион до вашия склад или до нашия склад в Марикостиново.',
    captions: {
      factory: 'Нашата фабрика в Китай',
      sea: 'По море',
      rail: 'С влак',
      air: 'По въздух · по-малки пратки',
      yours: 'Вашият склад',
      ours: 'Нашият склад в Марикостиново',
    },
    steps: ['Фабрика', 'Транспорт', 'Склад'],
    stepLabel: 'Стъпка {n}: {name}',
    transport: 'Транспорт',
    modes: { sea: 'Море', rail: 'ЖП', air: 'Въздух' },
    arrival: 'Пристигане',
    // On a narrow screen the button drops oursWhere.
    places: { yours: 'Вашият склад', ours: 'Нашият склад', oursWhere: ' в Марикостиново' },
    pause: 'Пауза',
    play: 'Пусни',
    storyboard: 'Пътят на поръчката в три стъпки',
  },

  doors: {
    heading: 'Препродавате или купувате за свой обект?',
    resell: {
      title: 'Препродавам',
      text: 'Предлагайте нашите контейнери и Бокс къщи на своите клиенти — навсякъде и на ваша цена, без собствен внос и митница. Доставяме до вашия клиент или до вашия склад.',
      button: 'Запитване за препродажба',
    },
    own: {
      title: 'Купувам няколко броя за свой обект',
      text: 'Правим оферта за цялото количество наведнъж, с доставката до обекта.',
      chipsLabel: 'Подходящо за:',
      // Each chip opens the product page that fits it.
      chips: [
        { key: 'glamping', label: 'Къмпинг и глемпинг', pathKey: 'modularHouses' },
        { key: 'hotel', label: 'Хотел и къща за гости', pathKey: 'modularHouses' },
        { key: 'construction', label: 'Строителен обект', pathKey: 'modularBuilds' },
        { key: 'farm', label: 'Стопанство', pathKey: 'modularBuilds' },
        { key: 'investor', label: 'Инвеститор', pathKey: 'steelHouses' },
      ],
      button: 'Запитване за обект',
    },
  },

  // „Накратко": label and value. `link` names a page by its paths.js key; a `pending` row would
  // wait for the owner's answer and never be drawn (none does now).
  terms: {
    heading: 'Накратко',
    rows: [
      { key: 'price', label: 'Цена', text: 'По-ниска според броя: за контейнери от {containerMin} бр., за Бокс къщи от {boxMin} бр. в поръчка. Точната цена е в офертата за количеството.', link: { label: 'Цените за един брой →', pathKey: 'prices' } },
      { key: 'who', label: 'Кой е партньор', text: 'Фирма, която поръчва поне толкова броя наведнъж.' },
      { key: 'payment', label: 'Плащане', text: '100% предплащане, по договор.' },
      { key: 'resale', label: 'Продажба', text: 'Продавате навсякъде и на цена, която определяте вие.' },
      {
        key: 'delivery',
        label: 'Доставка',
        text: 'До вас, до вашия склад или направо до вашия клиент. Контейнер — {containerRate}/км, Бокс къща — около {boxRate}/км и кран около {boxCrane}; км в двете посоки, без ДДС. България и Гърция — по калкулатора, другите държави — по запитване.',
        link: { label: 'Изчислете доставката →', pathKey: 'delivery' },
      },
      { key: 'ownLogistics', label: 'Собствена логистика', text: 'Може да платите директно на фабриката и да организирате транспорта сами.' },
      { key: 'documents', label: 'Документи', text: 'Списък на материалите, CAD чертежи, CE сертификат и всички други нужни документи — за контейнерите и за къщите.' },
      { key: 'customs', label: 'Митница', text: 'Поемаме я ние — за всичко, което доставяме.' },
      { key: 'insurance', label: 'Застраховка и проследяване', text: 'Предлагаме ги за транспорта.' },
      { key: 'yard', label: 'Склад', text: 'В Марикостиново. Може да го посетите с предварителна уговорка.' },
      { key: 'containers', label: 'Контейнери', text: 'Моделите от галерията са на склад, монтажът е в цената. При вас до {days} дни.' },
      { key: 'boxes', label: 'Бокс къщи', text: '37, 58 и 73 м², пътуват сгънати. Изработват се до {production} дни и са на адреса за около {months} месеца.' },
      { key: 'steel', label: 'Сглобяеми къщи', text: 'По ваш проект или по проект, който изготвяме ние.' },
      // The short form; the questions below give every term, the conditions and what it does not cover.
      { key: 'warranty', label: 'Гаранция', text: 'Контейнери и Бокс къщи: конструкция\u00a0{structureYears}\u00a0г., панели\u00a0{panelYears}\u00a0г., дограма\u00a0{joineryYears}\u00a0г., санитария\u00a0{sanitaryYears}\u00a0г. — от предаването.' },
    ],
    note: 'Цените в галерията са крайни цени на дребно, с ДДС. Офертата за количество е отделна.',
  },

  // The three product pages with their live "from" prices (the gallery's, never typed).
  products: {
    heading: 'Какво можете да поръчате',
    sub: 'Цените тук са на дребно, с ДДС. За количество правим отделна оферта.',
    go: 'Разгледайте →',
    from: 'от',
    containers: { label: 'Контейнерни модули', desc: 'Жилищни и офис контейнери 6×3, 7×3 и 8×3 м, на склад в Марикостиново.', basis: 'с ДДС и монтаж' },
    houses: { label: 'Бокс къщи', desc: 'Разгъваеми къщи 37, 58 и 73 м², които пътуват сгънати.', basis: 'с ДДС, без монтаж' },
    steel: { label: 'Сглобяеми къщи по проект', desc: 'Стоманена конструкция по ваш или по наш проект.' },
    // A separate product, sold to builders, developers and shops; never for the Box houses.
    doors: { label: 'Интериорни врати на едро', desc: 'Врати в комплект с каса, панти, дръжка и первази, за вашия обект. Цената зависи от количеството.' },
  },

  // Each step's picture is a slot of "Снимки на сайта" (photoSlotNames.js PARTNER_STEP_SLOTS):
  // steps 1, 3 and 4 have their own, step 2 reads About's factory-floor. adminAlt is the alt
  // for an owner's photo there (his own description on this page when he types one): it names
  // the place the caption names and nothing of the default photo, in words other than the
  // caption's, so a screen reader does not hear the figure say the same thing twice. The
  // captions stay.
  process: {
    heading: 'Как работим',
    steps: [
      {
        title: 'Запитване',
        text: 'Пишете ни какво, колко броя и къде — до вас или до вашия клиент.',
        image: { src: '/delivery/journey-yard.webp', adminAlt: 'Снимка от нашата база в Марикостиново', alt: 'Сгъната Бокс къща се разтоварва от морски контейнер в нашата база', caption: 'Нашата база в Марикостиново' },
      },
      {
        title: 'Оферта за количеството и договор',
        text: 'Получавате цена за цялото количество, с доставката. Подписваме договор и плащате 100% предварително.',
        image: { src: '/factory/factory-hall-1200.webp', adminAlt: 'Снимка от цеха на нашата фабрика в Китай', alt: 'Цехът на нашата фабрика в Китай: стоманени профили и панели, подредени на пода', caption: 'Производството в нашата фабрика в Китай' },
      },
      {
        title: 'От склада или от нашата фабрика',
        text: 'Контейнерите на склад са при вас до {days} дни. Бокс къщите се изработват до {production} дни и пристигат по море; митницата поемаме ние.',
        image: { src: '/delivery/journey-port.webp', adminAlt: 'Снимка от пристанището', alt: 'Сгъната Бокс къща, опакована във фолио, се вдига на пристанището', caption: 'На пристанището' },
      },
      {
        title: 'Доставка',
        text: 'Докарваме до вас, до склада ви или направо до вашия клиент. Или плащате директно на фабриката и организирате транспорта сами.',
        image: { src: '/delivery/journey-plot.webp', adminAlt: 'Доставка при клиента', alt: 'Кран поставя модул върху наземни винтове', caption: 'При клиента' },
      },
    ],
  },

  // „Кой какво поема". No line on connecting utilities; the warranty is in „Накратко" and the questions.
  split: {
    heading: 'Кой какво поема',
    we: {
      title: 'Ние',
      items: [
        'Производството в нашата фабрика в Китай',
        'Морския превоз и митницата',
        'Доставката с камион и кран — до вас, до склада ви или до вашия клиент; кранът е за ваша сметка, около {boxCrane} без ДДС',
        'Монтажа на контейнерите',
        'Документите: списък на материалите, CAD чертежи, CE сертификат',
        'Застраховка и проследяване на транспорта, ако ги искате',
      ],
    },
    you: {
      title: 'Вие или вашият клиент',
      items: [
        'Плащането — 100% предварително, по договор',
        'Продажбата — където и на каквато цена решите',
        'Основата — каква е нужна, зависи от мястото',
        'Достъп до мястото за камиона и крана',
        'Нощувките на нашите двама работници ({nights} нощи) и пътя им — до {travel} без ДДС, ако контейнерът се сглобява на място',
        'Транспорта, ако изберете собствена логистика',
      ],
    },
  },

  // The published Paralia Kariani case, as the delivery page draws it, and the delivery
  // page's own words for it.
  proof: {
    heading: 'Реални доставки',
    sub: 'Бокс къща, доставена и монтирана в Гърция.',
    case: delivery.proof.case,
    photo: delivery.proof.photo,
    stars: delivery.proof.stars,
    more: delivery.proof.more,
    reviews: 'Отзиви от наши клиенти →',
  },

  form: {
    heading: 'Запитване от фирма',
    sub: 'Около минута. Полетата със * са задължителни.',
    optional: 'по избор',
    role: {
      legend: 'Кое ви описва',
      options: { reseller: 'Препродавам', ownSite: 'Купувам за свой обект', other: 'Друго' },
      error: 'Изберете кое ви описва.',
    },
    sector: {
      label: 'Сфера',
      placeholder: 'Изберете',
      options: {
        glamping: 'Къмпинг или глемпинг',
        hotel: 'Хотел или къща за гости',
        construction: 'Строителна фирма',
        farm: 'Стопанство',
        investor: 'Инвеститор',
        shop: 'Магазин',
        realEstate: 'Агенция за имоти',
        other: 'Друго',
      },
    },
    products: {
      legend: 'Продукти',
      options: { container: 'Контейнери', box37: 'Бокс 37 м²', box58: 'Бокс 58 м²', box73: 'Бокс 73 м²', steel: 'Сглобяема къща по проект' },
    },
    quantity: {
      legend: 'Колко броя в поръчката',
      options: { '2-5': '2–5', '6-10': '6–10', '11-25': '11–25', '25+': '25+' },
      hint: 'По-ниска цена: контейнери от {containerMin} бр., Бокс къщи от {boxMin} бр.',
      error: 'Изберете броя.',
    },
    timing: {
      label: 'Кога',
      placeholder: 'Изберете',
      options: { month: 'До 1 месец', '1-3m': '1–3 месеца', '3-6m': '3–6 месеца', season: 'За следващия сезон', exploring: 'Само проучвам' },
    },
    boxNote: 'Бокс къщата се изработва до {production} дни и е на адреса за около {months} месеца. Ако ви трябва до месец, изберете контейнер от склада.',
    logistics: {
      legend: 'Транспорт',
      options: { ours: 'Доставка от нас', own: 'Собствена логистика — плащам директно на фабриката' },
    },
    country: {
      label: 'Държава',
      placeholder: 'Изберете',
      options: { BG: 'България', GR: 'Гърция', MK: 'Северна Македония', RO: 'Румъния', EU: 'Друга държава в ЕС', nonEU: 'Извън ЕС' },
      error: 'Изберете държава.',
    },
    region: 'Град или област',
    company: 'Фирма',
    vatId: 'ЕИК / ДДС номер',
    name: { label: 'Име', error: 'Напишете името си.' },
    phone: { label: 'Телефон', error: 'Напишете телефон — обаждаме се по фирмените запитвания.' },
    email: { label: 'Имейл', error: 'Напишете имейл, на който да ви пишем.' },
    message: { label: 'Съобщение', placeholder: 'Модели, размери, срокове, мястото на доставка…' },
    privacy: 'Използваме данните само за да отговорим на запитването.',
    privacyLink: 'Поверителност',
    submit: 'Изпратете запитването',
    invalid: 'Попълнете отбелязаните полета.',
  },

  // The header's offer and question forms, opened on this page, carry this line, so the
  // enquiry reads as a partner's in Запитвания.
  prefill: {
    offer: 'Партньорско запитване — от страницата за партньори',
    cargo: 'Въпрос за превоз на товар — от страницата за партньори',
  },

  faq: {
    heading: 'Въпроси от търговци',
    // The link to the FAQ hub under the questions (the hub gathers these and answers more).
    more: 'Още въпроси и отговори →',
    items: [
      { id: 'partner-price', q: 'Каква е цената за няколко броя?', a: 'По-ниска от цената на дребно — според броя: за контейнери от {containerMin} бр., за Бокс къщи от {boxMin} бр. в една поръчка. Точната цена е в офертата за вашето количество.' },
      { id: 'partner-who', q: 'Кой може да стане партньор?', a: 'Фирма, която поръчва поне {containerMin} контейнера или поне {boxMin} Бокс къщи в една поръчка.' },
      { id: 'partner-payment', q: 'Как плащат партньорите?', a: 'Цялата сума предварително, по договор с нас.' },
      { id: 'partner-resale', q: 'Мога ли да продавам навсякъде и на своя цена?', a: 'Да. Продавате където искате и на цената, която определите вие.' },
      { id: 'partner-delivery', q: 'Доставяте ли до моя клиент или до моя склад? А извън България?', a: 'Да — до вас, до склада ви или направо до клиента. В България и Гърция по цените от калкулатора: контейнер {containerRate}/км, Бокс къща около {boxRate}/км и кран около {boxCrane}, км в двете посоки, без ДДС. За други държави — по запитване.' },
      { id: 'partner-documents', q: 'Какви документи получавам?', a: 'Списък на материалите, CAD чертежи, CE сертификат и всички други нужни документи — за контейнерите и за къщите.' },
      // The hub's own customs answer and the delivery page's lead time say the same and are
      // marked up there: these two are shown here and marked up there, once.
      { id: 'partner-customs', markup: 'faq', q: 'Кой поема митницата?', a: 'Ние — за всичко, което доставяме.' },
      { id: 'partner-lead-time', markup: 'delivery', q: 'Колко време отнема?', a: 'Контейнер от склада е при вас до {days} дни. Бокс къщата се изработва до {production} дни и е на адреса за около {months} месеца.' },
      { id: 'partner-visit', q: 'Мога ли да видя стоката?', a: 'Да. Складът ни е в Марикостиново — посещение с предварителна уговорка.' },
      { id: 'partner-own-logistics', q: 'Като партньор мога ли да използвам собствена логистика?', a: 'Да. Може да платите директно на фабриката и да организирате транспорта сами.' },
      // Also the FAQ hub's question (id 'warranty'): shown here, marked up there, once.
      { id: 'warranty', markup: 'faq', q: 'Каква е гаранцията на контейнерите и Бокс къщите?', a: 'Носещата стоманена конструкция — {structureYears}\u00a0години; термопанелите — {panelYears}\u00a0години; дограмата (профили и стъклопакети) — {joineryYears}\u00a0години; санитарните уреди и ВиК арматурата — {sanitaryYears}\u00a0години. Останалите елементи се проверяват визуално при предаването. Гаранцията покрива фабрични дефекти и тече от датата на предаване — при нормална употреба, подходяща основа, добро отводняване и без неразрешена намеса от трети лица. Не покрива механични повреди, неправилен транспорт или разтоварване, които не са извършени от нас, неподходяща основа, липса на вентилация, лошо отводняване, течове от външни връзки, конденз, по-късни ремонти или промени от купувача или от трети лица, както и форсмажорни обстоятелства.' },
    ],
  },

  cargo: {
    heading: 'Организираме и вашия товар',
    text: 'Ако внасяте сами, можем да организираме превоза — попитайте ни.',
    ask: 'Задайте въпрос',
  },

  finalTitle: 'Да обсъдим вашата поръчка?',
}
