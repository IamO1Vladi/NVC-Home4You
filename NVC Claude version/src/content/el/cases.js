export default {
  locale: 'el-GR',
  api: {
    casesPageEndpoint: '/api/cases-page',
    reviewsEndpoint: '/api/reviews',
  },
  seo: {
    // The title and description are routeMeta.js's (META.cases), read by the cases routes.
    url: 'https://nvc-home4you.eu/el/erga-kai-kritikes',
  },
  breadcrumbs: [
    { name: 'Αρχική', url: 'https://nvc-home4you.eu/el' },
    { name: 'Έργα & Κριτικές', url: 'https://nvc-home4you.eu/el/erga-kai-kritikes' },
  ],
  copy: {
    heroTitle: 'Έργα & Κριτικές',
    heroLead:
      'Παραδόσεις σε πελάτες μας και οι κριτικές τους: τι αγόρασαν, πού παραδόθηκε, φωτογραφίες και βαθμολογίες από 1 έως 5 αστέρια.',
    heroPoints: [
      'Δημοσιευμένα έργα με εταιρεία, προϊόν και τοποθεσία',
      'Ορατές αξιολογήσεις πελατών και γραπτές κριτικές',
      'Μια σύντομη φόρμα 1–5 αστέρων για νέες κριτικές πελατών',
    ],
    ctaPrimary: 'Λάβετε προσφορά',
    ctaSecondary: 'Κάντε μια ερώτηση',
    panelTitle: 'Τι θα βρείτε εδώ',
    stats: {
      cases: 'Δημοσιευμένα έργα',
      rating: 'Μέση αξιολόγηση',
      reviews: 'Κριτικές πελατών',
      countries: 'Χώρες που εξυπηρετούμε',
    },
    buyersTitle: 'Ποιοι αγοράζουν από εμάς',
    buyersLead:
      'Εταιρείες και κλάδοι που αγοράζουν από εμάς.',
    buyersEmpty:
      'Δεν υπάρχουν ακόμη δημοσιευμένες εταιρείες-πελάτες.',
    casesTitle: 'Πρόσφατα έργα',
    casesLead:
      'Τι παραδώσαμε, σε ποιον και πού, με την κριτική του πελάτη.',
    filters: {
      all: 'Όλα',
      modularBuilds: 'Μονάδες-κοντέινερ',
      modularHouses: 'Δομικά σπίτια',
      steelHouses: 'Μεταλλικά σπίτια σε δικό σας σχέδιο',
      interiors: 'Εσωτερικοί χώροι',
      delivery: 'Παράδοση',
      logistics: 'Εφοδιαστική',
      other: 'Άλλο',
    },
    // Each case card's link to its product page, by the card's category (CasesPage.jsx
    // CASE_PAGE). A category with no line here (interiors, logistics, other) gets no link.
    productLinks: {
      modularBuilds: 'Περισσότερα για τα κοντέινερ →',
      modularHouses: 'Περισσότερα για τα σπίτια Box →',
      steelHouses: 'Περισσότερα για τα σπίτια σε δικό σας σχέδιο →',
      delivery: 'Περισσότερα για την παράδοση και τη συναρμολόγηση →',
    },
    labels: {
      buyer: 'Αγοραστής',
      product: 'Προϊόν',
      location: 'Τοποθεσία',
      scope: 'Αντικείμενο',
      result: 'Αποτέλεσμα',
      year: 'Έτος',
      units: 'Μονάδες',
      sector: 'Κλάδος',
      approved: 'Εγκεκριμένο',
      purchased: 'Αγοράστηκε',
      company: 'Εταιρεία',
      customer: 'Πελάτης',
    },
    featured: 'Προτεινόμενο',
    photosLabel: 'Φωτογραφίες',
    similarCta: 'Ζητήστε κάτι παρόμοιο',
    noCases:
      'Δεν υπάρχουν ακόμη δημοσιευμένα έργα.',
    reviewsTitle: 'Αξιολογήσεις & κριτικές',
    reviewsLead:
      'Πραγματικές αξιολογήσεις και κριτικές από τους πελάτες μας.',
    breakdownTitle: 'Ανάλυση αξιολόγησης',
    noRatings: 'Δεν υπάρχουν ακόμη δημόσιες αξιολογήσεις.',
    formTitle: 'Αφήστε μια κριτική',
    formLead:
      'Αφήστε την αξιολόγησή σας και ένα σύντομο σχόλιο για την εμπειρία σας μαζί μας.',
    moderation: 'Οι νέες κριτικές εμφανίζονται σύντομα μετά την υποβολή.',
    placeholders: {
      name: 'Όνομα',
      company: 'Εταιρεία',
      email: 'Διεύθυνση email',
      location: 'Πόλη / χώρα',
      product: 'Τι αγοράσατε;',
      comment: 'Γράψτε μια σύντομη κριτική για την παράδοση, την ποιότητα του προϊόντος ή την επικοινωνία',
    },
    submit: 'Υποβολή κριτικής',
    sending: 'Αποστολή…',
    success:
      'Ευχαριστούμε. Η κριτική σας ελήφθη και θα εμφανιστεί σύντομα.',
    error:
      'Η κριτική δεν ήταν δυνατό να υποβληθεί αυτή τη στιγμή. Παρακαλούμε δοκιμάστε ξανά αργότερα.',
    noReviewsCard:
      'Όταν υπάρχουν κριτικές, θα εμφανίζονται εδώ ως δημόσιες μαρτυρίες.',
  },
  lightbox: {
    closeLabel: 'Κλείσιμο',
    prevLabel: 'Προηγ.',
    nextLabel: 'Επόμ.',
    descriptionHeading: 'Περιγραφή',
    thumbnailsLabel: 'Μικρογραφίες',
    imageAltPattern: 'Εικόνα {current} από {total}',
    thumbnailAltPattern: 'Μικρογραφία {current} από {total}',
  },
}
