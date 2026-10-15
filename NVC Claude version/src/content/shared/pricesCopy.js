// Copy for the prices page, in all three locales.
//
// One file rather than three under content/{locale}/, because this page is a table with
// labels around it: the three versions are the same twelve strings and keeping them side by
// side is what stops a price caveat being corrected in Bulgarian and left wrong in Greek.
// The FIGURES are not here at all — they come from prices.js, which imports them from the
// catalogue, and the crane and delivery figures in the "not included" list from
// deliveryRates.js (filled into {containerRate}, {boxRate}, {containerCrane}, {boxCrane}).
//
// The "not included" section is the point of the page, not a disclaimer. Every competitor
// publishes a number that turns out to exclude things; saying plainly that the crane and the
// foundation are extra is what makes the rest of the table believable, and it is what a
// visitor is actually trying to find out before they call.

import { euro } from '../../lib/euro.js'
import { DELIVERY_RATES } from './deliveryRates.js'

const SHARED = {
  vatRatePercent: 20,
}

export const PRICES_COPY = {
  bg: {
    ...SHARED,
    h1: 'Цени на сглобяеми къщи',
    lead: 'Цената на къщата, монтажът на място и ДДС — събрани в една таблица, за да видите крайната сума, а не начална цена, която после расте.',
    fromLabel: 'Завършена къща от',
    tableCaption: 'Цени по модел',
    colModel: 'Модел',
    colHouse: 'Къща (с ДДС)',
    colAssemblyNet: 'Монтаж (без ДДС)',
    colAssemblyGross: 'Монтаж (с ДДС)',
    colTotal: 'Общо с ДДС',
    // Used only in the Product/Offer markup, not shown on the page.
    productNamePrefix: 'Сглобяема къща',
    specDimensions: 'Размери',
    specFrame: 'Конструкция',
    variantLegend: 'Вариант',
    variantStandard: 'Стандартен',
    variantBalcony: 'С покрив и веранда',
    vatNote: 'Всички суми са в евро. Цените на къщите вече включват 20% ДДС; монтажът се оферира без ДДС и е показан и с включено ДДС.',

    loading: 'Зареждане на цените…',
    loadError: 'Цените не се заредиха. Опитайте отново.',
    boxSectionTitle: 'Разгъваеми бокс къщи',
    boxSectionIntro: 'Цената на къщата включва ДДС; монтажът се добавя отделно и е показан без и с ДДС.',
    wagonSectionTitle: 'Фургони и контейнери',
    wagonSectionIntro: 'При фургоните монтажът е включен в цената — таблицата показва каква част от нея е той.',
    wagonColHouse: 'Фургон (с ДДС)',
    wagonColAssembly: 'Вкл. монтаж',
    wagonVatNote: 'Всички суми са в евро с включено ДДС. Монтажът е част от цената, не добавка към нея.',
    assemblyOnRequest: 'по запитване',
    includedTitle: 'Какво включва монтажът',
    included: [
      'Поставяне на къщата на подготвената основа.',
      'Довършителни работи до ключ — готова за нанасяне.',
    ],
    excludedTitle: 'Какво не включва',
    // The list sits under both tables, so the crane line says which product needs one.
    excluded: [
      'Кранът, който поставя къщата на място: за Бокс къща е задължителен — около {boxCrane} без ДДС, а според мястото може и повече; за контейнер е по ваш избор — около {containerCrane} без ДДС.',
      'Основата, върху която стъпва къщата.',
      'Доставката до вашия парцел: за контейнер {containerRate} на километър, за Бокс къща около {boxRate}, в двете посоки, без ДДС.',
    ],
    foundationNote: 'За основа препоръчваме Siana Burgas, ако изберете наземни винтове.',

    // The steel-frame line, in the words its own page uses (steelHouses.price.body). It said
    // "modular houses" until 2026-10, which the modular houses page, priced from the gallery,
    // now contradicts.
    customTitle: 'Сглобяеми къщи по проект',
    customBody: 'Сглобяемите къщи със стоманена конструкция се изработват по индивидуален проект, затова нямат каталожна цена. Опишете какво търсите и ще ви изпратим оферта.',
    customLink: 'Как работим по проект →',

    configuratorTitle: 'Изчислете своята конфигурация',
    configuratorBody: 'Конфигураторът пресмята цената според плана, дограмата, банята и кухнята, които изберете.',
    configuratorCta: 'Отвори конфигуратора',
    quoteCta: 'Заяви оферта',
  },

  en: {
    ...SHARED,
    h1: 'Prefab house prices',
    lead: 'House price, on-site assembly and VAT in one table — so you see the finished figure rather than a starting price that grows later.',
    fromLabel: 'A finished house from',
    tableCaption: 'Prices by model',
    colModel: 'Model',
    colHouse: 'House (incl. VAT)',
    colAssemblyNet: 'Assembly (excl. VAT)',
    colAssemblyGross: 'Assembly (incl. VAT)',
    colTotal: 'Total incl. VAT',
    // Used only in the Product/Offer markup, not shown on the page.
    productNamePrefix: 'Prefab house',
    specDimensions: 'Dimensions',
    specFrame: 'Frame',
    variantLegend: 'Variant',
    variantStandard: 'Standard',
    variantBalcony: 'With roof & veranda',
    vatNote: 'All figures in euro. House prices already include 20% VAT; assembly is quoted excluding VAT and shown both ways.',

    loading: 'Loading prices…',
    loadError: 'The prices did not load. Please try again.',
    boxSectionTitle: 'Expandable box houses',
    boxSectionIntro: 'The house price includes VAT; assembly is added separately and shown both without and with VAT.',
    wagonSectionTitle: 'Wagons & containers',
    wagonSectionIntro: 'Wagon prices include assembly — the table shows how much of the price it is.',
    wagonColHouse: 'Wagon (incl. VAT)',
    wagonColAssembly: 'Incl. assembly',
    wagonVatNote: 'All figures in euro, VAT included. Assembly is part of the price, not an addition to it.',
    assemblyOnRequest: 'on request',
    includedTitle: 'What assembly covers',
    included: [
      'Placing the house on your prepared base.',
      'Turnkey finishing — ready to move into.',
    ],
    excludedTitle: 'What it does not cover',
    excluded: [
      'The crane that lifts the house into place: required for a Box house, about {boxCrane} excl. VAT, or more depending on the location; your choice for a container, about {containerCrane} excl. VAT.',
      'The foundation the house stands on.',
      'Delivery to your plot: {containerRate} per kilometre for a container, about {boxRate} for a Box house, counted both ways, excl. VAT.',
    ],
    foundationNote: 'For the foundation we recommend Siana Burgas, if you go with ground screws.',

    customTitle: 'Steel-frame prefab houses to your plan',
    customBody: 'Steel-frame houses are built to an individual design, so they have no catalogue price. Tell us what you need and we will send a quote.',
    customLink: 'How we work to your plan →',

    configuratorTitle: 'Price your own configuration',
    configuratorBody: 'The configurator works out the price from the plan, windows, bathroom and kitchen you choose.',
    configuratorCta: 'Open the configurator',
    quoteCta: 'Request a quote',
  },

  el: {
    ...SHARED,
    h1: 'Τιμές προκατασκευασμένων σπιτιών',
    lead: 'Τιμή σπιτιού, συναρμολόγηση και ΦΠΑ σε έναν πίνακα — για να βλέπετε το τελικό ποσό, όχι μια αρχική τιμή που ανεβαίνει μετά.',
    fromLabel: 'Ολοκληρωμένο σπίτι από',
    tableCaption: 'Τιμές ανά μοντέλο',
    colModel: 'Μοντέλο',
    colHouse: 'Σπίτι (με ΦΠΑ)',
    colAssemblyNet: 'Συναρμολόγηση (χωρίς ΦΠΑ)',
    colAssemblyGross: 'Συναρμολόγηση (με ΦΠΑ)',
    colTotal: 'Σύνολο με ΦΠΑ',
    // Used only in the Product/Offer markup, not shown on the page.
    productNamePrefix: 'Προκατασκευασμένο σπίτι',
    specDimensions: 'Διαστάσεις',
    specFrame: 'Σκελετός',
    variantLegend: 'Παραλλαγή',
    variantStandard: 'Βασικό',
    variantBalcony: 'Με στέγη και βεράντα',
    vatNote: 'Όλα τα ποσά σε ευρώ. Οι τιμές των σπιτιών περιλαμβάνουν ήδη ΦΠΑ 20%· η συναρμολόγηση δίνεται χωρίς ΦΠΑ και εμφανίζεται και με ΦΠΑ.',

    loading: 'Φόρτωση τιμών…',
    loadError: 'Οι τιμές δεν φορτώθηκαν. Δοκιμάστε ξανά.',
    boxSectionTitle: 'Αναδιπλούμενα box σπίτια',
    boxSectionIntro: 'Η τιμή του σπιτιού περιλαμβάνει ΦΠΑ· η συναρμολόγηση προστίθεται χωριστά και εμφανίζεται χωρίς και με ΦΠΑ.',
    wagonSectionTitle: 'Δομικές μονάδες & κοντέινερ',
    wagonSectionIntro: 'Στις μονάδες η συναρμολόγηση περιλαμβάνεται στην τιμή — ο πίνακας δείχνει πόσο από αυτή είναι.',
    wagonColHouse: 'Μονάδα (με ΦΠΑ)',
    wagonColAssembly: 'Περιλ. συναρμολόγηση',
    wagonVatNote: 'Όλα τα ποσά σε ευρώ με ΦΠΑ. Η συναρμολόγηση είναι μέρος της τιμής, όχι πρόσθετο.',
    assemblyOnRequest: 'κατόπιν αιτήματος',
    includedTitle: 'Τι περιλαμβάνει η συναρμολόγηση',
    included: [
      'Τοποθέτηση του σπιτιού στην προετοιμασμένη βάση σας.',
      'Τελειώματα «με το κλειδί στο χέρι» — έτοιμο για κατοίκηση.',
    ],
    excludedTitle: 'Τι δεν περιλαμβάνει',
    excluded: [
      'Τον γερανό που τοποθετεί το σπίτι: για σπίτι Box είναι απαραίτητος, περίπου {boxCrane} χωρίς ΦΠΑ, ή και περισσότερο ανάλογα με την τοποθεσία· για κοντέινερ είναι προαιρετικός, περίπου {containerCrane} χωρίς ΦΠΑ.',
      'Τη βάση πάνω στην οποία στέκεται το σπίτι.',
      'Την παράδοση στο οικόπεδό σας: {containerRate} ανά χιλιόμετρο για κοντέινερ, περίπου {boxRate} για σπίτι Box, και για τις δύο κατευθύνσεις, χωρίς ΦΠΑ.',
    ],
    foundationNote: 'Για τη βάση προτείνουμε τη Siana Burgas, αν επιλέξετε βίδες εδάφους.',

    customTitle: 'Μεταλλικά σπίτια σε δικό σας σχέδιο',
    customBody: 'Τα σπίτια με μεταλλικό σκελετό κατασκευάζονται σε ατομικό σχέδιο, οπότε δεν έχουν τιμή καταλόγου. Πείτε μας τι χρειάζεστε και θα σας στείλουμε προσφορά.',
    customLink: 'Πώς δουλεύουμε με το δικό σας σχέδιο →',

    configuratorTitle: 'Υπολογίστε τη δική σας διαμόρφωση',
    configuratorBody: 'Ο διαμορφωτής υπολογίζει την τιμή από την κάτοψη, τα κουφώματα, το μπάνιο και την κουζίνα που επιλέγετε.',
    configuratorCta: 'Ανοίξτε τον διαμορφωτή',
    quoteCta: 'Ζητήστε προσφορά',
  },
}

// The owner's crane and delivery figures, written into the "not included" lines once, so the
// prices page and the Box houses page (which prints the same list) read the same sentence.
const { container, box } = DELIVERY_RATES.products

function withDeliveryFigures(copy, locale) {
  const figures = {
    containerRate: euro(container.perKm, locale),
    boxRate: euro(box.perKm, locale),
    containerCrane: euro(container.crane.about, locale),
    boxCrane: euro(box.crane.about, locale),
  }
  const fill = (line) => Object.entries(figures).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), line)
  return { ...copy, excluded: copy.excluded.map(fill) }
}

const FILLED = Object.fromEntries(
  Object.entries(PRICES_COPY).map(([locale, copy]) => [locale, withDeliveryFigures(copy, locale)]),
)

export function getPricesCopy(locale = 'en') {
  return FILLED[locale] || FILLED.en
}
