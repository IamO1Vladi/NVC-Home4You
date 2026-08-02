export default {
  header: {
    primaryNavAria: 'Κύρια πλοήγηση',
    brand: { short: 'NVC', full: 'Home4You' },
    servicesSummary: 'Τα Προϊόντα & οι Υπηρεσίες μας',
    nav: {
      gallery: 'Γκαλερί',
      cases: 'Έργα',
      faq: 'Συχνές ερωτήσεις',
      about: 'Σχετικά',
      partner: 'Συνεργάτης',
      planner: 'Σχεδιαστής',
      quote: 'Ζητήστε προσφορά',
      boxConfigurator: 'Διαμορφωτής'
    },
    servicesMenu: {
      columns: [
        {
          title: 'Σπίτια Κοντέινερ & Προκατασκευασμένα',
          items: [
            { pathKey: 'modularBuilds', label: 'Δομικές κατασκευές' },
            { pathKey: 'modularHouses', label: 'Δομικά σπίτια' },
            { pathKey: 'steelHouses', label: 'Μεταλλικά σπίτια' },
          ],
        },
        {
          title: 'Logistics & Εργοτάξιο',
          items: [
            { pathKey: 'delivery', label: 'Παράδοση έως την πόρτα' },
            { pathKey: 'logistics', label: 'Logistics' },
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
      system: 'Σύστημα',
    },
    language: {
      label: 'Γλώσσα',
      ariaLabel: 'Γλώσσα',
      options: [
        { value: 'en', label: 'EN' },
        { value: 'bg', label: 'BG' },
        { value: 'el', label: 'EL' },
      ],
    },
    mobileMenuButtonAria: 'Άνοιγμα μενού',
  },
  home: {
    hero: {
      title: 'Γιατί ένα σπίτι <g>δεν πρέπει</g> να είναι έξοδο',
      lead: 'Προκατασκευασμένα σπίτια και σπίτια-κοντέινερ με παράδοση σε όλη την Ευρώπη.',
      primaryCta: 'Λάβετε προσφορά',
      secondaryCta: 'Κάντε μια ερώτηση',
      motto: 'Εμπιστοσύνη & Ασφάλεια',
      badges: ['Παράδοση σε όλη την ΕΕ', 'Παράδοση με το κλειδί στο χέρι', 'Δική μας εφοδιαστική'],
      showcase: {
        openLabel: 'Άνοιγμα',
        slidesLabel: 'Διαφάνειες hero',
        slides: [
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdg/eg/vb', alt: 'Δομικές κατασκευές', pathKey: 'modularBuilds' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdf/eg/vb', alt: 'Δομικά σπίτια', pathKey: 'modularHouses' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rde/eg/vb', alt: 'Μεταλλικά σπίτια', pathKey: 'steelHouses' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bukcsfwf9/g/rdc/eg/vb', alt: 'Εσωτερικοί χώροι', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbx/eg/vb', alt: 'Εσωτερικοί χώροι', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r7/eg/vb', alt: 'Εσωτερικοί χώροι', pathKey: 'interiors' },
          { src: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbu/eg/vb', alt: 'Εσωτερικοί χώροι', pathKey: 'interiors' },
        ],
      },
    },
    serviceTiles: {
      ariaLabel: 'Οι υπηρεσίες μας',
      heading: 'Ανακαλύψτε τις υπηρεσίες μας',
      subheading: 'Περάστε τον δείκτη για λεπτομέρειες, πατήστε για άνοιγμα της σελίδας',
      button: 'Ανακαλύψτε →',
      items: [
        {
          key: 'modularBuilds',
          pathKey: 'modularBuilds',
          title: 'Δομικές κατασκευές',
          desc: 'Έτοιμες προς τοποθέτηση δομικές μονάδες για κατοικία, γραφείο ή κατάστημα — γρήγορη συναρμολόγηση, μακροχρόνια χρήση.',
          icon: 'layers',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rbp/eg/vb',
        },
        {
          key: 'modularHouses',
          pathKey: 'modularHouses',
          title: 'Δομικά σπίτια',
          desc: 'Μόνιμα δομικά σπίτια με ευέλικτες κατόψεις και φινιρίσματα.',
          icon: 'home',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdb/eg/vd',
        },
        {
          key: 'steelHouses',
          pathKey: 'steelHouses',
          title: 'Μεταλλικά σπίτια',
          desc: 'Ελαφριά και ανθεκτικά σπίτια με μεταλλικό σκελετό — έξυπνη λύση σε χρόνο και κόστος.',
          icon: 'steel',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdc/eg/vb',
        },
        {
          key: 'interiors',
          pathKey: 'interiors',
          title: 'Εσωτερικοί χώροι',
          desc: 'Ανακαίνιση μπάνιων και κουζινών με σαφές πλάνο και διαφανείς τιμές.',
          icon: 'interior',
          img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rce/eg/vb',
        },
      ],
    },
    glideServices: {
      ariaLabel: 'Οι υπηρεσίες μας',
      subheading: 'Σύρετε ή πατήστε οποιαδήποτε κάρτα για άνοιγμα της σελίδας',
      prevAria: 'Προηγούμενη διαφάνεια',
      nextAria: 'Επόμενη διαφάνεια',
      dotsAria: 'Πλοήγηση διαφανειών',
      slides: [
        { key: 'steelHouse0', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdd/eg/vb' },
        { key: 'steelHouse7', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rde/eg/vb' },
        { key: 'modularHouse0', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rdf/eg/vb' },
        { key: 'steelHouse1', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rcf/eg/vb' },
        { key: 'steelHouse2', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rm/eg/vb' },
        { key: 'modularHouse1', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rb9/eg/vb' },
        { key: 'modularHouse2', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r2/eg/vb' },
        { key: 'modularHouse3', pathKey: 'modularHouses', title: 'Δομικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rq/eg/vb' },
        { key: 'steelHouse3', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/rr/eg/vb' },
        { key: 'steelHouse4', pathKey: 'steelHouses', title: 'Μεταλλικά σπίτια', img: 'https://vladimirbuilder.quickbase.com/up/bvk4n834b/g/r4/eg/vb' },
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
      heading: 'Γιατί να μας επιλέξετε',
      subheading: 'Εξαιρετικά σπίτια, κορυφαία εξυπηρέτηση.',
      items: [
        { icon: 'qa', title: 'Απόλυτη διαφάνεια', desc: 'Όλες οι τιμές αναγράφονται με αναλυτικές προδιαγραφές και φινιρίσματα, χωρίς κρυφές χρεώσεις.' },
        { icon: 'paper', title: 'Υποστήριξη 24/7', desc: 'Συναντηθείτε μαζί μας από κοντά ή εξ αποστάσεως, ενώ κρατάμε τα πάντα τεκμηριωμένα και διαφανή.' },
        { icon: 'truck', title: 'Σαφής προγραμματισμός', desc: 'Θα γνωρίζετε τις ημερομηνίες παράδοσης και συναρμολόγησης από την πρώτη μέρα.' },
        { icon: 'star', title: 'Η καλύτερη αξία στη Βουλγαρία', desc: 'Ανταγωνιστικές τιμές για σπίτια-κοντέινερ και προκατασκευασμένα σπίτια στη Βουλγαρία.' },
      ],
    },
    steps: {
      heading: 'Πώς το κάνουμε',
      progressLabel: 'Πρόοδος',
      stepOfPattern: 'Βήμα {current} από {total}',
      items: [
        {
          title: '1. Διερεύνηση',
          short: 'Επιλέξτε από τον κατάλογό μας, στείλτε μας email ή επισκεφθείτε μας για να συζητήσουμε το κατάλληλο σπίτι για το έργο σας.',
          long: 'Ξεκινάμε κατανοώντας τη χρήση, το χρονοδιάγραμμα, τον προϋπολογισμό και το προτιμώμενο μοντέλο σας, ώστε να προτείνουμε τη σωστή κατεύθυνση από την πρώτη μέρα.',
        },
        {
          title: '2. Σχεδιασμός & Προδιαγραφές',
          short: 'Επιλέξτε κάτοψη, προδιαγραφές και φινιρίσματα, ενώ εμείς οργανώνουμε τις τεχνικές λεπτομέρειες.',
          long: 'Μόλις ξεκαθαρίσει η ιδέα, κλειδώνουμε την κάτοψη, τον εξοπλισμό και το πακέτο φινιρίσματος, ώστε η τιμολόγηση και η παραγωγή να προχωρήσουν χωρίς αβεβαιότητα.',
        },
        {
          title: '3. Επιβεβαίωση & Προγραμματισμός',
          short: 'Επιβεβαιώνουμε την επιλογή, την τιμή και το χρονικό περιθώριο παράδοσης.',
          long: 'Λαμβάνετε ένα σαφές εμπορικό και χρονικό σημείο ελέγχου πριν οριστικοποιηθούν η παραγωγή και η μεταφορά.',
        },
        {
          title: '4. Προετοιμασία & Έγγραφα',
          short: 'Ετοιμάζουμε τα έγγραφα, την ασφάλιση και τη μεταφορά, και μοιραζόμαστε λίστα ετοιμότητας του χώρου.',
          long: 'Αυτό το στάδιο καλύπτει το σύνολο της εφοδιαστικής: τεκμηρίωση, ασφάλιση, σχεδιασμό μεταφοράς και την πρακτική λίστα ελέγχου για τον χώρο σας.',
        },
        {
          title: '5. Παράδοση & Συναρμολόγηση',
          short: 'Παραδίδουμε, συναρμολογούμε και ολοκληρώνουμε το νέο σας σπίτι.',
          long: 'Η μονάδα φτάνει στον χώρο, συντονίζεται η τοποθέτηση και η κατασκευή ολοκληρώνεται σύμφωνα με το συμφωνημένο αντικείμενο.',
        },
        {
          title: '6. Εξυπηρέτηση μετά την παράδοση',
          short: 'Υποστήριξη εγγύησης, ανταλλακτικά και αναβαθμίσεις διατηρούν το ακίνητό σας σε άριστη κατάσταση.',
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
      subheading: 'Επαληθευμένες κριτικές από ιδιοκτήτες σπιτιών σε όλη την Ευρώπη.',
      aggregateAria: 'Μέση βαθμολογία πελατών',
      countLabel: '{count} επαληθευμένες κριτικές',
      verified: 'Επαληθευμένη',
      customerFallback: 'Πελάτης',
      ctaLabel: 'Δείτε όλες τις κριτικές →',
    },
    finalCta: {
      title: 'Έτοιμοι να ξεκινήσετε το έργο σας;',
      desc: 'Λάβετε προσφορά χωρίς δέσμευση ή ρωτήστε μας οτιδήποτε. Απαντάμε εντός 24 ωρών.',
      primaryCta: 'Λάβετε προσφορά',
      secondaryCta: 'Κάντε μια ερώτηση',
      phone: '+359 87 935 5269',
      email: 'contact@nvc-home4you.eu',
    },
    localBusiness: {
      url: 'https://nvc-home4you.eu/',
      email: 'contact@nvc-home4you.eu',
      telephone: '+359879355269',
    },
  },
  servicesPage: {
    heading: 'Οι Υπηρεσίες μας',
    subheading: 'Τρεις κατηγορίες, καθεμία με τρεις εξειδικευμένες προσφορές.',
    categories: [
      {
        title: 'Σπίτια Κοντέινερ & Προκατασκευασμένα',
        items: [
          { title: 'Δομικά σπίτια', desc: 'Ευέλικτες μονάδες, γρήγορη συναρμολόγηση, μοντέρνα φινιρίσματα.' },
          { title: 'Σπίτια ελαφρού χάλυβα', desc: 'Σπίτια με μεταλλικό σκελετό, υψηλή μόνωση και μεγάλη διάρκεια ζωής.' },
          { title: 'Καμπίνες Capsule & Apple', desc: 'Κομψές, έτοιμες προς χρήση μονάδες σχεδιασμού με πανοραμικό τζάμι· ιδανικές για στούντιο και ξενώνα.' },
        ],
      },
      {
        title: 'Logistics & Εργοτάξιο',
        items: [
          { title: 'Παράδοση έως την πόρτα', desc: 'Αναλαμβάνουμε logistics, ασφάλιση και τελωνεία ΕΕ.' },
          { title: 'Ενοποίηση & Συσκευασία', desc: 'Συνδυάστε σπίτια και υλικά σε μία αποστολή.' },
          { title: 'Συντονισμός τοποθέτησης', desc: 'Αξιόπιστοι τοπικοί συνεργάτες για τοποθέτηση και συνδέσεις παροχών.' },
        ],
      },
      {
        title: 'Υλικά, Έπιπλα & Ανακαινίσεις',
        items: [
          { title: 'Μπάνια', desc: 'Ντουζιέρες, λεκάνες, έπιπλα μπάνιου και εξαρτήματα.' },
          { title: 'Τοίχοι & Δάπεδα', desc: 'Πάνελ τοίχου, δάπεδα και deck.' },
          { title: 'Εσωτερικές ανακαινίσεις', desc: 'Κουζίνες, μπάνια, πλήρης διαμόρφωση και πακέτα επίπλων.' },
        ],
      },
    ],
  },
  common: {
    close: 'Κλείσιμο',
    open: 'Άνοιγμα',
    viberChatLabel: 'Άνοιγμα συνομιλίας Viber',
    whatsAppChatLabel: 'Άνοιγμα συνομιλίας WhatsApp',
    contactLabel: 'Επικοινωνήστε μαζί μας',
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
      title: 'Ζητήστε προσφορά',
      fields: {
        name: 'Όνομα',
        email: 'Email',
        phone: 'Τηλέφωνο',
        project: 'Λεπτομέρειες έργου',
      },
      submit: 'Υποβολή',
    },
    question: {
      title: 'Κάντε μια ερώτηση',
      fields: {
        name: 'Όνομα',
        email: 'Email',
        question: 'Η ερώτησή σας',
      },
      submit: 'Αποστολή',
    },
  },
}
