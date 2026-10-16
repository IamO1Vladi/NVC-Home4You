// The FAQ hub, /en/faq: "Frequently asked questions". The Bulgarian file (bg/faq.js) says where
// every answer comes from and which rules the copy keeps; this one carries the same keys, ids
// and topics in English. Every figure is a {placeholder} filled by lib/faqHub.js hubFigures().
// No seo block: the head comes from routeMeta.js.
export default {
  breadcrumb: 'Frequently asked questions',
  home: 'Home',

  hero: {
    eyebrow: 'Questions and answers',
    h1: 'Frequently asked questions',
    lead: 'Prices and VAT, delivery and the crane, the warranty and documents, partners, doors and renovations: the answers in one place.',
  },

  search: {
    label: 'Search the questions',
    placeholder: 'For example: crane, warranty, customs',
    clear: 'Clear the search',
  },
  topicsLabel: 'Topics',
  all: 'All',
  count: { one: '{n} question', other: '{n} questions' },
  empty: {
    text: 'No question matches your search.',
    reset: 'Show all questions',
    ask: 'Ask a question',
  },

  topics: {
    buying: { label: 'Buying and prices', link: 'Prices of every model, incl. VAT →' },
    containers: { label: 'Containers', link: 'Containers: models, prices and specification →' },
    box: { label: 'Box houses', link: 'Box houses: sizes, prices and the warranty →' },
    steel: { label: 'Steel-frame houses', link: 'Houses to your plan: how we work →' },
    delivery: { label: 'Delivery and assembly', link: 'Delivery and assembly: calculator and example prices →' },
    warranty: { label: 'Warranty and documents', link: 'The contract, the documents and the warranty →' },
    company: { label: 'Visits and the company', link: 'About us: who we are and where to find us →' },
    partners: { label: 'Partners', link: 'Partner terms and the enquiry form →' },
    doors: { label: 'Internal doors', link: 'Internal doors: types, colours and enquiry →' },
    renovations: { label: 'Interior renovations', link: 'Interior renovations: what we do and the free site visit →' },
  },

  items: [
    {
      id: 'prices-vat',
      topic: 'buying',
      q: 'Do the prices include VAT, and what is paid separately?',
      a: 'Container prices include VAT and assembly. Box house prices include VAT, with assembly priced separately, excl. VAT: from {boxAssembly} for the {areas} m² models. Delivery and the crane are priced separately, excl. VAT.',
    },
    {
      id: 'contract',
      topic: 'buying',
      q: 'Do I get a written contract?',
      a: 'Yes. We sell under a written contract, and the warranty is set out in an annex to it.',
    },

    {
      id: 'container-kitchen',
      topic: 'containers',
      q: 'Does a container come with a kitchen?',
      a: 'A kitchen is not included. There is a room that can be used as one.',
      link: { pathKey: 'modularBuilds', hash: 'specs', label: 'What every container has →' },
    },
    {
      id: 'container-assembly',
      topic: 'containers',
      q: 'Is assembly included in the container price?',
      a: 'Yes. Assembly is included in the price of every model: {containerAssembly} of that price is for the assembly.',
      link: { pathKey: 'modularBuilds', hash: 'assembly', label: 'Container assembly and delivery →' },
    },
    {
      id: 'container-sizes',
      topic: 'containers',
      q: 'Are there containers in other sizes?',
      a: 'Other sizes from the catalogue are not in stock, but we can order them for you. Just ask.',
      link: { pathKey: 'modularBuilds', hash: 'units', label: 'The containers in stock, with prices →' },
    },

    {
      id: 'box-price',
      topic: 'box',
      q: 'What does the Box house price include?',
      a: 'VAT, shipping from China and customs. For the {areas} m² models the price also covers the fully equipped bathroom ({bathrooms} versions to choose from), the kitchen ({kitchens} versions to choose from, and {kitchensExtra} more at extra cost) and the standard terrace on the short side, {terrace}. Assembly is priced separately, and the crane, the foundation and delivery to your plot are not included.',
      link: { pathKey: 'modularHouses', hash: 'sizes', label: 'Box house sizes and prices →' },
    },
    {
      id: 'box-appliances',
      topic: 'box',
      q: 'Are kitchen appliances included?',
      a: 'No. We do not supply or charge for the appliances: in the configurator you show where each one goes, so that we build the kitchen to fit, and the preparation for them (electrical points and plumbing) is included in the price. The sink is the exception: we do sell it, and you choose it in the configurator.',
      link: { pathKey: 'boxConfigurator', label: 'Build your house in the configurator →' },
    },
    {
      id: 'box-assembly',
      topic: 'box',
      q: 'What does Box house assembly include?',
      a: 'Placing the house on your prepared base and turnkey finishing: the house is ready to move into. Assembly does not include the crane, the foundation or delivery to your plot. The crane is required: about {boxCrane} excl. VAT, or more depending on the location.',
      link: { pathKey: 'prices', label: 'The assembly price of every model →' },
    },
    {
      id: 'box-layouts',
      topic: 'box',
      q: 'Can I choose the layout?',
      a: 'Yes. Start from one of the {layouts} layouts in our catalogue for the {areas} m² models, or draw your own in the planner, and send it to us for a quote. The bathroom and the entrance door are fixed: they sit where the model’s technical drawing puts them.',
      link: { pathKey: 'planner', label: 'The layouts in the planner →' },
    },

    {
      id: 'steel-price',
      topic: 'steel',
      q: 'How much does a steel-frame house cost?',
      a: 'Each house is its own project, so there is no catalogue price. Send us your plan or a sketch and we will quote it, or, if you do not have one, we will draw one up for you.',
      link: { pathKey: 'steelHouses', label: 'How we work to your plan →' },
    },
    {
      id: 'steel-delivery',
      topic: 'steel',
      q: 'Do you handle delivery and customs for a house built to a plan?',
      a: 'Yes. We deliver the parts to your plot and handle the customs clearance. The delivery price is in the quote for the project.',
      link: { pathKey: 'steelHouses', hash: 'pp-process', label: 'The steps from plan to handover →' },
    },

    {
      id: 'customs',
      topic: 'delivery',
      q: 'Do you handle customs?',
      a: 'Yes, for everything we deliver. For Box houses, shipping from China and customs are already in the house price.',
    },
    {
      id: 'foundation',
      topic: 'delivery',
      q: 'What foundation do I need?',
      a: 'It depends on the location, so call us or ask us about your plot. The foundation is not included in the price. {foundationNote}',
    },
    {
      id: 'unloading',
      topic: 'delivery',
      q: 'Who unloads the house?',
      a: 'At our base, unloading is at our cost. Transport from the base to your address, and unloading there, are at your cost unless we agree otherwise.',
    },
    {
      id: 'insurance',
      topic: 'delivery',
      q: 'Do you insure and track the shipment?',
      a: 'Yes. We offer transport insurance and shipment tracking.',
    },

    {
      id: 'warranty',
      topic: 'warranty',
      q: 'What warranty do the containers and Box houses carry?',
      a: 'For containers and Box houses: the load-bearing steel structure {structureYears} years; the thermal panels {panelYears} years; the windows and doors (profiles and glazing) {joineryYears} years; the sanitary ware and plumbing fittings {sanitaryYears} years. Everything else is checked visually at handover. The warranty covers factory defects and runs from the day of handover, with normal use, a suitable foundation, proper drainage and no unauthorised work by third parties. It does not cover mechanical damage, improper transport or unloading not carried out by us, an unsuitable foundation, lack of ventilation, poor drainage, leaks from external connections, condensation, later repairs or changes by the buyer or third parties, or force majeure.',
    },
    {
      id: 'documents',
      topic: 'warranty',
      q: 'What documents come with a container or a Box house?',
      a: 'With a container or a Box house you get the CE certificate, the list of materials and the drawings.',
    },
    {
      id: 'quality-check',
      topic: 'warranty',
      q: 'Do you check the quality before you ship?',
      a: 'Yes. Before we ship an order, we check its quality at our factory.',
    },

    {
      id: 'visits',
      topic: 'company',
      q: 'Can I visit you, and when are you open?',
      a: 'Yes, at our base in Marikostinovo, near Petrich, Bulgaria, by prior appointment only. Opening hours: {hours}.',
    },
    {
      id: 'factory',
      topic: 'company',
      q: 'Where are the containers and Box houses made?',
      a: 'At our factory in China. We handle customs, and then we bring them to your address.',
    },
    {
      id: 'company',
      topic: 'company',
      q: 'What kind of company is NVC Home4You?',
      a: 'A Bulgarian company from Marikostinovo, near Petrich. We started in {founded} as a logistics firm; today we sell and deliver containers, Box houses and steel-frame houses built to your design. We have delivered {homes} homes. VAT number: {vat}.',
    },
  ],

  siblings: {
    heading: 'Where to look next',
    go: 'Take a look →',
    delivery: { label: 'Delivery and assembly', desc: 'What delivery to you costs, with a calculator.' },
    prices: { label: 'Prices', desc: 'The house, assembly and VAT for every model, in one table.' },
    partner: { label: 'Partners', desc: 'Lower prices for several units: containers from {containerMin}, Box houses from {boxMin} in one order.' },
    about: { label: 'About us', desc: 'Who we are, our team and our base in Marikostinovo.' },
  },

  finalTitle: 'Didn’t find your answer?',
}
