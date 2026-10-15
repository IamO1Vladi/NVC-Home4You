// Euro amounts the way each of the site's languages writes them. A module of its own, with no
// imports, so a page that only prints a delivery rate or a crane price (the FAQ, the delivery
// page and its estimator) does not pull in the whole configurator catalogue to format a number.
// boxConfiguratorCatalog.js re-exports it, so its existing importers are unchanged.

// el-GR prints "14.840 €". en-GB's "€14,840" would put a comma where Greek
// writes its DECIMAL separator, so the Greek reader sees fourteen euros.
const EURO_NUMBER_LOCALES = { bg: 'bg-BG', el: 'el-GR' }

export function euro(value, locale = 'en') {
  return new Intl.NumberFormat(EURO_NUMBER_LOCALES[locale] || 'en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}
