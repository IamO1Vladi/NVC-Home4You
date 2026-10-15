// The About page, /en/about. The same shape and the same facts as bg/about.js, whose header
// gives the rules: words only, every figure a {placeholder} filled from a module, one factory
// ("our factory in China"), delivery across the EU as the home page says it, and `pending`
// never rendered. No seo block: routeMeta.js has it.
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
    paragraphs: [
      'We started out in interior renovation. That work showed us how often people had to choose between quality, clarity and price, and it is why we moved into prefab and modular homes.',
      'Today we sell and deliver containers, Box houses and houses built to your design from our base in Marikostinovo, near Petrich. Container and Box house prices are published with VAT, and each model\'s specification says what the price includes.',
    ],
    terms: [
      { key: 'base', label: 'Our base', text: 'Marikostinovo, 2850 Petrich, Bulgaria.', map: 'See it on the map' },
      { key: 'factory', label: 'Where they are made', text: 'Containers and Box houses are made at our factory in China.' },
      { key: 'answer', label: 'Who answers', text: 'A real person, by phone or email, within 24 hours.' },
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
    more: 'See the project →',
  },

  inWriting: {
    heading: 'What we take on, and what stays with you',
    sub: 'The contract, customs, transport and prices.',
    terms: [
      { key: 'contract', label: 'Contract', text: 'We sell under a written contract, and the warranty is set out in an annex to it.' },
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
  },

  finalTitle: 'Shall we talk about your project?',

  // WAITING FOR THE OWNER, NEVER RENDERED (see bg/about.js).
  pending: {
    founding: {
      ask: 'When was the company founded, and since which year have you sold containers and Box houses? The site says 2019, 2021 and 2022.',
      draft: 'Founded in 2019',
    },
    since: {
      ask: 'Is "Building homes since 2022" right?',
      draft: 'Building homes since 2022',
    },
    people: {
      ask: 'May we show the name, role and photo of the people who answer customers?',
      draft: 'Our team',
    },
    legal: {
      ask: 'What is the company\'s legal name and its EIK/VAT number?',
      draft: 'EIK',
    },
    homes: {
      ask: 'Is "87 homes delivered" current, and does it count containers and houses together?',
      draft: '87 homes delivered',
    },
    documents: {
      ask: 'Do ordinary buyers also get the CE certificate, the materials list and the drawings?',
      draft: 'CE certificate, materials list and drawings',
    },
    factoryQc: {
      ask: 'Is there a quality check at our factory before shipping?',
      draft: 'Quality check before shipping',
    },
    visits: {
      ask: 'May any customer visit the base in Marikostinovo by appointment?',
      draft: 'Visits to the base by appointment',
    },
    hours: {
      ask: 'Are the hours Mon–Fri 07:00–19:00 right?',
      draft: 'Opening hours',
    },
  },
}
