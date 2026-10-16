export default {
  // The title and description are routeMeta.js's (META.gallery), read by GalleryRoutes.jsx.
  // The index (GalleryIndexPage.jsx): the line above the H1, the H1, and one line under it.
  // The Box houses are made to order (up to 40 days in production, the owner 2026-10-15), so
  // the lead does not call every model "available"; the gallery's containers are stock models.
  eyebrow: 'Μοντέλα και τιμές',
  heading: 'Γκαλερί: κοντέινερ και σπίτια Box',
  lead: 'Κάθε μοντέλο με την τιμή του με ΦΠΑ: τα κοντέινερ είναι σε απόθεμα, ενώ τα σπίτια Box κατασκευάζονται κατά παραγγελία.',
  loading: 'Φόρτωση μοντέλων…',
  error: 'Η γκαλερί δεν ήταν δυνατό να φορτωθεί. Παρακαλούμε δοκιμάστε ξανά αργότερα.',
  retry: 'Δοκιμάστε ξανά',
  empty: {
    all: 'Δεν έχουν προστεθεί ακόμη μοντέλα.',
    filtered: 'Κανένα μοντέλο δεν ταιριάζει σε αυτήν την κατηγορία.',
    showAll: 'Εμφάνιση όλων των μοντέλων',
  },
  // How many models the list shows, after a filter too ({n}); Intl.PluralRules picks the form.
  count: { one: '{n} μοντέλο', other: '{n} μοντέλα' },
  filtersAria: 'Φίλτρα',
  filters: {
    all: 'Όλα',
    // The index's filters (galleryUtils INDEX_FILTER_IDS), in the words the rest of the site
    // uses for the two product lines. The prefab and garage filters always opened empty and
    // were removed (the owner, 2026-10-17).
    shown: {
      wagon: 'Κοντέινερ',
      modular: 'Σπίτια Box',
    },
    // The item page's name for a model's category, under its title and in its Product markup
    // (GalleryRoutes.jsx). All four ids keep one: the admin can still file a model under any.
    categories: {
      prefab: 'Προκατασκευασμένο σπίτι',
      wagon: 'Βαγονέτο / Καμπίνα εργοταξίου',
      modular: 'Δομικό σπίτι',
      garage: 'Γκαράζ',
    },
  },
  // One card per model: the price with what it includes, worded as on the product pages and
  // the prices table (a container's price includes its assembly, a Box house's does not).
  card: {
    basis: {
      wagon: 'με ΦΠΑ και συναρμολόγηση',
      box: 'με ΦΠΑ, χωρίς συναρμολόγηση',
      // A model whose assembly figure the prices table does not have (shared/prices.js).
      vat: 'με ΦΠΑ',
      // A house that needs no assembly (shared/prices.js arrivesReady: the capsule, the owner 2026-10-17).
      ready: 'με ΦΠΑ, φτάνει έτοιμη',
    },
    more: 'Φωτογραφίες και περιγραφή →',
  },
  // Only past 24 models (galleryUtils PAGE_SIZE); real links, ?page=N.
  pagination: {
    paginationAria: 'Σελιδοποίηση',
    prev: 'Προηγούμενο',
    next: 'Επόμενο',
    page: 'Σελίδα {n}',
  },
  schema: {
    listName: 'Γκαλερί μοντέλων',
  },
  breadcrumbs: {
    home: 'Αρχική',
    gallery: 'Γκαλερί',
  },
  detail: {
    backToGallery: '← Επιστροφή στην γκαλερί',
    descriptionTitle: 'Περιγραφή',
    requestCta: 'Ζητήστε προσφορά',
    pricePrefix: 'Από ',
    priceOnRequest: 'Τιμή κατόπιν αιτήματος',
    imageThumb: 'Εικόνα',
    closeLabel: 'Κλείσιμο',
    loading: 'Φόρτωση μοντέλου…',
    error: 'Το μοντέλο δεν ήταν δυνατό να φορτωθεί. Παρακαλούμε δοκιμάστε ξανά.',
    notFoundTitle: 'Το μοντέλο δεν βρέθηκε',
    notFoundText: 'Αυτό το URL δεν αντιστοιχεί σε διαθέσιμο μοντέλο από το API.',
    // The links under the request button (src/gallery/itemLinks.js): its product page, its row in
    // the prices table, the configurator on its model (37, 58 and 73 m² only) and the delivery
    // calculator for its kind of product. A link the item has no target for is not drawn.
    links: {
      heading: 'Περισσότερα για αυτό το μοντέλο',
      containers: 'Όλα για τα κοντέινερ: συναρμολόγηση, παράδοση, εγγύηση →',
      box: 'Τα σπίτια Box: μεγέθη, συναρμολόγηση, εγγύηση →',
      prices: 'Η τιμή του με τη συναρμολόγηση στον πίνακα τιμών →',
      // For a house whose assembly is still quoted on request (its row says so).
      pricesNoAssembly: 'Η τιμή του στον πίνακα τιμών →',
      configurator: 'Διαμορφώστε αυτό το σπίτι στον διαμορφωτή →',
      delivery: 'Υπολογίστε το κόστος παράδοσης σε εσάς →',
    },
  },
  altBase: {
    bg: 'https://nvc-home4you.eu/bg/galeriq',
    en: 'https://nvc-home4you.eu/en/gallery',
    el: 'https://nvc-home4you.eu/el/gkaleri',
  },
}
