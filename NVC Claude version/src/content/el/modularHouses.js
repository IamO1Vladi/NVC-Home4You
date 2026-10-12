// src/content/el/modularHouses.js
//
// The words of the modular houses page (/el/domika-spitia). No price is written here: every
// figure on the page is computed from the gallery rows (src/lib/productRows.js) and printed
// with euro(); a pattern below marks where one goes with {price}, {house} or {assembly}.
// The title, description and breadcrumb come from routeMeta.js through the route, so this
// file has no seo block any more.
//
// Every fact is one the gallery, the configurator catalogue or the published case already
// states, or one the owner gave us (2026-10-12): the Box house sizes, frame, walls and glazing
// are the gallery descriptions'; the capsule lines are gallery item 100015's and nothing more;
// the hero photo and the proof card are the Paralia Kariani case on /api/cases-page. Do not
// add a lead time, a permit or a foundation recommendation here; there is none we can stand
// behind yet. The "not included" list is NOT here either: the page reads it from pricesCopy so
// this page and /el/times say it in the same words.
//
// Drafted Greek; it still needs a native speaker's read before Stage 2.
export default {
  hero: {
    eyebrow: 'Αναπτυσσόμενα σπίτια και κάψουλες',
    h1: 'Δομικά σπίτια για μόνιμη κατοικία',
    lead: 'Αναπτυσσόμενα σπίτια (Box) από 18 έως 74 m², που φτάνουν διπλωμένα και ανοίγουν επί τόπου, και μια κάψουλα 38 m². Επιλέξτε μέγεθος και διαμορφώστε το σπίτι σας διαδικτυακά.',
    from: 'από',
    basis: 'το σπίτι με ΦΠΑ, χωρίς συναρμολόγηση',
    build: 'Ξεκινήστε τη διαμόρφωση',
    offer: 'Ζητήστε προσφορά',
    facts: [
      'Πλήρως εξοπλισμένο μπάνιο',
      'Ηλεκτρολογικά και υδραυλικά έτοιμα από το εργοστάσιο',
      'Σκελετός από γαλβανισμένο χάλυβα',
    ],
    // The default photo: the delivered 58 m² house from the published case. An admin photo
    // (/admin/home-photos, the page-modular-houses slot) replaces it and drops the chip,
    // since the chip names this house and the admin's photo may show another.
    photo: {
      url: '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
      alt: 'Αναπτυσσόμενο σπίτι 58 m² με βεράντα, παραδομένο στην Παραλία Καριανής, Ελλάδα',
      position: '50% 45%',
    },
    adminAlt: 'Αναπτυσσόμενο δομικό σπίτι της NVC Home4You',
  },

  // The published case (/api/cases-page, id "2"). The API's text is Bulgarian only, so the
  // line, the result and the buyer's name are written here once per language; the photos,
  // the quote and the rating are read from the API, and the card is not drawn if the case is
  // ever unpublished.
  case: {
    id: '2',
    line: '58 m² με βεράντα · Παραλία Καριανής, Ελλάδα · 2026',
    result: 'Παραδόθηκε και συναρμολογήθηκε, έτοιμο για κατοίκηση.',
    name: 'Βαγγέλης',
  },

  sizes: {
    heading: 'Επιλέξτε μέγεθος αναπτυσσόμενου σπιτιού',
    sub: 'Η τιμή του σπιτιού περιλαμβάνει ΦΠΑ· η συναρμολόγηση είναι χωριστή και φαίνεται από κάτω. Τα μοντέλα 37, 58 και 73 m² μπορείτε να τα διαμορφώσετε στον διαμορφωτή.',
    allPrices: 'Ο πλήρης πίνακας τιμών →',
    allPhotos: 'Φωτογραφίες όλων των δομικών σπιτιών →',
    basis: 'με ΦΠΑ, χωρίς συναρμολόγηση',
    assembly: '+ συναρμολόγηση {price} με ΦΠΑ',
    assemblyOnRequest: 'Συναρμολόγηση κατόπιν αιτήματος',
    variant: 'Με βεράντα και διπλή στέγη: {house} + συναρμολόγηση {assembly}',
    variantOnRequest: 'Με βεράντα και διπλή στέγη: {house}, συναρμολόγηση κατόπιν αιτήματος',
    build: 'Ξεκινήστε τη διαμόρφωση',
    ask: 'Ζητήστε προσφορά για αυτό το μοντέλο',
    more: 'Λεπτομέρειες →',
    // One line per card, keyed by gallery id: what this size has that the others do not.
    diff: {
      100016: 'Το μικρότερο μοντέλο, με πλήρως εξοπλισμένο μπάνιο και κουζίνα',
      10: 'Σκελετός 3,0 mm, μπάνιο 2,2 × 1,25 m',
      5: 'Σκελετός 3,5 mm, μπάνιο 2,4 × 1,25 m',
      9: 'Σκελετός 4,0 mm, μπάνιο 2,8 × 1,25 m',
      16: 'Στέγη πάνω από όλο το σπίτι και μπαλκόνι πλάτους 2 m',
      17: 'Δύο όροφοι με εσωτερική σκάλα και μπαλκόνι 2 m',
    },
  },

  capsule: {
    basis: 'με ΦΠΑ, συναρμολόγηση κατόπιν αιτήματος',
    lines: [
      '38 m², 11,5 × 3,3 m',
      'Σκελετός από γαλβανισμένο χάλυβα 3,5 mm',
      'Τοίχοι 100 mm με μόνωση πολυουρεθάνης και επένδυση αλουμινίου',
      'Κουφώματα αλουμινίου με θερμοδιακοπή και διπλούς υαλοπίνακες ασφαλείας',
      'Πόρτα εισόδου με έξυπνη κλειδαριά',
    ],
  },

  compare: {
    heading: 'Σπίτι Box ή κάψουλα',
    columns: ['Χαρακτηριστικό', 'Σπίτι Box', 'Κάψουλα'],
    rows: [
      { label: 'Εμβαδόν', values: ['18–74 m²', '38 m²'] },
      { label: 'Σκελετός', values: ['Γαλβανισμένος χάλυβας, 3,0 / 3,5 / 4,0 mm για 37 / 58 / 73 m²', 'Γαλβανισμένος χάλυβας, 3,5 mm'] },
      { label: 'Τοίχοι', values: ['Πετροβάμβακας 100 mm, 80 kg/m³, κατηγορία αντίδρασης στη φωτιά A, και πρόσοψη πολυουρεθάνης 16 mm', '100 mm με μόνωση πολυουρεθάνης, επένδυση αλουμινίου'] },
      { label: 'Κουφώματα', values: ['Αλουμινίου με θερμοδιακοπή ή PVC, διπλοί υαλοπίνακες', 'Αλουμινίου με θερμοδιακοπή, διπλοί υαλοπίνακες ασφαλείας'] },
    ],
    priceLabel: 'Τιμή από',
    boxPrice: '{price}, χωρίς συναρμολόγηση',
    capsulePrice: '{price}, συναρμολόγηση κατόπιν αιτήματος',
  },

  // {folded} and {open} are the 37 m² model's widths from the configurator catalogue.
  arrival: {
    heading: 'Πώς φτάνει το αναπτυσσόμενο σπίτι',
    paragraphs: [
      'Το αναπτυσσόμενο σπίτι κατασκευάζεται στο εργοστάσιο μαζί με το μπάνιο, την κουζίνα, τα κουφώματα και τις εγκαταστάσεις που επιλέξατε. Ταξιδεύει διπλωμένο και ανοίγει μόνο στη θέση του — γι’ αυτό άλλοι το λένε πτυσσόμενο, άλλοι επεκτεινόμενο και άλλοι απλώς σπίτι box. Το παραδίδουμε στη Βουλγαρία και σε άλλες χώρες της ΕΕ.',
      'Κατά τη μεταφορά το μοντέλο των 37 m² έχει πλάτος {folded} m, ενώ ανοιγμένο {open} m. Στο σημείο το σπίτι τοποθετείται με γερανό στην προετοιμασμένη βάση και ανοίγει. Οι εγκαταστάσεις στο εσωτερικό είναι ήδη έτοιμες από το εργοστάσιο.',
    ],
    pricesLink: 'Τιμές με τη συναρμολόγηση →',
    includedHeading: 'Τι περιλαμβάνει η συναρμολόγηση',
    excludedHeading: 'Τι δεν περιλαμβάνεται',
    foundationAsk: 'Η βάση που χρειάζεται εξαρτάται από το οικόπεδο. Τηλεφωνήστε μας ή ρωτήστε μας.',
  },

  proof: {
    heading: 'Παραδομένο σε πελάτη',
    sub: 'Ένα από τα αναπτυσσόμενα σπίτια μας, ήδη στη θέση του.',
    // Two of the case's own photos, shown only while the case still lists them.
    photos: [
      { url: '/api/img/cases/1/5f6e02eabc11410c89ab824cb2496488.webp', alt: 'Το καθιστικό και η κουζίνα του σπιτιού στην Παραλία Καριανής' },
      { url: '/api/img/cases/1/268f1b6801134d16ab11f700ac46faf5.webp', alt: 'Το μπάνιο με την καμπίνα ντους στο σπίτι στην Παραλία Καριανής' },
    ],
    more: 'Δείτε το έργο →',
    stars: '{rating} από 5',
  },

  catalogues: {
    heading: 'Κατάλογοι (PDF)',
    subheading: 'Τα αναπτυσσόμενα σπίτια και η κάψουλα σε χαρτί, για εκτύπωση ή για να τα στείλετε σε όποιον αποφασίζει μαζί σας.',
    // The sizes and languages are what /api/brochures served on 2026-10-12: neither has a
    // Greek edition, so both open in Bulgarian. Update the notes when the admin uploads one.
    items: [
      { brochureSlug: 'box-house', label: 'Αναπτυσσόμενα σπίτια (Box)', note: '37 / 58 / 73 m² · στα βουλγαρικά · 16 MB' },
      { brochureSlug: 'space-capsules', label: 'Κάψουλες', note: 'Στα βουλγαρικά · 3,4 MB' },
    ],
  },

  siblings: {
    heading: 'Ψάχνετε κάτι άλλο;',
    go: 'Δείτε →',
    from: 'από',
    withAssembly: 'με ΦΠΑ και συναρμολόγηση',
    containers: {
      label: 'Μονάδες-κοντέινερ',
      desc: 'Κοντέινερ κατοικίας και γραφείου 6×3, 7×3 και 8×3 m, συναρμολογημένα από εμάς.',
    },
    steel: {
      label: 'Μεταλλικά σπίτια σε δικό σας σχέδιο',
      desc: 'Σπίτι με μεταλλικό σκελετό στο δικό σας σχέδιο, ή ετοιμάζουμε εμείς το σχέδιο για εσάς.',
    },
  },

  finalTitle: 'Να μιλήσουμε για το σπίτι σας;',

  // Product markup only, never shown.
  listName: 'Δομικά σπίτια',
  schemaCategory: 'Δομικό σπίτι',
}
