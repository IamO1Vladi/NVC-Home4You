// Copy for the prices page, in all three locales.
//
// One file rather than three under content/{locale}/, because this page is a table with
// labels around it: the three versions are the same twelve strings and keeping them side by
// side is what stops a price caveat being corrected in Bulgarian and left wrong in Greek.
// The FIGURES are not here at all — they come from prices.js, which imports them from the
// catalogue.
//
// The "not included" section is the point of the page, not a disclaimer. Every competitor
// publishes a number that turns out to exclude things; saying plainly that the crane and the
// foundation are extra is what makes the rest of the table believable, and it is what a
// visitor is actually trying to find out before they call.

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
    excluded: [
      'Кранът, който поставя къщата на място.',
      'Основата, върху която стъпва къщата.',
    ],
    foundationNote: 'За основа препоръчваме Siana Burgas, ако изберете наземни винтове.',

    customTitle: 'Модулни къщи по проект',
    customBody: 'Модулните къщи се изработват по индивидуален проект, затова нямат каталожна цена. Опишете какво търсите и ще Ви изпратим оферта.',

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
      'The crane that lifts the house into place.',
      'The foundation the house stands on.',
    ],
    foundationNote: 'For the foundation we recommend Siana Burgas, if you go with ground screws.',

    customTitle: 'Modular houses to your own design',
    customBody: 'Modular houses are built to an individual design, so they have no catalogue price. Tell us what you need and we will send a quote.',

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
      'Τον γερανό που τοποθετεί το σπίτι.',
      'Τη βάση πάνω στην οποία στέκεται το σπίτι.',
    ],
    foundationNote: 'Για τη βάση προτείνουμε τη Siana Burgas, αν επιλέξετε βίδες εδάφους.',

    customTitle: 'Δομικά σπίτια κατά παραγγελία',
    customBody: 'Τα δομικά σπίτια κατασκευάζονται σε ατομικό σχέδιο, οπότε δεν έχουν τιμή καταλόγου. Πείτε μας τι χρειάζεστε και θα σας στείλουμε προσφορά.',

    configuratorTitle: 'Υπολογίστε τη δική σας διαμόρφωση',
    configuratorBody: 'Ο διαμορφωτής υπολογίζει την τιμή από την κάτοψη, τα κουφώματα, το μπάνιο και την κουζίνα που επιλέγετε.',
    configuratorCta: 'Ανοίξτε τον διαμορφωτή',
    quoteCta: 'Ζητήστε προσφορά',
  },
}

export function getPricesCopy(locale = 'en') {
  return PRICES_COPY[locale] || PRICES_COPY.en
}
