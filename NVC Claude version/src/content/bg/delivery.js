import { euro } from '../../lib/euro.js'
import { DELIVERY_BASES, DELIVERY_RATES } from '../shared/deliveryRates.js'

// The estimator still computes one rate, the container's, from Marikostinovo; the heading
// above it names both products. Every figure comes from deliveryRates.js.
const CONTAINER = DELIVERY_RATES.products.container
const BOX = DELIVERY_RATES.products.box

export default {
  seo: {
    title: 'Доставка до адрес на модулни и сглобяеми къщи | NVC Home4You',
    description:
      'Доставка до адрес на модулни, сглобяеми и контейнерни къщи с проследяване, логистика, митническо съдействие и интерактивен калкулатор за цена на доставката.',
    url: 'https://nvc-home4you.eu/bg/dostavka-do-vratata',
  },
  breadcrumbs: [
    { name: 'Начало', url: 'https://nvc-home4you.eu/bg' },
    { name: 'Доставка до вратата', url: 'https://nvc-home4you.eu/bg/dostavka-do-vratata' },
  ],
  hero: {
    title: 'Доставка до вратата',
    getOffer: 'Получи оферта',
    askQuestion: 'Задай въпрос',
    image: {
      src: '/api/img/content/bvk4n834b-rcd-eg-vb.webp',
    },
  },
  process: {
    segmentMs: 1500,
    lead: 'Организираме доставката от потвърждаването на поръчката до разтоварването на адреса, с ясен процес и координация във всеки етап.',
    bullets: [
      'Проследяване на пратката и координация на маршрута.',
      'Съдействие за застраховка и планиране на разтоварването.',
      'Подготовка на документи и подкрепа при митнически процедури.',
    ],
    replay: 'Повтори',
    steps: [
      {
        key: 'order',
        heading: 'Потвърждение на поръчката',
        body: 'Уточняваме модела, адреса, сроковете и условията за доставка, за да фиксираме правилния маршрут.',
        meta: 'План и координация',
      },
      {
        key: 'prod',
        heading: 'Производство и подготовка',
        body: 'Планираме товаренето, опаковката и готовността на обекта за приемане на доставката.',
        meta: 'Подготовка за експедиция',
      },
      {
        key: 'export',
        heading: 'Експорт и експедиция',
        body: 'Товарът отпътува с подготвени документи, а клиентът получава информация за движението и етапите.',
        meta: 'Документи и тръгване',
      },
      {
        key: 'import',
        heading: 'Внос и митници',
        body: 'Организираме вносните формалности и координираме локалната логистика до финалната точка.',
        meta: 'Митническо съдействие',
      },
      {
        key: 'door',
        heading: 'Доставка до адрес',
        body: 'Следим последния етап до адреса, разтоварването и предаването според предварителния план.',
        meta: 'Крайна доставка',
      },
    ],
    // No lead-time chips: the owner is still confirming lead times (2026-10-15).
  },
  estimator: {
    locale: 'bg-BG',
    acceptLanguage: 'bg,en',
    base: DELIVERY_BASES.marikostinovo,
    ratePerKm: CONTAINER.perKm,
    strings: {
      heading: 'Ориентировъчна цена за доставка',
      subheading: `Контейнер: ${euro(CONTAINER.perKm, 'bg')}/км от Марикостиново, в двете посоки. Бокс къща: около ${euro(BOX.perKm, 'bg')}/км, в двете посоки, от Марикостиново или от Варна (откъдето е по-близо), плюс кран около ${euro(BOX.crane.about, 'bg')}, а според мястото може и повече. Цените са без ДДС.`,
      // Owner, 2026-10-15: abroad only Greece so far, at the same rates; other countries on request.
      countriesNote: 'България и Гърция, на същите цени. Други държави — по запитване.',
      placeholder: 'Въведете адрес (пример: София, бул. Черни връх 1)',
      buttonIdle: 'Изчисли',
      buttonLoading: 'Търсене…',
      addressLabel: 'Адрес:',
      oneWayLabel: 'Разстояние в една посока:',
      billableLabel: 'Разстояние за таксуване:',
      estimateLabel: 'Ориентировъчна цена за контейнер:',
      vatLabel: 'без ДДС',
      searchNote: 'Показана е ориентировъчна права линия, когато пътният маршрут не е наличен.',
      helpText: 'Въведете адрес или кликнете върху картата, за да поставите маркер.',
      droppedPin: 'Поставен маркер',
      geocodeError: 'Грешка при геокодиране',
      notFoundError: 'Не е намерен адрес',
      // A map pin outside the countries above gets this in place of a price.
      outsideError: 'Извън България и Гърция доставката е по запитване.',
      genericError: 'Нещо се обърка',
      emptyValue: '—',
      km: 'км',
    },
  },
}
