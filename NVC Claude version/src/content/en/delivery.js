// The delivery page, /en/delivery: "Delivery and assembly". The Bulgarian file
// (src/content/bg/delivery.js) explains the placeholders and where every figure comes from;
// this one carries the same keys in English. Delivery and crane figures are WITHOUT VAT.
export default {
  breadcrumb: 'Delivery and assembly',
  home: 'Home',

  service: {
    name: 'Delivery and assembly of containers and Box houses',
    serviceType: 'Truck delivery and crane placement',
  },

  hero: {
    eyebrow: 'Delivery and assembly',
    h1: 'Delivered and assembled on your plot',
    lead: 'The price depends on what we deliver and how far away you are. Pick the product and your town, and you see the price straight away.',
    facts: {
      container: 'Container: {containerRate}/km, both ways, excl. VAT',
      box: 'Box house: about {boxRate}/km both ways + a crane of about {boxCrane}, excl. VAT',
      project: 'House to your plan: delivery is in the quote',
    },
    ask: 'Ask a question',
  },

  calculator: {
    title: 'What delivery to you will cost',
    productLegend: 'What we deliver',
    products: { container: 'Container', box: 'Box house', project: 'House to your plan' },
    placeLabel: 'Town or village',
    placeholder: 'e.g. Bansko',
    placeHint: 'In Bulgaria or Greece. You can paste a whole address too.',
    loading: 'Loading towns and villages…',
    loadError: "The list of towns and villages didn't load.",
    retry: 'Try again',
    suggestionsLabel: 'Towns and villages',
    suggestionsCount: { one: '1 suggestion', many: '{count} suggestions' },
    noMatch: "We can't find this place in Bulgaria or Greece. Delivery anywhere else is quoted separately, so write to us.",
    countries: { BG: 'Bulgaria', GR: 'Greece' },
    region: { BG: '{region} Province', GR: '{region}' },
    bases: { marikostinovo: 'Marikostinovo', varna: 'Varna' },
    fromBase: { marikostinovo: 'from Marikostinovo', varna: 'from Varna' },
    km: 'km',
    vat: 'excl. VAT',
    resultLabel: 'Delivery price',
    distance: '{km} by road {from}, one way',
    billable: 'Both ways: {km} × 2 = {billable}',
    boxBase: 'The Box house sets off {from}, the closer of our two bases.',
    container: {
      transportLabel: 'Transport',
      transportMath: '{billable} × {rate}/km',
      fixed: 'fixed rate, excl. VAT',
      assembly: "Assembly is included in the container's price.",
      craneTitle: 'With a crane (optional)',
      crane: 'About {crane} excl. VAT, at your cost. We assemble the container in our warehouse and it arrives built, so there is no travel or accommodation to pay for our workers.',
      noCraneTitle: 'Without a crane',
      noCrane: 'Two of our workers assemble it on site over {nights} nights. Their travel adds up to {travel} excl. VAT, depending on the location, and you arrange their accommodation.',
    },
    box: {
      transportLabel: 'Transport',
      transportMath: '{billable} × about {rate}/km',
      craneLabel: 'Crane',
      craneNote: 'can be more, depending on the location',
      totalLabel: 'Total',
      about: 'about {amount}',
      noCrane: 'A Box house cannot be delivered without a crane.',
      included: 'Shipping from China and customs are already in the house price.',
      assembly: 'Assembly is quoted separately.',
      assemblyLink: 'Box house prices with assembly →',
    },
    project: {
      text: 'Delivery is quoted with the project; we handle customs.',
    },
    onRequest: 'Delivery to this place is quoted on request.',
    notes: {
      approx: 'An estimate, by road to the town centre; the exact price is in the quote.',
      several: 'More than one container or Box house: quoted on request.',
      foundation: "The foundation isn't included; it depends on the site.",
      data: 'Places and road distances: © OpenStreetMap contributors',
    },
    enquiry: 'Send an enquiry with this delivery',
    enquiryPlain: 'Send an enquiry',
    map: {
      show: 'Show on the map',
      hide: 'Hide the map',
      loading: 'Loading the map…',
      label: 'Map: our base and the place you chose',
      hint: 'Tap the map to pick the nearest town or village.',
      nothingNear: "There's no town or village from our list near there. Tap closer to one.",
      line: '{km} by road',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      attributionTitle: 'A JavaScript library for interactive maps',
      baseMarker: 'Our base: {base}',
      placeMarker: '{place}',
    },
    offer: {
      heading: 'Delivery: an estimate',
      product: 'Product',
      place: 'Place',
      distance: 'Distance',
      distanceValue: '{km} one way {from}; {billable} billed',
      transport: 'Transport',
      crane: 'Crane',
      total: 'Total',
      craneOptional: 'optional, about {crane}',
      noCraneTravel: "Without a crane: the workers' travel up to {travel}; the customer arranges their accommodation.",
      onRequest: 'on request',
      project: 'Delivery is quoted with the project.',
      outside: 'Outside Bulgaria and Greece: quoted on request.',
      footer: 'An estimate; all amounts excl. VAT.',
      question: 'Delivery question: {product}, {place} ({km} one way).',
      questionOnRequest: 'Delivery question: {product}, {place}.',
      questionOutside: 'Delivery question: {product}, {place}.',
    },
  },

  included: {
    heading: "What's in the price",
    sub: 'Delivery and the crane are quoted excl. VAT. The house and container prices on this site include it.',
    cards: {
      container: {
        title: 'Container',
        lines: [
          { label: 'Transport', text: '{containerRate}/km, both ways: a fixed rate, excl. VAT.' },
          { label: 'Assembly', text: "Included in every container's price." },
          { label: 'With a crane', text: 'Your choice, about {containerCrane} excl. VAT. We then assemble the container in our warehouse and it arrives built.' },
          { label: 'Without a crane', text: 'Two of our workers assemble it on site over {nights} nights. Their travel adds up to {travel} excl. VAT, and you arrange their accommodation.' },
          { label: 'Customs', text: 'We handle it.' },
        ],
      },
      box: {
        title: 'Box house',
        lines: [
          { label: 'Transport', text: 'About {boxRate}/km, both ways, excl. VAT, from Marikostinovo or Varna, whichever is closer.' },
          { label: 'Crane', text: "Required: about {boxCrane} excl. VAT, and it can be more depending on the location. It can't be done without one." },
          { label: 'Shipping and customs', text: 'Already in the house price. For the trip to you, you pay only for the truck and the crane.' },
          { label: 'Assembly', text: 'Separate, from {assembly} excl. VAT.' },
        ],
        pricesLink: 'Prices with assembly →',
      },
      project: {
        title: 'House to your plan',
        lines: [
          { label: 'Delivery', text: 'We deliver the parts to your plot. The price is in the quote for the project.' },
          { label: 'Customs', text: 'We handle it.' },
        ],
      },
    },
    foundation: "The foundation isn't included: what you need depends on the site.",
    several: 'More than one container or Box house is quoted on request, and so is anywhere outside Bulgaria and Greece.',
    // After `several`: a link to the partner page's enquiry form (#zapitvane).
    partnerLink: 'An offer for several units →',
    call: 'Give us a call',
  },

  examples: {
    heading: 'Example prices',
    sub: 'By road from our base to the centre of the town.',
    columns: ['Place · km one way', 'Container, excl. VAT', 'Box house: transport + crane, excl. VAT'],
    box: 'about {transport} + crane about {crane}',
    boxCraneOnly: 'crane about {crane}',
    fromVarna: 'from Varna, {km}, which is closer',
    note: 'An estimate, to the town centre, excl. VAT. The exact price is in the quote.',
  },

  journey: {
    heading: 'From the port to your plot',
    sub: 'Footage from our own deliveries.',
    clips: [
      { id: 'port', title: 'At the port', text: 'The folded house arrives by ship from China; we handle customs.' },
      { id: 'yard', title: 'At our base', text: 'We unload it from the sea container.' },
      { id: 'truck', title: 'On the truck', text: 'A crane lifts it onto the truck that brings it to you.' },
      { id: 'plot', title: 'On your plot', text: 'The crane sets it on its foundation, here on ground screws.' },
    ],
    leadTimesHeading: 'How long it takes',
    leadTimes: {
      container: 'A container in stock: with you within {days} days.',
      box: 'A Box house: made in up to {production} days and at your address in about {months} months.',
    },
    unfoldHeading: 'It unfolds on site',
    unfoldText: 'The Box house travels folded and opens out only once it is in place.',
    plannerLink: 'The unfold and the layouts in the planner →',
    truck: {
      heading: 'Size and weight in transport',
      columns: ['Model', 'Size in transport (L × W × H)', 'Weight'],
      dims: '{l} × {w} × {h} m',
      weight: '{kg} kg',
      note: 'That is the load the truck and the crane have to carry.',
    },
  },

  prepare: {
    heading: 'What to prepare',
    photoAlt: 'A crane lifting a long module off a truck onto a concrete yard',
    adminAlt: 'A module delivered by truck and crane',
    terms: [
      { label: 'Foundation', text: 'It depends on the site. Call us about your land.', foundationNote: true },
      { label: 'Access', text: 'The truck and the crane have to reach the spot where the house will stand. Describe the road and the place to us; a photo helps. The crane can cost more depending on the location.' },
      { label: 'Container with a crane', text: 'We assemble it in our warehouse and it arrives built. All it needs is room for the crane.' },
      { label: 'Container without a crane', text: 'Two of our workers assemble it on site over {nights} nights. You arrange their accommodation; their travel adds up to {travel} excl. VAT.' },
    ],
  },

  proof: {
    heading: 'Delivered to a customer',
    sub: 'A Box house delivered and assembled in Greece.',
    case: {
      id: '2',
      line: '58 m² with veranda · Paralia Kariani, Greece · 2026',
      result: 'Delivered and assembled, ready to move into.',
      name: 'Vangelis',
    },
    photo: {
      url: '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
      alt: 'The 58 m² expandable house with veranda delivered to Paralia Kariani, Greece',
    },
    stars: '{rating} out of 5',
    // To the case's own card on the cases page (#case-<id>), named for what it shows.
    more: 'The house in Paralia Kariani →',
  },

  faq: {
    heading: 'Questions about delivery',
    // The link to the FAQ hub under the questions (the hub gathers these and answers more).
    more: 'More questions and answers →',
    items: [
      {
        id: 'delivery-both-ways',
        q: 'How is the delivery price counted "both ways"?',
        a: 'The road km from our base to your town, times two, times the rate per km: {containerRate} for a container and about {boxRate} for a Box house, excl. VAT. A Box house is counted from Marikostinovo or Varna, whichever is closer.',
      },
      {
        id: 'delivery-crane',
        q: 'What does the crane cost?',
        a: 'A Box house needs a crane: about {boxCrane} excl. VAT, and it can be more depending on the location. For a container it is your choice, about {containerCrane} excl. VAT; we then assemble the container in our warehouse and it arrives built.',
      },
      {
        id: 'delivery-without-crane',
        q: 'Can it be done without a crane?',
        a: 'A container, yes: two of our workers assemble it on site over {nights} nights. Their travel adds up to {travel} excl. VAT, depending on the location, and you arrange their accommodation. A Box house, no: it is not possible without a crane.',
      },
      {
        id: 'delivery-abroad',
        q: 'Do you deliver to Greece and other countries?',
        a: 'To Greece, yes, at the same rates; we have already delivered a Box house to Paralia Kariani. Other countries on request.',
      },
      {
        id: 'delivery-lead-time',
        q: 'How long until a container or a Box house reaches me?',
        a: 'A container in stock is with you within {days} days. A Box house is made in up to {production} days and reaches your address in about {months} months.',
      },
      {
        id: 'delivery-final-price',
        q: 'Is the calculator’s price final?',
        a: 'The figure is an estimate, by road to the town centre, excl. VAT. For a container the rate is fixed; for a Box house the price is approximate. The exact price is in the quote. More than one container or Box house is quoted separately.',
      },
    ],
  },

  siblings: {
    heading: 'What we deliver',
    go: 'See them →',
    containers: { label: 'Container units', desc: 'Living and office containers, assembly included in the price.' },
    houses: { label: 'Box houses', desc: 'Expandable houses that travel folded.' },
    steel: { label: 'Steel-frame prefab houses to your plan', desc: 'A steel frame, to your plan or ours.' },
    prices: { label: 'Prices', desc: 'Every price, with assembly and VAT.' },
  },

  finalTitle: 'Shall we work out the delivery to your plot?',
}
