// src/content/el/modularBuilds.js
//
// The words on the «Μονάδες-κοντέινερ» page (/el/domikes-kataskeves). No price lives here:
// the prices, the "from" figure, the assembly share of a price and the delivery rate come
// from the gallery (/api/gallery), prices.js and delivery.js, and are filled into {amount},
// {rate} and {price}. The title and description search engines read are in
// src/seo/routeMeta.js.
//
// The table states only what the six gallery descriptions state. The kitchen, the crane,
// the accommodation, the foundation and the made-to-order sizes are the owner's words
// (2026-10-12). Drafted Greek; a native read is still to come.
export default {
  hero: {
    eyebrow: 'Μονάδες-κοντέινερ',
    h1: 'Κοντέινερ για κατοικία, γραφείο και εργοτάξιο',
    lead: 'Κοντέινερ κατοικίας και γραφείου 6×3, 7×3 και 8×3 m με μπάνιο, ηλεκτρολογική και υδραυλική εγκατάσταση — τα παραδίδουμε και τα συναρμολογούμε εμείς.',
    from: 'από',
    basis: 'με ΦΠΑ και συναρμολόγηση',
    cta: 'Ζητήστε προσφορά',
    call: 'Καλέστε μας',
    facts: [
      'Μπάνιο, ηλεκτρολογικά και υδραυλικά έτοιμα',
      'Συναρμολόγηση επί τόπου από δύο τεχνικούς μας ή με γερανό, με δικά σας έξοδα',
      'Άλλα μεγέθη από 14 έως 30 m² κατόπιν παραγγελίας',
    ],
    // A real daylight photo from the gallery (the 8 × 3 m model) until the owner uploads one
    // of a delivered container in the admin panel. Not the night render.
    photo: {
      url: '/api/img/gallery/3/37755aa751c74bb5bbcd9848842c3a1e.webp',
      alt: 'Εσωτερικό κοντέινερ 8 × 3 m με δίρριχτη στέγη',
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
  },

  specs: {
    heading: 'Τι έχει κάθε κοντέινερ',
    lead: 'Ίδια και στα έξι μοντέλα, εκτός αν σημειώνεται αλλιώς.',
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
    crane: 'Αν προτιμάτε, το κοντέινερ τοποθετείται στη θέση του με γερανό, με δικά σας έξοδα.',
    noCraneLabel: 'Χωρίς γερανό',
    noCrane: 'Αν δεν θέλετε γερανό, δύο τεχνικοί μας συναρμολογούν το κοντέινερ επί τόπου, στον χώρο σας. Σε αυτή την περίπτωση τους εξασφαλίζετε διαμονή για τρεις νύχτες.',
    foundationLabel: 'Θεμελίωση',
    foundation: 'Η θεμελίωση που χρειάζεται εξαρτάται από την τοποθεσία. Καλέστε μας ή ρωτήστε μας για το δικό σας οικόπεδο.',
    deliveryLabel: 'Παράδοση',
    delivery: 'Παραδίδουμε από το Μαρικοστίνοβο της Βουλγαρίας: {rate} ανά χιλιόμετρο, και για τις δύο κατευθύνσεις.',
    deliveryLink: 'Υπολογίστε το κόστος παράδοσης στη διεύθυνσή σας →',
    ask: 'Κάντε μια ερώτηση',
    call: 'Καλέστε μας',
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
  listName: 'Μονάδες-κοντέινερ',
  schemaCategory: 'Κοντέινερ κατοικίας',
}
