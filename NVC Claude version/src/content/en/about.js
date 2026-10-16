// The About page, /en/about. The same shape and the same facts as bg/about.js, whose header
// gives the rules: words only, every figure a {placeholder} filled from a module, one factory
// ("our factory in China"), delivery across the EU as the home page says it. No seo block:
// routeMeta.js has it.
export default {
  breadcrumb: 'About us',
  home: 'Home',

  hero: {
    eyebrow: 'About us',
    h1: 'NVC Home4You: containers and Box houses from Marikostinovo, Petrich',
    lead: 'We sell living containers, expandable Box houses and steel-frame houses built to your design. The containers and Box houses come from our factory in China; we handle customs, then bring them to your address.',
    offer: 'Request an offer',
    call: 'Call us',
    photoAlt: 'A crane lifting a long module off a truck onto a concrete yard',
  },

  facts: {
    heading: 'What you can expect',
    tiles: {
      homes: { value: '{homes}', label: 'homes delivered' },
      container: { value: 'up to {days}\u00a0days', label: 'for a container in stock to reach your address' },
      production: { value: 'up to {production}\u00a0days', label: 'to make a Box house at our factory' },
      toAddress: { value: 'about {months}\u00a0months', label: 'for a Box house, from order to your address' },
      warranty: { value: '{years}\u00a0years', label: 'warranty on the load-bearing structure' },
      reviews: { value: '{score}', label: 'out of 5, the average from {count} verified reviews' },
    },
    everywhere: 'We deliver across the EU. For an address in Bulgaria or Greece, the calculator shows the price straight away; for any other country, we quote on request.',
    calculator: 'Work out the delivery →',
  },

  story: {
    heading: 'Who we are',
    lead: 'NVC Home4You is a Bulgarian company from Marikostinovo, near Petrich. We started in logistics and, step by step, came to the homes we sell today.',
    timelineLabel: 'Our path, year by year',
    timeline: [
      { year: '2021', title: 'Logistics', text: 'We set up NVC Home4You as a logistics firm.' },
      // A step with a pathKey links to the page of what it started (paths.js key, words in `link`).
      { year: '2024', title: 'Containers', text: 'We begin importing living containers.', pathKey: 'modularBuilds', link: 'The living containers →' },
      { year: '2025', title: 'Box houses', text: 'We add the expandable Box houses.', pathKey: 'modularHouses', link: 'The Box houses →' },
      { year: '2026', title: 'Steel-frame houses', text: 'We start offering steel-frame houses too, built to your design.', pathKey: 'steelHouses', link: 'Houses built to your design →' },
    ],
    todayHeading: 'Today',
    paragraphs: [
      'We sell and deliver containers, Box houses and houses built to your design from our base in Marikostinovo. Container and Box house prices are published with VAT, and each model\'s specification says what the price includes.',
    ],
    renovation: {
      text: 'With our own team of builders we also renovate bathrooms and kitchens, in the area from Sofia to Petrich.',
      link: 'Interior renovations →',
    },
    terms: [
      { key: 'base', label: 'Our base', text: 'Marikostinovo, 2850 Petrich, Bulgaria.', map: 'See it on the map' },
      { key: 'visits', label: 'Visits', text: 'You are welcome at our base, by prior appointment only.' },
      { key: 'hours', label: 'Opening hours', text: '{hours}' },
      { key: 'factory', label: 'Where they are made', text: 'Containers and Box houses are made at our factory in China.' },
      { key: 'answer', label: 'Who answers', text: 'A real person, by phone or email, within 24 hours.' },
      { key: 'company', label: 'Company', text: 'NVC Home4You, VAT number {vat}' },
    ],
  },

  team: {
    heading: 'Our team',
    sub: 'The people behind NVC Home4You: the three managing directors, sales and our builders.',
    people: [
      { slug: 'vladimir-vladimirov', name: 'Vladimir Vladimirov', role: 'Managing Director', area: 'Marketing and engineering' },
      { slug: 'tsvetelin-bonin', name: 'Tsvetelin Bonin', role: 'Managing Director', area: 'Legal matters and customers' },
      { slug: 'nikolay-lekov', name: 'Nikolay Lekov', role: 'Managing Director', area: 'Logistics and production' },
      { slug: 'radina-ivanova', name: 'Radina Ivanova', role: 'Sales Manager', area: '' },
      { slug: 'vasil-vasilev', name: 'Vasil Vasilev', role: 'Builder', area: '' },
      { slug: 'ivan-vasilev', name: 'Ivan Vasilev', role: 'Builder', area: '' },
    ],
  },

  journey: {
    heading: 'From our factory to your plot',
    sub: 'Photos and footage from our factory and our own deliveries.',
    factory: {
      title: 'At our factory in China',
      text: 'This is where the containers and Box houses we sell are made.',
      alt: 'A production hall with module frames and wall panels',
    },
    clips: [
      { id: 'port', title: 'At the port', text: 'The folded Box house arrives by ship; we handle customs.' },
      { id: 'yard', title: 'At our base', text: 'We unload it from the shipping container, at our cost.' },
      { id: 'truck', title: 'On the truck', text: 'A crane lifts it onto the truck that brings it to you.' },
      { id: 'plot', title: 'On your plot', text: 'The crane sets it on its foundation.' },
    ],
    more: 'Delivery and assembly: prices and calculator →',
  },

  proof: {
    heading: 'Delivered to a customer',
    case: {
      id: '2',
      line: '58 m² with veranda · Paralia Kariani, Greece · {year}',
      result: 'A Box house, delivered and assembled, ready to move into.',
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

  inWriting: {
    heading: 'What we take on, and what stays with you',
    sub: 'The contract, the documents, customs, transport and prices.',
    terms: [
      { key: 'contract', label: 'Contract', text: 'We sell under a written contract, and the warranty is set out in an annex to it.' },
      { key: 'documents', label: 'Documents', text: 'With a container or a Box house you get the CE certificate, the list of materials and the drawings.' },
      { key: 'qc', label: 'Quality check', text: 'Before we ship an order, we check its quality at our factory.' },
      { key: 'customs', label: 'Customs', text: 'We handle it, for everything we deliver.' },
      { key: 'insurance', label: 'Insurance and tracking', text: 'We offer transport insurance and shipment tracking.' },
      { key: 'unloading', label: 'Unloading', text: 'At our base it is at our cost. Transport from the base to your address, and unloading there, are at your cost unless we agree otherwise.' },
      { key: 'prices', label: 'Prices', text: 'Container prices include VAT and assembly. Box house prices include VAT, with assembly priced separately. Delivery and the crane are priced separately, excl. VAT.', link: 'All prices →' },
    ],
  },

  warranty: {
    heading: 'Warranty on the containers and Box houses',
    lead: 'The terms are set out in the annex to our contract.',
    rows: [
      { key: 'structure', label: 'Structure', text: '{years}\u00a0years: the load-bearing steel frame' },
      { key: 'panels', label: 'Panels', text: '{years}\u00a0years: the thermal (sandwich) panels' },
      { key: 'joinery', label: 'Windows and doors', text: '{years}\u00a0years: the profiles and the glazing' },
      { key: 'sanitary', label: 'Sanitary ware', text: '{years}\u00a0years: the sanitary ware and plumbing fittings in the bathroom' },
    ],
    conditions: 'The warranty covers factory defects and runs from the day of handover, with normal use, a suitable foundation, proper drainage and no unauthorised work by third parties. Everything else is checked visually at handover against the factory standard.',
    excluded: 'The warranty does not cover mechanical damage, improper transport or unloading not carried out by us, an unsuitable foundation, lack of ventilation, poor drainage, leaks from external connections, condensation, later repairs or changes by the buyer or third parties, or force majeure.',
  },

  siblings: {
    heading: 'Where to look next',
    go: 'Take a look →',
    cases: { label: 'Cases and reviews', desc: 'Delivered houses and what our customers say.' },
    faq: { label: 'Questions', desc: 'Prices, delivery, assembly and the warranty.' },
    gallery: { label: 'Gallery with prices', desc: 'The models, with photos and prices incl. VAT.' },
    delivery: { label: 'Delivery and assembly', desc: 'What delivery to you costs, with a calculator.' },
    partner: { label: 'For companies and partners', desc: 'Containers and Box houses for resellers and bulk orders.' },
    doors: { label: 'Internal doors', desc: 'Doors as a set with frame, hinges, handle and trims, and fitting if you want it.' },
  },

  finalTitle: 'Shall we talk about your project?',
}
