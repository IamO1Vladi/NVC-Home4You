// The delivery page, /bg/dostavka-do-vratata: "Доставка и монтаж".
//
// WORDS ONLY. Every rate, crane price, workers' figure and lead time is a {placeholder} the page
// fills from src/content/shared/deliveryRates.js (the owner's answers of 2026-10-15); the Box
// assembly "from" from prices.js; the truck sizes and weights from boxConfiguratorCatalog.js;
// the example km from deliveryPlaces/examples.json. So a price change is still one line there.
//
// The placeholders: {containerRate} {boxRate} {containerCrane} {boxCrane} {nights} {travel}
// {days} {production} {months} {assembly}. Delivery and crane figures are WITHOUT VAT, and every
// sentence that prints one says so; house and container prices elsewhere include it.
//
// No seo block: the title, description, canonical and hreflangs come from routeMeta.js.
// Nothing here about forwarding, tracking, insurance or connecting utilities: the owner offers
// none of it as a service, and the old logistics page that claimed it is retired.
export default {
  breadcrumb: 'Доставка и монтаж',
  home: 'Начало',

  // ServiceJSONLD, no price: the page publishes a rate and an estimate, not an offer.
  service: {
    name: 'Доставка и монтаж на контейнери и Бокс къщи',
    serviceType: 'Доставка с камион и поставяне с кран',
  },

  hero: {
    eyebrow: 'Доставка и монтаж',
    h1: 'Доставка и монтаж до вашия парцел',
    lead: 'Цената зависи от това какво доставяме и колко далеч сте. Изберете продукта и населеното място — сметката излиза веднага.',
    facts: {
      container: 'Контейнер: {containerRate}/км, в двете посоки, без ДДС',
      box: 'Бокс къща: около {boxRate}/км в двете посоки + кран около {boxCrane}, без ДДС',
      project: 'Къща по проект: доставката е в офертата',
    },
    ask: 'Задай въпрос',
  },

  // The calculator's own strings: the keys are listed at the top of DeliveryCalculator.jsx.
  // {crane}, {rate}, {travel}, {nights}, {km}, {billable}, {amount} and {from} are filled by it.
  calculator: {
    title: 'Колко струва доставката до вас',
    productLegend: 'Какво доставяме',
    products: { container: 'Контейнер', box: 'Бокс къща', project: 'Къща по проект' },
    placeLabel: 'Населено място',
    placeholder: 'напр. Банско',
    placeHint: 'В България или Гърция. Може да поставите и цял адрес.',
    loading: 'Зареждаме населените места…',
    loadError: 'Списъкът с населени места не се зареди.',
    retry: 'Опитайте отново',
    suggestionsLabel: 'Населени места',
    suggestionsCount: { one: '1 предложение', many: '{count} предложения' },
    noMatch: 'Не намираме това място в България или Гърция. Доставки извън тях оферираме отделно — пишете ни.',
    countries: { BG: 'България', GR: 'Гърция' },
    region: { BG: 'обл. {region}', GR: '{region}' },
    bases: { marikostinovo: 'Марикостиново', varna: 'Варна' },
    fromBase: { marikostinovo: 'от Марикостиново', varna: 'от Варна' },
    km: 'км',
    vat: 'без ДДС',
    resultLabel: 'Цена на доставката',
    distance: '{km} по пътя {from}, в една посока',
    billable: 'В двете посоки: {km} × 2 = {billable}',
    boxBase: 'Бокс къщата тръгва {from} — оттам е по-близо.',
    container: {
      transportLabel: 'Транспорт',
      transportMath: '{billable} × {rate}/км',
      fixed: 'фиксирана тарифа, без ДДС',
      assembly: 'Монтажът е включен в цената на контейнера.',
      craneTitle: 'С кран — по избор',
      crane: 'Около {crane} без ДДС, за ваша сметка. Сглобяваме контейнера в нашия склад и той пристига готов — без път и нощувки за работници.',
      noCraneTitle: 'Без кран',
      noCrane: 'Двама наши работници го сглобяват на място и остават {nights} нощи. Пътят им добавя до {travel} без ДДС според мястото, а нощувките им осигурявате вие.',
    },
    box: {
      transportLabel: 'Транспорт',
      transportMath: '{billable} × около {rate}/км',
      craneLabel: 'Кран',
      craneNote: 'според мястото може и повече',
      totalLabel: 'Общо',
      about: 'около {amount}',
      noCrane: 'Бокс къща не се доставя без кран.',
      included: 'Морският превоз от Китай и митницата вече са в цената на къщата.',
      assembly: 'Монтажът се оферира отделно.',
      assemblyLink: 'Вижте цените',
    },
    project: {
      text: 'Доставката се оферира с проекта; митницата поемаме ние.',
    },
    onRequest: 'Доставката до това място е по запитване.',
    notes: {
      approx: 'Ориентировъчно — по пътя до центъра на населеното място; точната цена е в офертата.',
      several: 'За повече от един контейнер или Бокс къща — оферта по запитване.',
      foundation: 'Основата не е включена — зависи от мястото.',
      // The place table's names and road km are OpenStreetMap data (ODbL): credited wherever shown.
      data: 'Населени места и разстояния: © OpenStreetMap contributors',
    },
    enquiry: 'Изпратете запитване с тази доставка',
    enquiryPlain: 'Изпратете запитване',
    map: {
      show: 'Покажи на картата',
      hide: 'Скрий картата',
      loading: 'Картата се зарежда…',
      label: 'Карта: нашата база и избраното място',
      hint: 'Докоснете картата, за да изберете най-близкото населено място.',
      nothingNear: 'Наблизо няма населено място от нашия списък. Докоснете по-близо до град или село.',
      line: '{km} по пътя',
      zoomIn: 'Приближи',
      zoomOut: 'Отдалечи',
      attributionTitle: 'JavaScript библиотека за интерактивни карти',
      baseMarker: 'Нашата база: {base}',
      placeMarker: '{place}',
    },
    offer: {
      heading: 'Доставка — ориентировъчна сметка',
      product: 'Продукт',
      place: 'Място',
      distance: 'Разстояние',
      distanceValue: '{km} в една посока {from}; {billable} за таксуване',
      transport: 'Транспорт',
      crane: 'Кран',
      total: 'Общо',
      craneOptional: 'по избор, около {crane}',
      noCraneTravel: 'Без кран: пътят на работниците до {travel}, нощувките им — от клиента.',
      onRequest: 'по запитване',
      project: 'Доставката се оферира с проекта.',
      outside: 'Извън България и Гърция — оферта по запитване.',
      footer: 'Ориентировъчно; всички суми са без ДДС.',
      question: 'Въпрос за доставка — {product}, {place} ({km} в една посока).',
      questionOnRequest: 'Въпрос за доставка — {product}, {place}.',
      questionOutside: 'Въпрос за доставка — {product}, {place}.',
    },
  },

  included: {
    heading: 'Какво влиза в цената',
    sub: 'Доставката и кранът са без ДДС. Цените на къщите и контейнерите на сайта са с ДДС.',
    cards: {
      container: {
        title: 'Контейнер',
        lines: [
          { label: 'Транспорт', text: '{containerRate}/км, в двете посоки — фиксирана тарифа, без ДДС.' },
          { label: 'Монтаж', text: 'Включен е в цената на всеки контейнер.' },
          { label: 'С кран', text: 'По ваш избор, около {containerCrane} без ДДС. Тогава сглобяваме контейнера в нашия склад и той пристига готов.' },
          { label: 'Без кран', text: 'Двама наши работници го сглобяват на място и остават {nights} нощи. Пътят им добавя до {travel} без ДДС, а нощувките им осигурявате вие.' },
          { label: 'Митница', text: 'Поемаме я ние.' },
        ],
      },
      box: {
        title: 'Бокс къща',
        lines: [
          { label: 'Транспорт', text: 'Около {boxRate}/км, в двете посоки, без ДДС — от Марикостиново или от Варна, откъдето е по-близо.' },
          { label: 'Кран', text: 'Задължителен — около {boxCrane} без ДДС, а според мястото може и повече. Без кран не е възможно.' },
          { label: 'Морски превоз и митница', text: 'Вече са в цената на къщата. За пътя до вас плащате само камиона и крана.' },
          { label: 'Монтаж', text: 'Отделно, от {assembly} без ДДС.' },
        ],
        pricesLink: 'Цените с монтажа →',
      },
      project: {
        title: 'Къща по проект',
        lines: [
          { label: 'Доставка', text: 'Доставяме елементите до вашия парцел. Цената е в офертата за проекта.' },
          { label: 'Митница', text: 'Поемаме я ние.' },
        ],
      },
    },
    foundation: 'Основата не е включена — каква е нужна, зависи от мястото.',
    several: 'Повече от един контейнер или Бокс къща — оферта по запитване. Извън България и Гърция — също.',
    // After `several`: a link to the partner page's enquiry form (#zapitvane).
    partnerLink: 'Оферта за няколко броя →',
    call: 'Обадете се',
  },

  examples: {
    heading: 'Примерни цени',
    sub: 'По пътя от нашата база до центъра на населеното място.',
    columns: ['Място · км в една посока', 'Контейнер, без ДДС', 'Бокс къща: транспорт + кран, без ДДС'],
    // {transport} and {crane} arrive formatted; the Box house figures are estimates.
    box: 'около {transport} + кран около {crane}',
    // A place at the Varna base itself has no transport worth printing, only the crane.
    boxCraneOnly: 'кран около {crane}',
    fromVarna: 'от Варна, {km} — по-близо е',
    note: 'Ориентировъчно, до центъра на населеното място, без ДДС. Точната цена е в офертата.',
  },

  journey: {
    heading: 'От пристанището до вашия парцел',
    sub: 'Кадри от наши доставки.',
    // In this order, each beside its clip in public/delivery/journey-<id>.mp4.
    clips: [
      { id: 'port', title: 'На пристанището', text: 'Сгънатата къща пристига с кораба от Китай; митницата поемаме ние.' },
      { id: 'yard', title: 'В нашата база', text: 'Разтоварваме я от морския контейнер.' },
      { id: 'truck', title: 'На камиона', text: 'С кран я качваме на камиона, който я кара до вас.' },
      { id: 'plot', title: 'На вашия парцел', text: 'Кранът я поставя на основата — тук на наземни винтове.' },
    ],
    leadTimesHeading: 'Колко време отнема',
    leadTimes: {
      container: 'Контейнер на склад — при вас до {days} дни.',
      box: 'Бокс къща — изработва се до {production} дни и е на вашия адрес за около {months} месеца.',
    },
    unfoldHeading: 'На място се разгъва',
    unfoldText: 'Бокс къщата пътува сгъната и се разгъва едва на мястото си.',
    truck: {
      heading: 'Размери и тегло при транспорт',
      columns: ['Модел', 'Размери при транспорт (Д × Ш × В)', 'Тегло'],
      dims: '{l} × {w} × {h} м',
      weight: '{kg} кг',
      note: 'Толкова трябва да носят камионът и кранът.',
    },
  },

  prepare: {
    heading: 'Какво да подготвите',
    photoAlt: 'Кран сваля дълъг модул от камион върху бетонна площадка',
    adminAlt: 'Доставка на модул с камион и кран',
    terms: [
      // foundationNote: the prices page's ground-screw recommendation follows the text.
      { label: 'Основа', text: 'Зависи от мястото — обадете се за вашия терен.', foundationNote: true },
      { label: 'Достъп', text: 'Камионът и кранът трябва да стигнат до мястото на къщата. Опишете ни пътя и мястото — снимка помага. Според мястото кранът може да струва и повече.' },
      { label: 'Контейнер с кран', text: 'Сглобяваме го в нашия склад и пристига готов. Трябва само място за крана.' },
      { label: 'Контейнер без кран', text: 'Двама наши работници го сглобяват на място и остават {nights} нощи. Осигурявате нощувките им; пътят им добавя до {travel} без ДДС.' },
    ],
  },

  // The published case (/api/cases-page, id "2"), as the Box page draws it; not drawn if it is
  // ever unpublished. Its photo is shown only while the case still lists it.
  proof: {
    heading: 'Доставена при клиент',
    sub: 'Бокс къща, доставена и монтирана в Гърция.',
    case: {
      id: '2',
      line: '58 м² с веранда · Паралия Кариани, Гърция · 2026',
      result: 'Доставена и монтирана до ключ.',
      name: 'Вангелис',
    },
    photo: {
      url: '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
      alt: 'Разгъваема къща от 58 м² с веранда, доставена в Паралия Кариани, Гърция',
    },
    stars: '{rating} от 5',
    more: 'Вижте проекта →',
  },

  faq: {
    heading: 'Въпроси за доставката',
    items: [
      {
        id: 'delivery-both-ways',
        q: 'Как се смята цената на доставката „в двете посоки“?',
        a: 'Удвояваме километрите по пътя от нашата база до вашето населено място и ги умножаваме по цената на километър: {containerRate} за контейнер и около {boxRate} за Бокс къща, без ДДС. Бокс къщата се смята от Марикостиново или от Варна — откъдето е по-близо.',
      },
      {
        id: 'delivery-crane',
        q: 'Колко струва кранът?',
        a: 'За Бокс къща кранът е задължителен: около {boxCrane} без ДДС, а според мястото може и повече. За контейнер е по ваш избор, около {containerCrane} без ДДС — тогава сглобяваме контейнера в нашия склад и той пристига готов.',
      },
      {
        id: 'delivery-without-crane',
        q: 'Може ли без кран?',
        a: 'Контейнер — да: двама наши работници го сглобяват на място и остават {nights} нощи. Пътят им добавя до {travel} без ДДС според мястото, а нощувките им осигурявате вие. Бокс къща — не, без кран не е възможно.',
      },
      {
        id: 'delivery-abroad',
        q: 'Доставяте ли в Гърция и в други държави?',
        a: 'В Гърция — да, на същите цени; там вече сме доставили Бокс къща в Паралия Кариани. За други държави — по запитване.',
      },
      {
        id: 'delivery-lead-time',
        q: 'За колко време пристига контейнерът или Бокс къщата?',
        a: 'Контейнер, който е на склад, е при вас до {days} дни. Бокс къщата се изработва до {production} дни и е на вашия адрес за около {months} месеца.',
      },
      {
        id: 'delivery-final-price',
        q: 'Окончателна ли е цената от калкулатора?',
        a: 'Сметката е ориентировъчна — по пътя до центъра на населеното място, без ДДС. За контейнер тарифата е фиксирана, за Бокс къща цената е приблизителна. Точната цена е в офертата. За повече от един контейнер или Бокс къща правим отделна оферта.',
      },
    ],
  },

  siblings: {
    heading: 'Какво доставяме',
    go: 'Разгледайте →',
    containers: { label: 'Контейнерни модули', desc: 'Контейнери за живеене и офис, с монтажа в цената.' },
    houses: { label: 'Бокс къщи', desc: 'Разгъваеми къщи, които пътуват сгънати.' },
    steel: { label: 'Сглобяеми къщи по проект', desc: 'Стоманена конструкция по ваш или наш проект.' },
    prices: { label: 'Цени', desc: 'Всички цени, с монтажа и с ДДС.' },
  },

  finalTitle: 'Да сметнем доставката до вашия парцел?',
}
