export default {
  // The title and description are routeMeta.js's (META.gallery), read by GalleryRoutes.jsx.
  heading: 'Gallery: containers and Box houses',
  sub: 'Browse the available models and open a dedicated detail page for each solution.',
  loading: 'Loading models…',
  error: 'The gallery could not be loaded. Please try again later.',
  empty: {
    all: 'No models have been added yet.',
    filtered: 'No models match this category.',
  },
  filtersAria: 'Filters',
  filters: {
    all: 'All',
    categories: {
      prefab: 'Prefab house',
      wagon: 'Wagon / site cabin',
      modular: 'Modular house',
      garage: 'Garage',
    },
  },
  pagination: {
    paginationAria: 'Pagination',
    prev: 'Previous',
    next: 'Next',
    pages: 'Pages',
    currentPage: 'Current page',
    pageAbbr: 'Page',
  },
  viewDetails: 'View details',
  openCta: 'Open →',
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
