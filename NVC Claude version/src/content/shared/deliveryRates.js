// What delivery and the crane cost, as the owner gave them on 2026-10-15. Numbers only:
// every page that quotes a rate or a crane reads it from here and words it in its own
// content, so the containers page, the Box page, the prices list, the FAQ and the
// estimator cannot quote two different figures again (the estimator charged 0.80 €/km
// for everything until this file).
//
// NONE OF THESE INCLUDE VAT. House and container prices elsewhere on the site do, so
// every place that prints one of these figures says "без ДДС" / "excl. VAT" / "χωρίς ΦΠΑ".
//
// Owner's other answers the same day, kept out of the numbers: customs is handled for
// everything; abroad we have delivered only to Greece, at the same rates, and other
// countries are on request; more than one container or Box house is quoted separately.
//
// What the pages READ: countries, the perKm rates, crane.about, noCrane.nights and
// noCrane.travelMax, DELIVERY_BASES.marikostinovo (the estimator's start) and LEAD_TIMES. The rest
// (kind, roundTrip, bases, varna, optional/required/canBeMore, workers, project, vatIncluded)
// records the owner's answer and is read by no page: the copy words those facts itself
// ("two of our workers", "Marikostinovo or Varna", "or more depending on the location"), so
// changing one of these fields changes nothing on the site until the copy is changed too.

export const DELIVERY_BASES = {
  marikostinovo: { lat: 41.43165, lon: 23.33813 },
  // Box houses only: they are counted from whichever base is closer.
  varna: { lat: 43.2141, lon: 27.9147 },
}

export const DELIVERY_RATES = {
  vatIncluded: false,
  // ISO 3166 codes the estimator's address search is limited to (Nominatim countrycodes).
  countries: ['bg', 'gr'],
  products: {
    // A fixed rate, the km counted there and back.
    container: {
      kind: 'fixed',
      perKm: 1,
      roundTrip: true,
      bases: ['marikostinovo'],
      // With a crane the container is assembled in our warehouse and arrives built, so there
      // is no travel or accommodation for workers to pay.
      crane: { optional: true, about: 550 },
      // Without a crane: two of our workers assemble it on site; the customer arranges
      // their accommodation, and their travel adds up to travelMax depending on the place.
      noCrane: { workers: 2, nights: '3–4', travelMax: 100 },
    },
    // An estimate. The ship from China and customs are already in the house price; the
    // buyer pays this truck leg and the crane, which a Box house cannot do without.
    box: {
      kind: 'estimate',
      perKm: 2,
      roundTrip: true,
      bases: ['marikostinovo', 'varna'],
      crane: { required: true, about: 550, canBeMore: true },
    },
    // Custom steel houses: delivery is quoted with the project.
    project: { kind: 'quote' },
  },
}


// From order to the customer's address, owner 2026-10-15. The "30–35 / 40–45 дни" the site
// used to show were sea-transit windows only, not lead times.
export const LEAD_TIMES = {
  // A container in stock reaches the customer within this many days.
  containerInStockDays: 7,
  // A Box house is made in up to this many days...
  boxProductionDays: 40,
  // ...and reaches the customer's address in about this many months.
  boxToAddressMonths: '3–4',
}
