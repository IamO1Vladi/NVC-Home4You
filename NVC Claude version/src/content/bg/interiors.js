export default {
  seo: {
    title: 'Вътрешни ремонти на бани и кухни | NVC Home4You',
    description:
      'Вътрешни ремонти на бани и кухни с ясен процес, конфигурации по проект, ориентировъчна сложност и довършителни решения според бюджета.',
    url: 'https://nvc-home4you.eu/bg/vytreshni-remonti',
  },
  breadcrumbs: [
    { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
    { name: 'Вътрешни ремонти', url: 'https://nvc-home4you.eu/bg/vytreshni-remonti' },
  ],
  title: 'Вътрешни ремонти',
  lead: 'Ремонти на бани и кухни с ясен обхват, конфигурации по избор и контрол върху сроковете и бюджета.',
  getOffer: 'Получи оферта',
  askQuestion: 'Задай въпрос',
  hero: {
    quick: {
      h: 'Накратко',
      items: [
        'График и етапи още в началото на проекта',
        'Прозрачно ценообразуване и ясно дефиниран обхват',
        'Договор, координация и реални довършителни опции',
      ],
      brochure: {
        file: 'modular-builds/modular-builds.pdf',
        page: 4,
        label: 'Отвори брошурата (стр. 4)',
      },
    },
  },
  tabs: {
    label: 'Категории вътрешни ремонти',
    bath: 'Баня',
    kitchen: 'Кухня',
  },
  beforeAfterLabels: {
    comparisonAria: 'Сравнение преди и след ремонта',
    revealLabel: 'Плъзгач за сравнение',
    rangeLabel: 'Степен на разкриване',
    before: 'Преди',
    after: 'След',
  },
  calculator: {
    heading: 'Изберете обхват на работата',
    complexityLabel: 'Сложност',
    timelineLabel: 'Ориентировъчен срок',
    cta: 'Изпрати запитване',
    baseScore: 1,
    levels: {
      low: { maxScore: 4, label: 'Ниска', timeline: 'до 1 седмица' },
      medium: { maxScore: 8, label: 'Средна', timeline: '1–2 седмици' },
      high: { label: 'Висока', timeline: '2+ седмици' },
    },
  },
  bath: {
    h: 'Ремонт на баня',
    p: 'Комбинирайте подготвителни, инсталационни и довършителни работи според конкретния проект и желания краен вид.',
    options: [
      { key: 'bath_demo', label: 'Къртене и демонтаж', weight: 2 },
      { key: 'bath_plumbing', label: 'ВиК промени', weight: 3 },
      { key: 'bath_electrical', label: 'Ел. инсталация', weight: 2 },
      { key: 'bath_tiles', label: 'Премиум плочки', weight: 2 },
      { key: 'bath_underfloor', label: 'Подово отопление', weight: 2 },
      { key: 'bath_grout', label: 'Фугиране и силикон', weight: 1 },
      { key: 'bath_accessories', label: 'Огледала и аксесоари', weight: 1 },
    ],
    beforeAfter: {
      before: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc2/eg/vb',
      after: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc4/eg/vb',
      altBefore: 'Баня преди ремонт',
      altAfter: 'Баня след ремонт',
    },
  },
  kitchen: {
    h: 'Ремонт на кухня',
    p: 'Планирайте основните дейности по кухнята - подготовка на помещението, инсталации, монтаж и финален вид.',
    options: [
      { key: 'kitchen_design', label: 'Планиране и дизайн', weight: 1 },
      { key: 'kitchen_prep', label: 'Подготовка на помещението', weight: 2 },
      { key: 'kitchen_utils', label: 'Инсталации и изводи', weight: 3 },
      { key: 'kitchen_install', label: 'Монтаж на кухня', weight: 3 },
      { key: 'kitchen_finish', label: 'Финални довършвания', weight: 1 },
    ],
    beforeAfter: {
      before: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rc3/eg/vb',
      after: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcz/eg/vb',
      altBefore: 'Кухня преди ремонт',
      altAfter: 'Кухня след ремонт',
    },
  },
  why: {
    h: 'Защо да работите с нас',
    items: [
      'Ясен обхват и последователен процес още преди старта на ремонта.',
      'Гъвкави конфигурации според бюджет, срок и желан стандарт на изпълнение.',
      'Координация на довършителните работи, доставките и финалното изпълнение.',
    ],
  },
}
