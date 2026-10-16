// src/content/en/modularHouses.js
//
// The words of the modular houses page (/en/modular-houses). No price is written here: every
// figure on the page is computed from the gallery rows (src/lib/productRows.js) and printed
// with euro(); a pattern below marks where one goes with {price}, {house} or {assembly}.
// The title, description and breadcrumb come from routeMeta.js through the route, so this
// file has no seo block any more.
//
// Every fact is one the gallery, the configurator catalogue or the published case already
// states, or one the owner gave us (2026-10-12): the Box house sizes, frame, walls and glazing
// are the gallery descriptions'; the capsule lines are gallery item 100015's and nothing more;
// the hero photo and the proof card are the Paralia Kariani case on /api/cases-page.
// The lead time in arrival.delivery ({production} and {months}) is the owner's of 2026-10-15,
// read from deliveryRates.js, and the foundation tip the page shows is his too (pricesCopy's
// foundationNote, beside arrival.foundationAsk). The permit is the FAQ hub's answer
// (faq.js, id "permit", the owner's of 2026-10-17), not this page's.
// The "not included" list is NOT here either: the page reads it from
// pricesCopy so this page and /en/prices say it in the same words.
export default {
  hero: {
    eyebrow: 'Expandable houses and capsules',
    h1: 'Modular houses for permanent living',
    lead: 'Expandable (Box) houses from 18 to 74 m² that arrive folded and unfold on site, and a 38 m² capsule. Choose a size and build your house online.',
    from: 'from',
    basis: 'the house incl. VAT, assembly extra',
    build: 'Build it online',
    offer: 'Request a quote',
    facts: [
      'Fully equipped bathroom',
      'Electrics and plumbing installed at the factory',
      'Galvanised steel frame',
    ],
    // The default photo: the delivered 58 m² house from the published case. An admin photo
    // (/admin/home-photos, the page-modular-houses slot) replaces it and drops the chip,
    // since the chip names this house and the admin's photo may show another.
    photo: {
      url: '/api/img/cases/1/0ed68fb76fbe4876a9905da7d043216d.webp',
      alt: 'A 58 m² expandable house with a veranda, delivered to Paralia Kariani, Greece',
      position: '50% 45%',
    },
    adminAlt: 'An NVC Home4You expandable modular house',
  },

  // The published case (/api/cases-page, id "2"). The API's text is Bulgarian only, so the
  // line, the result and the buyer's name are written here once per language; the photos,
  // the quote and the rating are read from the API, and the card is not drawn if the case is
  // ever unpublished.
  case: {
    id: '2',
    line: '58 m² with veranda · Paralia Kariani, Greece · 2026',
    result: 'Delivered and assembled, ready to move into.',
    name: 'Vangelis',
  },

  sizes: {
    heading: 'Choose your expandable house size',
    sub: 'The house price includes VAT; assembly is extra and shown beneath it. The 37, 58 and 73 m² models can be built in the configurator.',
    allPrices: 'The full price table →',
    allPhotos: 'Photos of every modular house →',
    plannerLink: 'Layouts and the 3D unfold in the planner →',
    // To the partner page's enquiry form (#zapitvane): more than one unit, or for resale.
    partnerLink: 'More than one, or for resale? →',
    basis: 'incl. VAT, assembly extra',
    assembly: '+ assembly {price} incl. VAT',
    assemblyOnRequest: 'Assembly on request',
    variant: 'With veranda and double roof: {house} + assembly {assembly}',
    variantOnRequest: 'With veranda and double roof: {house}, assembly on request',
    build: 'Build it online',
    ask: 'Request a quote for this model',
    more: 'Details →',
    // One line per card, keyed by gallery id: what this size has that the others do not.
    diff: {
      100016: 'The smallest model, with a fully equipped bathroom and kitchen',
      10: '3.0 mm frame, 2.2 × 1.25 m bathroom',
      5: '3.5 mm frame, 2.4 × 1.25 m bathroom',
      9: '4.0 mm frame, 2.8 × 1.25 m bathroom',
      16: 'A roof over the whole house and a 2 m wide balcony',
      17: 'Two floors with an inside staircase and a 2 m balcony',
    },
  },

  // The lines are gallery item 100015's; the basis is the owner's answer of 2026-10-17: the
  // capsule needs no assembly, it arrives ready.
  capsule: {
    // Its Product markup's category once it is filed under its own "capsule" (2026-10-17),
    // the gallery's own name for it (content/en/gallery.js filters.categories.capsule).
    schemaCategory: 'Space capsule',
    basis: 'incl. VAT; arrives ready, no assembly needed',
    lines: [
      '38 m², 11.5 × 3.3 m',
      '3.5 mm galvanised steel frame',
      '100 mm walls with polyurethane insulation and aluminium cladding',
      'Thermally broken aluminium frames with tempered double glazing',
      'Entrance door with a smart lock',
    ],
  },

  compare: {
    heading: 'Box house or capsule',
    columns: ['Feature', 'Box house', 'Capsule'],
    rows: [
      { label: 'Floor area', values: ['18–74 m²', '38 m²'] },
      { label: 'Frame', values: ['Galvanised steel, 3.0 / 3.5 / 4.0 mm for 37 / 58 / 73 m²', 'Galvanised steel, 3.5 mm'] },
      { label: 'Walls', values: ['100 mm rock wool at 80 kg/m³, fire class A, and a 16 mm polyurethane facade', '100 mm with polyurethane insulation, aluminium cladding'] },
      { label: 'Windows', values: ['Thermally broken aluminium or PVC, double glazed', 'Thermally broken aluminium, tempered double glazing'] },
    ],
    priceLabel: 'Price from',
    boxPrice: '{price}, assembly extra',
    capsulePrice: '{price}; arrives ready, no assembly needed',
  },

  // {folded} and {open} are the 37 m² model's widths from the configurator catalogue.
  arrival: {
    heading: 'How an expandable house arrives',
    paragraphs: [
      'An expandable house is made in the factory together with the bathroom, kitchen, windows and installations you chose. It travels folded and only opens out where it will stand, which is why some call it a folding house, some an extendable house and some simply a box house. We deliver it in Bulgaria and Greece; other countries on request.',
      'In transit the 37 m² model is {folded} m wide; unfolded it is {open} m. On site the house is lifted by crane onto the prepared foundation and unfolded. The installations inside are already built in at the factory.',
    ],
    // {rate}, {crane}, {production} and {months} come from deliveryRates.js, the owner's figures of 2026-10-15.
    delivery: 'Delivery to your plot: about {rate} per kilometre, counted both ways, from Marikostinovo or from Varna, whichever is closer to you. The crane is required and costs about {crane}, or more depending on the location. Delivery and crane exclude VAT. The house is made in up to {production} days and reaches your address in about {months} months.',
    pricesLink: 'Prices with assembly →',
    deliveryLink: 'Work out delivery to you →',
    includedHeading: 'What assembly covers',
    excludedHeading: 'What is not included',
    foundationAsk: 'The foundation you need depends on the site. Call us or ask us.',
  },

  // The warranty as the owner gave it on 2026-10-15, from the annex to our Box-house sales
  // contract. The lead names the Box houses and the capsule, which carries the same warranty
  // (owner, 2026-10-17). {years} is the row's figure from shared/warranty.js, by its key.
  warranty: {
    heading: 'Warranty',
    lead: 'For the expandable (Box) houses and the capsule.',
    rows: [
      { key: 'structure', label: 'Structure', text: '{years}\u00a0years: the load-bearing steel frame' },
      { key: 'panels', label: 'Panels', text: '{years}\u00a0years: the thermal (sandwich) panels' },
      { key: 'joinery', label: 'Windows and doors', text: '{years}\u00a0years: the profiles and the glazing' },
      { key: 'sanitary', label: 'Sanitary ware', text: '{years}\u00a0years: the sanitary ware and plumbing fittings in the bathroom and kitchen' },
    ],
    conditions: 'The warranty covers factory defects and runs from the day of handover, with normal use, a suitable foundation, proper drainage and no unauthorised work by third parties. Everything else is checked visually at handover against the factory standard.',
    excluded: 'The warranty does not cover mechanical damage, improper transport or unloading not carried out by us, an unsuitable foundation, lack of ventilation, poor drainage, leaks from external connections, condensation, later repairs or changes by the buyer or third parties, or force majeure.',
  },

  proof: {
    heading: 'Delivered to a customer',
    sub: 'One of our expandable houses, already in its place.',
    // Two of the case's own photos, shown only while the case still lists them.
    photos: [
      { url: '/api/img/cases/1/5f6e02eabc11410c89ab824cb2496488.webp', alt: 'The living room and kitchen of the house in Paralia Kariani' },
      { url: '/api/img/cases/1/268f1b6801134d16ab11f700ac46faf5.webp', alt: 'The bathroom and its shower cabin in the house in Paralia Kariani' },
    ],
    // To the case's own card on the cases page (#case-<id>), named for what it shows.
    more: 'The house in Paralia Kariani →',
    stars: '{rating} out of 5',
  },

  // The page's questions (lib/productQuestions.js): the same ids as bg/modularHouses.js, which
  // says where each answer comes from.
  faq: {
    heading: 'Questions',
    // To the hub's Box houses topic (#t-box).
    more: 'More questions →',
    items: [
      {
        id: 'box-price',
        q: 'What does the Box house price include?',
        a: 'VAT, shipping from China and customs. For the {areas} m² models the price also covers the fully equipped bathroom ({bathrooms} versions to choose from), the kitchen ({kitchens} versions to choose from, and {kitchensExtra} more at extra cost) and the standard terrace on the short side, {terrace}. Assembly is priced separately, and the crane, the foundation and delivery to your plot are not included.',
        link: { pathKey: 'modularHouses', hash: 'sizes', label: 'Box house sizes and prices →' },
      },
      {
        id: 'box-assembly',
        q: 'What does Box house assembly include?',
        a: 'Placing the house on your prepared base and turnkey finishing: the house is ready to move into. Assembly does not include the crane, the foundation or delivery to your plot. The crane is required: about {boxCrane} excl. VAT, or more depending on the location.',
        link: { pathKey: 'prices', label: 'The assembly price of every model →' },
      },
      {
        id: 'box-assembly-crew',
        q: 'Who assembles a Box house, and how long does it take?',
        a: 'We do: {workers} of our workers assemble it on site in {assemblyDays} days.',
      },
      {
        id: 'box-assembly-18',
        q: 'How much is assembly for the 18 m² house?',
        a: 'Assembly of the 18 m² expandable house costs {smallAssembly} excl. VAT, or {smallAssemblyGross} incl. VAT.',
      },
      {
        id: 'box-lead-times',
        q: 'Is the lead time the same for every size?',
        a: 'Yes. Every Box house, from 18 to 74 m², is made in up to {production} days and reaches your address in about {months} months.',
      },
      {
        id: 'capsule-ready',
        q: 'Does the capsule need assembly?',
        a: 'No. The capsule arrives ready and needs no assembly. Delivery, the crane, the lead time (about {months} months to your address) and the warranty are the same as for the Box houses.',
      },
      {
        id: 'box-layouts',
        q: 'Can I choose the layout?',
        a: 'Yes. Start from one of the {layouts} layouts in our catalogue for the {areas} m² models, or draw your own in the planner, and send it to us for a quote. The bathroom and the entrance door are fixed: they sit where the model’s technical drawing puts them.',
        link: { pathKey: 'planner', label: 'The layouts in the planner →' },
      },
      {
        id: 'box-appliances',
        q: 'Are kitchen appliances included?',
        a: 'No. We do not supply or charge for the appliances: in the configurator you show where each one goes, so that we build the kitchen to fit, and the preparation for them (electrical points and plumbing) is included in the price. The sink is the exception: we do sell it, and you choose it in the configurator.',
        link: { pathKey: 'boxConfigurator', label: 'Build your house in the configurator →' },
      },
    ],
  },

  catalogues: {
    heading: 'Catalogues (PDF)',
    subheading: 'The expandable houses and the capsule on paper, to print or to send to whoever you are deciding with.',
    // The sizes and languages are what /api/brochures served on 2026-10-12: the box-house
    // catalogue has an English edition, the capsule one is Bulgarian only. Update both when
    // the admin uploads a new edition.
    items: [
      { brochureSlug: 'box-house', label: 'Expandable (Box) houses', note: '37 / 58 / 73 m² · 5.4 MB' },
      { brochureSlug: 'space-capsules', label: 'Capsules', note: 'In Bulgarian · 3.4 MB' },
    ],
  },

  siblings: {
    heading: 'Looking for something else?',
    go: 'Have a look →',
    from: 'from',
    withAssembly: 'incl. VAT and assembly',
    containers: {
      label: 'Container units',
      desc: 'Living and office containers of 6×3, 7×3 and 8×3 m, assembled by us.',
    },
    steel: {
      label: 'Steel-frame prefab houses to your plan',
      desc: 'A steel-frame house built to your own design, or we prepare the design for you.',
    },
  },

  finalTitle: 'Shall we talk about your house?',

  // Product markup only, never shown.
  listName: 'Modular houses',
  schemaCategory: 'Modular house',
}
