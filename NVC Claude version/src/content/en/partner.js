// The partner page, /en/partner: "Partners", for companies that resell our containers and Box
// houses or buy several for a site of their own.
//
// WORDS ONLY, AND ONLY THE OWNER'S, as in bg/partner.js (which carries the full note): his
// answers of 2026-10-15 and the delivery facts already on the site. The warranty, answered the
// same day, covers containers and Box houses only. "Our factory in China", always one factory.
//
// Placeholders: {containerMin} {boxMin} from shared/partnerTerms.js; {containerRate} {boxRate}
// {boxCrane} {days} {production} {months} {nights} {travel} from shared/deliveryRates.js;
// {structureYears} {panelYears} {joineryYears} {sanitaryYears} from shared/warranty.js. No seo block:
// routeMeta.js has the title and description.
import { routeMapControls as ROUTE_CONTROLS, routeMapDestinations as ROUTE_MAP } from '../shared/routeMap.js'
import delivery from './delivery.js'

export default {
  breadcrumb: 'Partners',
  home: 'Home',

  service: {
    name: 'Containers and Box houses for resellers and bulk orders',
    serviceType: 'Sale of containers and expandable houses to resellers and companies',
  },

  hero: {
    eyebrow: 'Partners',
    h1: 'Containers and Box houses for resellers and bulk orders',
    lead: 'They come from our factory in China, we keep containers in stock at Marikostinovo, Bulgaria, and we handle customs. You resell them or put them on your own site; we deliver to you or straight to your client.',
    facts: [
      'Lower prices by quantity: containers from {containerMin} units, Box houses from {boxMin}',
      'A container from stock with you within {days} days',
      'Customs is on us; transport insurance and tracking on offer',
      'Full documents: CE certificate, CAD drawings, list of materials',
    ],
    primary: 'Send an enquiry',
    call: 'Call us',
    photoAlt: 'A crane lifting a long module off a truck onto a concrete yard',
    adminAlt: 'A container or Box house being delivered',
  },

  // The journey drawing in the hero (PartnerJourney.jsx); the same facts as bg/partner.js: one
  // factory, by air only smaller shipments in crates, no transit times or speed comparisons.
  journey: {
    summary: 'How an order travels: from our factory in China by sea, by rail or by air (by air only smaller shipments, in crates), then by truck to your warehouse or to our warehouse in Marikostinovo.',
    captions: {
      factory: 'Our factory in China',
      sea: 'By sea',
      rail: 'By rail',
      air: 'By air · smaller shipments',
      yours: 'Your warehouse',
      ours: 'Our warehouse in Marikostinovo',
    },
    steps: ['Factory', 'Transport', 'Warehouse'],
    stepLabel: 'Step {n}: {name}',
    transport: 'Transport',
    modes: { sea: 'Sea', rail: 'Rail', air: 'Air' },
    arrival: 'Arrival',
    places: { yours: 'Your warehouse', ours: 'Our warehouse', oursWhere: ' in Marikostinovo' },
    pause: 'Pause',
    play: 'Play',
    storyboard: 'The journey of an order in three steps',
  },

  doors: {
    heading: 'Reselling, or buying for your own site?',
    resell: {
      title: 'I resell',
      text: 'Offer our containers and Box houses to your clients, anywhere and at your own price, with no importing or customs of your own. We deliver to your client or to your warehouse.',
      button: 'Enquire about reselling',
    },
    own: {
      title: 'I am buying several units for my own site',
      text: 'We quote the whole quantity at once, with delivery to the site.',
      chipsLabel: 'Suits:',
      chips: [
        { key: 'glamping', label: 'Campsites and glamping', pathKey: 'modularHouses' },
        { key: 'hotel', label: 'Hotels and guest houses', pathKey: 'modularHouses' },
        { key: 'construction', label: 'Building sites', pathKey: 'modularBuilds' },
        { key: 'farm', label: 'Farms', pathKey: 'modularBuilds' },
        { key: 'investor', label: 'Investors', pathKey: 'steelHouses' },
      ],
      button: 'Enquire for a site',
    },
  },

  terms: {
    heading: 'At a glance',
    rows: [
      { key: 'price', label: 'Price', text: 'Lower by quantity: from {containerMin} units for containers and from {boxMin} for Box houses in one order. The exact price is in the offer for your quantity.' },
      { key: 'who', label: 'Who is a partner', text: 'A company ordering at least that many units in one order.' },
      { key: 'payment', label: 'Payment', text: '100% in advance, under a contract.' },
      { key: 'resale', label: 'Selling', text: 'Sell anywhere, at the price you set.' },
      {
        key: 'delivery',
        label: 'Delivery',
        text: 'To you, to your warehouse or straight to your client. A container {containerRate}/km, a Box house about {boxRate}/km plus a crane of about {boxCrane}; km counted both ways, excl. VAT. Bulgaria and Greece by the calculator, other countries on request.',
        link: { label: 'Work out the delivery →', pathKey: 'delivery' },
      },
      { key: 'ownLogistics', label: 'Your own logistics', text: 'You can pay the factory directly and arrange the transport yourself.' },
      { key: 'documents', label: 'Documents', text: 'List of materials, CAD drawings, CE certificate and any other documents needed, for the containers and for the houses.' },
      { key: 'customs', label: 'Customs', text: 'We handle it, for everything we deliver.' },
      { key: 'insurance', label: 'Insurance and tracking', text: 'We offer both for the transport.' },
      { key: 'yard', label: 'Yard', text: 'At Marikostinovo, Bulgaria. You can visit by appointment.' },
      { key: 'containers', label: 'Containers', text: 'The gallery models are in stock, assembly included in the price. With you within {days} days.' },
      { key: 'boxes', label: 'Box houses', text: '37, 58 and 73 m², travelling folded. Made in up to {production} days and at the address in about {months} months.' },
      { key: 'steel', label: 'Steel-frame houses', text: 'To your plan, or to one we draw for you.' },
      { key: 'warranty', label: 'Warranty', text: 'Containers and Box houses: structure\u00a0{structureYears}\u00a0years, panels\u00a0{panelYears}, windows and doors\u00a0{joineryYears}, sanitary ware\u00a0{sanitaryYears}, from handover.' },
    ],
    note: 'Gallery prices are final retail prices incl. VAT. The offer for a quantity is separate.',
  },

  products: {
    heading: 'What you can order',
    sub: 'These are retail prices incl. VAT. A quantity gets an offer of its own.',
    go: 'See them →',
    from: 'from',
    containers: { label: 'Container units', desc: 'Living and office containers, 6×3, 7×3 and 8×3 m, in stock at Marikostinovo.', basis: 'incl. VAT and assembly' },
    houses: { label: 'Box houses', desc: 'Expandable houses of 37, 58 and 73 m² that travel folded.', basis: 'incl. VAT, without assembly' },
    steel: { label: 'Steel-frame houses to a plan', desc: 'A steel frame, to your plan or ours.' },
  },

  process: {
    heading: 'How we work',
    steps: [
      {
        title: 'Enquiry',
        text: 'Tell us what, how many and where: to you or to your client.',
        image: { src: '/delivery/journey-yard.webp', alt: 'A folded Box house being unloaded from a shipping container at our base', caption: 'Our base at Marikostinovo' },
      },
      {
        title: 'An offer for the quantity, and a contract',
        text: 'You get a price for the whole quantity, delivery included. We sign a contract and you pay 100% in advance.',
        image: { src: '/partner/factory-floor.webp', alt: 'A production hall with module frames and wall panels', caption: 'Production at our factory in China' },
      },
      {
        title: 'From stock or from our factory',
        text: 'Containers in stock are with you within {days} days. Box houses are made in up to {production} days and come by sea; customs is on us.',
        image: { src: '/delivery/journey-port.webp', alt: 'A folded Box house wrapped in film being lifted at the port', caption: 'At the port' },
      },
      {
        title: 'Delivery',
        text: 'We bring it to you, to your warehouse or straight to your client. Or you pay the factory directly and arrange the transport yourself.',
        image: { src: '/delivery/journey-plot.webp', alt: 'A crane setting a module onto ground screws', caption: 'At the client\'s' },
      },
    ],
  },

  split: {
    heading: 'Who takes care of what',
    we: {
      title: 'We do',
      items: [
        'Production at our factory in China',
        'Sea freight and customs',
        'Delivery by truck and crane, to you, your warehouse or your client; the crane is at your cost, about {boxCrane} excl. VAT',
        'Assembly of the containers',
        'The documents: list of materials, CAD drawings, CE certificate',
        'Transport insurance and tracking, if you want them',
      ],
    },
    you: {
      title: 'You or your client',
      items: [
        'Payment: 100% in advance, under a contract',
        'Selling: wherever and at whatever price you decide',
        'The foundation: what it needs depends on the site',
        'Access to the site for the truck and the crane',
        'Accommodation for our two workers ({nights} nights) and their travel, up to {travel} excl. VAT, if a container is assembled on site',
        'The transport, if you choose your own logistics',
      ],
    },
  },

  proof: {
    heading: 'Real deliveries',
    sub: 'A Box house delivered and assembled in Greece.',
    case: delivery.proof.case,
    photo: delivery.proof.photo,
    stars: delivery.proof.stars,
    more: delivery.proof.more,
    reviews: 'Reviews from our customers →',
  },

  form: {
    heading: 'Enquiry from a company',
    sub: 'About a minute. Fields marked * are required.',
    optional: 'optional',
    role: {
      legend: 'Which describes you',
      options: { reseller: 'Reselling', ownSite: 'Buying for my own site', other: 'Other' },
      error: 'Choose what describes you.',
    },
    sector: {
      label: 'Sector',
      placeholder: 'Choose',
      options: {
        glamping: 'Campsite or glamping',
        hotel: 'Hotel or guest house',
        construction: 'Construction company',
        farm: 'Farm',
        investor: 'Investor',
        shop: 'Shop',
        realEstate: 'Estate agency',
        other: 'Other',
      },
    },
    products: {
      legend: 'Products',
      options: { container: 'Containers', box37: 'Box 37 m²', box58: 'Box 58 m²', box73: 'Box 73 m²', steel: 'Steel-frame house to a plan' },
    },
    quantity: {
      legend: 'How many units in the order',
      options: { '2-5': '2–5', '6-10': '6–10', '11-25': '11–25', '25+': '25+' },
      hint: 'A lower price: containers from {containerMin} units, Box houses from {boxMin}.',
      error: 'Choose a quantity.',
    },
    timing: {
      label: 'When',
      placeholder: 'Choose',
      options: { month: 'Within a month', '1-3m': '1–3 months', '3-6m': '3–6 months', season: 'For next season', exploring: 'Just looking' },
    },
    boxNote: 'A Box house is made in up to {production} days and reaches the address in about {months} months. If you need it within a month, choose a container from stock.',
    logistics: {
      legend: 'Transport',
      options: { ours: 'Delivered by us', own: 'My own logistics: I pay the factory directly' },
    },
    country: {
      label: 'Country',
      placeholder: 'Choose',
      options: { BG: 'Bulgaria', GR: 'Greece', MK: 'North Macedonia', RO: 'Romania', EU: 'Another EU country', nonEU: 'Outside the EU' },
      error: 'Choose a country.',
    },
    region: 'Town or region',
    company: 'Company',
    vatId: 'Company or VAT number',
    name: { label: 'Name', error: 'Please write your name.' },
    phone: { label: 'Phone', error: 'Please add a phone number: we call back on company enquiries.' },
    email: { label: 'Email', error: 'Please add an email address we can write to.' },
    message: { label: 'Message', placeholder: 'Models, sizes, dates, where it goes…' },
    privacy: 'We use these details only to answer your enquiry.',
    privacyLink: 'Privacy',
    submit: 'Send the enquiry',
    invalid: 'Please fill in the marked fields.',
  },

  prefill: {
    offer: 'Partner enquiry, from the partners page',
    cargo: 'Question about shipping cargo, from the partners page',
  },

  faq: {
    heading: 'Questions from resellers',
    items: [
      { q: 'What does it cost for several units?', a: 'Less than the retail price, depending on the quantity: from {containerMin} units for containers and from {boxMin} for Box houses in one order. The exact price is in the offer for your quantity.' },
      { q: 'Who can become a partner?', a: 'A company ordering at least {containerMin} containers or at least {boxMin} Box houses in one order.' },
      { q: 'How is payment made?', a: 'The full amount in advance, under a contract with us.' },
      { q: 'Can I sell anywhere, at my own price?', a: 'Yes. You sell wherever you like, at the price you set.' },
      { q: 'Do you deliver to my client or my warehouse? And outside Bulgaria?', a: 'Yes: to you, to your warehouse or straight to your client. In Bulgaria and Greece at the calculator\'s rates: a container {containerRate}/km, a Box house about {boxRate}/km plus a crane of about {boxCrane}, km counted both ways, excl. VAT. Other countries on request.' },
      { q: 'What documents do I get?', a: 'A list of materials, CAD drawings, a CE certificate and any other documents needed, for the containers and for the houses.' },
      { q: 'Who handles customs?', a: 'We do, for everything we deliver.' },
      { q: 'How long does it take?', a: 'A container from stock is with you within {days} days. A Box house is made in up to {production} days and reaches the address in about {months} months.' },
      { q: 'Can I see the stock?', a: 'Yes. Our yard is at Marikostinovo, Bulgaria: visits by appointment.' },
      { q: 'Can I use my own logistics?', a: 'Yes. You can pay the factory directly and arrange the transport yourself.' },
      { q: 'What warranty do the containers and Box houses carry?', a: 'The load-bearing steel structure {structureYears}\u00a0years; the thermal panels {panelYears}\u00a0years; the windows and doors (profiles and glazing) {joineryYears}\u00a0years; the sanitary ware and plumbing fittings {sanitaryYears}\u00a0years. Everything else is checked visually at handover. The warranty covers factory defects and runs from the day of handover, with normal use, a suitable foundation, proper drainage and no unauthorised work by third parties. It does not cover mechanical damage, improper transport or unloading not carried out by us, an unsuitable foundation, lack of ventilation, poor drainage, leaks from external connections, condensation, later repairs or changes by the buyer or third parties, or force majeure.' },
    ],
  },

  cargo: {
    heading: 'We organise your cargo too',
    text: 'If you import yourself, we can organise the shipping. Ask us.',
    ask: 'Ask a question',
    show: 'Show the routes',
    loading: 'Loading the map…',
    unavailable: 'The map did not load. Reload the page to see it.',
  },

  logisticsWorld: {
    modeLabel: 'Mode:',
    modeSea: 'Sea',
    modeAir: 'Air',
    modeRail: 'Rail',
    seaDestinationLabel: 'Port destination:',
    airDestinationLabel: 'Airport:',
    railDestinationLabel: 'Rail hub:',
    legendLabel: 'Legend',
    legendShanghai: 'Shanghai',
    legendHoChiMinh: 'Ho Chi Minh',
    legendLaemChabang: 'Laem Chabang',
    destinations: ROUTE_MAP.en,
    mapControls: ROUTE_CONTROLS.en,
  },

  finalTitle: 'Shall we talk about your order?',
}
