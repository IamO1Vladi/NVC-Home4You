// The route map is drawn on two pages, this one and the partner page; partner.js imports
// these two so the map's place names and control wording are written once.
//
// Destination names for the map's selects, keyed by the ids in LogisticsWorld.jsx. Greek
// exonyms where Greek has one; the airport codes stay as they are.
export const routeMapDestinations = {
  sea: {
    rtm: 'Ρότερνταμ, Ολλανδία',
    ham: 'Αμβούργο, Γερμανία',
    ant: 'Αμβέρσα, Βέλγιο',
    pir: 'Πειραιάς, Ελλάδα',
    vlc: 'Βαλένθια, Ισπανία',
    cnd: 'Κωνστάντζα, Ρουμανία',
    var: 'Βάρνα, Βουλγαρία',
    lax: 'Λος Άντζελες, ΗΠΑ',
    nyc: 'Νέα Υόρκη, ΗΠΑ',
    sts: 'Σάντος, Βραζιλία',
    cll: 'Καγιάο, Περού',
  },
  air: {
    sof: 'Σόφια (SOF), Βουλγαρία',
    ath: 'Αθήνα (ATH), Ελλάδα',
    fra: 'Φρανκφούρτη (FRA), Γερμανία',
    cdg: 'Παρίσι (CDG), Γαλλία',
    lhr: 'Λονδίνο (LHR), Ηνωμένο Βασίλειο',
    jfk: 'Νέα Υόρκη (JFK), ΗΠΑ',
    lax: 'Λος Άντζελες (LAX), ΗΠΑ',
    gru: 'Σάο Πάολο (GRU), Βραζιλία',
  },
  rail: {
    dsg: 'Ντούισμπουργκ, Γερμανία',
    ham: 'Αμβούργο, Γερμανία',
    waw: 'Βαρσοβία, Πολωνία',
    bud: 'Βουδαπέστη, Ουγγαρία',
    sof: 'Σόφια, Βουλγαρία',
  },
}

// Leaflet's own control wording, which is English unless replaced.
export const routeMapControls = {
  zoomIn: 'Μεγέθυνση',
  zoomOut: 'Σμίκρυνση',
  attributionTitle: 'Βιβλιοθήκη JavaScript για διαδραστικούς χάρτες',
  marker: 'Σημείο στον χάρτη',
}

export default {
  seo: {
    title: 'Διεθνής εφοδιαστική από Ασία προς Ευρώπη | NVC Home4You',
    description:
      'Διεθνής εφοδιαστική από Κίνα, Βιετνάμ και Ταϊλάνδη προς Ευρώπη, Βόρεια και Νότια Αμερική. Θαλάσσια, αεροπορική, σιδηροδρομική και συνδυασμένη μεταφορά με συντονισμό τελωνείων.',
    url: 'https://nvc-home4you.eu/el/diethnis-efodiastiki',
  },
  breadcrumbs: [
    { name: 'Αρχική', url: 'https://nvc-home4you.eu/el' },
    { name: 'Διεθνής εφοδιαστική', url: 'https://nvc-home4you.eu/el/diethnis-efodiastiki' },
  ],
  hero: {
    title: 'Διεθνής εφοδιαστική',
    lead:
      'EXW/FOB → DAP/DDP από Κίνα, Βιετνάμ και Ταϊλάνδη προς Ευρώπη, Βόρεια και Νότια Αμερική. Θαλάσσια (LCL/FCL), αεροπορική, σιδηροδρομική και συνδυασμένη μεταφορά με συντονισμό τελωνείων.',
    button: 'Επικοινωνήστε μαζί μας',
    image: {
      src: '/api/img/content/bvk4n834b-rcd-eg-vb.webp',
    },
  },
  process: {
    segmentMs: 1500,
    lead: 'Δομούμε ολόκληρη τη ροή — από τον σχεδιασμό διαδρομής και τα Incoterms έως την άφιξη, την παρακολούθηση και την τελική παράδοση.',
    replay: 'Επανάληψη',
    steps: [
      {
        key: 'plan',
        heading: 'Διαδρομή και εμπορικοί όροι',
        body: 'Καθορίζουμε προέλευση, προορισμό, προφίλ φορτίου και Incoterms για να επιλέξουμε τη σωστή διάταξη μεταφοράς.',
        meta: 'EXW / FOB / DAP / DDP',
      },
      {
        key: 'book',
        heading: 'Κράτηση και προετοιμασία',
        body: 'Σχεδιάζουμε θαλάσσια, αεροπορική, σιδηροδρομική ή συνδυασμένη δρομολόγηση βάσει χρόνου, προϋπολογισμού και μεγέθους αποστολής.',
        meta: 'LCL / FCL / Express',
      },
      {
        key: 'docs',
        heading: 'Έγγραφα και φόρτωση',
        body: 'Ετοιμάζουμε τα έγγραφα αποστολής και συντονίζουμε τη φόρτωση ώστε το φορτίο να αναχωρεί χωρίς περιττές καθυστερήσεις.',
        meta: 'Τεκμηρίωση και συμμόρφωση',
      },
      {
        key: 'transit',
        heading: 'Διαμετακόμιση και παρακολούθηση',
        body: 'Παρακολουθούμε τη διαδρομή και διατηρούμε ορατότητα σε ορόσημα, αλλαγές και ενδεικτικά χρονικά περιθώρια παράδοσης.',
        meta: 'Παρακολούθηση αποστολής',
      },
      {
        key: 'arrival',
        heading: 'Άφιξη και τελική παράδοση',
        body: 'Συντονίζουμε λιμάνι, τελωνείο και τα τελικά χερσαία στάδια έως το σημείο παράδοσης.',
        meta: 'Εισαγωγή και παράδοση',
      },
    ],
    windows: {
      chips: [
        'Θαλάσσια προς Δυτική Ευρώπη: ~30–35 ημέρες',
        'Θαλάσσια προς Ανατολική Ευρώπη: ~40–45 ημέρες',
      ],
      sub: 'Ο πραγματικός χρόνος διαμετακόμισης εξαρτάται από το ζεύγος λιμανιών, την εποχικότητα, τη συμφόρηση και τις τοπικές διατυπώσεις.',
    },
  },
  map: {
    note: 'Ενδεικτικά θαλάσσια περιθώρια προς ΕΕ: Δυτική Ευρώπη ~30–35 ημέρες, Ανατολική Ευρώπη ~40–45 ημέρες· ο πραγματικός χρόνος εξαρτάται από το λιμάνι, την εποχή και τον τελωνειακό χειρισμό.',
    world: {
      modeLabel: 'Μέσο:',
      modeSea: 'Θαλάσσια',
      modeAir: 'Αεροπορική',
      modeRail: 'Σιδηροδρομική',
      seaDestinationLabel: 'Λιμάνι προορισμού:',
      airDestinationLabel: 'Αεροδρόμιο:',
      railDestinationLabel: 'Σιδηροδρομικός κόμβος:',
      legendLabel: 'Προελεύσεις',
      legendShanghai: 'Σαγκάη',
      legendHoChiMinh: 'Χο Τσι Μινχ',
      legendLaemChabang: 'Λάεμ Τσαμπάνγκ',
      destinations: routeMapDestinations,
      mapControls: routeMapControls,
    },
  },
  tiles: [
    {
      id: 'sea',
      title: 'Θαλάσσια μεταφορά (LCL/FCL)',
      desc: 'Κοντέινερ και ομαδικά φορτία από και προς μεγάλα λιμάνια. Η καλύτερη αξία ανά όγκο όταν είναι αποδεκτός μεγαλύτερος χρόνος.',
      img: '/api/img/content/bvk4n834b-rv-eg-vb.webp',
    },
    {
      id: 'air',
      title: 'Αεροπορική μεταφορά',
      desc: 'Η πιο γρήγορη επιλογή για επείγουσες αποστολές, δείγματα και χρονικά ευαίσθητα φορτία.',
      img: '/api/img/content/bvk4n834b-rbq-eg-vb.webp',
    },
    {
      id: 'rail',
      title: 'Σιδηροδρομική μεταφορά',
      desc: 'Ισορροπία κόστους και ταχύτητας στους ευρασιατικούς διαδρόμους, κατάλληλη για παλετοποιημένες και τακτικές ροές.',
      img: '/api/img/content/bvk4n834b-rx-eg-vb.webp',
    },
    {
      id: 'multi',
      title: 'Συνδυασμένη δρομολόγηση',
      desc: 'Συνδυασμός θαλάσσιων, αεροπορικών, σιδηροδρομικών και οδικών σκελών για αυστηρότερο έλεγχο προϋπολογισμού και χρονοδιαγράμματος.',
      img: '/api/img/content/bvk4n834b-rcd-eg-vb.webp',
    },
  ],
}
