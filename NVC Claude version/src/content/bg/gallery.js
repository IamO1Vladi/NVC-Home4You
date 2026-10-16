export default {
  // The title and description are routeMeta.js's (META.gallery), read by GalleryRoutes.jsx.
  // The index (GalleryIndexPage.jsx): the line above the H1, the H1, and one line under it.
  // The Box houses are made to order (up to 40 days in production, the owner 2026-10-15), so
  // the lead does not call every model "available"; the gallery's containers are stock models.
  eyebrow: 'Модели и цени',
  // The four lines, in the chips' words and order (filters.shown), since 2026-10-17. Longer than
  // the title, which has no room for "Галерия" or "космически" (routeMeta.js META.gallery).
  heading: 'Галерия: контейнери, Бокс къщи, космически капсули и сглобяеми къщи',
  // Not "every model with its price": a steel-frame project (prefab, 2026-10-17) is priced per
  // project and its card may have none. The capsule takes 3–4 months, as a Box house does (the
  // owner, 2026-10-17); every steel-frame house is its own project (the owner, 2026-10-12).
  lead: 'Цените са с ДДС: контейнерите са на склад, Бокс къщите и капсулата се изработват по поръчка, а всяка сглобяема къща е отделен проект.',
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
    // uses for its product lines. Each one is shown only while it has a model (indexFilterIds):
    // "Сглобяема къща" and "Гараж" always opened empty and were removed, and the owner asked for
    // the capsules and the steel-frame projects to have their own (both 2026-10-17). "prefab"
    // holds the steel-frame houses already built, which a customer can ask for one like.
    shown: {
      wagon: 'Контейнери',
      modular: 'Бокс къщи',
      capsule: 'Космически капсули',
      prefab: 'Сглобяеми къщи',
    },
    // The item page's name for a model's category, under its title and in its Product markup
    // (GalleryRoutes.jsx). All five ids keep one: the admin can still file a model under any.
    categories: {
      prefab: 'Сглобяема къща',
      wagon: 'Фургон',
      modular: 'Модулна къща',
      capsule: 'Космическа капсула',
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
      // A steel-frame project already built (prefab): its price is what that project cost, and a
      // house like it is priced per project (the owner, 2026-10-17).
      project: 'с ДДС, за този проект',
      projectOnRequest: 'Цена по проект',
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
    // A steel-frame project (prefab): its own price with no "От", or none at all, and the
    // enquiry is for a house like it.
    projectPrice: '{price} · с ДДС, за този проект',
    priceByProject: 'Цена по проект',
    requestLikeCta: 'Поискай оферта за подобна къща',
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
      // The capsule's own card on the Box houses page, and a steel-frame project's page.
      capsule: 'Космическата капсула: размери, доставка, гаранция →',
      steel: 'Сглобяемите къщи по проект: как работим →',
      prices: 'Цената с монтажа в таблицата с цени →',
      // For a house whose assembly is still quoted on request (its row says so).
      pricesNoAssembly: 'Цената в таблицата с цени →',
      configurator: 'Сглобете тази къща в конфигуратора →',
      delivery: 'Изчислете доставката до вас →',
      // A steel-frame project's: the calculator quotes its delivery with the project (the delivery
      // page's own name for it, "Къща по проект").
      deliveryProject: 'Доставка и митница при къща по проект →',
    },
  },
  altBase: {
    bg: 'https://nvc-home4you.eu/bg/galeriq',
    en: 'https://nvc-home4you.eu/en/gallery',
    el: 'https://nvc-home4you.eu/el/gkaleri',
  },
}
