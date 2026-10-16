export default {
  // The title and description are routeMeta.js's (META.gallery), read by GalleryRoutes.jsx.
  // The index (GalleryIndexPage.jsx): the line above the H1, the H1, and one line under it.
  // The Box houses are made to order (up to 40 days in production, the owner 2026-10-15), so
  // the lead does not call every model "available"; the gallery's containers are stock models.
  eyebrow: 'Models and prices',
  heading: 'Gallery: containers and Box houses',
  lead: 'Every model with its price incl. VAT: the containers are in stock and the Box houses are made to order.',
  loading: 'Loading models…',
  error: 'The gallery could not be loaded. Please try again later.',
  retry: 'Try again',
  empty: {
    all: 'No models have been added yet.',
    filtered: 'No models match this category.',
    showAll: 'Show all models',
  },
  // How many models the list shows, after a filter too ({n}); Intl.PluralRules picks the form.
  count: { one: '{n} model', other: '{n} models' },
  filtersAria: 'Filters',
  filters: {
    all: 'All',
    // The index's filters (galleryUtils INDEX_FILTER_IDS), in the words the rest of the site
    // uses for the two product lines. "Prefab house" and "Garage" always opened empty and
    // were removed (the owner, 2026-10-17).
    shown: {
      wagon: 'Containers',
      modular: 'Box houses',
    },
    // The item page's name for a model's category, under its title and in its Product markup
    // (GalleryRoutes.jsx). All four ids keep one: the admin can still file a model under any.
    categories: {
      prefab: 'Prefab house',
      wagon: 'Wagon / site cabin',
      modular: 'Modular house',
      garage: 'Garage',
    },
  },
  // One card per model: the price with what it includes, worded as on the product pages and
  // the prices table (a container's price includes its assembly, a Box house's does not).
  card: {
    basis: {
      wagon: 'incl. VAT and assembly',
      box: 'incl. VAT, assembly extra',
      // A model whose assembly figure the prices table does not have (shared/prices.js).
      vat: 'incl. VAT',
      // A house that needs no assembly (shared/prices.js arrivesReady: the capsule, the owner 2026-10-17).
      ready: 'incl. VAT, arrives ready',
    },
    more: 'Photos and description →',
  },
  // Only past 24 models (galleryUtils PAGE_SIZE); real links, ?page=N.
  pagination: {
    paginationAria: 'Pagination',
    prev: 'Previous',
    next: 'Next',
    page: 'Page {n}',
  },
  schema: {
    listName: 'Model gallery',
  },
  breadcrumbs: {
    home: 'Home',
    gallery: 'Gallery',
  },
  detail: {
    backToGallery: '← Back to gallery',
    descriptionTitle: 'Description',
    requestCta: 'Request an offer',
    pricePrefix: 'From ',
    priceOnRequest: 'Price on request',
    imageThumb: 'Image',
    closeLabel: 'Close',
    loading: 'Loading model…',
    error: 'The model could not be loaded. Please try again.',
    notFoundTitle: 'Model not found',
    notFoundText: 'This URL does not match an available model from the API.',
    // The links under the request button (src/gallery/itemLinks.js): its product page, its row in
    // the prices table, the configurator on its model (37, 58 and 73 m² only) and the delivery
    // calculator for its kind of product. A link the item has no target for is not drawn.
    links: {
      heading: 'More about this model',
      containers: 'All about the containers: assembly, delivery, warranty →',
      box: 'The Box houses: sizes, assembly, warranty →',
      prices: 'Its price with assembly in the price table →',
      // For a house whose assembly is still quoted on request (its row says so).
      pricesNoAssembly: 'Its price in the price table →',
      configurator: 'Build this house in the configurator →',
      delivery: 'Work out the delivery to you →',
    },
  },
  altBase: {
    bg: 'https://nvc-home4you.eu/bg/galeriq',
    en: 'https://nvc-home4you.eu/en/gallery',
    el: 'https://nvc-home4you.eu/el/gkaleri',
  },
}
