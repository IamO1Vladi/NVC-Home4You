import { DELIVERED_CONTAINER } from '../shared/deliveredMedia.js'

// src/content/en/modularBuilds.js
//
// The words on the "Container units" page (/en/modular-builds). No price lives here: the
// prices, the "from" figure, the assembly share of a price and the delivery rate come from
// the gallery (/api/gallery), prices.js and deliveryRates.js, and are filled into {amount},
// {rate}, {crane}, {travel} and {price}. The title and description search engines read are in
// src/seo/routeMeta.js.
//
// The table states only what the six gallery descriptions state. The kitchen, the crane,
// the accommodation, the foundation and the made-to-order sizes are the owner's words
// (2026-10-12); the crane's cost, the 3–4 nights and the workers' travel are his 2026-10-15
// figures, in deliveryRates.js.
export default {
  hero: {
    eyebrow: 'Container units',
    h1: 'Containers for living, office and site use',
    lead: 'Residential and office containers of 6×3, 7×3 and 8×3 m with a bathroom, electrics and plumbing — delivered and assembled by us.',
    from: 'from',
    basis: 'incl. VAT and assembly',
    cta: 'Get a Quote',
    call: 'Call us',
    facts: [
      'Bathroom, electrics and plumbing fitted',
      // The short form of assembly.crane and assembly.noCrane below: with a crane the
      // container is assembled in our warehouse and arrives built, never on site.
      'Assembled in our warehouse if you choose a crane at your cost, or on site by two of our workers',
      'Other sizes from 14 to 30 m² can be ordered',
    ],
    // The owner's photo (2026-10-17) of a container delivered to a customer's plot
    // (shared/deliveredMedia.js), until another is set in the admin panel. Not the night render.
    photo: {
      url: DELIVERED_CONTAINER.url,
      srcSet: DELIVERED_CONTAINER.srcSet,
      alt: 'A container delivered to a customer\'s plot',
      position: '50% 55%',
    },
    // Read only when the admin set a photo but left its description empty: the default
    // photo's alt describes a different picture.
    adminAlt: 'A container unit by NVC Home4You',
  },

  units: {
    heading: 'Choose a residential or office container',
    lead: 'Six standard models. Every price includes VAT and assembly.',
    basis: 'incl. VAT and assembly',
    ask: 'Request a quote for this model',
    more: 'Details →',
    // By gallery id: what sets the model apart from the one beside it. A new model with no
    // line here is simply shown without one.
    diff: {
      13: 'The base model, 6 × 3 m',
      6: 'The base model, one metre longer: 7 × 3 m',
      12: 'A fully glazed wall in an aluminium frame and a PU facade; bathroom with toilet and basin, no shower',
      14: 'Decorative 16 mm PU facade panels',
      7: 'Decorative 16 mm PU facade panels',
      8: 'Gable roof and a 1500 × 1600 mm window',
    },
    madeToOrder: 'Other sizes from the catalogue, 14 to 30 m², are not in stock, but we can order them for you. Just ask.',
    loadError: 'We could not load the prices.',
    pricesLink: 'Full price table →',
    galleryLink: 'Photos of every container →',
    // To the partner page's enquiry form (#zapitvane): more than one unit, or for resale.
    partnerLink: 'More than one, or for resale? →',
  },

  specs: {
    heading: 'What every container has',
    lead: 'The same in all six models, except where noted.',
    // Container buyers can choose their doors from the internal doors range (owner, 2026-10-15).
    doorsLink: 'Internal doors for your container →',
    rows: [
      { label: 'Structure', value: 'Galvanised steel frame, 2.3 mm' },
      { label: 'Walls and insulation', value: '50 mm panels with 100 kg/m³ rock wool' },
      { label: 'Windows', value: 'PVC, double glazed, 950 × 1200 mm; 1500 × 1600 mm on the 8 × 3 m model' },
      { label: 'Floor', value: 'PVC; SPC or tiles in the bathroom, your choice' },
      { label: 'Electrics and plumbing', value: 'Fully installed' },
      { label: 'Bathroom', value: 'Toilet, basin with cabinet and shower tray; no shower in the panoramic office' },
      { label: 'Kitchen', value: 'Not included. There is a room that can be used as one.' },
    ],
    // Two photos of the models themselves, from the gallery: the item's id and the photo's place in it.
    photos: [
      { id: 13, index: 1, alt: 'The bathroom of a 6 × 3 m container: shower tray, basin with cabinet and toilet' },
      { id: 6, index: 1, alt: 'Inside a 7 × 3 m container: PVC floor and a double-glazed window' },
    ],
  },

  assembly: {
    heading: 'Assembly and delivery',
    includedLabel: 'Assembly',
    included: 'Included in the price of every model: {amount} of it is the assembly.',
    craneLabel: 'With a crane',
    crane: 'If you prefer, the container is set in place by crane, which you pay for: about {crane} excl. VAT. We then assemble it in our warehouse and it arrives finished, with no travel or accommodation for workers to pay.',
    noCraneLabel: 'Without a crane',
    noCrane: 'If you do not want a crane, two of our workers build the container on site at your place. They stay {nights} nights, and you arrange their accommodation. Depending on the location, their travel adds up to {travel} excl. VAT.',
    foundationLabel: 'Foundation',
    foundation: 'The foundation it needs depends on the location. Call us or ask us about your plot.',
    deliveryLabel: 'Delivery',
    delivery: 'We deliver from Marikostinovo, Bulgaria: {rate} per kilometre, counted both ways, excl. VAT. A container in stock arrives within {days} days.',
    deliveryLink: 'Work out delivery to you →',
    ask: 'Ask a Question',
    call: 'Call us',
  },

  // The warranty as the owner gave it on 2026-10-15 for containers and Box houses. {years} is
  // the row's figure from shared/warranty.js, by its key.
  warranty: {
    heading: 'Warranty',
    rows: [
      { key: 'structure', label: 'Structure', text: '{years}\u00a0years: the load-bearing steel frame' },
      { key: 'panels', label: 'Panels', text: '{years}\u00a0years: the thermal (sandwich) panels' },
      { key: 'joinery', label: 'Windows and doors', text: '{years}\u00a0years: the profiles and the glazing' },
      { key: 'sanitary', label: 'Sanitary ware', text: '{years}\u00a0years: the sanitary ware and plumbing fittings in the bathroom' },
    ],
    conditions: 'The warranty covers factory defects and runs from the day of handover, with normal use, a suitable foundation, proper drainage and no unauthorised work by third parties. Everything else is checked visually at handover against the factory standard.',
    excluded: 'The warranty does not cover mechanical damage, improper transport or unloading not carried out by us, an unsuitable foundation, lack of ventilation, poor drainage, leaks from external connections, condensation, later repairs or changes by the buyer or third parties, or force majeure.',
  },

  // The page's questions (lib/productQuestions.js): the same ids as bg/modularBuilds.js, which
  // says where each answer comes from.
  faq: {
    heading: 'Questions',
    // To the hub's containers topic (#t-containers).
    more: 'More questions →',
    items: [
      {
        id: 'container-kitchen',
        q: 'Does the container have a kitchen?',
        a: 'A kitchen is not included. There is a room that can be used as one.',
        link: { pathKey: 'modularBuilds', hash: 'specs', label: 'What every container has →' },
      },
      {
        id: 'container-assembly',
        q: 'Is assembly included in the container price?',
        a: 'Yes. Assembly is included in the price of every model: {containerAssembly} of that price is for the assembly.',
        link: { pathKey: 'modularBuilds', hash: 'assembly', label: 'Container assembly and delivery →' },
      },
      {
        id: 'container-sizes',
        q: 'Are there containers in other sizes?',
        a: 'Other sizes from the catalogue are not in stock, but we can order them for you. Just ask.',
        link: { pathKey: 'modularBuilds', hash: 'units', label: 'The containers in stock, with prices →' },
      },
      {
        id: 'container-made-to-order',
        q: 'How long does a made-to-order container take?',
        a: 'About {madeToOrderMonths} months, the same as a Box house. A container in stock is with you within {days} days.',
      },
      {
        id: 'container-finishes',
        q: 'Can I choose the container’s finishes?',
        a: 'Yes, when the container is made to order for you. For a container from stock, the finishes cannot be chosen.',
      },
      { id: 'doors-for-containers', from: 'doors' },
    ],
  },

  reviewsHeading: 'What buyers say',

  catalogues: {
    heading: 'Catalogues (PDF)',
    subheading: 'The catalogues are in Bulgarian for now. The current prices are the ones on this page.',
    items: [
      { brochureSlug: 'standard-containers', label: 'Standard containers', note: '14–30 m² units' },
      { brochureSlug: 'villa-office', label: 'Villa / Office', note: 'Living and working modules' },
      { brochureSlug: 'sloped-roof', label: 'Sloped roof', note: 'Sloped-roof units' },
    ],
  },

  siblings: {
    heading: 'Looking for something else?',
    go: 'See them →',
    houses: {
      label: 'Modular houses',
      desc: 'Expandable Box houses and capsules for living in all year round.',
      price: 'from {price} incl. VAT, without assembly',
    },
    steel: {
      label: 'Steel-frame prefab houses to your plan',
      desc: 'Send us your plan for a quote, or we prepare the plan for you.',
    },
  },

  finalTitle: 'Shall we talk about your container?',

  // Product markup: the list's name and each model's category.
  listName: 'Container units',
  schemaCategory: 'Living containers',
}
