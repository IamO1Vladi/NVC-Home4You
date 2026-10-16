import { DELIVERED_CONTAINER } from '../shared/deliveredMedia.js'

// src/content/el/modularBuilds.js
//
// The words on the «Οικίσκοι κοντέινερ» page (/el/domikes-kataskeves). No price lives here:
// the prices, the "from" figure, the assembly share of a price and the delivery rate come
// from the gallery (/api/gallery), prices.js and deliveryRates.js, and are filled into
// {amount}, {rate}, {crane}, {travel} and {price}. The title and description search engines read are in
// src/seo/routeMeta.js.
//
// The table states only what the six gallery descriptions state. The kitchen, the crane,
// the accommodation, the foundation and the made-to-order sizes are the owner's words
// (2026-10-12; the crane's cost, the 3–4 nights and the workers' travel are his 2026-10-15
// figures, in deliveryRates.js). Drafted Greek; a native read is still to come.
export default {
  hero: {
    eyebrow: 'Οικίσκοι κοντέινερ',
    h1: 'Κοντέινερ για κατοικία, γραφείο και εργοτάξιο',
    lead: 'Κοντέινερ κατοικίας και γραφείου 6×3, 7×3 και 8×3 m με μπάνιο, ηλεκτρολογική και υδραυλική εγκατάσταση — τα παραδίδουμε και τα συναρμολογούμε εμείς.',
    from: 'από',
    basis: 'με ΦΠΑ και συναρμολόγηση',
    cta: 'Ζητήστε προσφορά',
    call: 'Καλέστε μας',
    facts: [
      'Μπάνιο, ηλεκτρολογικά και υδραυλικά έτοιμα',
      // The short form of assembly.crane and assembly.noCrane below: with a crane the
      // container is assembled in our warehouse and arrives built, never on site.
      'Συναρμολόγηση στην αποθήκη μας, αν επιλέξετε γερανό με δικά σας έξοδα, ή επί τόπου από δύο τεχνικούς μας',
      'Άλλα μεγέθη από 14 έως 30 m² κατόπιν παραγγελίας',
    ],
    // The owner's photo (2026-10-17) of a container delivered to a customer's plot
    // (shared/deliveredMedia.js), until another is set in the admin panel. Not the night render.
    photo: {
      url: DELIVERED_CONTAINER.url,
      srcSet: DELIVERED_CONTAINER.srcSet,
      alt: 'Κοντέινερ παραδομένο στο οικόπεδο πελάτη',
      position: '50% 55%',
    },
    // Read only when the admin set a photo but left its description empty: the default
    // photo's alt describes a different picture.
    adminAlt: 'Κοντέινερ της NVC Home4You',
  },

  units: {
    heading: 'Επιλέξτε κοντέινερ κατοικίας ή γραφείου',
    lead: 'Έξι βασικά μοντέλα. Κάθε τιμή περιλαμβάνει ΦΠΑ και συναρμολόγηση.',
    basis: 'με ΦΠΑ και συναρμολόγηση',
    ask: 'Ζητήστε προσφορά για αυτό το μοντέλο',
    more: 'Λεπτομέρειες →',
    // By gallery id: what sets the model apart from the one beside it. A new model with no
    // line here is simply shown without one.
    diff: {
      13: 'Το βασικό μοντέλο, 6 × 3 m',
      6: 'Το βασικό μοντέλο, ένα μέτρο μακρύτερο: 7 × 3 m',
      12: 'Ολόκληρος γυάλινος τοίχος με πλαίσιο αλουμινίου και πρόσοψη PU· μπάνιο με τουαλέτα και νιπτήρα, χωρίς ντους',
      14: 'Διακοσμητική πρόσοψη από πάνελ PU 16 mm',
      7: 'Διακοσμητική πρόσοψη από πάνελ PU 16 mm',
      8: 'Δίρριχτη στέγη και παράθυρο 1500 × 1600 mm',
    },
    madeToOrder: 'Τα άλλα μεγέθη του καταλόγου, από 14 έως 30 m², δεν τα έχουμε σε απόθεμα, αλλά μπορούμε να τα παραγγείλουμε για εσάς. Ρωτήστε μας.',
    loadError: 'Δεν μπορέσαμε να φορτώσουμε τις τιμές.',
    pricesLink: 'Ο πλήρης πίνακας τιμών →',
    galleryLink: 'Φωτογραφίες όλων των κοντέινερ →',
    // To the partner page's enquiry form (#zapitvane): more than one unit, or for resale.
    partnerLink: 'Περισσότερα από ένα τεμάχιο ή για μεταπώληση; →',
  },

  specs: {
    heading: 'Τι έχει κάθε κοντέινερ',
    lead: 'Ίδια και στα έξι μοντέλα, εκτός αν σημειώνεται αλλιώς.',
    // Container buyers can choose their doors from the internal doors range (owner, 2026-10-15).
    doorsLink: 'Εσωτερικές πόρτες για το κοντέινερ σας →',
    rows: [
      { label: 'Κατασκευή', value: 'Γαλβανισμένος χαλύβδινος σκελετός, 2,3 mm' },
      { label: 'Τοίχοι και μόνωση', value: 'Πάνελ 50 mm με πετροβάμβακα 100 kg/m³' },
      { label: 'Παράθυρα', value: 'PVC με διπλά τζάμια, 950 × 1200 mm· στο μοντέλο 8 × 3 m, 1500 × 1600 mm' },
      { label: 'Δάπεδο', value: 'PVC· στο μπάνιο SPC ή πλακάκια, της επιλογής σας' },
      { label: 'Ηλεκτρολογικά και υδραυλικά', value: 'Πλήρως εγκατεστημένα' },
      { label: 'Μπάνιο', value: 'Τουαλέτα, νιπτήρας με έπιπλο και ντουζιέρα· στο πανοραμικό γραφείο χωρίς ντους' },
      { label: 'Κουζίνα', value: 'Δεν περιλαμβάνεται. Υπάρχει χώρος που μπορεί να χρησιμοποιηθεί ως κουζίνα.' },
    ],
    // Two photos of the models themselves, from the gallery: the item's id and the photo's place in it.
    photos: [
      { id: 13, index: 1, alt: 'Το μπάνιο κοντέινερ 6 × 3 m: ντουζιέρα, νιπτήρας με έπιπλο και τουαλέτα' },
      { id: 6, index: 1, alt: 'Εσωτερικό κοντέινερ 7 × 3 m: δάπεδο PVC και παράθυρο με διπλά τζάμια' },
    ],
  },

  assembly: {
    heading: 'Συναρμολόγηση και παράδοση',
    includedLabel: 'Συναρμολόγηση',
    included: 'Περιλαμβάνεται στην τιμή κάθε μοντέλου: τα {amount} από αυτήν αφορούν τη συναρμολόγηση.',
    craneLabel: 'Με γερανό',
    crane: 'Αν προτιμάτε, το κοντέινερ τοποθετείται στη θέση του με γερανό, με δικά σας έξοδα: περίπου {crane} χωρίς ΦΠΑ. Τότε το συναρμολογούμε στην αποθήκη μας και φτάνει έτοιμο, χωρίς έξοδα μετακίνησης ή διαμονής τεχνικών.',
    noCraneLabel: 'Χωρίς γερανό',
    noCrane: 'Αν δεν θέλετε γερανό, δύο τεχνικοί μας συναρμολογούν το κοντέινερ επί τόπου, στον χώρο σας. Η εργασία απαιτεί {nights} διανυκτερεύσεις, για τις οποίες τους εξασφαλίζετε διαμονή. Ανάλογα με την τοποθεσία, τα έξοδα μετακίνησής τους φτάνουν έως {travel} χωρίς ΦΠΑ.',
    foundationLabel: 'Θεμελίωση',
    foundation: 'Η θεμελίωση που χρειάζεται εξαρτάται από την τοποθεσία. Καλέστε μας ή ρωτήστε μας για το δικό σας οικόπεδο.',
    deliveryLabel: 'Παράδοση',
    delivery: 'Παραδίδουμε από το Μαρικοστίνοβο της Βουλγαρίας: {rate} ανά χιλιόμετρο, και για τις δύο κατευθύνσεις, χωρίς ΦΠΑ. Ένα κοντέινερ από απόθεμα φτάνει σε έως {days} ημέρες.',
    deliveryLink: 'Υπολογίστε το κόστος παράδοσης σε εσάς →',
    ask: 'Κάντε μια ερώτηση',
    call: 'Καλέστε μας',
  },

  // The warranty as the owner gave it on 2026-10-15 for containers and Box houses. {years} is
  // the row's figure from shared/warranty.js, by its key.
  warranty: {
    heading: 'Εγγύηση',
    rows: [
      { key: 'structure', label: 'Σκελετός', text: '{years}\u00a0χρόνια — ο φέρων χαλύβδινος σκελετός' },
      { key: 'panels', label: 'Πάνελ', text: '{years}\u00a0χρόνια — τα θερμομονωτικά πάνελ τύπου σάντουιτς' },
      { key: 'joinery', label: 'Κουφώματα', text: '{years}\u00a0χρόνια — τα προφίλ και οι υαλοπίνακες' },
      { key: 'sanitary', label: 'Είδη υγιεινής', text: '{years}\u00a0χρόνια — τα είδη υγιεινής και τα υδραυλικά εξαρτήματα στο μπάνιο' },
    ],
    conditions: 'Η εγγύηση καλύπτει εργοστασιακά ελαττώματα και ισχύει από την ημερομηνία παράδοσης, με κανονική χρήση, κατάλληλη θεμελίωση, σωστή αποστράγγιση και χωρίς μη εξουσιοδοτημένες επεμβάσεις τρίτων. Όλα τα υπόλοιπα στοιχεία ελέγχονται οπτικά κατά την παράδοση ως προς τη συμφωνία τους με τις προδιαγραφές του εργοστασίου.',
    excluded: 'Η εγγύηση δεν καλύπτει μηχανικές ζημιές, λανθασμένη μεταφορά ή εκφόρτωση που δεν έγινε από εμάς, ακατάλληλη θεμελίωση, έλλειψη αερισμού, κακή αποστράγγιση, διαρροές από εξωτερικές συνδέσεις, συμπύκνωση υγρασίας, μεταγενέστερες επισκευές ή αλλαγές από τον αγοραστή ή από τρίτους, ούτε ανωτέρα βία.',
  },

  // The page's questions (lib/productQuestions.js): the same ids as bg/modularBuilds.js, which
  // says where each answer comes from. Drafted Greek, like the rest of this file.
  faq: {
    heading: 'Ερωτήσεις',
    // To the hub's containers topic (#t-containers).
    more: 'Περισσότερες ερωτήσεις →',
    items: [
      {
        id: 'container-kitchen',
        q: 'Το κοντέινερ έχει κουζίνα;',
        a: 'Η κουζίνα δεν περιλαμβάνεται. Υπάρχει χώρος που μπορεί να χρησιμοποιηθεί ως κουζίνα.',
        link: { pathKey: 'modularBuilds', hash: 'specs', label: 'Τι έχει κάθε κοντέινερ →' },
      },
      {
        id: 'container-assembly',
        q: 'Η συναρμολόγηση περιλαμβάνεται στην τιμή του κοντέινερ;',
        a: 'Ναι. Περιλαμβάνεται στην τιμή κάθε μοντέλου: τα {containerAssembly} από αυτήν αφορούν τη συναρμολόγηση.',
        link: { pathKey: 'modularBuilds', hash: 'assembly', label: 'Συναρμολόγηση και παράδοση κοντέινερ →' },
      },
      {
        id: 'container-sizes',
        q: 'Υπάρχουν κοντέινερ σε άλλα μεγέθη;',
        a: 'Τα άλλα μεγέθη του καταλόγου δεν τα έχουμε σε απόθεμα, αλλά μπορούμε να τα παραγγείλουμε για εσάς. Ρωτήστε μας.',
        link: { pathKey: 'modularBuilds', hash: 'units', label: 'Τα κοντέινερ σε απόθεμα, με τιμές →' },
      },
      {
        id: 'container-made-to-order',
        q: 'Σε πόσο καιρό φτάνει ένα κοντέινερ κατόπιν παραγγελίας;',
        a: 'Σε περίπου {madeToOrderMonths} μήνες, όσο και ένα σπίτι Box. Ένα κοντέινερ από το απόθεμα είναι σε εσάς μέσα σε {days} ημέρες.',
      },
      {
        id: 'container-finishes',
        q: 'Μπορώ να επιλέξω τα φινιρίσματα του κοντέινερ;',
        a: 'Ναι, όταν το κοντέινερ παραγγέλνεται ειδικά για εσάς. Στα κοντέινερ από το απόθεμα τα φινιρίσματα δεν επιλέγονται.',
      },
      { id: 'doors-for-containers', from: 'doors' },
    ],
  },

  reviewsHeading: 'Τι λένε οι αγοραστές',

  catalogues: {
    heading: 'Κατάλογοι (PDF)',
    subheading: 'Οι κατάλογοι είναι προς το παρόν στα βουλγαρικά. Οι ισχύουσες τιμές είναι αυτές της σελίδας.',
    items: [
      { brochureSlug: 'standard-containers', label: 'Τυπικά κοντέινερ', note: 'Μονάδες 14–30 m²' },
      { brochureSlug: 'villa-office', label: 'Βίλα / Γραφείο', note: 'Μονάδες κατοικίας και εργασίας' },
      { brochureSlug: 'sloped-roof', label: 'Κεκλιμένη στέγη', note: 'Μονάδες με κεκλιμένη στέγη' },
    ],
  },

  siblings: {
    heading: 'Ψάχνετε κάτι άλλο;',
    go: 'Δείτε →',
    houses: {
      label: 'Δομικά σπίτια',
      desc: 'Αναπτυσσόμενα σπίτια Box και κάψουλες για μόνιμη κατοικία.',
      price: 'από {price} με ΦΠΑ, χωρίς συναρμολόγηση',
    },
    steel: {
      label: 'Μεταλλικά σπίτια σε δικό σας σχέδιο',
      desc: 'Στείλτε μας το σχέδιό σας για προσφορά ή ετοιμάζουμε εμείς το σχέδιο για εσάς.',
    },
  },

  finalTitle: 'Να μιλήσουμε για το κοντέινερ σας;',

  // Product markup: the list's name and each model's category.
  listName: 'Οικίσκοι κοντέινερ',
  schemaCategory: 'Κοντέινερ κατοικίας',
}
