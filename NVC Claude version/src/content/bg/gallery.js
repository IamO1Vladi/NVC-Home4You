export default {
  // The title and description are routeMeta.js's (META.gallery), read by GalleryRoutes.jsx.
  heading: 'Галерия: контейнери и Бокс къщи',
  sub: 'Разгледайте наличните модели и отворете детайлна страница за всяко решение.',
  loading: 'Зареждане на модели…',
  error: 'Галерията не можа да се зареди. Опитайте по-късно.',
  empty: {
    all: 'Няма добавени модели.',
    filtered: 'Няма модели в тази категория.',
  },
  filtersAria: 'Филтри',
  filters: {
    all: 'Всички',
    categories: {
      prefab: 'Сглобяема къща',
      wagon: 'Фургон',
      modular: 'Модулна къща',
      garage: 'Гараж',
    },
  },
  pagination: {
    paginationAria: 'Навигация по страници',
    prev: 'Предишна',
    next: 'Следваща',
    pages: 'Страници',
    currentPage: 'Текуща страница',
    pageAbbr: 'Стр.',
  },
  viewDetails: 'Виж детайли',
  openCta: 'Отвори →',
  schema: {
    listName: 'Галерия с модели',
  },
  breadcrumbs: {
    home: 'Начало',
    gallery: 'Галерия',
  },
  detail: {
    backToGallery: '← Обратно към галерията',
    descriptionTitle: 'Описание',
    requestCta: 'Поискай оферта',
    pricePrefix: 'От ',
    priceOnRequest: 'Цена по запитване',
    imageThumb: 'Изображение',
    closeLabel: 'Затвори',
    loading: 'Зареждане на модела…',
    error: 'Моделът не можа да бъде зареден. Опитайте отново.',
    notFoundTitle: 'Моделът не е намерен',
    notFoundText: 'Този URL не съвпада с наличен модел от API.',
    // The links under the request button (src/gallery/itemLinks.js): its product page, its row in
    // the prices table, the configurator on its model (37, 58 and 73 m² only) and the delivery
    // calculator for its kind of product. A link the item has no target for is not drawn.
    links: {
      heading: 'Още за този модел',
      containers: 'Всичко за контейнерите: монтаж, доставка, гаранция →',
      box: 'Бокс къщите: размери, монтаж, гаранция →',
      prices: 'Цената с монтажа в таблицата с цени →',
      // For a house whose assembly is still quoted on request (its row says so).
      pricesNoAssembly: 'Цената в таблицата с цени →',
      configurator: 'Сглобете тази къща в конфигуратора →',
      delivery: 'Изчислете доставката до вас →',
    },
  },
  altBase: {
    bg: 'https://nvc-home4you.eu/bg/galeriq',
    en: 'https://nvc-home4you.eu/en/gallery',
    el: 'https://nvc-home4you.eu/el/gkaleri',
  },
}
