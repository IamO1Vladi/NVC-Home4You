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
      a: 'Container prices include VAT and assembly. Box house prices include VAT, with assembly priced separately, excl. VAT: from {boxAssembly}, depending on the model. The capsule arrives ready and needs no assembly. Delivery and the crane are priced separately, excl. VAT.',
    },
    {
      id: 'contract',
      topic: 'buying',
      q: 'Do I get a written contract?',
      a: 'Yes. We sell under a written contract, and the warranty is set out in an annex to it.',
    },
    {
      id: 'payment',
      topic: 'buying',
      q: 'How do I pay for a container or a house?',
      a: 'You pay {atOrder}% of the price when you order and the remaining {afterDelivery}% after delivery. Assembly is paid for once it is finished. Partners work on different terms: the full amount in advance, under a contract.',
    },
    {
      id: 'financing',
      topic: 'buying',
      q: 'Can the purchase be financed?',
      a: 'Yes. You can get financing of up to {financing} through {bank}.',
    },
    {
      id: 'permit',
      topic: 'buying',
      q: 'Do I need a building permit for a container or a Box house?',
      a: 'No. You need a permit for a temporary structure, and we provide the documents you need to obtain it.',
    },
    {
      id: 'moving',
      topic: 'buying',
      q: 'Can I move the container or the Box house later?',
      a: 'Yes. A container can be taken apart and moved, and a Box house can be folded and moved again.',
    },
    {
      id: 'insulation',
      topic: 'buying',
      q: 'Are the roof and the floor insulated?',
      a: 'The roof is insulated: with {boxRoofMm} mm of rock wool on Box houses, and with mineral wool on containers. The floor is not insulated as standard; we can add floor insulation at extra cost.',
    },

    {
      id: 'customs',
      topic: 'delivery',
      q: 'Do you handle customs?',
      a: 'Yes, for everything we deliver. Customs clearance is included in the container prices and in the quote for a steel-frame house; for Box houses, shipping from China and customs are already in the house price.',
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
