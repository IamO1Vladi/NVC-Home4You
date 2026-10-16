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
// the hero photo and the proof card are the Paralia Kariani case on /api/cases-page.
// The lead time in arrival.delivery ({production} and {months}) is the owner's of 2026-10-15,
// read from deliveryRates.js, and the foundation tip the page shows is his too (pricesCopy's
// foundationNote, beside arrival.foundationAsk). The permit is the FAQ hub's answer
// (faq.js, id "permit", the owner's of 2026-10-17), not this page's.
// The "not included" list is NOT here either: the page reads it from
// pricesCopy so this page and /el/times say it in the same words.
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
    plannerLink: 'Κατόψεις και το σπίτι σε 3D στον σχεδιαστή →',
    // To the partner page's enquiry form (#zapitvane): more than one unit, or for resale.
    partnerLink: 'Περισσότερα από ένα τεμάχιο ή για μεταπώληση; →',
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

  // The lines are gallery item 100015's; the basis is the owner's answer of 2026-10-17: the
  // capsule needs no assembly, it arrives ready.
  capsule: {
    // Its Product markup's category once it is filed under its own "capsule" (2026-10-17),
    // the gallery's own name for it (content/el/gallery.js filters.categories.capsule).
    schemaCategory: 'Κάψουλα χώρου',
    basis: 'με ΦΠΑ· φτάνει έτοιμη, δεν χρειάζεται συναρμολόγηση',
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
    capsulePrice: '{price}· φτάνει έτοιμη, δεν χρειάζεται συναρμολόγηση',
  },

  // {folded} and {open} are the 37 m² model's widths from the configurator catalogue.
  arrival: {
    heading: 'Πώς φτάνει το αναπτυσσόμενο σπίτι',
    paragraphs: [
      'Το αναπτυσσόμενο σπίτι κατασκευάζεται στο εργοστάσιο μαζί με το μπάνιο, την κουζίνα, τα κουφώματα και τις εγκαταστάσεις που επιλέξατε. Ταξιδεύει διπλωμένο και ανοίγει μόνο στη θέση του — γι’ αυτό άλλοι το λένε πτυσσόμενο, άλλοι επεκτεινόμενο και άλλοι απλώς σπίτι box. Το παραδίδουμε στη Βουλγαρία και στην Ελλάδα· για άλλες χώρες, κατόπιν αιτήματος.',
      'Κατά τη μεταφορά το μοντέλο των 37 m² έχει πλάτος {folded} m, ενώ ανοιγμένο {open} m. Στο σημείο το σπίτι τοποθετείται με γερανό στην προετοιμασμένη βάση και ανοίγει. Οι εγκαταστάσεις στο εσωτερικό είναι ήδη έτοιμες από το εργοστάσιο.',
    ],
    // {rate}, {crane}, {production} and {months} come from deliveryRates.js, the owner's figures of 2026-10-15.
    delivery: 'Παράδοση στο οικόπεδό σας: περίπου {rate} ανά χιλιόμετρο, και για τις δύο κατευθύνσεις, από το Μαρικοστίνοβο ή από τη Βάρνα, όποιο είναι πιο κοντά σας. Ο γερανός είναι απαραίτητος και κοστίζει περίπου {crane}, ή και περισσότερο ανάλογα με την τοποθεσία. Η παράδοση και ο γερανός δεν περιλαμβάνουν ΦΠΑ. Το σπίτι κατασκευάζεται σε έως {production} ημέρες και φτάνει στη διεύθυνσή σας σε περίπου {months} μήνες.',
    pricesLink: 'Τιμές με τη συναρμολόγηση →',
    deliveryLink: 'Υπολογίστε το κόστος παράδοσης σε εσάς →',
    includedHeading: 'Τι περιλαμβάνει η συναρμολόγηση',
    // Active, like pricesCopy's excludedTitle: the list under it is pricesCopy.excluded,
    // written in the accusative ('Τον γερανό…', 'Τη βάση…', 'Την παράδοση…').
    excludedHeading: 'Τι δεν περιλαμβάνει',
    foundationAsk: 'Η βάση που χρειάζεται εξαρτάται από το οικόπεδο. Τηλεφωνήστε μας ή ρωτήστε μας.',
  },

  // The warranty as the owner gave it on 2026-10-15, from the annex to our Box-house sales
  // contract. The lead names the Box houses and the capsule, which carries the same warranty
  // (owner, 2026-10-17). {years} is the row's figure from shared/warranty.js, by its key.
  warranty: {
    heading: 'Εγγύηση',
    lead: 'Για τα αναπτυσσόμενα σπίτια Box και την κάψουλα.',
    rows: [
      { key: 'structure', label: 'Σκελετός', text: '{years}\u00a0χρόνια — ο φέρων χαλύβδινος σκελετός' },
      { key: 'panels', label: 'Πάνελ', text: '{years}\u00a0χρόνια — τα θερμομονωτικά πάνελ τύπου σάντουιτς' },
      { key: 'joinery', label: 'Κουφώματα', text: '{years}\u00a0χρόνια — τα προφίλ και οι υαλοπίνακες' },
      { key: 'sanitary', label: 'Είδη υγιεινής', text: '{years}\u00a0χρόνια — τα είδη υγιεινής και τα υδραυλικά εξαρτήματα στο μπάνιο και την κουζίνα' },
    ],
    conditions: 'Η εγγύηση καλύπτει εργοστασιακά ελαττώματα και ισχύει από την ημερομηνία παράδοσης, με κανονική χρήση, κατάλληλη θεμελίωση, σωστή αποστράγγιση και χωρίς μη εξουσιοδοτημένες επεμβάσεις τρίτων. Όλα τα υπόλοιπα στοιχεία ελέγχονται οπτικά κατά την παράδοση ως προς τη συμφωνία τους με τις προδιαγραφές του εργοστασίου.',
    excluded: 'Η εγγύηση δεν καλύπτει μηχανικές ζημιές, λανθασμένη μεταφορά ή εκφόρτωση που δεν έγινε από εμάς, ακατάλληλη θεμελίωση, έλλειψη αερισμού, κακή αποστράγγιση, διαρροές από εξωτερικές συνδέσεις, συμπύκνωση υγρασίας, μεταγενέστερες επισκευές ή αλλαγές από τον αγοραστή ή από τρίτους, ούτε ανωτέρα βία.',
  },

  proof: {
    heading: 'Παραδομένο σε πελάτη',
    sub: 'Ένα από τα αναπτυσσόμενα σπίτια μας, ήδη στη θέση του.',
    // Two of the case's own photos, shown only while the case still lists them.
    photos: [
      { url: '/api/img/cases/1/5f6e02eabc11410c89ab824cb2496488.webp', alt: 'Το καθιστικό και η κουζίνα του σπιτιού στην Παραλία Καριανής' },
      { url: '/api/img/cases/1/268f1b6801134d16ab11f700ac46faf5.webp', alt: 'Το μπάνιο με την καμπίνα ντους στο σπίτι στην Παραλία Καριανής' },
    ],
    // To the case's own card on the cases page (#case-<id>), named for what it shows.
    more: 'Το σπίτι στην Παραλία Καριανής →',
    stars: '{rating} από 5',
  },

  // The page's questions (lib/productQuestions.js): the same ids as bg/modularHouses.js, which
  // says where each answer comes from. Drafted Greek, like the rest of this file.
  faq: {
    heading: 'Ερωτήσεις',
    // To the hub's Box houses topic (#t-box).
    more: 'Περισσότερες ερωτήσεις →',
    items: [
      {
        id: 'box-price',
        q: 'Τι περιλαμβάνει η τιμή του σπιτιού Box;',
        a: 'Τον ΦΠΑ, τη θαλάσσια μεταφορά από την Κίνα και τον εκτελωνισμό. Στα μοντέλα των {areas} m² η τιμή καλύπτει επίσης το πλήρως εξοπλισμένο μπάνιο ({bathrooms} παραλλαγές για να διαλέξετε), την κουζίνα ({kitchens} παραλλαγές για να διαλέξετε και άλλες {kitchensExtra} με επιπλέον χρέωση) και τη βασική βεράντα στη μικρή πλευρά, {terrace}. Η συναρμολόγηση τιμολογείται χωριστά, ενώ ο γερανός, η βάση και η παράδοση στο οικόπεδο δεν περιλαμβάνονται.',
        link: { pathKey: 'modularHouses', hash: 'sizes', label: 'Μεγέθη και τιμές των σπιτιών Box →' },
      },
      {
        id: 'box-assembly',
        q: 'Τι περιλαμβάνει η συναρμολόγηση του σπιτιού Box;',
        a: 'Την τοποθέτηση του σπιτιού στην προετοιμασμένη βάση σας και τα τελειώματα «με το κλειδί στο χέρι»: το σπίτι είναι έτοιμο για κατοίκηση. Η συναρμολόγηση δεν περιλαμβάνει τον γερανό, τη βάση και την παράδοση στο οικόπεδο. Ο γερανός είναι απαραίτητος: περίπου {boxCrane} χωρίς ΦΠΑ, ή και περισσότερο ανάλογα με την τοποθεσία.',
        link: { pathKey: 'prices', label: 'Η τιμή συναρμολόγησης κάθε μοντέλου →' },
      },
      {
        id: 'box-assembly-crew',
        q: 'Ποιος συναρμολογεί το σπίτι Box και πόσο διαρκεί;',
        a: 'Το συναρμολογούν {workers} τεχνικοί μας επί τόπου, στον χώρο σας, σε {assemblyDays} ημέρες.',
      },
      {
        id: 'box-assembly-18',
        q: 'Πόσο κοστίζει η συναρμολόγηση του σπιτιού των 18 m²;',
        a: 'Η συναρμολόγηση του αναπτυσσόμενου σπιτιού των 18 m² κοστίζει {smallAssembly} χωρίς ΦΠΑ, ή {smallAssemblyGross} με ΦΠΑ.',
      },
      {
        id: 'box-lead-times',
        q: 'Είναι ίδιος ο χρόνος παράδοσης για όλα τα μεγέθη;',
        a: 'Ναι. Κάθε σπίτι Box, από 18 έως 74 m², κατασκευάζεται σε έως {production} ημέρες και φτάνει στη διεύθυνσή σας σε περίπου {months} μήνες.',
      },
      {
        id: 'capsule-ready',
        q: 'Χρειάζεται η κάψουλα συναρμολόγηση;',
        a: 'Όχι. Η κάψουλα φτάνει έτοιμη και δεν χρειάζεται συναρμολόγηση. Η παράδοση, ο γερανός, ο χρόνος παράδοσης (περίπου {months} μήνες έως τη διεύθυνσή σας) και η εγγύηση είναι ίδια με των σπιτιών Box.',
      },
      {
        id: 'box-layouts',
        q: 'Μπορώ να διαλέξω τη διαρρύθμιση;',
        a: 'Ναι. Ξεκινήστε από μία από τις {layouts} κατόψεις του καταλόγου για τα μοντέλα των {areas} m² ή σχεδιάστε τη δική σας στον σχεδιαστή, και στείλτε μας την κάτοψη για προσφορά. Το μπάνιο και η πόρτα εισόδου είναι σταθερά: βρίσκονται όπου τα δείχνει το τεχνικό σχέδιο του μοντέλου.',
        link: { pathKey: 'planner', label: 'Οι κατόψεις στον σχεδιαστή →' },
      },
      {
        id: 'box-appliances',
        q: 'Περιλαμβάνονται οι συσκευές κουζίνας;',
        a: 'Όχι. Οι συσκευές δεν παρέχονται και δεν χρεώνονται από εμάς: στον διαμορφωτή δείχνετε πού θα μπει η καθεμία, για να κατασκευάσουμε την κουζίνα στα μέτρα σας, και η προετοιμασία (ηλεκτρικά και υδραυλικά) περιλαμβάνεται στην τιμή. Τον νεροχύτη όμως τον πουλάμε εμείς και τον επιλέγετε στον διαμορφωτή.',
        link: { pathKey: 'boxConfigurator', label: 'Συνθέστε το σπίτι σας στον διαμορφωτή →' },
      },
    ],
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
      label: 'Οικίσκοι κοντέινερ',
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
