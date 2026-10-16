import { ABOUT_PHOTO } from '../shared/aboutMedia.js'

// Ο χάρτης που ανοίγει ο επισκέπτης από το «Άνοιγμα στους Χάρτες». Η διεύθυνση είναι αυτή
// που τυπώνει η σελίδα, κωδικοποιημένη στο URL ώστε να μη στέκει ως λέξη στο κείμενο.
const MAPS_HREF = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Μαρικοστίνοβο, 2850 Πέτριτς, Βουλγαρία')}`

export default {
  header: {
    primaryNavAria: 'Κύρια πλοήγηση',
    brand: { short: 'NVC', full: 'Home4You' },
    servicesSummary: 'Σπίτια & υπηρεσίες',
    nav: {
      gallery: 'Γκαλερί',
      prices: 'Τιμές',
      cases: 'Κριτικές',
      faq: 'Συχνές ερωτήσεις',
      about: 'Σχετικά',
      partner: 'Συνεργάτες',
      planner: 'Σχεδιαστής',
      quote: 'Ζητήστε προσφορά',
      boxConfigurator: 'Διαμορφωτής',
      plannerGroup: 'Σχεδιασμός',
      call: 'Καλέστε μας',
      catalogues: 'Κατάλογοι (PDF)',
    },
    servicesMenu: {
      columns: [
        {
          title: 'Σπίτια Κοντέινερ & Προκατασκευασμένα',
          items: [
            { pathKey: 'modularBuilds', label: 'Μονάδες-κοντέινερ' },
            { pathKey: 'modularHouses', label: 'Δομικά σπίτια' },
            { pathKey: 'steelHouses', label: 'Μεταλλικά σπίτια σε δικό σας σχέδιο' },
          ],
        },
        {
          title: 'Παράδοση',
          items: [
            { pathKey: 'delivery', label: 'Παράδοση και συναρμολόγηση' },
          ],
        },
        {
          title: 'Υλικά, Έπιπλα & Ανακαινίσεις',
          items: [
            { pathKey: 'interiors', label: 'Εσωτερικοί χώροι' },
            { pathKey: 'doors', label: 'Εσωτερικές πόρτες' },
          ],
        },
      ],
    },
    theme: {
      label: 'Θέμα',
      ariaLabel: 'Θέμα',
      light: 'Φωτεινό',
      dark: 'Σκούρο',
      system: 'Όπως η συσκευή',
    },
    language: {
      label: 'Γλώσσα',
      ariaLabel: 'Γλώσσα',
      options: [
        { value: 'en', label: 'English' },
        { value: 'bg', label: 'Български' },
        { value: 'el', label: 'Ελληνικά' },
      ],
    },
    mobileMenuButtonAria: 'Άνοιγμα μενού',
  },
  // The footer's site map on every page (SiteFooter.jsx). Only the group headings are here: each
  // link is named with the header's own label above (servicesMenu, nav) and goes to its paths.js
  // path, so the menu and the footer cannot name a page two ways.
  footer: {
    siteMapLabel: 'Χάρτης ιστότοπου',
    groups: {
      products: 'Προϊόντα',
      buy: 'Αγορά',
      company: 'Η εταιρεία',
      contact: 'Επικοινωνία',
    },
  },
  home: {
    hero: {
      eyebrow: 'Προκατασκευασμένα σπίτια και σπίτια-κοντέινερ',
      title: 'Γιατί ένα <g>σπίτι</g> δεν πρέπει να είναι έξοδο',
      // Το {price} είναι το φθηνότερο κοντέινερ της γκαλερί (με ΦΠΑ και συναρμολόγηση), από το
      // /api/home/photos μέσω του euro(), ποτέ γραμμένο εδώ. Μέχρι να είναι γνωστό, η αρχή
      // δείχνει το leadNoPrice, την ίδια πρόταση χωρίς ποσό.
      lead: 'Προκατασκευασμένα σπίτια και σπίτια-κοντέινερ από {price} με ΦΠΑ. Με έδρα το Πέτριτς Βουλγαρίας, παραδίδουμε σε όλη την ΕΕ.',
      leadNoPrice: 'Προκατασκευασμένα σπίτια και σπίτια-κοντέινερ με σαφείς τιμές. Με έδρα το Πέτριτς Βουλγαρίας, παραδίδουμε σε όλη την ΕΕ.',
      primaryCta: 'Ζητήστε προσφορά',
      pricesCta: 'Δείτε μοντέλα & τιμές',
      facts: ['87 σπίτια παραδόθηκαν', 'Τιμές με ΦΠΑ', 'Εταιρεία από το 2021'],
      // A fact that names a page links there, its words unchanged (`fact` is its place in facts).
      factLinks: [{ fact: 2, pathKey: 'about' }],
      slidesLabel: 'Φωτογραφίες',
      photoLabelPattern: 'Φωτογραφία {n} από {total}: {label}',
      showcase: {
        openLabel: 'Άνοιγμα',
        slidesLabel: 'Φωτογραφίες',
        slides: [
          { src: '/api/img/content/bukcsfwf9-rdg-eg-vb.webp', alt: 'Μονάδες-κοντέινερ', pathKey: 'modularBuilds', frame: { position: '30% 50%', scale: 1.22 } },
          { src: '/api/img/content/bukcsfwf9-rdf-eg-vb.webp', alt: 'Δομικά σπίτια', pathKey: 'modularHouses' },
          { src: '/api/img/content/bvk4n834b-rbu-eg-vb.webp', alt: 'Μονάδες-κοντέινερ', pathKey: 'modularBuilds' },
          { src: '/api/img/content/bvk4n834b-r7-eg-vb.webp', alt: 'Μεταλλικά σπίτια σε δικό σας σχέδιο', pathKey: 'steelHouses' },
          // Slide 5 (since 2026-10-17): the crane lifting a container (shared/aboutMedia.js, the About and delivery photo), linking to
          // the delivery page. The lakeside container stands at its photo's left edge, where the hero fades under the heading.
          { src: ABOUT_PHOTO.url, srcSet: ABOUT_PHOTO.srcSet, alt: 'Παράδοση και συναρμολόγηση', pathKey: 'delivery' },
        ],
      },
    },
    band: {
      visitTitle: 'Επισκεφθείτε μας',
      address: 'Μαρικοστίνοβο, 2850 Πέτριτς',
      mapsLabel: 'Άνοιγμα στους Χάρτες →',
      mapsHref: MAPS_HREF,
      callTitle: 'Κλήση ή WhatsApp',
      hours: 'Δευ–Παρ 07:00–19:00',
      writeTitle: 'Γράψτε μας',
      replyNote: 'Απαντάμε εντός 24 ωρών',
    },
    strip: {
      kicker: 'Τιμές',
      titlePattern: '{count} μοντέλα από {price} — φτιάξτε το δικό σας online',
      lead: 'Διαλέξτε μοντέλο και δείτε την τιμή σε κάθε βήμα: κάτοψη, κουφώματα, μπάνιο, κουζίνα.',
      from: 'από',
      incl: 'με ΦΠΑ, χωρίς συναρμολόγηση',
      cta: 'Ξεκινήστε με αυτό →',
      all: 'Όλες οι τιμές →',
      gallery: 'Όλα τα μοντέλα με φωτογραφίες →',
      planner: 'Σχεδιάστε την κάτοψη →',
      paperPrefix: 'Προτιμάτε χαρτί;',
      paperLink: 'Κατεβάστε τον κατάλογο (PDF)',
      paperOr: 'ή',
      paperAll: 'δείτε και τους έξι καταλόγους',
    },
    serviceTiles: {
      ariaLabel: 'Τι κατασκευάζουμε',
      heading: 'Τι κατασκευάζουμε',
      subheading: 'Από ένα δωμάτιο 14 m² μέχρι οικογενειακό σπίτι — και τα μπάνια και οι κουζίνες μέσα.',
      button: 'Ανακαλύψτε →',
      // Under the tiles: the partner page, for buyers of several units and resellers.
      partnerLink: 'Αγοράζετε πολλά τεμάχια ή μεταπωλείτε; →',
      items: [
        {
          key: 'modularBuilds',
          pathKey: 'modularBuilds',
          title: 'Μονάδες-κοντέινερ · 14–30 m²',
          desc: 'Έτοιμες μονάδες-κοντέινερ — εξοχικό, ξενώνας, γραφείο ή κατάστημα — παραδίδονται και συναρμολογούνται από εμάς.',
          icon: 'layers',
          img: '/api/img/content/bvk4n834b-rbp-eg-vb.webp',
        },
        {
          key: 'modularHouses',
          pathKey: 'modularHouses',
          title: 'Προκάτ σπίτια · 18–74 m²',
          desc: 'Σπίτια από 18 έως 74 m²: επεκτάσιμα σπίτια Box και κάψουλες χώρου, με τη δική σας κάτοψη και φινιρίσματα.',
          icon: 'home',
          img: '/api/img/content/bvk4n834b-rdb-eg-vd.webp',
        },
        {
          key: 'steelHouses',
          pathKey: 'steelHouses',
          title: 'Μεταλλικά σπίτια σε δικό σας σχέδιο',
          desc: 'Σπίτια με μεταλλικό σκελετό με βάση τη δική σας μελέτη — ή εκπονούμε εμείς τη μελέτη για εσάς.',
          icon: 'steel',
          img: '/api/img/content/bvk4n834b-rdc-eg-vb.webp',
        },
        {
          key: 'interiors',
          pathKey: 'interiors',
          title: 'Εσωτερικοί χώροι',
          desc: 'Ανακαίνιση μπάνιων και κουζινών με σαφές πλάνο και διαφανείς τιμές.',
          icon: 'interior',
          img: '/api/img/content/bvk4n834b-rce-eg-vb.webp',
        },
      ],
    },
    catalogues: {
      heading: 'Πάρτε έναν κατάλογο μαζί σας',
      subheading: 'Έξι κατάλογοι PDF με κάθε μοντέλο, μέγεθος και φινίρισμα. Ανοίξτε έναν σε νέα καρτέλα, τυπώστε τον ή στείλτε τον σε όποιον αποφασίζει μαζί σας.',
      items: [
        { brochureSlug: 'modular-builds', label: 'Γενικός κατάλογος', note: 'Δομικές κατασκευές, όλες οι σειρές' },
        { brochureSlug: 'standard-containers', label: 'Τυπικά κοντέινερ', note: 'Μονάδες 14–30 m²' },
        { brochureSlug: 'villa-office', label: 'Βίλα / Γραφείο', note: 'Μονάδες κατοικίας και εργασίας' },
        { brochureSlug: 'sloped-roof', label: 'Κεκλιμένη στέγη', note: 'Μονάδες καταστήματος και κεκλιμένης στέγης' },
        { brochureSlug: 'box-house', label: 'Σπίτια Box', note: 'Επεκτάσιμα σπίτια 37 / 58 / 73 m²' },
        { brochureSlug: 'space-capsules', label: 'Κάψουλες χώρου', note: 'Σπίτια-κάψουλες' },
      ],
    },
    glideServices: {
      ariaLabel: 'Επιλεγμένες υπηρεσίες',
      subheading: 'Σύρετε ή πατήστε οποιαδήποτε κάρτα για άνοιγμα της σελίδας',
      prevAria: 'Προηγούμενη διαφάνεια',
      nextAria: 'Επόμενη διαφάνεια',
      dotsAria: 'Πλοήγηση διαφανειών',
      slides: [
        { key: 'steelHouse0', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: '/api/img/content/bvk4n834b-rdd-eg-vb.webp' },
        { key: 'steelHouse7', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: '/api/img/content/bvk4n834b-rde-eg-vb.webp' },
        { key: 'modularHouse0', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: '/api/img/content/bvk4n834b-rdf-eg-vb.webp' },
        { key: 'steelHouse1', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: '/api/img/content/bvk4n834b-rcf-eg-vb.webp' },
        { key: 'steelHouse2', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: '/api/img/content/bvk4n834b-rm-eg-vb.webp' },
        { key: 'modularHouse1', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: '/api/img/content/bvk4n834b-rb9-eg-vb.webp' },
        { key: 'modularHouse2', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: '/api/img/content/bvk4n834b-r2-eg-vb.webp' },
        { key: 'modularHouse3', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: '/api/img/content/bvk4n834b-rq-eg-vb.webp' },
        { key: 'steelHouse3', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: '/api/img/content/bvk4n834b-rr-eg-vb.webp' },
        { key: 'steelHouse4', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: '/api/img/content/bvk4n834b-r4-eg-vb.webp' },
      ],
    },
    stats: {
      heading: 'Το ιστορικό μας',
      items: [
        { label: 'Σπίτια που παραδόθηκαν', value: 87 },
        { label: 'Έγκαιρη παράδοση (ημέρες)', value: 5 },
        { label: 'Μέσος χρόνος συναρμολόγησης', value: 7 },
      ],
    },
    whyUs: {
      heading: 'Γιατί μας επιλέγουν οικογένειες στη Βουλγαρία και την ΕΕ',
      items: [
        { icon: 'qa', title: 'Χωρίς κρυφά κόστη', desc: 'Κάθε τιμή αναγράφεται με τις προδιαγραφές και τα φινιρίσματα αναλυτικά.' },
        { icon: 'person', title: 'Σας απαντά πραγματικός άνθρωπος', desc: 'Καλέστε, γράψτε ή επισκεφθείτε μας κοντά στο Πέτριτς — απαντάμε εντός 24 ωρών.' },
        { icon: 'truck', pathKey: 'delivery', title: 'Παράδοση σε όλη την ΕΕ', desc: 'Δική μας εφοδιαστική και παράδοση με το κλειδί στο χέρι, οπουδήποτε στην ΕΕ.' },
      ],
    },
    steps: {
      heading: 'Από το πρώτο τηλεφώνημα έως την παράδοση σε 6 βήματα',
      items: [
        {
          title: 'Διερεύνηση',
          long: 'Ξεκινάμε κατανοώντας τη χρήση, το χρονοδιάγραμμα, τον προϋπολογισμό και το προτιμώμενο μοντέλο σας, ώστε να προτείνουμε τη σωστή κατεύθυνση από την πρώτη μέρα.',
        },
        {
          title: 'Σχεδιασμός & Προδιαγραφές',
          long: 'Μόλις ξεκαθαρίσει η ιδέα, κλειδώνουμε την κάτοψη, τον εξοπλισμό και το πακέτο φινιρίσματος, ώστε η τιμολόγηση και η παραγωγή να προχωρήσουν χωρίς αβεβαιότητα.',
        },
        {
          title: 'Επιβεβαίωση & Προγραμματισμός',
          long: 'Λαμβάνετε ένα σαφές εμπορικό και χρονικό σημείο ελέγχου πριν οριστικοποιηθούν η παραγωγή και η μεταφορά.',
        },
        {
          title: 'Προετοιμασία & Έγγραφα',
          long: 'Αυτό το στάδιο καλύπτει το σύνολο της εφοδιαστικής: τεκμηρίωση, ασφάλιση, σχεδιασμό μεταφοράς και την πρακτική λίστα ελέγχου για τον χώρο σας.',
        },
        {
          title: 'Παράδοση & Συναρμολόγηση',
          long: 'Η μονάδα φτάνει στον χώρο, συντονίζεται η τοποθέτηση και η κατασκευή ολοκληρώνεται σύμφωνα με το συμφωνημένο αντικείμενο.',
        },
        {
          title: 'Εξυπηρέτηση μετά την παράδοση',
          long: 'Μετά την παράδοση, παραμένουμε διαθέσιμοι για υποστήριξη εγγύησης, ανταλλακτικά και μελλοντικές αναβαθμίσεις όποτε χρειαστεί.',
        },
      ],
    },
    mobileDock: {
      closeLabel: 'Κλείσιμο',
      title: 'NVC Home4You',
      description: 'Λάβετε προσφορά χωρίς δέσμευση ή ρωτήστε μας οτιδήποτε. Απαντάμε εντός 24 ωρών.',
      primaryCta: 'Ζητήστε προσφορά',
    },
    testimonials: {
      take: 3,
      heading: 'Τι λένε οι πελάτες μας',
      subheading: 'Με τα δικά τους λόγια, στη γλώσσα που τα έγραψαν.',
      aggregateAria: 'Μέση βαθμολογία πελατών',
      aggregatePattern: '{score} από {count} επαληθευμένες κριτικές',
      countLabel: '{count} επαληθευμένες κριτικές',
      verified: 'Επαληθευμένη',
      customerFallback: 'Πελάτης',
      reviewIn: { bg: 'Κριτική στα βουλγαρικά', en: 'Κριτική στα αγγλικά', el: 'Κριτική στα ελληνικά' },
      ctaLabel: 'Δείτε όλες τις κριτικές →',
    },
    finalCta: {
      title: 'Να μιλήσουμε για το σπίτι σας;',
      desc: 'Λάβετε προσφορά χωρίς δέσμευση ή ρωτήστε μας οτιδήποτε. Απαντάμε εντός 24 ωρών.',
      primaryCta: 'Ζητήστε προσφορά',
      secondaryCta: 'Κάντε μια ερώτηση',
      phone: '+359 87 935 5269',
      email: 'contact@nvc-home4you.eu',
      where: 'Δευ–Παρ 07:00–19:00 · Μαρικοστίνοβο, Πέτριτς, Βουλγαρία',
    },
    // Ό,τι τυπώνει η σελίδα και ό,τι δημοσιεύει το LocalBusinessJSONLD, από ένα αντικείμενο.
    // Η διεύθυνση σε ελληνική γραφή: η σελίδα είναι ελληνική και ο έλεγχος αντιγράφου
    // (greekCopy.test.js) δεν δέχεται λατινικά τοπωνύμια σε αυτό το αρχείο.
    localBusiness: {
      url: 'https://nvc-home4you.eu/',
      email: 'contact@nvc-home4you.eu',
      telephone: '+359879355269',
      mapsHref: MAPS_HREF,
      address: {
        streetAddress: 'Μαρικοστίνοβο',
        addressLocality: 'Πέτριτς',
        addressRegion: 'Μπλαγκόεβγκραντ',
        postalCode: '2850',
        addressCountry: 'BG',
      },
      hours: {
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '19:00',
      },
    },
  },
  // `servicesPage` removed 2026-08-17 with the page that read it — see routes/paths.js.
  common: {
    close: 'Κλείσιμο',
    open: 'Άνοιγμα',
    viberChatLabel: 'Άνοιγμα συνομιλίας Viber',
    whatsAppChatLabel: 'Άνοιγμα συνομιλίας WhatsApp',
    contactLabel: 'Κλήση ή chat',
    callLabel: 'Κλήση',
    carouselRoleDescription: 'καρουζέλ',
    lightbox: {
      closeLabel: 'Κλείσιμο',
      prevLabel: 'Προηγ.',
      nextLabel: 'Επόμ.',
      descriptionHeading: 'Περιγραφή',
      fromLabel: 'από',
      requestLabel: 'Ζητήστε αυτό το μοντέλο',
      thumbnailsLabel: 'Μικρογραφίες',
      imageAltPattern: 'Εικόνα {current} από {total}',
      thumbnailAltPattern: 'Μικρογραφία {current} από {total}',
    },
    banner: {
      sending: 'Αποστολή…',
      retrying: 'Νέα προσπάθεια',
      retry: 'Δοκιμάστε ξανά',
    },
    toast: {
      successTitle: 'Επιτυχία',
      errorTitle: 'Σφάλμα',
      offerSuccess: 'Το αίτημά σας στάλθηκε!',
      offerError: 'Η υποβολή της προσφοράς απέτυχε',
      questionSuccess: 'Η ερώτησή σας στάλθηκε!',
      questionError: 'Η υποβολή της ερώτησης απέτυχε',
    },
  },
  forms: {
    offer: {
      title: 'Αίτημα προσφοράς',
      fields: {
        name: 'Όνομα',
        email: 'Διεύθυνση email',
        phone: 'Τηλέφωνο',
        project: 'Λεπτομέρειες έργου',
      },
      // Labels the line naming the gallery model an offer was requested for.
      model: 'Μοντέλο',
      // The same line for a steel-frame project (gallery prefab): the enquiry is for one like it.
      like: 'Σπίτι παρόμοιο με',
      submit: 'Υποβολή',
    },
    question: {
      title: 'Κάντε μια ερώτηση',
      fields: {
        name: 'Όνομα',
        email: 'Διεύθυνση email',
        question: 'Η ερώτησή σας',
      },
      submit: 'Αποστολή',
    },
  },
}
