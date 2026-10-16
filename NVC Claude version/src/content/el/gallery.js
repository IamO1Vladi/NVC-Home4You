export default {
  // The title and description are routeMeta.js's (META.gallery), read by GalleryRoutes.jsx.
  heading: 'Γκαλερί: κοντέινερ και σπίτια Box',
  sub: 'Δείτε τα διαθέσιμα μοντέλα και ανοίξτε μια ειδική σελίδα λεπτομερειών για κάθε λύση.',
  loading: 'Φόρτωση μοντέλων…',
  error: 'Η γκαλερί δεν ήταν δυνατό να φορτωθεί. Παρακαλούμε δοκιμάστε ξανά αργότερα.',
  empty: {
    all: 'Δεν έχουν προστεθεί ακόμη μοντέλα.',
    filtered: 'Κανένα μοντέλο δεν ταιριάζει σε αυτήν την κατηγορία.',
  },
  filtersAria: 'Φίλτρα',
  filters: {
    all: 'Όλα',
    categories: {
      prefab: 'Προκατασκευασμένο σπίτι',
      wagon: 'Βαγονέτο / Καμπίνα εργοταξίου',
      modular: 'Δομικό σπίτι',
      garage: 'Γκαράζ',
    },
  },
  pagination: {
    paginationAria: 'Σελιδοποίηση',
    prev: 'Προηγούμενο',
    next: 'Επόμενο',
    pages: 'Σελίδες',
    currentPage: 'Τρέχουσα σελίδα',
    pageAbbr: 'Σελίδα',
  },
  viewDetails: 'Δείτε λεπτομέρειες',
  openCta: 'Άνοιγμα →',
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
