import { euro } from '../../lib/euro.js'
import { DELIVERY_BASES, DELIVERY_RATES } from '../shared/deliveryRates.js'

// The estimator still computes one rate, the container's, from Marikostinovo; the heading
// above it names both products. Every figure comes from deliveryRates.js.
const CONTAINER = DELIVERY_RATES.products.container
const BOX = DELIVERY_RATES.products.box

export default {
  seo: {
    title: 'Παράδοση έως την πόρτα για δομικά και προκατασκευασμένα σπίτια | NVC Home4You',
    description:
      'Παράδοση έως την πόρτα για δομικά, προκατασκευασμένα σπίτια και σπίτια-κοντέινερ, με σχεδιασμό διαδρομής, παρακολούθηση, υποστήριξη τελωνείων και διαδραστικό υπολογιστή κόστους παράδοσης.',
    url: 'https://nvc-home4you.eu/el/paradosi-sto-spiti',
  },
  breadcrumbs: [
    { name: 'Αρχική', url: 'https://nvc-home4you.eu/el' },
    { name: 'Παράδοση', url: 'https://nvc-home4you.eu/el/paradosi-sto-spiti' },
  ],
  hero: {
    title: 'Παράδοση έως την πόρτα',
    getOffer: 'Λάβετε προσφορά',
    askQuestion: 'Κάντε μια ερώτηση',
    image: {
      src: '/api/img/content/bvk4n834b-rcd-eg-vb.webp',
    },
  },
  process: {
    segmentMs: 1500,
    lead: 'Διαχειριζόμαστε την παράδοση από την επιβεβαίωση της παραγγελίας έως την εκφόρτωση στον χώρο, με σαφή διαδικασία και συντονισμό σε κάθε στάδιο.',
    bullets: [
      'Παρακολούθηση αποστολής και συντονισμός διαδρομής.',
      'Υποστήριξη για ασφάλιση φορτίου και σχεδιασμό εκφόρτωσης.',
      'Προετοιμασία εγγράφων και βοήθεια με τις τελωνειακές διαδικασίες.',
    ],
    replay: 'Επανάληψη',
    steps: [
      {
        key: 'order',
        heading: 'Επιβεβαίωση παραγγελίας',
        body: 'Επιβεβαιώνουμε το μοντέλο, τη διεύθυνση παράδοσης, το χρονοδιάγραμμα και τους όρους μεταφοράς, ώστε η διαδρομή να σχεδιαστεί σωστά από την αρχή.',
        meta: 'Σχεδιασμός και συντονισμός',
      },
      {
        key: 'prod',
        heading: 'Παραγωγή και προετοιμασία',
        body: 'Συντονίζουμε τη φόρτωση, τη συσκευασία και την ετοιμότητα του χώρου πριν αναχωρήσει η αποστολή.',
        meta: 'Προετοιμασία αποστολής',
      },
      {
        key: 'export',
        heading: 'Εξαγωγή και αποστολή',
        body: 'Η αποστολή αναχωρεί με τα απαραίτητα έγγραφα σε ισχύ και ο πελάτης λαμβάνει ενημερώσεις προόδου.',
        meta: 'Έγγραφα και αναχώρηση',
      },
      {
        key: 'import',
        heading: 'Εισαγωγή και τελωνείο',
        body: 'Συντονίζουμε τις διατυπώσεις εισαγωγής και την τοπική εφοδιαστική για ομαλή παράδοση στην αγορά προορισμού.',
        meta: 'Υποστήριξη τελωνείων',
      },
      {
        key: 'door',
        heading: 'Παράδοση στη διεύθυνση',
        body: 'Παρακολουθούμε το τελικό στάδιο έως την εκφόρτωση και την παράδοση σύμφωνα με το συμφωνημένο πλάνο.',
        meta: 'Τελική παράδοση',
      },
    ],
    // No lead-time chips: the owner is still confirming lead times (2026-10-15).
  },
  estimator: {
    locale: 'el-GR',
    acceptLanguage: 'el,en',
    base: DELIVERY_BASES.marikostinovo,
    ratePerKm: CONTAINER.perKm,
    strings: {
      heading: 'Εκτιμώμενη τιμή παράδοσης',
      subheading: `Κοντέινερ: ${euro(CONTAINER.perKm, 'el')}/χλμ από το Μαρικοστίνοβο, και για τις δύο κατευθύνσεις. Σπίτι Box: περίπου ${euro(BOX.perKm, 'el')}/χλμ, και για τις δύο κατευθύνσεις, από το Μαρικοστίνοβο ή τη Βάρνα (όποιο είναι πιο κοντά), συν γερανός περίπου ${euro(BOX.crane.about, 'el')}, ή και περισσότερο ανάλογα με την τοποθεσία. Οι τιμές δεν περιλαμβάνουν ΦΠΑ.`,
      // Owner, 2026-10-15: abroad only Greece so far, at the same rates; other countries on request.
      countriesNote: 'Βουλγαρία και Ελλάδα, με τις ίδιες τιμές. Άλλες χώρες: κατόπιν αιτήματος.',
      // A Greek address, not the Sofia one en/bg show: the example is meant to be typed, and
      // the geocoder finds no Bulgarian street spelled in Greek letters ("Σόφια, Τσέρνι Βραχ 1"
      // returns nothing; "Θεσσαλονίκη, Εγνατία 1" resolves). Checked against Nominatim 2026-10-01.
      placeholder: 'Εισαγάγετε μια διεύθυνση (παράδειγμα: Θεσσαλονίκη, Εγνατία 1)',
      buttonIdle: 'Υπολογισμός',
      buttonLoading: 'Αναζήτηση…',
      addressLabel: 'Διεύθυνση:',
      oneWayLabel: 'Απόσταση μονής διαδρομής:',
      billableLabel: 'Χρεώσιμη απόσταση:',
      estimateLabel: 'Εκτιμώμενη τιμή για κοντέινερ:',
      vatLabel: 'χωρίς ΦΠΑ',
      searchNote: 'Εμφανίζεται εκτίμηση ευθείας γραμμής όταν η δρομολόγηση οδικού δικτύου δεν είναι διαθέσιμη.',
      helpText: 'Εισαγάγετε μια διεύθυνση ή κάντε κλικ στον χάρτη για να τοποθετήσετε πινέζα προορισμού.',
      droppedPin: 'Τοποθετημένη πινέζα',
      geocodeError: 'Η γεωκωδικοποίηση απέτυχε',
      notFoundError: 'Η διεύθυνση δεν βρέθηκε',
      // A map pin outside the countries above gets this in place of a price.
      outsideError: 'Εκτός Βουλγαρίας και Ελλάδας, η παράδοση κοστολογείται κατόπιν αιτήματος.',
      genericError: 'Κάτι πήγε στραβά',
      emptyValue: '—',
      km: 'χλμ',
      // Leaflet's own control wording, which is English unless replaced.
      mapControls: {
        zoomIn: 'Μεγέθυνση',
        zoomOut: 'Σμίκρυνση',
        attributionTitle: 'Βιβλιοθήκη JavaScript για διαδραστικούς χάρτες',
        marker: 'Σημείο στον χάρτη',
      },
    },
  },
}
