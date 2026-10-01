// Destination names for the route map's selects, keyed by the ids in LogisticsWorld.jsx.
// The map is drawn on this page and the partner page; partner.js imports this, so the names
// are written once. They are the names this page has always shown, in Latin script; spelling
// them in Bulgarian is a separate decision.
export const routeMapDestinations = {
  sea: {
    rtm: 'Rotterdam, NL',
    ham: 'Hamburg, DE',
    ant: 'Antwerp, BE',
    pir: 'Piraeus, GR',
    vlc: 'Valencia, ES',
    cnd: 'Constanța, RO',
    var: 'Varna, BG',
    lax: 'Los Angeles, US',
    nyc: 'New York, US',
    sts: 'Santos, BR',
    cll: 'Callao, PE',
  },
  air: {
    sof: 'Sofia (SOF), BG',
    ath: 'Athens (ATH), GR',
    fra: 'Frankfurt (FRA), DE',
    cdg: 'Paris (CDG), FR',
    lhr: 'London (LHR), UK',
    jfk: 'New York (JFK), US',
    lax: 'Los Angeles (LAX), US',
    gru: 'São Paulo (GRU), BR',
  },
  rail: {
    dsg: 'Duisburg, DE',
    ham: 'Hamburg, DE',
    waw: 'Warsaw, PL',
    bud: 'Budapest, HU',
    sof: 'Sofia, BG',
  },
}

export default {
  seo: {
    title: 'Международна логистика от Азия до Европа | NVC Home4You',
    description:
      'Международна логистика от Китай, Виетнам и Тайланд до Европа, Северна и Южна Америка. Морски, въздушен, ЖП и комбиниран транспорт с митническа координация.',
    url: 'https://nvc-home4you.eu/bg/mejdunarodna-logistika',
  },
  breadcrumbs: [
    { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
    { name: 'Международна логистика', url: 'https://nvc-home4you.eu/bg/mejdunarodna-logistika' },
  ],
  hero: {
    title: 'Международна логистика',
    lead:
      'EXW/FOB → DAP/DDP от Китай, Виетнам и Тайланд към Европа, Северна и Южна Америка. Морски (LCL/FCL), въздушен, ЖП и комбиниран транспорт с митническа координация.',
    button: 'Свържи се с нас',
    image: {
      src: '/api/img/content/bvk4n834b-rcd-eg-vb.webp',
    },
  },
  process: {
    segmentMs: 1500,
    lead: 'Подреждаме целия поток - от избора на маршрут и Incoterms до пристигането, проследяването и финалната доставка.',
    replay: 'Повтори',
    steps: [
      {
        key: 'plan',
        heading: 'Маршрут и търговски условия',
        body: 'Уточняваме произхода, дестинацията, товара и Incoterms, за да подберем правилната схема за транспорт.',
        meta: 'EXW / FOB / DAP / DDP',
      },
      {
        key: 'book',
        heading: 'Резервация и подготовка',
        body: 'Планираме море, въздух, ЖП или комбиниран маршрут според срок, бюджет и обем.',
        meta: 'LCL / FCL / Express',
      },
      {
        key: 'docs',
        heading: 'Документи и товарене',
        body: 'Подготвяме товарните документи и координираме товаренето така, че пратката да тръгне без забавяне.',
        meta: 'Документи и съответствие',
      },
      {
        key: 'transit',
        heading: 'Транзит и проследяване',
        body: 'Следим движението по маршрута и даваме ясна видимост за междинните етапи и ориентировъчните срокове.',
        meta: 'Проследяване',
      },
      {
        key: 'arrival',
        heading: 'Пристигане и финално предаване',
        body: 'Организираме пристанищни, митнически и последни сухопътни етапи до финалната точка.',
        meta: 'Внос и доставка',
      },
    ],
    windows: {
      chips: [
        'Море до Западна Европа: ~30–35 дни',
        'Море до Източна Европа: ~40–45 дни',
      ],
      sub: 'Реалният транзит зависи от пристанището, сезона, натовареността и локалните формалности.',
    },
  },
  map: {
    note: 'Ориентировъчни морски прозорци до ЕС: Западна Европа ~30–35 дни, Източна Европа ~40–45 дни; реалният срок зависи от пристанище, сезон и митнически процедури.',
    world: {
      modeLabel: 'Режим:',
      modeSea: 'Море',
      modeAir: 'Въздух',
      modeRail: 'ЖП',
      seaDestinationLabel: 'Пристанище:',
      airDestinationLabel: 'Летище:',
      railDestinationLabel: 'ЖП хъб:',
      legendLabel: 'Изходни точки',
      legendShanghai: 'Шанхай',
      legendHoChiMinh: 'Хо Ши Мин',
      legendLaemChabang: 'Лаем Чабанг',
      destinations: routeMapDestinations,
    },
  },
  tiles: [
    {
      id: 'sea',
      title: 'Морски транспорт (LCL/FCL)',
      desc: 'Контейнери и групаж към и от основни пристанища. Най-добро съотношение цена/обем при по-дълъг транзит.',
      img: '/api/img/content/bvk4n834b-rv-eg-vb.webp',
    },
    {
      id: 'air',
      title: 'Въздушен транспорт',
      desc: 'Най-бързият вариант за спешни пратки, мостри и чувствителни по срок товари.',
      img: '/api/img/content/bvk4n834b-rbq-eg-vb.webp',
    },
    {
      id: 'rail',
      title: 'ЖП транспорт',
      desc: 'Баланс между цена и време по евразийските коридори, подходящ за палетизирани и регулярни потоци.',
      img: '/api/img/content/bvk4n834b-rx-eg-vb.webp',
    },
    {
      id: 'multi',
      title: 'Комбиниран маршрут',
      desc: 'Комбинация от море, въздух, ЖП и автомобилен транспорт за по-точен бюджет и график.',
      img: '/api/img/content/bvk4n834b-rcd-eg-vb.webp',
    },
  ],
}
