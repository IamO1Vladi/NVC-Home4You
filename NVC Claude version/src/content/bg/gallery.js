export default {
  // The title and description are routeMeta.js's (META.gallery), read by GalleryRoutes.jsx.
  // The index (GalleryIndexPage.jsx): the line above the H1, the H1, and one line under it.
  // The Box houses are made to order (up to 40 days in production, the owner 2026-10-15), so
  // the lead does not call every model "available"; the gallery's containers are stock models.
  eyebrow: 'Модели и цени',
  heading: 'Галерия: контейнери и Бокс къщи',
  lead: 'Всеки модел с цената му с ДДС: контейнерите са на склад, а Бокс къщите се изработват по поръчка.',
  loading: 'Зареждане на модели…',
  error: 'Галерията не можа да се зареди. Опитайте по-късно.',
  retry: 'Опитайте отново',
  empty: {
    all: 'Няма добавени модели.',
    filtered: 'Няма модели в тази категория.',
    showAll: 'Покажи всички модели',
  },
  // How many models the list shows, after a filter too ({n}); Intl.PluralRules picks the form.
  count: { one: '{n} модел', other: '{n} модела' },
  filtersAria: 'Филтри',
  filters: {
    all: 'Всички',
    // The index's filters (galleryUtils INDEX_FILTER_IDS), in the words the rest of the site
    // uses for the two product lines. "Сглобяема къща" and "Гараж" always opened empty and
    // were removed (the owner, 2026-10-17).
    shown: {
      wagon: 'Контейнери',
      modular: 'Бокс къщи',
    },
    // The item page's name for a model's category, under its title and in its Product markup
    // (GalleryRoutes.jsx). All four ids keep one: the admin can still file a model under any.
    categories: {
      prefab: 'Сглобяема къща',
      wagon: 'Фургон',
      modular: 'Модулна къща',
      garage: 'Гараж',
    },
  },
  // One card per model: the price with what it includes, worded as on the product pages and
  // the prices table (a container's price includes its assembly, a Box house's does not).
  card: {
    basis: {
      wagon: 'с ДДС и монтаж',
      box: 'с ДДС, без монтаж',
      // A model whose assembly figure the prices table does not have (shared/prices.js).
      vat: 'с ДДС',
      // A house that needs no assembly (shared/prices.js arrivesReady: the capsule, the owner 2026-10-17).
      ready: 'с ДДС, пристига готова',
    },
    more: 'Снимки и описание →',
  },
  // Only past 24 models (galleryUtils PAGE_SIZE); real links, ?page=N.
  pagination: {
    paginationAria: 'Навигация по страници',
    prev: 'Предишна',
    next: 'Следваща',
    page: 'Страница {n}',
  },
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
